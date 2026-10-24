import { expect, test } from 'claude-code/testing'
import type { On } from 'claude-code'

type Request = Record<string, unknown>
type Ids = Record<string, string>

const ORIGIN = { kind: 'composer' } as const
const PRESENTATION = { isFullscreen: false, columns: 80 } as const
const SESSION = { cwd: '/project', surface: 'terminal', isInteractive: true } as const
const SESSION_STATE = { observations: 0, last_sequence: 0 }

/** What the bridge prints on stderr before exiting 1, as the mock answers it. */
class Refusal extends Error {}

type Fixture = {
  requests: Request[]
  /** What the plugin put in `$.store`, by key. */
  store: Record<string, unknown>
}

/** Stands in for the engine and for the Python bridge: every request is kept, every observe answered with a fresh id. */
function engine(
  on: On,
  fixture: Fixture,
  bridge?: (request: Request) => unknown,
  spawnedAgent?: string,
) {
  let minted = 0
  on('session.start', (_, e) => ({ cwd: e.cwd }))
  on('command.register', () => ({ value: { command: 'textprov' } }))
  on('session.id', () => ({ value: 'session-test' }))
  on('session.root', () => ({ value: '/project' }))
  on('session.version', () => ({ value: { version: '0.0.0-test' } }))
  on('ui.status', () => ({ value: undefined }))
  on('clock.after', () => ({ value: undefined }))
  on('store.get', (_, e) => ({ value: fixture.store[e.key] }))
  on('store.set', (_, e) => {
    fixture.store[e.key] = e.value
    return { value: undefined }
  })
  on('store.delete', (_, e) => {
    delete fixture.store[e.key]
    return { value: undefined }
  })
  on('store.keys', () => ({ value: Object.keys(fixture.store) }))
  on('prompt.submit', (_, e) => ({ text: e.text }))
  on('turn.start', (_, e) => ({ turnId: e.turnId }))
  on('tool.call', () => ({ result: {} }))
  on('turn.complete', (_, e) => ({ text: e.answer }))
  on('agent.spawn', () => ({ model: 'test-model', agentId: spawnedAgent ?? 'agent-1' }))
  on('process.run', (_, e) => {
    const request = JSON.parse(e.init?.stdin ?? '{}') as Request
    fixture.requests.push(request)
    const given = bridge?.(request)
    if (given instanceof Refusal) {
      return {
        value: { exitCode: 1, stdout: '', stderr: JSON.stringify({ error: given.message }), isStdoutTruncated: false, isStderrTruncated: false },
      }
    }
    if (given instanceof Error) throw given
    let result =
      given !== undefined ? given : request.operation === 'observe' ? `obs-${++minted}` : request.operation === 'session' ? SESSION_STATE : {}
    if (request.operation === 'inspect') result = { provider: 'claude', session_id: 'session-test', agent_id: null, ...(result as Request) }
    return {
      value: { exitCode: 0, stdout: JSON.stringify({ result }), stderr: '', isStdoutTruncated: false, isStderrTruncated: false },
    }
  })
}

const fixture = (): Fixture => ({ requests: [], store: {} })
const observed = (requests: Request[]) => requests.filter(one => one.operation === 'observe')

test('a submission is observed as stored user text, with no claim', async ($, on) => {
  const f = fixture()
  engine(on, f)
  await $.session.start(SESSION)
  await $.prompt.submit({ text: 'Keep the original wording.', wait: false, origin: ORIGIN })

  const captured = observed(f.requests)
  expect(captured.length).toBe(1)
  const one = captured[0]!
  expect(one.event_kind).toBe('submission')
  expect(one.channel).toBe('user')
  expect(one.visibility).toBe('stored')
  expect(one.text).toBe('Keep the original wording.')
  expect(one.session_id).toBe('session-test')
  expect(one.provider).toBe('claude')
  expect(one.adapter).toBe('claude-textprov-plugin/0.1.2')
  expect(one.completeness).toBe('complete')
})

