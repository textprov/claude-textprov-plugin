"""Runs scripts/textprov_bridge.py as the hooks module does, against a real core.

The core comes from TEXTPROV_PYTHON, or from a sibling checkout at
../../textprov/python; the suite is skipped when neither holds textprov/chronicle.py.
"""

import json
import os
import subprocess
import sys
import tempfile
import unittest
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

    def test_core_errors_are_json_on_stderr(self):
        process = self.call({"operation": "inspect", "observation_id": "nope"})
        self.assertEqual(process.returncode, 1)
        self.assertIn("unknown observation", json.loads(process.stderr)["error"])
        process = self.call({"operation": "drop"})
        self.assertEqual(process.returncode, 1)
        self.assertIn("unknown operation", json.loads(process.stderr)["error"])

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
