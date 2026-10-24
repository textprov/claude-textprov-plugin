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

Version: 0.1.2 (local development). Status: prototype, step 3 and 5 of the
[plugin design's implementation sequence](https://github.com/textprov/textprov/blob/main/docs/development/plugin-prototype.md).
Explicit experimental export returns classification text and its companion report.
Stored-row capture remains outside this prototype.

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

The plugin requires TextProv Python core 0.1.5 or newer with the public chronicle
APIs for status, sessions, attributes, comparison, claim transfer and export.
This development version is local; point `textprov_python` at the matching core
checkout, or use a locally installed compatible core. Status reports the loaded
module and version and explains an incompatible core. When the plugin is enabled
Claude Code asks for these options; they are also rows in `/config`:

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
transactionally. Each process establishes a cryptographic UUID capture namespace,
retained across hot reloads. Prompt keys are `prompt:<namespace>:N`, and retries keep
the exact key and payload. Separate processes resuming the same native session cannot
collapse identical prompts or collide on different prompts just because their counters
start at the same value. If a namespace cannot be established, the plugin reports the
capture failure and leaves the prompt uncaptured; it does not invent a reused key.

At session start the plugin also reads the session's last `capture_sequence` from the
database (`status` and this query never create it) for best-effort count continuity.
This is a snapshot, not an atomic allocator: sequences are process-local observation
metadata, can overlap across simultaneous writers, and imply no global causal order.
Status reports the process's `capture_namespace` separately from its native session ID.

## What it records

| Event | Observation | Correlation |
| --- | --- | --- |
| A prompt you submit | `submission`, channel `user`, visibility `stored`, the text as it entered the turn | `prompt` (its own key, `prompt:<namespace>:N`); `submitted_during` names the turn that was running when you typed it |
| A block you pasted into a prompt | `pasted_block`, channel `user`, visibility `stored`: the block exactly as the host delivered it inside its `<pasted_content>` wrapper | `prompt` (the submission's key) and `paste` (the wrapper's id) |
| `Write` or `Edit` tool input | `tool_call`, channel `assistant`, visibility `model`: the written content or the new string | `tool_call` (the tool_use id), `path`, and the running `turn` |
| An `Edit`'s `old_string` | `tool_anchor`, channel `assistant`, visibility `model`: the text the assistant quoted from the file to place the edit | the same `tool_call`, `path` and `turn` |
| The tool's result | `tool_result`, channel `tool`; visibility `model` when the engine relays the model-facing text, `structured` when only the record is available; a denied call is recorded as `unobserved` | the same `tool_call` ID |
| The task given to a subagent | `agent_task`, channel `assistant`, visibility `model`: the Agent call's prompt, recorded in the parent's loop | `agent` (the started agent's id), `tool_call` (the Agent call) and the parent's running `turn` |
| The turn's final answer | `assistant_message`, channel `assistant`, visibility `display`; `partial` when the turn was aborted | `turn` ID, the `prompt` of the submission that started the turn, and `agent` for subagent turns |

A prompt typed while the session is idle has no turn ID when it is submitted. The
main-loop turn that starts with its text claims it: the answer and the tool calls made
during that turn carry that `turn` ID, and the answer also carries the prompt's `prompt`
key, so `inspect` on either side shows the other. The final number in `prompt:<namespace>:N` is
that process's `capture_sequence`; the namespace provides event identity.

A prompt typed while a turn is running is queued by the host, which may deliver it into
that turn, start the next turn with it, or never deliver it (you can pull it back). The
plugin sees it at queueing and cannot tell which, so the submission never carries that
turn as its `turn`; it carries it as `submitted_during`, a fact about timing only. If
the host starts the next turn with the prompt's text, the answer joins it as usual.

Every capture in a subagent's loop (its Write and Edit calls, results and answer) sits
in the agent's own scope and carries the agent id as `agent`. The `agent_task` row in
the parent's scope carries the same id. `inspect <id> --cross-agent` shows these
joins within the same provider and session. Inspection defaults to one agent's scope.

Slash commands and hidden prompts are not submissions. Other tools (Bash, MultiEdit,
NotebookEdit, MCP tools) are not observed yet; the gap is deliberate and visible, not
filled by guessing. Each Edit capture records `attributes.replace_all` (false when
omitted by the host). It records the requested operation, not a count of actual
replacements. An aborted turn that produced no text leaves no answer row.

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
/textprov list --session [--cross-agent] [--limit N] [--before <id>]
/textprov status               bridge, core and database state, plus the plugin's own:
                               adapter, loaded version, host version, session id,
                               sequence, counts, the last failure, the session's rows
/textprov inspect <id> [--cross-agent]
/textprov match <src> <dst> [--policy exact-v1|line-endings-v1|common-indent-v1]
                           [--partial] [--min-chars N] [--cross-agent]
/textprov claim <id> <start> <end> <voice-id> [definition...]
                [--support <id>] [--cross-agent]
/textprov transfer <JSON>
/textprov resolve <JSON>
/textprov export <JSON>
```

IDs may be unambiguous prefixes of the IDs `/textprov` lists; an observation from
before a resume needs its full ID. `list --session` retrieves full IDs and durable
metadata newest first for the main agent, with `next_before_id` for the next page.
Pass that ID to `--before`; `--limit` accepts 1–1000 (default 100). The response names
the provider, session and agent scope. `--cross-agent` includes that session's
subagents; it still excludes other providers and sessions. `start` and `end` count Unicode scalars from 0, end
excluded, and must sit on grapheme boundaries; the core refuses anything else, and
`inspect` shows `scalar_length`. `voice-id` is a TextProv voice such as `Voice1`;
`Voice0` is unattributed text and needs no claim. The definition says who the voice is:

```text
/textprov claim 5410ad26 0 152 Voice1 the person typing at the prompt
```

A claim is recorded with basis `user_command`, voice context `claude:<session id>` and
the session's adapter string as its policy version. Repeat `--support <id>` to name
supporting observations. Use `--` before definition text containing words beginning
with `--`. Claims still require the person's explicit choice of range and voice.

Matching defaults to `exact-v1` and the entire source block. `line-endings-v1`
compares CRLF/CR as LF; `common-indent-v1` also removes each block's common leading
indentation. `--partial` proposes shared passages of at least `--min-chars` Unicode
scalars (default 16). Comparison views do not rewrite the observations. Returned
ranges and segment mappings refer to the original text; keep discontiguous segments
separate when making claims. Repeated passages remain ambiguous and no candidate is
selected automatically.

Inspect, match and claim support stay within one agent scope by default. Explicit
`--cross-agent` allows other agents in the same provider and session; it does not
allow another session or provider. A match, including a normalized or partial match,
never creates a claim or decides who wrote the passage. Full UUIDs are checked
against the current Claude provider/session; a full ID does not grant access to
another session. A child-agent observation requires explicit cross-agent access.

The three policy commands accept JSON objects of public core arguments. Observation
IDs may use the same prefixes as other commands; claim IDs and content hashes are
copied exactly from inspection. They return JSON and do not write project files.

`transfer` records the person's explicit acceptance of one match candidate and a
nonempty selection of existing source claims. Supply the same comparison options
used for `match`, the zero-based `candidate_index`, exact source/target hashes and
source claim IDs. Even a single candidate needs an explicit index. Cross-agent
transfer requires `"cross_agent": true` and stays within the current provider/session.
The JSON `resolve` and `export` commands also accept `"cross_agent": true` as an
access option for a child-agent observation in this session; the adapter consumes
that option before calling their core APIs.

```text
/textprov transfer {"source_id":"<source UUID>","target_id":"<target UUID>","candidate_index":0,"source_claim_ids":["<claim ID>"],"source_hash":"<hash>","target_hash":"<hash>","comparison_policy":"exact-v1"}
/textprov resolve {"observation_id":"<target UUID>","content_hash":"<hash>"}
```

The shared `supplied-claims-v1` policy transfers only the selected supplied voices,
leaves unknown gaps unattributed, and refuses incompatible overlapping claims.
Inspection retains the selected passage and supporting claim evidence. `resolve`
shows the resulting partition and gaps without needing retained text. Transfer and
export require retained text; an identical successful transfer remains idempotent
after expiry.

`export` requires the exact hash, an explicit human/AI projection for every resolved
voice and `"allow_lossy": true`. Its only supported profile is experimental
`experimental-vs-classification-v1`: the encoded text loses voice identity/context
and claim evidence. Keep the entire returned companion report with its text;
selector offsets in that report permit exact recovery without removing pre-existing
Unicode selectors. Markdown syntax and code are protected by default; unknown
ranges remain unencoded.

```text
/textprov export {"observation_id":"<target UUID>","content_hash":"<hash>","voice_states":[{"voice_context":"claude:<session>","voice_id":"Voice1","state":"human"}],"allow_lossy":true}
```

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
  on its own. Explicit comparison policies handle line endings and common indentation;
  arbitrary rendering changes remain outside those policies.
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

Develop in a separate checkout or copy while a trial session uses its frozen plugin
and core builds. Editing a folder passed to `--plugin-dir` can hot-reload it into the
running session. Do not edit either build during a declared trial.

For local checks against a core checkout:

```sh
export TEXTPROV_PYTHON=/path/to/textprov/python
claude plugin validate .                 # manifest, marketplace and hooks module
claude plugin test .                     # tests/register.test.ts against the engine
python3 -m unittest discover -s tests    # the bridge against TEXTPROV_PYTHON
tsc -p .                               # requires generated host declarations
```

The Python tests look for the core at `TEXTPROV_PYTHON` or `../textprov/python` and
skip when neither has `textprov/chronicle.py`. The bridge checks the loaded version
and API before every operation; having a file with that name alone is insufficient.
The bridge uses public Chronicle APIs only and preserves the command's existing
`counts`, `cache_policy`, session counts and ISO 8601 expiry presentation.

Loading the plugin once from this folder (`claude --plugin-dir .`) makes Claude Code
write its type declarations to `.claude-plugin/types/`; after that `tsc -p .`
type-checks the module and tests. That folder is ignored by git.

After the checks pass, start a separate feedback-only trial with the frozen
plugin 0.1.2 and compatible core. Run `/textprov status` first and record its output
unchanged, all component versions/commits, database observations, evidence and gaps
in `../trials/YYYY-MMDD-N-<topic>.md` (`N` counts trials on that date). Check:

- Deny a Write; confirm retries finish and the call/result leave no sequence gap.
- Queue and withdraw a prompt; confirm `submitted_during` and no incorrect turn join.
- Run a subagent; inspect joins with and without `--cross-agent`, and confirm another
  provider/session is still refused for matching and claim support.
- Resume after a failure; confirm its history survives and process/session counts differ.
- Try explicit normalized/partial matching, Edit `replace_all`, valid claims and invalid
  scalar/grapheme ranges; confirm matches alone leave claims empty.
- Explicitly select a passage/source claims, resolve gaps/conflicts, and export with
  supplied voice classifications and loss acknowledgement; retain the companion report.
- Observe the status glyph with zero failures and an interrupted partial answer.

Engine and bridge tests establish local behavior; the trial establishes what the
installed Claude Code build actually delivers. Keep fixes in a later development
session that starts from the trial report. These local checks do not publish the plugin.

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