test('a slash command is not a submission', async ($, on) => {
  const f = fixture()
  engine(on, f)
  await $.session.start(SESSION)
  await $.prompt.submit({ text: '/textprov', command: { name: 'textprov', args: '' }, wait: false, origin: ORIGIN })
  expect(observed(f.requests).length).toBe(0)
})

test('the submission key carries its capture sequence, and the answer joins the prompt through the turn', async ($, on) => {
  const f = fixture()
  engine(on, f)
  await $.session.start(SESSION)
  await $.prompt.submit({ text: 'hello', wait: false, origin: ORIGIN })
  await $.turn.start({ text: 'hello', turnId: 'turn-1' })
  await $.turn.complete({ answer: 'Hi.', durationMs: 1, isAborted: false, turnId: 'turn-1', reason: 'answer' })

  const [submission, answer] = observed(f.requests)
  expect(String(submission!.delivery_key)).toMatch(/^prompt:[0-9a-f-]{36}:1$/)
  expect(submission!.capture_sequence).toBe(1)
  expect((submission!.host_ids as Ids).prompt).toBe(submission!.delivery_key)
  expect((submission!.host_ids as Ids).turn).toBeUndefined()
  expect(answer!.event_kind).toBe('assistant_message')
  expect(answer!.capture_sequence).toBe(2)
  expect((answer!.host_ids as Ids).turn).toBe('turn-1')
  expect((answer!.host_ids as Ids).prompt).toBe(submission!.delivery_key)
})

test('a continued turn claims no submission', async ($, on) => {
  const f = fixture()
  engine(on, f)
  await $.session.start(SESSION)
  await $.turn.start({ text: '', turnId: 'turn-2' })
  await $.turn.complete({ answer: 'Done.', durationMs: 1, isAborted: false, turnId: 'turn-2', reason: 'answer' })

  const [answer] = observed(f.requests)
  expect((answer!.host_ids as Ids).turn).toBe('turn-2')
  expect((answer!.host_ids as Ids).prompt).toBeUndefined()
})

test('a prompt typed while a turn runs records that turn as submitted_during, never as its turn', async ($, on) => {
  const f = fixture()
  engine(on, f)
  await $.session.start(SESSION)
  await $.turn.start({ text: 'first', turnId: 'turn-a' })
  await $.prompt.submit({ text: 'while you work', turnId: 'turn-a', wait: false, origin: ORIGIN })

  const [queued] = observed(f.requests)
  expect(String(queued!.delivery_key)).toMatch(/^prompt:[0-9a-f-]{36}:1$/)
  expect((queued!.host_ids as Ids).submitted_during).toBe('turn-a')
  expect((queued!.host_ids as Ids).turn).toBeUndefined()
})

test('a pasted block is also recorded on its own, joined to the submission', async ($, on) => {
  const f = fixture()
  engine(on, f)
  await $.session.start(SESSION)
  const text = 'Look at this:\n<pasted_content id="ab12">\nquoted line\n</pasted_content id="ab12">\nthoughts?'
  await $.prompt.submit({ text, wait: false, origin: ORIGIN })

  const [submission, paste] = observed(f.requests)
  expect(submission!.text).toBe(text)
  expect(paste!.event_kind).toBe('pasted_block')
  expect(paste!.channel).toBe('user')
  expect(paste!.text).toBe('\nquoted line\n')
  expect(paste!.delivery_key).toBe(`${String(submission!.delivery_key)}:paste:ab12`)
  expect((paste!.host_ids as Ids).prompt).toBe(submission!.delivery_key)
  expect((paste!.host_ids as Ids).paste).toBe('ab12')
})

