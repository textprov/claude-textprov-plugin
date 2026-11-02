"""Bridge between the Claude plugin's hooks module and the shared TextProv chronicle.

Reads one JSON request from stdin, runs it against this project's chronicle
database and prints ``{"result": ...}``. Errors are ``{"error": ...}`` on
stderr with exit code 1. The attribution logic lives in ``textprov.chronicle``;
this file only locates the core and the database, reports status, and answers
what the chronicle holds for a session.
"""

import argparse
import hashlib
import json
import os
import platform
import inspect
import re
import sys
from datetime import datetime, timezone
from pathlib import Path

OPERATIONS = ("observe", "match", "claim", "inspect", "transfer", "resolve", "export", "list_observations")
MIN_CORE = (0, 3, 1)
REQUIRED_PARAMETERS = {
    "observe": ("attributes",), "session": ("provider", "session_id"),
    "status": (), "inspect": ("cross_agent",),
    "match": ("policy", "partial", "min_match_chars", "cross_agent"),
    "claim": ("cross_agent", "supporting_ids"),
    "transfer": ("candidate_index", "source_claim_ids", "source_hash", "target_hash", "cross_agent"),
    "resolve": ("observation_id", "content_hash"),
    "export": ("observation_id", "content_hash", "voice_states", "allow_lossy"),
    "list_observations": ("provider", "session_id", "agent_id", "cross_agent", "limit", "before_id"),
}


def data_directory(given):
    if given:
        return Path(given).expanduser()
    return Path.home() / ".claude" / "plugins" / "data" / "textprov"


def database_path(data_dir, root):
    """One database per project root, keyed by the real path's digest."""
    real = os.path.realpath(root)
    digest = hashlib.sha256(real.encode("utf-8")).hexdigest()[:16]
    folder = data_dir / "chronicles" / digest
    folder.mkdir(parents=True, exist_ok=True)
    marker = folder / "root.txt"
    if not marker.exists():
        marker.write_text(real + "\n", encoding="utf-8")
    return folder / "chronicle.sqlite"


def load_core(checkout):
    if checkout:
        sys.path.insert(0, str(Path(checkout).expanduser()))
    import textprov  # noqa: WPS433 (resolved at run time on purpose)

    try:
        from textprov import chronicle
    except ImportError as error:
        raise RuntimeError(
            "textprov at %s has no chronicle module (%s); set textprov_python to a "
            "checkout's python/ directory that has textprov/chronicle.py" % (textprov.__file__, error)
        )
    version = getattr(textprov, "__version__", None)
    parsed = re.fullmatch(r"(\d+)\.(\d+)\.(\d+)(?:\+[^\s]+)?", version or "")
    if parsed is None or tuple(map(int, parsed.groups())) < MIN_CORE:
        raise RuntimeError("TextProv core 0.3.1 or newer is required; loaded %s from %s" %
                           (str(version)[:80], textprov.__file__))
    for method, parameters in REQUIRED_PARAMETERS.items():
        implementation = getattr(getattr(chronicle, "Chronicle", None), method, None)
        if not callable(implementation) or any(
                name not in inspect.signature(implementation).parameters for name in parameters):
            raise RuntimeError("TextProv core has an incompatible Chronicle.%s API; core 0.3.1 or newer is required" % method)
    return textprov, chronicle


def status(args, database):
    report = {
        "python": sys.executable,
        "python_version": platform.python_version(),
        "root": os.path.realpath(args.root),
        "data_dir": str(data_directory(args.data_dir)),
        "database": str(database),
        "database_exists": database.exists(),
        "textprov_python": args.textprov_python or None,
        "core": None,
    }
    try:
        textprov, chronicle = load_core(args.textprov_python)
    except Exception as error:  # reported, not raised: status must answer
        report["core"] = {"available": False, "error": "%s: %s" % (type(error).__name__, error)}
        return report
    report["core"] = {
        "available": True,
        "module": textprov.__file__,
        "version": getattr(textprov, "__version__", None),
        "minimum_version": "0.3.1",
    }
    if database.exists():
        with chronicle.Chronicle(database) as instance:
            state = instance.status()
            report["counts"] = {"observations": state["observation_count"],
                                "claims": state["claim_count"], "cache": state["cached_observation_count"]}
            report["cache_policy"] = {"max_bytes": state["max_bytes"], "ttl_seconds": state["ttl_seconds"]}
            report["cached_bytes"] = state["cached_bytes"]
    return report


def session_state(database, chronicle, provider, session_id):
    """What the chronicle holds for one session across its agents: its row count and highest capture_sequence.

    Asking never creates the database. The hooks module
    continues its counter from ``last_sequence`` when a resumed session loads it
    again, and reports ``observations`` beside its own per-process count.
    """
    if not database.exists():
        return {"observations": 0, "last_sequence": 0}
    with chronicle.Chronicle(database) as instance:
        state = instance.session(provider, session_id)
    return {"observations": state["observation_count"], "last_sequence": state["max_capture_sequence"] or 0}


