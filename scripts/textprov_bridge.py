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
import sqlite3
import sys
from datetime import datetime, timezone
from pathlib import Path

OPERATIONS = ("observe", "match", "claim")


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
    }
    if database.exists():
        with chronicle.Chronicle(database) as instance:
            counts = {}
            for table in ("observations", "claims", "cache"):
                counts[table] = instance.db.execute("SELECT COUNT(*) FROM " + table).fetchone()[0]
            report["counts"] = counts
            report["cache_policy"] = {"max_bytes": instance.max_bytes, "ttl_seconds": instance.ttl}
    return report


def session_state(database, provider, session_id):
    """What the chronicle holds for one session across its agents: its row count and highest capture_sequence.

    Read-only on purpose: asking never creates the database. The hooks module
    continues its counter from ``last_sequence`` when a resumed session loads it
    again, and reports ``observations`` beside its own per-process count.
    """
    if not database.exists():
        return {"observations": 0, "last_sequence": 0}
    db = sqlite3.connect("file:%s?mode=ro" % database, uri=True)
    try:
        row = db.execute("""SELECT COUNT(*), MAX(json_extract(record, '$.capture_sequence')) FROM observations
            WHERE json_extract(record, '$.provider') = ? AND json_extract(record, '$.session_id') = ?""",
                         (provider, session_id)).fetchone()
    finally:
        db.close()
    return {"observations": int(row[0]), "last_sequence": int(row[1] or 0)}


def inspect(instance, observation_id):
    """The core's inspection plus when its cached text expires, so a person knows how long a claim stays possible."""
    report = instance.inspect(observation_id)
    row = instance.db.execute("SELECT expires FROM cache WHERE observation_id = ?", (observation_id,)).fetchone()
    report["content_expires_at"] = None if row is None else (
        datetime.fromtimestamp(row[0], timezone.utc).isoformat(timespec="seconds"))
    return report


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
        database = database_path(data_directory(args.data_dir), args.root)
        if operation == "status":
            result = status(args, database)
        elif operation == "session":
            result = session_state(database, request["provider"], request["session_id"])
        elif operation == "inspect":
            _, chronicle = load_core(args.textprov_python)
            with chronicle.Chronicle(database) as instance:
                result = inspect(instance, request["observation_id"])
        elif operation in OPERATIONS:
            _, chronicle = load_core(args.textprov_python)
            with chronicle.Chronicle(database) as instance:
                result = getattr(instance, operation)(**request)
        else:
            raise ValueError("unknown operation: %r" % (operation,))
        print(json.dumps({"result": result}, ensure_ascii=False, sort_keys=True))
        return 0
    except Exception as error:  # every failure is one JSON line for the hooks module
        print(json.dumps({"error": "%s: %s" % (type(error).__name__, error)}), file=sys.stderr)
        return 1


if __name__ == "__main__":
    sys.exit(main())