test('the sequence continues from the chronicle when a session is loaded again', async ($, on) => {
  const f = fixture()
  engine(on, f, request => (request.operation === 'session' ? { observations: 7, last_sequence: 7 } : undefined))
  await $.session.start(SESSION)
  expect(f.requests[0]!.operation).toBe('session')
  expect(f.requests[0]!.session_id).toBe('session-test')
  await $.prompt.submit({ text: 'again', wait: false, origin: ORIGIN })

  const [submission] = observed(f.requests)
  expect(String(submission!.delivery_key)).toMatch(/^prompt:[0-9a-f-]{36}:8$/)
  expect(submission!.capture_sequence).toBe(8)
})

test('a Write is observed as a call and a result joined by tool_call and the running turn', async ($, on) => {
  const f = fixture()
  engine(on, f)
  await $.session.start(SESSION)
  await $.turn.start({ text: 'write it', turnId: 'turn-3' })
  await $.tool.call({ tool: 'Write', file_path: '/project/notes.md', content: 'Draft: Keep the original wording.' })

  const call = f.requests.find(one => one.event_kind === 'tool_call')
  const result = f.requests.find(one => one.event_kind === 'tool_result')
  expect(call).toBeDefined()
  expect(result).toBeDefined()
  expect(call!.text).toBe('Draft: Keep the original wording.')
  expect(call!.channel).toBe('assistant')
  expect(call!.visibility).toBe('model')
  expect((call!.host_ids as Ids).path).toBe('/project/notes.md')
  expect((call!.host_ids as Ids).turn).toBe('turn-3')
  expect((call!.host_ids as Ids).agent).toBeUndefined()
  const id = (call!.host_ids as Ids).tool_call
  expect(typeof id).toBe('string')
  expect((result!.host_ids as Ids).tool_call).toBe(id)
  expect(result!.channel).toBe('tool')
  expect(result!.visibility).toBe('structured')
  expect(String(call!.delivery_key)).toBe(`${id}:call`)
  expect(String(result!.delivery_key)).toBe(`${id}:result`)
  expect(f.requests.some(one => one.event_kind === 'tool_anchor')).toBe(false)
})

test('an Edit records its anchor beside the new string', async ($, on) => {
  const f = fixture()
  engine(on, f)
  await $.session.start(SESSION)
  await $.tool.call({
    tool: 'Edit',
    file_path: '/project/notes.md',
    old_string: '## Heading\n',
    new_string: '## Heading\n\nA new paragraph.\n',
  })

  const call = f.requests.find(one => one.event_kind === 'tool_call')
  const anchor = f.requests.find(one => one.event_kind === 'tool_anchor')
  expect(call!.text).toBe('## Heading\n\nA new paragraph.\n')
  expect(anchor!.text).toBe('## Heading\n')
  expect(anchor!.channel).toBe('assistant')
  expect(anchor!.visibility).toBe('model')
  const id = (call!.host_ids as Ids).tool_call
  expect((anchor!.host_ids as Ids).tool_call).toBe(id)
  expect((anchor!.host_ids as Ids).path).toBe('/project/notes.md')
  expect(String(anchor!.delivery_key)).toBe(`${id}:anchor`)
  expect(call!.attributes).toEqual({ replace_all: false })
  expect(anchor!.attributes).toEqual({ replace_all: false })
})