def inspection(instance, **request):
    """Keep the command's ISO 8601 expiry presentation over the public core API."""
    report = instance.inspect(**request)
    expires = report["content_expires_at"]
    report["content_expires_at"] = None if expires is None else (
        datetime.fromtimestamp(expires, timezone.utc).isoformat(timespec="seconds"))
    return report


def marking_mode(value):
    """Plugin modes are adapter policy, not keyword arguments to the core."""
    if value not in ("prose", "all", "none", "off", "remove"):
        raise ValueError("marking mode must be prose, all, none, off or remove")
    return "none" if value == "off" else value


def mark_output(textprov, operation, request):
    """Translate document-only plugin modes to the core's text APIs.

    Core chat scope 'prose' classifies chat prose; plugin mode 'prose' leaves
    chat unchanged and classifies documents instead. Keep that distinction at
    this boundary, including for older supported cores.
    """
    function = getattr(textprov, operation, None)
    if not callable(function):
        raise ValueError("matching local core with automatic marking APIs is required")
    if operation in ("mark_chat", "mark_chat_parts"):
        mode = marking_mode(request.get("scope", "prose"))
        request["scope"] = "all" if mode == "all" else "off"
        result = function(**request)
        if mode == "remove":
            return ([textprov.strip_marks(part) for part in result]
                    if operation == "mark_chat_parts" else textprov.strip_marks(result))
        return result
    if operation in ("mark_document", "mark_document_edit"):
        mode = marking_mode(request.pop("mode", "prose"))
        if mode in ("none", "remove"):
            text = request["text" if operation == "mark_document" else "new_text"]
            if not isinstance(text, str):
                raise ValueError("text must be a string")
            return textprov.strip_marks(text) if mode == "remove" else text
    return function(**request)


def main(argv=None):
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--root", required=True, help="project root the chronicle belongs to")
    parser.add_argument("--data-dir", default=None, help="where chronicle databases are kept")
    parser.add_argument("--textprov-python", default=None,
                        help="directory holding the textprov package (a checkout's python/)")
    args = parser.parse_args(argv)
    try:
        request = json.load(sys.stdin)
        if not isinstance(request, dict):
            raise ValueError("request must be an object")
        operation = request.pop("operation", None)
        if operation == "prepare_edit":
            mode = marking_mode(request.get("marking_mode", "prose"))
            if mode == "none":
                # Disabled mode has the same literal tool-input semantics as
                # Write: no anchor translation, source carry or core loading.
                result = {name: request[name] for name in ("old_string", "new_string")}
                if any(not isinstance(value, str) for value in result.values()):
                    raise ValueError("edit strings must be strings")
                print(json.dumps({"result": result}, ensure_ascii=False))
                return 0
            textprov, _ = load_core(args.textprov_python)
            from textprov.editing import rewrite_edit
            # A protected profile suppresses new labels while retaining the
            # core's mark-insensitive anchors and whole-grapheme safeguards.
            options = {"profile": lambda text: [True] * len(text)} if mode == "remove" else {}
            prepared = rewrite_edit(request["raw"], request["old_string"], request["new_string"],
                                    replace_all=request.get("replace_all", False), shingles=set(),
                                    preserve_new_marks=True, **options)
            if prepared is None:
                raise ValueError("document edit anchor not found")
            replacement = textprov.strip_marks(prepared[1]) if mode == "remove" else prepared[1]
            print(json.dumps({"result": {"old_string": prepared[0], "new_string": replacement}}, ensure_ascii=False))
            return 0
        if operation in ("mark_chat", "mark_document", "mark_document_edit", "strip_marks", "mark_chat_parts"):
            textprov, _ = load_core(args.textprov_python)
            print(json.dumps({"result": mark_output(textprov, operation, request)}, ensure_ascii=False))
            return 0
        database = database_path(data_directory(args.data_dir), args.root)
        if operation == "status":
            result = status(args, database)
        elif operation == "session":
            _, chronicle = load_core(args.textprov_python)
            result = session_state(database, chronicle, request["provider"], request["session_id"])
        elif operation in OPERATIONS:
            _, chronicle = load_core(args.textprov_python)
            if operation == "list_observations" and not database.exists():
                result = {"observations": [], "next_before_id": None}
            else:
                with chronicle.Chronicle(database) as instance:
                    result = inspection(instance, **request) if operation == "inspect" else getattr(instance, operation)(**request)
        else:
            raise ValueError("unknown operation: %r" % (operation,))
        print(json.dumps({"result": result}, ensure_ascii=False, sort_keys=True))
        return 0
    except ValueError as error:  # a refusal from the core or a bad request: the reason is the message
        print(json.dumps({"error": str(error)}), file=sys.stderr)
        return 1
    except Exception as error:  # anything else names its class, since the message alone may not say what broke
        print(json.dumps({"error": "%s: %s" % (type(error).__name__, error)}), file=sys.stderr)
        return 1


if __name__ == "__main__":
    sys.exit(main())
