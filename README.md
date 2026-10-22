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
| A prompt you submit | `submission`, channel `user`, visibility `stored`, the text as it entered the turn | `prompt` (its own key, `prompt:N`), and the `turn` ID when the prompt joined a running turn |
| `Write` or `Edit` tool input | `tool_call`, channel `assistant`, visibility `model`: the written content or the new string | `tool_call` (the tool_use id), `path`, and the running `turn` |
| An `Edit`'s `old_string` | `tool_anchor`, channel `assistant`, visibility `model`: the text the assistant quoted from the file to place the edit | the same `tool_call`, `path` and `turn` |
| The tool's result | `tool_result`, channel `tool`; visibility `model` when the engine relays the model-facing text, `structured` when only the record is available; a denied call is recorded as `unobserved` | the same `tool_call` ID |
| The turn's final answer | `assistant_message`, channel `assistant`, visibility `display`; `partial` when the turn was aborted | `turn` ID, the `prompt` of the submission that started the turn, and the agent ID for subagent turns |

A prompt typed while the session is idle has no turn ID when it is submitted. The
main-loop turn that starts with its text claims it: the answer and the tool calls made
during that turn carry that `turn` ID, and the answer also carries the prompt's `prompt`
key, so `inspect` on either side shows the other. The submission itself carries a `turn`
ID only when the host had one at submission time. The number in `prompt:N` is the
record's `capture_sequence`.

Slash commands and hidden prompts are not submissions. Other tools (Bash, MultiEdit,
NotebookEdit, MCP tools) are not observed yet; the gap is deliberate and visible, not
filled by guessing. An Edit's `replace_all` flag is not recorded either: the core's
record has no field for it, so one anchor observation stands for every occurrence.

Raw text goes into the core's bounded cache (1 MiB, one hour by default, a policy the
first opener of a database sets). Metadata, ID joins and claims persist. An observation
whose text has expired still inspects; it just cannot be matched or newly claimed.

The status line shows `textprov: N observed`, or the count of capture failures. A
failure (bridge not found, core missing, a core refusal) is listed by `/textprov` and
never blocks the prompt or the tool.

## Commands

```text
/textprov                      list this session's observations
/textprov status               bridge, core and database state, plus the plugin's own:
                               adapter, host version, session id, sequence, counts
/textprov inspect <id>         metadata, ID joins and claims of one observation
/textprov match <src> <dst>    exact occurrences of the source block in the target
/textprov claim <id> <start> <end> <voice> [definition...]
```

IDs may be unambiguous prefixes of the IDs `/textprov` lists. `start` and `end` are
half-open Unicode scalar offsets into the observation's text and must sit on grapheme
boundaries; the core refuses anything else. A claim is recorded with basis
`user_command`, voice context `claude:<session id>` and policy version
`claude-textprov-plugin/0.1.1`. Matching returns every exact occurrence and marks
repeated passages `ambiguous`; nothing is selected automatically.

## Limits

- Capture ownership: do not enable this plugin together with another TextProv capture
  path (such as settings hooks that record prompts) for the same project; the design
  requires one owner per observation stream.
- Observations are listed from session state; after a restart or resume, `/textprov`
  lists only the new process's captures, while the database keeps everything. Inspect
  older observations by full ID.
- Matching and claiming need the cached text, which expires with the cache policy (one
  hour by default). A claim on an older observation fails with `content unavailable`.
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
hooks/register.ts                the hooks: session.start, command.run, prompt.submit, turn.start, tool.call, turn.complete
hooks/bridge.ts                  runs scripts/textprov_bridge.py and parses its answer
scripts/textprov_bridge.py       locates the core and the database; forwards one operation
types/index.d.ts                 the $.state contract
tests/                           engine tests (TypeScript) and bridge tests (Python)
```

## License

Apache-2.0, like the TextProv code packages.
