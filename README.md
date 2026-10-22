---
README.md
---

# TextProv plugin for Claude Code

A prototype Claude Code plugin that records attribution observations in the shared
[TextProv](https://github.com/textprov/textprov) chronicle while you work, and gives you
`/textprov` to inspect them, match passages between them, and record explicit
attribution claims.

It is a hooks module (a "mod"), not a settings-hook script. It never rewrites files,
transcripts or tool inputs, and it never decides who wrote anything: host IDs correlate
events, matching proposes candidate passages, and only an explicit `/textprov claim`
assigns attribution. Everything else stays `Voice0`.

Status: prototype, step 3 and 5 of the
[plugin design's implementation sequence](https://github.com/textprov/textprov/blob/main/docs/development/plugin-prototype.md).
No file marking, no in-band export, no stored-row capture yet.

## Install

At the prompt of a terminal session:

```text
/plugin install textprov --marketplace textprov/claude-textprov-plugin
```

Answer `y` to add the marketplace, then pick a scope. From a shell instead:

```sh
claude plugin install textprov --marketplace textprov/claude-textprov-plugin
```

To run it from a checkout without installing:

```sh
claude --plugin-dir /path/to/claude-textprov-plugin
```

A plugin loaded this way reads its options from `pluginConfigs` in your user settings
(or a `--settings` value), under the plugin's name and an `options` key:

```json
{
  "pluginConfigs": {
    "textprov": {
      "options": { "textprov_python": "/path/to/textprov/python" }
    }
  }
}
```

## Setup

The plugin needs the TextProv Python core with its `chronicle` module. The published
`textprov` package on PyPI (0.1.3) does not include it yet, so point the plugin at a
checkout. When the plugin is enabled Claude Code asks for these options; they are also
rows in `/config`:

| Option | Meaning |
| --- | --- |
| `textprov_python` | The `python/` directory of a textprov checkout, the one that holds `textprov/chronicle.py`. Leave empty to use an installed `textprov` package. |
| `python` | Interpreter that runs the bridge. Default `python3`, needs 3.9 or newer; the core uses only the standard library. |
| `data_dir` | Where per-project chronicle databases live. Default `~/.claude/plugins/data/textprov`. |

Run `/textprov status` once: it reports the interpreter, whether the core and its
`chronicle` module were found, and the database path for this project.

Each project root gets its own SQLite database under
`<data_dir>/chronicles/<digest of the real root path>/chronicle.sqlite`, with a `root.txt`
beside it naming the root. Every chronicle call opens and closes the database in a
separate Python process, so separate hook processes and parallel tool calls share it
safely. At session start the plugin reads the session's last `capture_sequence` from the
database (read-only; `status` and this read never create it) and continues from there,
so a resumed session reuses no `prompt:N` key.

## What it records

| Event | Observation | Correlation |
| --- | --- | --- |
| A prompt you submit | `submission`, channel `user`, visibility `stored`, the text as it entered the turn | `prompt` (its own key, `prompt:N`); `submitted_during` names the turn that was running when you typed it |
| A block you pasted into a prompt | `pasted_block`, channel `user`, visibility `stored`: the block exactly as the host delivered it inside its `<pasted_content>` wrapper | `prompt` (the submission's key) and `paste` (the wrapper's id) |
| `Write` or `Edit` tool input | `tool_call`, channel `assistant`, visibility `model`: the written content or the new string | `tool_call` (the tool_use id), `path`, and the running `turn` |
| An `Edit`'s `old_string` | `tool_anchor`, channel `assistant`, visibility `model`: the text the assistant quoted from the file to place the edit | the same `tool_call`, `path` and `turn` |
| The tool's result | `tool_result`, channel `tool`; visibility `model` when the engine relays the model-facing text, `structured` when only the record is available; a denied call is recorded as `unobserved` | the same `tool_call` ID |
| The task given to a subagent | `agent_task`, channel `assistant`, visibility `model`: the Agent call's prompt, recorded in the parent's loop | `agent` (the started agent's id), `tool_call` (the Agent call) and the parent's running `turn` |
| The turn's final answer | `assistant_message`, channel `assistant`, visibility `display`; `partial` when the turn was aborted | `turn` ID, the `prompt` of the submission that started the turn, and `agent` for subagent turns |

A prompt typed while the session is idle has no turn ID when it is submitted. The
main-loop turn that starts with its text claims it: the answer and the tool calls made
during that turn carry that `turn` ID, and the answer also carries the prompt's `prompt`
key, so `inspect` on either side shows the other. The number in `prompt:N` is the
record's `capture_sequence`.

A prompt typed while a turn is running is queued by the host, which may deliver it into
that turn, start the next turn with it, or never deliver it (you can pull it back). The
plugin sees it at queueing and cannot tell which, so the submission never carries that
turn as its `turn`; it carries it as `submitted_during`, a fact about timing only. If
the host starts the next turn with the prompt's text, the answer joins it as usual.

Every capture in a subagent's loop (its Write and Edit calls, results and answer) sits
in the agent's own scope and carries the agent id as `agent`. The `agent_task` row in
the parent's scope carries the same id, so a reader of the database can join the two
sides; `inspect` does not show that join, since the core joins host IDs within one
scope only.

Slash commands and hidden prompts are not submissions. Other tools (Bash, MultiEdit,
NotebookEdit, MCP tools) are not observed yet; the gap is deliberate and visible, not
filled by guessing. An Edit's `replace_all` flag is not recorded either: the core's
record has no field for it, so one anchor observation stands for every occurrence. An
aborted turn that produced no text leaves no answer row.

Raw text goes into the core's bounded cache (1 MiB, one hour by default, a policy the
first opener of a database sets). Metadata, ID joins and claims persist. An observation
whose text has expired still inspects; it just cannot be matched or newly claimed.
`inspect` reports `content_expires_at`, so you can see how long a claim stays possible.

The status line shows `N observed`, then `N failed` and `N to retry` when there are
any; the host labels the line with the plugin's name. A failure (bridge not found, core
missing, a core refusal) is listed by `/textprov`, kept in the plugin's store for the
session, and never blocks the prompt or the tool. When the person interrupts a turn
(a "No" at a permission prompt does this), the host kills the bridge process of any
capture still running; that capture keeps its sequence number and is written at the
next event, or half a second later, whichever comes first. The chronicle treats a
repeated key with the same payload as the same event, so a retry never duplicates.

## Commands

```text
/textprov                      list what this process captured, and how many rows
                               the chronicle holds for the session
/textprov status               bridge, core and database state, plus the plugin's own:
                               adapter, loaded version, host version, session id,
                               sequence, counts, the last failure, the session's rows
/textprov inspect <id>         metadata, ID joins, claims and text expiry of one observation
/textprov match <src> <dst>    exact occurrences of the source block in the target
/textprov claim <id> <start> <end> <voice-id> [definition...]
```

IDs may be unambiguous prefixes of the IDs `/textprov` lists; an observation from
before a resume needs its full ID. `start` and `end` count Unicode scalars from 0, end
excluded, and must sit on grapheme boundaries; the core refuses anything else, and
`inspect` shows `scalar_length`. `voice-id` is a TextProv voice such as `Voice1`;
`Voice0` is unattributed text and needs no claim. The definition says who the voice is:

```text
/textprov claim 5410ad26 0 152 Voice1 the person typing at the prompt
```

A claim is recorded with basis `user_command`, voice context `claude:<session id>` and
the session's adapter string as its policy version. Matching returns every exact
occurrence and marks repeated passages `ambiguous`; nothing is selected automatically.

## Limits

- Capture ownership: do not enable this plugin together with another TextProv capture
  path (such as settings hooks that record prompts) for the same project; the design
  requires one owner per observation stream.
- Observations are listed from session state; after a restart or resume, `/textprov`
  lists only the new process's captures and says so, beside the session's row count
  from the database. Inspect older observations by full ID. Failures are kept per
  session in the plugin's store, so a resumed process still lists them.
- Matching and claiming need the cached text, which expires with the cache policy (one
  hour by default). A claim on an older observation fails with `content unavailable`.
- A paste is recorded as the host delivered it, wrapper included, and the pasted block
  on its own. Tracing a paste to its source needs a matcher that normalizes rendering
  and finds partial blocks; the core's exact matcher does not.
- Editing the plugin folder while a session runs from it (`--plugin-dir`) reloads the
  module in that session. The adapter string is pinned at the session's first load, so
  records and claims keep one adapter per session; `status` shows the loaded version
  beside it.
- The bridge runs one Python process per observation (roughly 100 ms each) and the
  hooks await it, so each prompt, Write, Edit and turn end pays that cost.
- The prototype does not verify host coverage: a passing test here is not evidence
  that a given Claude Code build delivers every event. Check `claude --debug` for
  skipped hooks.

## Development

```sh
claude plugin validate .                 # manifest, marketplace and hooks module
claude plugin test .                     # tests/register.test.ts against the engine
python3 -m unittest discover -s tests    # the bridge against ../textprov/python
```

The Python tests look for the core at `TEXTPROV_PYTHON` or `../textprov/python` and
skip when neither has `textprov/chronicle.py`.

Loading the plugin once from this folder (`claude --plugin-dir .`) makes Claude Code
write its type declarations to `.claude-plugin/types/`; after that `tsc -p .`
type-checks the module and tests. That folder is ignored by git.

Layout:

```text
.claude-plugin/plugin.json       manifest, userConfig
.claude-plugin/marketplace.json  this repository as a one-plugin marketplace
hooks/hooks.json                 names the hooks module
hooks/register.ts                the hooks: session.start, command.run, prompt.submit, turn.start, tool.call, agent.spawn, turn.complete
hooks/bridge.ts                  runs scripts/textprov_bridge.py and parses its answer
scripts/textprov_bridge.py       locates the core and the database; forwards one operation
types/index.d.ts                 the $.state contract
tests/                           engine tests (TypeScript) and bridge tests (Python)
```

## License

Apache-2.0, like the TextProv code packages.