test('a subagent task is recorded in the parent loop, and the subagent answer carries the agent id', async ($, on) => {
  const f = fixture()
  engine(on, f, undefined, 'agent-7')
  await $.session.start(SESSION)
  await $.turn.start({ text: 'delegate it', turnId: 'turn-p' })
  await $.agent.spawn({
    tool_use_id: 'toolu_agent',
    prompt: 'Write one line to notes.md',
    description: 'write a line',
    subagentType: 'general-purpose',
    provider: { plugin: 'engine', tier: 'core' },
    parentModel: 'test-model',
    background: false,
    fork: false,
  })
  await $.turn.start({ text: 'Write one line to notes.md', turnId: 'turn-s', agentId: 'agent-7' })
  await $.turn.complete({ answer: 'done', durationMs: 1, isAborted: false, turnId: 'turn-s', reason: 'answer', agentId: 'agent-7' })

  const task = f.requests.find(one => one.event_kind === 'agent_task')
  const answer = f.requests.find(one => one.event_kind === 'assistant_message')
  expect(task!.text).toBe('Write one line to notes.md')
  expect(task!.channel).toBe('assistant')
  expect(task!.agent_id).toBe(null)
  expect(task!.delivery_key).toBe('agent:agent-7:task')
  expect((task!.host_ids as Ids).agent).toBe('agent-7')
  expect((task!.host_ids as Ids).turn).toBe('turn-p')
  expect((task!.host_ids as Ids).tool_call).toBe('toolu_agent')
  expect(answer!.agent_id).toBe('agent-7')
  expect((answer!.host_ids as Ids).agent).toBe('agent-7')
  expect((answer!.host_ids as Ids).turn).toBe('turn-s')
})

test('a capture the bridge never answered is retried with the same key and sequence', async ($, on) => {
  const f = fixture()
  let killed = false
  engine(on, f, request => {
    if (request.operation === 'observe' && !killed) {
      killed = true
      return new Error('$.process.run(python3) aborted')
    }
    return undefined
  })
  await $.session.start(SESSION)
  await $.prompt.submit({ text: 'first', wait: false, origin: ORIGIN })
  await $.prompt.submit({ text: 'second', wait: false, origin: ORIGIN })

  const first = observed(f.requests).filter(one => String(one.delivery_key).endsWith(':1'))
  expect(first.length).toBe(2)
  expect(first[0]!.capture_sequence).toBe(1)
  expect(first[1]!.capture_sequence).toBe(1)
  expect(first[1]!.delivery_key).toBe(first[0]!.delivery_key)
  expect(first[1]!.text).toBe('first')
  const second = observed(f.requests).find(one => String(one.delivery_key).endsWith(':2'))
  expect(second).toBeDefined()
  const listed = await $.command.run({ command: 'textprov', args: '', origin: ORIGIN, presentation: PRESENTATION })
  expect(listed.text).toContain('2 observations captured by this process')
  expect(listed.text).not.toContain('failure')
})

test('the list command shows what was captured and the status command adds the plugin to the bridge report', async ($, on) => {
  const f = fixture()
  engine(on, f, request =>
    request.operation === 'status' ? { core: { available: true } } : request.operation === 'session' ? { observations: 5, last_sequence: 0 } : undefined,
  )
  await $.session.start(SESSION)
  await $.prompt.submit({ text: 'hello', wait: false, origin: ORIGIN })

  const listed = await $.command.run({ command: 'textprov', args: '', origin: ORIGIN, presentation: PRESENTATION })
  expect(listed.text).toContain('1 observation captured by this process since ')
  expect(listed.text).toContain('the chronicle holds 5 for this session')
  expect(listed.text).toContain('submission')
  expect(listed.text).toContain('obs-1'.slice(0, 8))
  expect(listed.text!.startsWith('textprov')).toBe(false)

  const status = await $.command.run({ command: 'textprov', args: 'status', origin: ORIGIN, presentation: PRESENTATION })
  expect(status.text).toContain('"available": true')
  expect(status.text).toContain('"adapter": "claude-textprov-plugin/0.1.2"')
  expect(status.text).toContain('"loaded_version": "0.1.2"')
  expect(status.text).toContain('"session_id": "session-test"')
  expect(status.text).toContain('"host_version": "0.0.0-test"')
  expect(status.text).toContain('"observations": 1')
  expect(status.text).toContain('"failures": 0')
  expect(status.text).toContain('"observations": 5')

  const unknown = await $.command.run({ command: 'textprov', args: 'inspect obs-1.', origin: ORIGIN, presentation: PRESENTATION })
  expect(unknown.text).toContain('no observation matches "obs-1."')
  const usage = await $.command.run({ command: 'textprov', args: 'claim', origin: ORIGIN, presentation: PRESENTATION })
  expect(usage.text).toContain('Voice1')
  expect(usage.text).toContain('Unicode scalars')
})

