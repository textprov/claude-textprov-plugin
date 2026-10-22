# Agent guidelines

## Trial sessions are feedback-only

A trial session runs an installed build of this plugin or of the textprov core
(`textprov`) to see how it behaves. A session is a trial when the person says so.

During a trial:

- Do not edit code in this repo or in `textprov`. This includes small fixes,
  and you should not offer to make one.
- Record the findings in `../trials/YYYY-MM-DD-<topic>.md`, which sits outside
  both repos. Include:
  - versions: Claude Code, plugin version and commit, core version and commit, Python
  - `/textprov status` output, copied unchanged
  - the observations as read from the chronicle database
  - each finding with its evidence
  - what was not tested
- Make fixes in a separate development session that starts from the trial file.

Editing code during a trial changes the build being observed. It also mixes
evaluation with development.
