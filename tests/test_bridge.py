"""Runs scripts/textprov_bridge.py as the hooks module does, against a real core.

The core comes from TEXTPROV_PYTHON, or from a sibling checkout at
../../textprov/python; the suite is skipped when neither holds textprov/chronicle.py.
"""

import hashlib
import json
import os
import subprocess
import sys
import tempfile
import unittest
import uuid
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timezone
from pathlib import Path

HERE = Path(__file__).resolve().parent
BRIDGE = HERE.parent / "scripts" / "textprov_bridge.py"
CHECKOUT = Path(os.environ.get("TEXTPROV_PYTHON") or HERE.parent.parent / "textprov" / "python")


def available():
    return (CHECKOUT / "textprov" / "chronicle.py").is_file()


@unittest.skipUnless(available(), "no textprov checkout with chronicle.py at %s" % CHECKOUT)
class BridgeTest(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.data = Path(self.temp.name) / "data"
        self.root = Path(self.temp.name) / "project"
        self.root.mkdir()

    def tearDown(self):
        self.temp.cleanup()

    def call(self, request, **extra):
        argv = [sys.executable, str(BRIDGE), "--root", str(self.root), "--data-dir", str(self.data),
                "--textprov-python", str(CHECKOUT)]
        process = subprocess.run(argv, input=json.dumps(request), text=True, capture_output=True, **extra)
        return process

    def ok(self, request):
        process = self.call(request)
        self.assertEqual(process.returncode, 0, process.stderr)
        return json.loads(process.stdout)["result"]

    def common(self, key, text):
        return dict(operation="observe", provider="claude", adapter="test", session_id="s1",
                    delivery_key=key, event_kind="submission", channel="user", visibility="stored",
                    text=text, host_ids={}, agent_id=None, host_version="t", capture_sequence=1,
                    completeness="complete")

    def test_status_before_and_after_a_database_exists(self):
        before = self.ok({"operation": "status"})
        self.assertTrue(before["core"]["available"], before["core"])
        self.assertFalse(before["database_exists"])
        self.ok(self.common("k1", "A passage"))
        after = self.ok({"operation": "status"})
        self.assertTrue(after["database_exists"])
        self.assertEqual(after["counts"]["observations"], 1)
        self.assertEqual(after["counts"]["claims"], 0)

    def test_database_is_keyed_by_project_root(self):
        status = self.ok({"operation": "status"})
        folder = Path(status["database"]).parent
        self.assertTrue(folder.is_relative_to(self.data / "chronicles"))
        self.assertEqual((folder / "root.txt").read_text().strip(), os.path.realpath(self.root))

    def test_observe_match_claim_round_trip(self):
        source = self.ok(self.common("src", "Keep the original wording."))
        target = self.ok(dict(self.common("dst", "Draft: Keep the original wording.\nAgain: Keep the original wording."),
                              event_kind="tool_call", channel="assistant", visibility="model"))
        self.assertEqual(self.ok(self.common("src", "Keep the original wording.")), source)
        matched = self.ok({"operation": "match", "source_id": source, "target_id": target})
        self.assertEqual(matched["status"], "ambiguous")
        self.assertEqual([c["target_range"] for c in matched["candidates"]], [[7, 33], [41, 67]])
        self.assertFalse(any(c["selected"] for c in matched["candidates"]))
        info = self.ok({"operation": "inspect", "observation_id": target})
        self.assertEqual(info["claims"], [])
        claim = self.ok({"operation": "claim", "observation_id": target, "start": 7, "end": 33,
                         "content_hash": info["content_hash"], "voice_context": "claude:s1",
                         "voice_id": "example-author", "voice_definition": "fictional",
                         "basis": "user_command", "policy_version": "test", "supporting_ids": [source]})
        self.assertEqual(len(self.ok({"operation": "inspect", "observation_id": target})["claims"]), 1)
        self.assertEqual(self.ok({"operation": "inspect", "observation_id": target})["claims"][0]["claim_id"], claim)

    def test_session_state_counts_a_session_without_creating_the_database(self):
        empty = {"observations": 0, "last_sequence": 0}
        self.assertEqual(self.ok({"operation": "session", "provider": "claude", "session_id": "s1"}), empty)
        self.assertFalse(self.ok({"operation": "status"})["database_exists"])
        self.ok(dict(self.common("prompt:1", "first"), capture_sequence=1))
        self.ok(dict(self.common("turn:t1:answer", "answer"), event_kind="assistant_message",
                     channel="assistant", visibility="display", capture_sequence=2, agent_id="sub-1"))
        self.ok(dict(self.common("prompt:1", "other session"), session_id="s2", capture_sequence=9))
        self.assertEqual(self.ok({"operation": "session", "provider": "claude", "session_id": "s1"}),
                         {"observations": 2, "last_sequence": 2})
        self.assertEqual(self.ok({"operation": "session", "provider": "claude", "session_id": "s3"}), empty)

    def test_notification_shaped_submission_retains_its_hash_and_unknown_voice(self):
        text = '<task-notification>\n<summary>Quoted text 🧪</summary>\n</task-notification>'
        for origin in ("composer", "task-notification", None):
            with self.subTest(origin=origin):
                observation = self.ok(dict(self.common("notification-shaped-%s" % origin, text),
                                           attributes={"prompt_origin": origin}))
                info = self.ok({"operation": "inspect", "observation_id": observation})
                self.assertEqual(info["attributes"], {"prompt_origin": origin})
                self.assertEqual(info["content_hash"], hashlib.sha256(text.encode("utf-8")).hexdigest())
                self.assertEqual(info["scalar_length"], len(text))
                self.assertEqual(info["claims"], [])
                resolved = self.ok({"operation": "resolve", "observation_id": observation,
                                    "content_hash": info["content_hash"]})
                self.assertEqual([entry["range"] for entry in resolved["ranges"]], [[0, len(text)]])
                self.assertIsNone(resolved["ranges"][0]["voice_id"])

    def test_inspect_says_when_the_text_expires(self):
        observation = self.ok(self.common("k1", "A passage"))
        info = self.ok({"operation": "inspect", "observation_id": observation})
        self.assertTrue(info["content_available"])
        expires = datetime.fromisoformat(info["content_expires_at"])
        captured = datetime.fromtimestamp(info["captured_at"], timezone.utc)
        self.assertAlmostEqual((expires - captured).total_seconds(), 3600, delta=1)

    def test_attributes_and_explicit_cross_agent_scope_round_trip(self):
        source = self.ok(dict(self.common("source", "A shared passage"), host_ids={"agent": "child"}))
        target = self.ok(dict(self.common("target", "A shared passage"), agent_id="child",
                              host_ids={"agent": "child"}, attributes={"replace_all": True}))
        info = self.ok({"operation": "inspect", "observation_id": target})
        self.assertEqual(info["attributes"], {"replace_all": True})
        self.assertEqual(info["event_relationships"], [])
        joined = self.ok({"operation": "inspect", "observation_id": target, "cross_agent": True})
        self.assertEqual(joined["event_relationships"][0]["observation_id"], source)
        refused = self.call({"operation": "match", "source_id": source, "target_id": target})
        self.assertEqual(refused.returncode, 1)
        result = self.ok({"operation": "match", "source_id": source, "target_id": target, "cross_agent": True})
        self.assertEqual(result["status"], "searched")
        claim = dict(operation="claim", observation_id=target, start=0, end=16,
                     content_hash=info["content_hash"], voice_context="claude:s1", voice_id="Voice1",
                     voice_definition="explicit", basis="user_command", policy_version="test", supporting_ids=[source])
        self.assertEqual(self.call(claim).returncode, 1)
        self.ok(dict(claim, cross_agent=True))
        foreign = self.ok(dict(self.common("foreign", "A shared passage"), session_id="s2"))
        self.assertEqual(self.call(dict(claim, supporting_ids=[foreign], cross_agent=True)).returncode, 1)
        self.assertEqual(self.call({"operation": "match", "source_id": source,
                                    "target_id": foreign, "cross_agent": True}).returncode, 1)

    def test_normalized_and_partial_comparison_remains_a_candidate(self):
        source = self.ok(self.common("source", "  Alpha\r\n  Beta\r\n"))
        target = self.ok(self.common("target", "Alpha\nBeta\n"))
        self.assertEqual(self.ok({"operation": "match", "source_id": source, "target_id": target})["candidates"], [])
        matched = self.ok({"operation": "match", "source_id": source, "target_id": target,
                           "policy": "common-indent-v1"})
        self.assertEqual(matched["status"], "searched")
        excerpt = self.ok(self.common("excerpt", "Beta"))
        partial = self.ok({"operation": "match", "source_id": source, "target_id": excerpt,
                           "policy": "common-indent-v1", "partial": True, "min_match_chars": 4})
        self.assertTrue(partial["candidates"])
        self.assertFalse(any(one["selected"] for one in partial["candidates"]))
        self.assertEqual(self.ok({"operation": "inspect", "observation_id": excerpt})["claims"], [])
        for invalid in ({"policy": "invented"}, {"partial": "false"}, {"min_match_chars": 0}):
            self.assertEqual(self.call(dict(operation="match", source_id=source, target_id=target, **invalid)).returncode, 1)

    def test_public_core_apis_supply_status_session_and_expiry(self):
        stub = Path(self.temp.name) / "public-api"
        package = stub / "textprov"
        package.mkdir(parents=True)
        (package / "__init__.py").write_text("__version__ = '0.1.5'\n")
        (package / "chronicle.py").write_text('''
class Chronicle:
    def __init__(self, path): pass
    def __enter__(self): return self
    def __exit__(self, *args): pass
    def observe(self, *, attributes=None): pass
    def status(self):
        return dict(observation_count=2, claim_count=1, cached_observation_count=1,
                    cached_bytes=12, max_bytes=100, ttl_seconds=60)
    def session(self, provider, session_id):
        return dict(observation_count=2, max_capture_sequence=7)
    def inspect(self, observation_id, *, cross_agent=False):
        return dict(content_expires_at=3600, cross_agent=cross_agent)
    def match(self, *, policy=None, partial=False, min_match_chars=16, cross_agent=False): pass
    def claim(self, *, cross_agent=False, supporting_ids=None): pass
    def transfer(self, *, candidate_index, source_claim_ids, source_hash, target_hash, cross_agent=False): pass
    def resolve(self, observation_id, *, content_hash=None): pass
    def export(self, observation_id, *, content_hash, voice_states, allow_lossy=False): pass
    def list_observations(self, provider, session_id, *, agent_id=None, cross_agent=False, limit=100, before_id=None): pass
''')
        database = Path(self.ok({"operation": "status"})["database"])
        database.touch()

        def fake(request):
            argv = [sys.executable, str(BRIDGE), "--root", str(self.root), "--data-dir", str(self.data),
                    "--textprov-python", str(stub)]
            process = subprocess.run(argv, input=json.dumps(request), text=True, capture_output=True)
            self.assertEqual(process.returncode, 0, process.stderr)
            return json.loads(process.stdout)["result"]

        state = fake({"operation": "status"})
        self.assertEqual(state["counts"], {"observations": 2, "claims": 1, "cache": 1})
        self.assertEqual(state["cache_policy"], {"max_bytes": 100, "ttl_seconds": 60})
        self.assertEqual(fake({"operation": "session", "provider": "claude", "session_id": "s1"}),
                         {"observations": 2, "last_sequence": 7})
        info = fake({"operation": "inspect", "observation_id": "id", "cross_agent": True})
        self.assertEqual(info["content_expires_at"], "1970-01-01T01:00:00+00:00")
        self.assertTrue(info["cross_agent"])

    def test_incompatible_core_version_and_api_are_reported(self):
        stub = Path(self.temp.name) / "incompatible"
        package = stub / "textprov"
        package.mkdir(parents=True)
        (package / "chronicle.py").write_text("class Chronicle: pass\n")
        for version, message in (("0.1.4", "0.1.5 or newer is required"),
                                 ("0.1.5", "incompatible Chronicle.observe API")):
            (package / "__init__.py").write_text("__version__ = %r\n" % version)
            argv = [sys.executable, "-B", str(BRIDGE), "--root", str(self.root), "--data-dir", str(self.data),
                    "--textprov-python", str(stub)]
            # Avoid a same-size __init__ timestamp cache between the two versions.
            for cached in package.glob("__pycache__/*"):
                cached.unlink()
            process = subprocess.run(argv, input=json.dumps({"operation": "status"}), text=True, capture_output=True)
            self.assertEqual(process.returncode, 0, process.stderr)
            core = json.loads(process.stdout)["result"]["core"]
            self.assertFalse(core["available"])
            self.assertIn(message, core["error"])


    def test_selected_multivoice_transfer_resolution_and_lossy_export(self):
        source = self.ok(self.common("source", "Alice Bob"))
        target = self.ok(self.common("target", "Alice Bob / Alice Bob"))
        source_info = self.ok({"operation": "inspect", "observation_id": source})
        target_info = self.ok({"operation": "inspect", "observation_id": target})
        claims = []
        for start, end, voice in ((0, 5, "Voice1"), (6, 9, "Voice2")):
            claims.append(self.ok(dict(operation="claim", observation_id=source, start=start, end=end,
                                      content_hash=source_info["content_hash"], voice_context="supplied",
                                      voice_id=voice, voice_definition=voice, basis="user_command", policy_version="test")))
        matched = self.ok(dict(operation="match", source_id=source, target_id=target))
        self.assertEqual(matched["status"], "ambiguous")
        self.assertEqual(len(matched["candidates"]), 2)
        self.assertEqual(self.ok(dict(operation="inspect", observation_id=target))["claims"], [])
        request = dict(operation="transfer", source_id=source, target_id=target, candidate_index=1,
                       source_claim_ids=claims, source_hash=source_info["content_hash"], target_hash=target_info["content_hash"])
        for invalid in (dict(request, source_claim_ids=[]), dict(request, candidate_index=2),
                        dict(request, source_hash="wrong")):
            self.assertEqual(self.call(invalid).returncode, 1)
        evidence = self.ok(request)
        self.assertEqual(evidence["candidate"]["target_range"], [12, 21])
        self.assertEqual(self.ok(request), evidence)
        resolved = self.ok(dict(operation="resolve", observation_id=target, content_hash=target_info["content_hash"]))
        self.assertEqual([entry["range"] for entry in resolved["ranges"]], [[0, 12], [12, 17], [17, 18], [18, 21]])
        self.assertIsNone(resolved["ranges"][0]["voice_id"])
        exported = dict(operation="export", observation_id=target, content_hash=target_info["content_hash"],
                        voice_states=[dict(voice_context="supplied", voice_id="Voice1", state="human"),
                                      dict(voice_context="supplied", voice_id="Voice2", state="ai")])
        self.assertEqual(self.call(exported).returncode, 1)
        report = self.ok(dict(exported, allow_lossy=True))
        self.assertTrue(report["lossy"])
        self.assertTrue(report["inserted_at"])
        self.assertTrue(report["text"].startswith("Alice Bob / "))
        self.assertEqual(report["source_content_hash"], target_info["content_hash"])
        self.ok(dict(operation="claim", observation_id=target, start=12, end=17,
                     content_hash=target_info["content_hash"], voice_context="supplied", voice_id="Voice3",
                     voice_definition="conflicting", basis="user_command", policy_version="test"))
        self.assertEqual(self.call(dict(operation="resolve", observation_id=target)).returncode, 1)
        self.assertEqual(self.call(dict(exported, allow_lossy=True)).returncode, 1)

    def test_session_listing_pages_full_ids_with_explicit_agent_scope(self):
        listing = dict(operation="list_observations", provider="claude", session_id="s1", limit=1)
        self.assertEqual(self.ok(listing), {"observations": [], "next_before_id": None})
        self.assertFalse(self.ok({"operation": "status"})["database_exists"])
        first = self.ok(self.common("first", "first"))
        child = self.ok(dict(self.common("child", "child"), agent_id="child"))
        last = self.ok(self.common("last", "last"))
        self.ok(dict(self.common("other", "other"), session_id="s2"))
        page = self.ok(listing)
        self.assertEqual(page["observations"][0]["observation_id"], last)
        self.assertEqual(page["next_before_id"], last)
        older = self.ok(dict(listing, before_id=last))
        self.assertEqual(older["observations"][0]["observation_id"], first)
        joined = self.ok(dict(listing, before_id=last, cross_agent=True))
        self.assertEqual(joined["observations"][0]["observation_id"], child)
        self.assertEqual(self.call(dict(listing, before_id=child)).returncode, 1)

    def test_concurrent_process_namespaces_preserve_identical_and_different_submissions(self):
        self.ok(self.common("seed", "seed database"))
        namespaces = [str(uuid.uuid4()), str(uuid.uuid4())]
        requests = [self.common("prompt:%s:1" % namespace, "identical") for namespace in namespaces]
        requests += [self.common("prompt:%s:2" % namespace, text)
                     for namespace, text in zip(namespaces, ("first writer", "second writer"))]
        with ThreadPoolExecutor(max_workers=4) as pool:
            ids = list(pool.map(self.ok, requests))
        self.assertEqual(len(set(ids)), 4)
        self.assertEqual([self.ok(request) for request in requests], ids)
        self.assertEqual(self.ok(dict(operation="session", provider="claude", session_id="s1"))["observations"], 5)

    def test_core_refusals_are_their_message_alone(self):
        process = self.call({"operation": "inspect", "observation_id": "nope"})
        self.assertEqual(process.returncode, 1)
        self.assertEqual(json.loads(process.stderr)["error"], "unknown observation: nope")
        process = self.call({"operation": "drop"})
        self.assertEqual(process.returncode, 1)
        self.assertEqual(json.loads(process.stderr)["error"], "unknown operation: 'drop'")
        process = self.call({"operation": "session", "provider": "claude"})
        self.assertEqual(process.returncode, 1)
        self.assertEqual(json.loads(process.stderr)["error"], "KeyError: 'session_id'")

    def test_missing_chronicle_is_reported_by_status(self):
        stub = Path(self.temp.name) / "stub"
        (stub / "textprov").mkdir(parents=True)
        (stub / "textprov" / "__init__.py").write_text("__version__ = '0.0.0-stub'\n")
        argv = [sys.executable, str(BRIDGE), "--root", str(self.root), "--data-dir", str(self.data),
                "--textprov-python", str(stub)]
        process = subprocess.run(argv, input=json.dumps({"operation": "status"}), text=True, capture_output=True)
        self.assertEqual(process.returncode, 0, process.stderr)
        core = json.loads(process.stdout)["result"]["core"]
        self.assertFalse(core["available"])
        self.assertIn("no chronicle module", core["error"])


if __name__ == "__main__":
    unittest.main()