test('a bridge failure is reported, never silently dropped, and kept in the store for the session', async ($, on) => {
  const f = fixture()
  engine(on, f, () => new Refusal('RuntimeError: textprov has no chronicle module'))
  await $.session.start(SESSION)
  const submitted = await $.prompt.submit({ text: 'hello', wait: false, origin: ORIGIN })
  expect(submitted.text).toBe('hello')

  const listed = await $.command.run({ command: 'textprov', args: 'list', origin: ORIGIN, presentation: PRESENTATION })
  expect(listed.text).toContain('0 observations captured by this process')
  // One failure for the session state at session start, one for the submission.
  expect(listed.text).toContain('2 capture failures this session; the last one: prompt:')
  expect(listed.text).toContain('no chronicle module')
  const stored = f.store['failures:session-test'] as { key: string }[]
  expect(stored.map(one => one.key)).toEqual(['session', observed(f.requests)[0]!.delivery_key])
})


test('an Edit records replace_all as an adapter fact on its captures', async ($, on) => {
  const f = fixture()
  engine(on, f)
  await $.session.start(SESSION)
  await $.tool.call({ tool: 'Edit', file_path: '/project/notes.md', old_string: 'old', new_string: 'new', replace_all: true })
  expect(observed(f.requests).length).toBe(3)
  for (const request of observed(f.requests)) expect(request.attributes).toEqual({ replace_all: true })
  expect(f.requests.some(one => one.operation === 'claim')).toBe(false)
})

test('comparison options are explicit and a match never makes a claim', async ($, on) => {
  const f = fixture()
  engine(on, f)
  await $.session.start(SESSION)
  await $.prompt.submit({ text: 'source', wait: false, origin: ORIGIN })
  await $.prompt.submit({ text: 'target', wait: false, origin: ORIGIN })
  await $.command.run({ command: 'textprov', args: 'match obs-1 obs-2 --policy common-indent-v1 --partial --min-chars 8 --cross-agent', origin: ORIGIN, presentation: PRESENTATION })
  const match = f.requests.find(one => one.operation === 'match')!
  expect(match).toEqual({ operation: 'match', source_id: 'obs-1', target_id: 'obs-2', policy: 'common-indent-v1', partial: true, min_match_chars: 8, cross_agent: true })
  expect(f.requests.some(one => one.operation === 'claim')).toBe(false)
  await $.command.run({ command: 'textprov', args: 'match obs-1 obs-2', origin: ORIGIN, presentation: PRESENTATION })
  const matches = f.requests.filter(one => one.operation === 'match')
  expect(matches[1]!.policy).toBe('exact-v1')
  expect(matches[1]!.partial).toBe(false)
  expect(matches[1]!.cross_agent).toBe(false)
})

test('inspection and explicit claim support forward cross-agent consent', async ($, on) => {
  const f = fixture()
  engine(on, f, request => request.operation === 'inspect' ? { content_hash: 'current-hash' } : undefined)
  await $.session.start(SESSION)
  await $.prompt.submit({ text: 'source', wait: false, origin: ORIGIN })
  await $.prompt.submit({ text: 'target', wait: false, origin: ORIGIN })
  await $.command.run({ command: 'textprov', args: 'inspect obs-2 --cross-agent', origin: ORIGIN, presentation: PRESENTATION })
  await $.command.run({ command: 'textprov', args: 'claim obs-2 0 6 Voice1 --support obs-1 --cross-agent -- definition with --literal', origin: ORIGIN, presentation: PRESENTATION })
  const inspections = f.requests.filter(one => one.operation === 'inspect')
  expect(inspections.length).toBe(3)
  for (const request of inspections) expect(request.cross_agent).toBe(true)
  const claim = f.requests.find(one => one.operation === 'claim')!
  expect(claim.supporting_ids).toEqual(['obs-1'])
  expect(claim.cross_agent).toBe(true)
  expect(claim.content_hash).toBe('current-hash')
  expect(claim.voice_definition).toBe('definition with --literal')
  expect(claim.basis).toBe('user_command')
  expect(claim.policy_version).toBe('claude-textprov-plugin/0.1.2')
})

test('invalid comparison and claim flags are refused before comparison or claims', async ($, on) => {
  const f = fixture()
  engine(on, f)
  await $.session.start(SESSION)
  for (const args of ['match a b --policy typo', 'match a b --min-chars 0', 'match a b --min-chars 9007199254740992', 'inspect a --partial', 'claim a 0 1 Voice1 --support']) {
    const refused = await $.command.run({ command: 'textprov', args, origin: ORIGIN, presentation: PRESENTATION })
    expect(refused.text).toBeDefined()
    expect(refused.text).not.toContain('no observation matches')
  }
  expect(f.requests.some(one => ['inspect', 'match', 'claim'].includes(String(one.operation)))).toBe(false)
})


test('a nested subagent task keeps the child join separate from its parent', async ($, on) => {
  const f = fixture()
  engine(on, f, undefined, 'child-agent')
  await $.session.start(SESSION)
  await $.turn.start({ text: 'delegate again', turnId: 'nested-parent-turn', agentId: 'parent-agent' })
  await $.agent.spawn({
    tool_use_id: 'toolu_nested', prompt: 'nested task', description: 'nested',
    subagentType: 'general-purpose', provider: { plugin: 'engine', tier: 'core' },
    parentModel: 'test-model', parentAgentId: 'parent-agent', background: false, fork: false,
  })
  const task = f.requests.find(one => one.event_kind === 'agent_task')!
  expect(task.agent_id).toBe('parent-agent')
  expect((task.host_ids as Ids).agent).toBe('child-agent')
  expect((task.host_ids as Ids).parent_agent).toBe('parent-agent')
  expect((task.host_ids as Ids).turn).toBe('nested-parent-turn')
})


test('policy JSON preserves explicit selection, hashes and supplied voice mappings', async ($, on) => {
  const f = fixture()
  engine(on, f)
  await $.session.start(SESSION)
  await $.prompt.submit({ text: 'source', wait: false, origin: ORIGIN })
  await $.prompt.submit({ text: 'target', wait: false, origin: ORIGIN })
  const transfer = { source_id: 'obs-1', target_id: 'obs-2', candidate_index: 1, source_claim_ids: ['claim-a', 'claim-b'], source_hash: 'source-hash', target_hash: 'target-hash', comparison_policy: 'exact-v1', cross_agent: true }
  await $.command.run({ command: 'textprov', args: `transfer ${JSON.stringify(transfer)}`, origin: ORIGIN, presentation: PRESENTATION })
  expect(f.requests.find(one => one.operation === 'transfer')).toEqual({ ...transfer, operation: 'transfer' })
  const projection = { observation_id: 'obs-2', content_hash: 'target-hash', voice_states: [{ voice_context: 'supplied context with spaces', voice_id: 'Voice1', state: 'human' }], allow_lossy: true }
  await $.command.run({ command: 'textprov', args: `export ${JSON.stringify(projection)}`, origin: ORIGIN, presentation: PRESENTATION })
  expect(f.requests.find(one => one.operation === 'export')).toEqual({ ...projection, operation: 'export' })
  await $.command.run({ command: 'textprov', args: 'resolve {"observation_id":"obs-2","content_hash":"target-hash"}', origin: ORIGIN, presentation: PRESENTATION })
  expect(f.requests.find(one => one.operation === 'resolve')).toEqual({ operation: 'resolve', observation_id: 'obs-2', content_hash: 'target-hash' })
  expect(f.requests.some(one => one.operation === 'claim')).toBe(false)
})

test('invalid policy JSON never reaches the bridge', async ($, on) => {
  const f = fixture()
  engine(on, f)
  await $.session.start(SESSION)
  for (const args of ['transfer {', 'resolve []', 'export null', 'transfer {"operation":"claim"}']) {
    const refused = await $.command.run({ command: 'textprov', args, origin: ORIGIN, presentation: PRESENTATION })
    expect(refused.text).toBeDefined()
  }
  expect(f.requests.some(one => ['transfer', 'resolve', 'export', 'claim'].includes(String(one.operation)))).toBe(false)
})

test('durable session listing forwards explicit scope and pagination', async ($, on) => {
  const f = fixture()
  engine(on, f, request => request.operation === 'list_observations' ? { observations: [{ observation_id: 'older-full-id' }], next_before_id: 'cursor-id' } : undefined)
  await $.session.start(SESSION)
  await $.prompt.submit({ text: 'one', wait: false, origin: ORIGIN })
  const listed = await $.command.run({ command: 'textprov', args: 'list --session --cross-agent --limit 2 --before obs-1', origin: ORIGIN, presentation: PRESENTATION })
  expect(f.requests.find(one => one.operation === 'list_observations')).toEqual({ operation: 'list_observations', provider: 'claude', session_id: 'session-test', agent_id: null, cross_agent: true, limit: 2, before_id: 'obs-1' })
  expect(listed.text).toContain('"next_before_id": "cursor-id"')
  expect(listed.text).toContain('"cross_agent": true')
  expect(listed.text).toContain('older-full-id')
  const refused = await $.command.run({ command: 'textprov', args: 'list --session --limit 1001', origin: ORIGIN, presentation: PRESENTATION })
  expect(refused.text).toContain('from 1 to 1000')
  expect(f.requests.filter(one => one.operation === 'list_observations').length).toBe(1)
})


test('full IDs cannot widen the current provider/session and other agents need explicit access', async ($, on) => {
  const f = fixture()
  const foreign = '11111111-1111-4111-8111-111111111111'
  const other = '22222222-2222-4222-8222-222222222222'
  const child = '33333333-3333-4333-8333-333333333333'
  engine(on, f, request => {
    if (request.operation !== 'inspect') return undefined
    const id = request.observation_id
    return { content_hash: 'hash', ...(id === foreign ? { session_id: 'foreign' } : id === other ? { provider: 'other-provider' } : id === child ? { agent_id: 'child' } : {}) }
  })
  await $.session.start(SESSION)
  await $.prompt.submit({ text: 'main observation', wait: false, origin: ORIGIN })
  for (const args of [
    `inspect ${foreign} --cross-agent`, `inspect ${other} --cross-agent`,
    `match ${foreign} ${foreign} --cross-agent`,
    `claim obs-1 0 1 Voice1 --support ${foreign} --cross-agent`,
    `transfer ${JSON.stringify({ source_id: foreign, target_id: 'obs-1', cross_agent: true })}`,
    `resolve ${JSON.stringify({ observation_id: foreign, cross_agent: true })}`,
    `export ${JSON.stringify({ observation_id: foreign, cross_agent: true })}`,
  ]) {
    const refused = await $.command.run({ command: 'textprov', args, origin: ORIGIN, presentation: PRESENTATION })
    expect(refused.text).toContain('outside the current Claude provider/session')
  }
  const refused = await $.command.run({ command: 'textprov', args: `inspect ${child}`, origin: ORIGIN, presentation: PRESENTATION })
  expect(refused.text).toContain('another agent')
  const allowed = await $.command.run({ command: 'textprov', args: `inspect ${child} --cross-agent`, origin: ORIGIN, presentation: PRESENTATION })
  expect(allowed.text).toContain('"agent_id": "child"')
  await $.command.run({ command: 'textprov', args: `resolve ${JSON.stringify({ observation_id: child, cross_agent: true })}`, origin: ORIGIN, presentation: PRESENTATION })
  expect(f.requests.find(one => one.operation === 'resolve')).toEqual({ operation: 'resolve', observation_id: child })
  expect(f.requests.some(one => ['match', 'transfer', 'export', 'claim'].includes(String(one.operation)))).toBe(false)
})


test('two process states seeded from one session snapshot mint independent prompt identities', async ($, on) => {
  const f = fixture()
  engine(on, f, request => request.operation === 'session' ? { observations: 7, last_sequence: 7 } : undefined)
  let active = 'first'
  const states: Record<string, Record<string, { value: unknown; version: number }>> = { first: {}, second: {} }
  on('state.get', (_, e) => {
    const held = states[active]![e.key]
    return { value: { value: held?.value, version: held?.version ?? 0 } }
  })
  on('state.set', (_, e) => {
    const state = states[active]!
    const version = state[e.key]?.version ?? 0
    if (e.ifVersion !== undefined && e.ifVersion !== version) return { value: { isSet: false, version } }
    state[e.key] = { value: e.value, version: version + 1 }
    return { value: { isSet: true, version: version + 1 } }
  })
  await $.session.start(SESSION)
  active = 'second'
  await $.session.start(SESSION)
  for (const text of ['identical prompt', 'different first prompt']) {
    active = 'first'
    await $.prompt.submit({ text, wait: false, origin: ORIGIN })
    active = 'second'
    await $.prompt.submit({ text: text === 'identical prompt' ? text : 'different second prompt', wait: false, origin: ORIGIN })
  }
  const requests = observed(f.requests)
  expect(new Set(requests.map(request => request.delivery_key)).size).toBe(4)
  expect(requests.map(request => request.capture_sequence)).toEqual([8, 8, 9, 9])
  expect(requests.every(request => request.session_id === 'session-test')).toBe(true)
  const originalNamespace = states.second!.captureNamespace!.value
  await $.session.start(SESSION)
  expect(states.second!.captureNamespace!.value).toBe(originalNamespace)
})

test('a missing capture namespace exposes a gap without minting a reused prompt key', async ($, on) => {
  const f = fixture()
  engine(on, f)
  let missing = false
  on('state.get', { plugin: 'textprov', key: 'captureNamespace' }, (_, e, next) => missing ? { value: { value: null, version: 1 } } : next(e))
  await $.session.start(SESSION)
  missing = true
  const entered = await $.prompt.submit({ text: 'still enters', wait: false, origin: ORIGIN })
  expect(entered.text).toBe('still enters')
  expect(observed(f.requests).length).toBe(0)
  const listed = await $.command.run({ command: 'textprov', args: '', origin: ORIGIN, presentation: PRESENTATION })
  expect(listed.text).toContain('capture identity unavailable; submission was not captured')
})


test('a namespace initialization failure preserves earlier persisted failures', async ($, on) => {
  const f = fixture()
  const previous = { key: 'earlier-capture', error: 'earlier failure', at: '2026-10-22T00:00:00.000Z' }
  f.store['failures:session-test'] = [previous]
  engine(on, f)
  // A refused state read forces update() to throw during initialization.
  on('state.get', { plugin: 'textprov', key: 'captureNamespace' }, () => ({ deny: 'namespace state unavailable' }))
  await $.session.start(SESSION)
  const stored = f.store['failures:session-test'] as { key: string; error: string }[]
  expect(stored.length).toBe(2)
  expect(stored[0]).toEqual(previous)
  expect(stored[1]!.key).toBe('capture_namespace')
  expect(stored[1]!.error).toContain('cannot establish capture identity')
  const listed = await $.command.run({ command: 'textprov', args: '', origin: ORIGIN, presentation: PRESENTATION })
  expect(listed.text).toContain('2 capture failures this session')
})
