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
  /** Command names the host refuses to register, with the refusal. */
  tools?: Request[]
  marker?: (request: Request) => unknown
  refused?: Record<string, string>
  selection?: { text: string; requestId?: string }
  copies?: string[]
  copyRefused?: boolean
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
  on('command.register', (_, e) => {
    const reason = fixture.refused?.[e.name]
    return reason === undefined ? { value: { command: e.name } } : { deny: reason }
  })
  on('session.id', () => ({ value: 'session-test' }))
  on('session.root', () => ({ value: '/project' }))
  on('session.version', () => ({ value: { version: '0.0.0-test' } }))
  on('fs.exists', () => ({ value: false }))
  on('fs.read', () => ({ value: 'old' }))
  on('ui.status', () => ({ value: undefined }))
  on('ui.selection', () => ({ value: fixture.selection }))
  on('ui.copy', (_, e) => {
    if (fixture.copyRefused) return { value: { isCopied: false, reason: 'no-clipboard' } }
    fixture.copies?.push(e.text)
    return { value: { isCopied: true } }
  })
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
  on('tool.call', (_, e) => { fixture.tools?.push(e); return { result: {} } })
  on('turn.complete', (_, e) => ({ text: e.answer }))
  on('agent.spawn', () => ({ model: 'test-model', agentId: spawnedAgent ?? 'agent-1' }))
  on('process.run', (_, e) => {
    const request = JSON.parse(e.init?.stdin ?? '{}') as Request
    fixture.requests.push(request)
    // Default identity marking keeps transport tests focused on correlation.
    // Dedicated marking tests below assert rewritten arguments separately.
    const policyResult = request.operation === 'mark_chat_parts' ? (request.parts as string[]).map(part => fixture.marker?.({ ...request, operation: 'mark_chat', text: part }) ?? part)
      : request.operation === 'mark_chat' ? request.text
      : request.operation === 'mark_document_edit' ? request.new_text
      : request.operation === 'prepare_edit' ? { old_string: request.old_string, new_string: request.new_string }
      : undefined
    const given = request.operation === 'mark_chat_parts' ? policyResult : policyResult !== undefined ? (fixture.marker?.(request) ?? policyResult) : bridge?.(request)
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
  expect(one.adapter).toBe('claude-textprov-plugin/0.1.7')
  expect(one.completeness).toBe('complete')
  expect(one.attributes).toEqual({ prompt_origin: 'composer' })
})

test('a slash command is not a submission', async ($, on) => {
  const f = fixture()
  engine(on, f)
  await $.session.start(SESSION)
  await $.prompt.submit({ text: '/textprov', command: { name: 'textprov', args: '' }, wait: false, origin: ORIGIN })
  expect(observed(f.requests).length).toBe(0)
})

test('notification-shaped composer text and an unmarked notification retain their payloads without claims', async ($, on) => {
  const f = fixture()
  engine(on, f)
  await $.session.start(SESSION)
  const text = '<task-notification>\n<task-id>pasted-example</task-id>\n<summary>Quoted text 🧪</summary>\n</task-notification>'
  const typed = await $.prompt.submit({ text, wait: false, origin: ORIGIN })
  const delivered = await $.prompt.submit({ text, wait: false, origin: { kind: 'task-notification' } })

  expect(typed.text).toBe(text)
  expect(delivered.text).toBe(text)
  const captures = observed(f.requests)
  expect(captures.length).toBe(2)
  for (const captured of captures) {
    expect(captured.event_kind).toBe('submission')
    expect(captured.channel).toBe('user')
    expect(captured.visibility).toBe('stored')
    expect(captured.text).toBe(text)
  }
  expect(captures[0]!.delivery_key).not.toBe(captures[1]!.delivery_key)
  expect(captures[0]!.attributes).toEqual({ prompt_origin: 'composer' })
  expect(captures[1]!.attributes).toEqual({ prompt_origin: 'task-notification' })
  expect(f.requests.filter(one => one.operation !== 'observe' && one.operation !== 'session' && one.operation !== 'mark_chat').length).toBe(0)
})

test('a submission without a native origin records explicit null rather than guessing from its wrapper', async ($, on) => {
  const f = fixture()
  engine(on, f)
  await $.session.start(SESSION)
  const text = '<task-notification>\n<pasted_content id="unstamped">quoted text</pasted_content id="unstamped">\n</task-notification>'
  // The current host types require origin; an unstamped/older delivery may lack it.
  // @ts-expect-error Exercise the runtime boundary when a native origin is unavailable.
  const delivered = await $.prompt.submit({ text, wait: false })

  expect(delivered.text).toBe(text)
  const captures = observed(f.requests)
  expect(captures.length).toBe(2)
  expect(captures[0]!.text).toBe(text)
  expect(captures[0]!.attributes).toEqual({ prompt_origin: null })
  expect(captures[1]!.text).toBe('quoted text')
  expect(captures[1]!.attributes).toEqual({ prompt_origin: null })
  expect(f.requests.filter(one => one.operation !== 'observe' && one.operation !== 'session' && one.operation !== 'mark_chat').length).toBe(0)
})

test('a host-marked meta prompt is forwarded without being captured', async ($, on) => {
  const f = fixture()
  engine(on, f)
  await $.session.start(SESSION)
  const text = '<task-notification>hidden delivery</task-notification>'
  const delivered = await $.prompt.submit({ text, isMeta: true, wait: false, origin: { kind: 'task-notification' } })

  expect(delivered.text).toBe(text)
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
  expect(submission!.attributes).toEqual({ prompt_origin: 'composer' })
  expect(paste!.attributes).toEqual({ prompt_origin: 'composer' })
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
  expect(status.text).toContain('"adapter": "claude-textprov-plugin/0.1.7"')
  expect(status.text).toContain('"loaded_version": "0.1.7"')
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
  expect(claim.policy_version).toBe('claude-textprov-plugin/0.1.7')
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

test('the plugin registers /textprov and reports its canonical name in help and status', async ($, on) => {
  const f = fixture()
  engine(on, f)
  await $.session.start(SESSION)

  const help = await $.command.run({ command: 'textprov', args: 'help', origin: ORIGIN, presentation: PRESENTATION })
  expect(help.text).toContain('usage: /textprov claim')
  expect(help.text).toContain('IDs may be unambiguous prefixes of observation IDs listed by /textprov.')
  const status = await $.command.run({ command: 'textprov', args: 'status', origin: ORIGIN, presentation: PRESENTATION })
  expect(status.text).toContain('"command": "textprov"')
  expect(status.text).toContain('"failures": 0')
})

test('when /textprov is refused, capture continues without taking over the existing command', async ($, on) => {
  const f = { ...fixture(), refused: { textprov: 'no commands here' } }
  engine(on, f)
  await $.session.start(SESSION)
  await $.prompt.submit({ text: 'still captured', wait: false, origin: ORIGIN })
  expect(observed(f.requests).length).toBe(1)
  const stored = f.store['failures:session-test'] as { key: string; error: string }[]
  expect(stored.map(one => one.key)).toEqual(['command'])
  expect(stored[0]!.error).toContain('no commands here')
  const user = await $.command.run({ command: 'textprov', args: 'status', origin: ORIGIN, presentation: PRESENTATION }).catch(() => ({ text: undefined }))
  expect(user.text ?? '').not.toContain('"adapter"')
})


test('human ingress is rewritten, preserves pasted marks, and machine notifications are not made human', { options: { chat_marks: 'all' } }, async ($, on) => {
  const f = fixture()
  const human = 'h\u{E0103}'
  f.marker = request => request.operation === 'mark_chat' ? `${request.text}${human}` : undefined
  engine(on, f)
  await $.session.start(SESSION)
  const entered = await $.prompt.submit({ text: 'hello', wait: false, origin: ORIGIN })
  expect(entered.text).toBe(`hello${human}`)
  expect(observed(f.requests)[0]!.text).toBe(entered.text)
  const machine = await $.prompt.submit({ text: 'notification', wait: false, origin: { kind: 'task-notification' } })
  expect(machine.text).toBe('notification')
})

test('prose Write reaches the tool with marked content while code passes unchanged', async ($, on) => {
  const f = fixture()
  f.marker = request => request.operation === 'mark_document_edit' ? 'marked prose' : undefined
  engine(on, f)
  const calls: Request[] = []
  f.tools = calls
  await $.session.start(SESSION)
  await $.tool.call({ tool: 'Write', file_path: '/project/notes.md', content: 'prose' })
  await $.tool.call({ tool: 'Write', file_path: '/project/app.py', content: 'print(1)' })
  expect(calls[0]!.content).toBe('marked prose')
  expect(calls[1]!.content).toBe('print(1)')
})

test('prose Edit uses marker-aware exact anchor and replacement returned by the core', async ($, on) => {
  const f = fixture()
  f.marker = request => request.operation === 'prepare_edit' ? { old_string: 'marked old', new_string: 'marked new' } : undefined
  engine(on, f)
  const calls: Request[] = []
  f.tools = calls
  await $.session.start(SESSION)
  await $.tool.call({ tool: 'Edit', file_path: '/project/notes.md', old_string: 'old', new_string: 'new' })
  expect(calls[0]!.old_string).toBe('marked old')
  expect(calls[0]!.new_string).toBe('marked new')
})


test('assistant stored response text is marked and non-text blocks survive', { options: { chat_marks: 'all' } }, async ($, on) => {
  const f = fixture()
  f.marker = request => request.operation === 'mark_chat' ? `${request.text} [AI marked]` : undefined
  engine(on, f)
  await $.session.start(SESSION)
  const stored = await $.session.append({ door: 'response', origin: { kind: 'model', model: 'test' }, uuid: 'answer-1',
    message: { type: 'assistant', role: 'assistant', content: [
      { type: 'text', text: 'answer' }, { type: 'thinking', thinking: 'private' },
    ] } })
  expect(stored.message!.content[0]!.text).toBe('answer [AI marked]')
  expect(stored.message!.content[1]!.thinking).toBe('private')
})

test('assistant rendered copy text uses the shared marking policy', { options: { chat_marks: 'all' } }, async ($, on) => {
  const f = fixture()
  f.marker = request => request.operation === 'mark_chat' ? `${request.text} [AI marked]` : undefined
  engine(on, f)
  on('ui.render', { component: 'AssistantMessage' }, (_, e) => ({ type: 'Text', children: [e.props.text] }))
  await $.session.start(SESSION)
  const stored = await $.session.append({ door: 'response', origin: { kind: 'model', model: 'test' }, uuid: 'answer-1',
    message: { type: 'assistant', role: 'assistant', content: [{ type: 'text', text: 'answer' }] } })
  const rendered = await $.ui.render({ surface: 'terminal', component: 'AssistantMessage', requestId: 'answer-1',
    props: { text: String(stored.message!.content[0]!.text), isFirstOfReply: true } })
  expect(rendered).toMatchObject({ type: 'Text', children: ['answer [AI marked]'] })
})


test('paste framing stays parseable while its user text is marked', { options: { chat_marks: 'all' } }, async ($, on) => {
  const f = fixture()
  f.marker = request => request.operation === 'mark_chat' ? `${request.text} [human]` : undefined
  engine(on, f)
  await $.session.start(SESSION)
  const entered = await $.prompt.submit({ text: 'Look <pasted_content id="p1">pasted</pasted_content id="p1">', wait: false, origin: ORIGIN })
  expect(entered.text).toBe('Look  [human]<pasted_content id="p1">pasted [human]</pasted_content id="p1">')
  expect(observed(f.requests).find(one => one.event_kind === 'pasted_block')!.text).toBe('pasted [human]')
})


test('prose is the default for human ingress and stored assistant text', async ($, on) => {
  const f = fixture()
  engine(on, f)
  await $.session.start(SESSION)
  await $.prompt.submit({ text: 'Use `git status`.', wait: false, origin: ORIGIN })
  await $.session.append({ door: 'response', origin: { kind: 'model', model: 'test' }, uuid: 'default-1',
    message: { type: 'assistant', role: 'assistant', content: [{ type: 'text', text: 'Run `git status`.' }] } })
  const calls = f.requests.filter(one => one.operation === 'mark_chat' || one.operation === 'mark_chat_parts')
  expect(calls).toEqual([])
})

test('session changes affect new turns while stored messages and active turns keep their modes', { options: { chat_marks: 'all' } }, async ($, on) => {
  const f = fixture()
  f.marker = request => `${request.text} [${request.scope}]`
  engine(on, f)
  on('ui.render', { component: 'AssistantMessage' }, (_, e) => ({ type: 'Text', children: [e.props.text] }))
  await $.session.start(SESSION)
  await $.turn.start({ turnId: 'turn-1', text: 'first' })
  await $.command.run({ command: 'textprov', args: 'prose', origin: ORIGIN, presentation: PRESENTATION })
  const first = await $.session.append({ door: 'response', origin: { kind: 'model', model: 'test' }, uuid: 'pinned-1',
    message: { type: 'assistant', role: 'assistant', content: [{ type: 'text', text: 'first' }] } })
  expect(first.message!.content[0]!.text).toBe('first [all]')
  const redraw = await $.ui.render({ surface: 'terminal', component: 'AssistantMessage', requestId: 'pinned-1', props: { text: String(first.message!.content[0]!.text), isFirstOfReply: true } })
  expect(redraw).toMatchObject({ type: 'Text', children: ['first [all]'] })
  const unknown = await $.ui.render({ surface: 'terminal', component: 'AssistantMessage', requestId: 'historic-1', props: { text: 'history', isFirstOfReply: true } })
  expect(unknown).toMatchObject({ type: 'Text', children: ['history'] })
  await $.turn.complete({ turnId: 'turn-1', answer: 'first', isAborted: false, durationMs: 10, reason: 'answer' })
  expect(observed(f.requests).find(one => one.event_kind === 'assistant_message')!.text).toBe('first [all]')
  await $.turn.start({ turnId: 'turn-2', text: 'second' })
  await $.turn.complete({ turnId: 'turn-2', answer: 'second', isAborted: false, durationMs: 10, reason: 'answer' })
  expect(observed(f.requests).at(-1)!.text).toBe('second')
  const prompt = await $.prompt.submit({ text: 'next prompt', wait: false, origin: ORIGIN })
  expect(prompt.text).toBe('next prompt')
  const status = await $.command.run({ command: 'textprov', args: 'status', origin: ORIGIN, presentation: PRESENTATION })
  expect(status.text).toContain('"chat_marks": "prose"')
})

test('next mode is consumed by exactly one main turn and never a child turn', async ($, on) => {
  const f = fixture()
  f.marker = request => `${request.text} [${request.scope}]`
  engine(on, f)
  await $.session.start(SESSION)
  await $.command.run({ command: 'textprov', args: 'all --next', origin: ORIGIN, presentation: PRESENTATION })
  await $.turn.start({ turnId: 'child', text: 'child', agentId: 'agent-1' })
  await $.turn.complete({ turnId: 'child', answer: 'child', agentId: 'agent-1', isAborted: false, durationMs: 10, reason: 'answer' })
  await $.turn.start({ turnId: 'one', text: 'one' })
  await $.turn.complete({ turnId: 'one', answer: 'one', isAborted: false, durationMs: 10, reason: 'answer' })
  await $.turn.start({ turnId: 'two', text: 'two' })
  await $.turn.complete({ turnId: 'two', answer: 'two', isAborted: false, durationMs: 10, reason: 'answer' })
  expect(observed(f.requests).filter(one => one.event_kind === 'assistant_message').map(one => one.text)).toEqual(['child', 'one [all]', 'two'])
  const invalid = await $.command.run({ command: 'textprov', args: 'all unknown', origin: ORIGIN, presentation: PRESENTATION })
  expect(invalid.text).toContain('usage:')
})

test('plain copy is explicit, selected-text-only, and reports unavailable selection and clipboard', async ($, on) => {
  const f = fixture()
  f.copies = []
  engine(on, f, request => request.operation === 'strip_marks' ? 'git status' : undefined)
  await $.session.start(SESSION)
  const absent = await $.command.run({ command: 'textprov', args: 'copy --plain', origin: ORIGIN, presentation: PRESENTATION })
  expect(absent.text).toContain('No selected text')
  expect(f.copies).toEqual([])
  f.selection = { text: 'marked command' }
  const copied = await $.command.run({ command: 'textprov', args: 'copy --plain', origin: ORIGIN, presentation: PRESENTATION })
  expect(copied.text).toContain('Copied selected text')
  expect(f.copies).toEqual(['git status'])
  f.copyRefused = true
  const refused = await $.command.run({ command: 'textprov', args: 'copy --plain', origin: ORIGIN, presentation: PRESENTATION })
  expect(refused.text).toContain('no-clipboard')
  expect(f.requests.filter(one => one.operation === 'strip_marks').map(one => one.text)).toEqual(['marked command', 'marked command'])
  expect(observed(f.requests)).toEqual([])
})


test('stored response marking receives all text blocks together and drawing never reclassifies a fragment', { options: { chat_marks: 'all' } }, async ($, on) => {
  const f = fixture()
  engine(on, f)
  on('ui.render', { component: 'AssistantMessage' }, (_, e) => ({ type: 'Text', children: [e.props.text] }))
  await $.session.start(SESSION)
  const response = await $.session.append({ door: 'response', origin: { kind: 'model', model: 'test' }, uuid: 'split-fence',
    message: { type: 'assistant', role: 'assistant', content: [
      { type: 'text', text: '```sh\n' },
      { type: 'thinking', thinking: 'private' },
      { type: 'text', text: 'git status\n```' },
    ] } })
  expect(f.requests.find(one => one.operation === 'mark_chat_parts')!.parts).toEqual(['```sh\n', 'git status\n```'])
  expect(response.message!.content[1]!.thinking).toBe('private')
  const before = f.requests.length
  const rendered = await $.ui.render({ surface: 'terminal', component: 'AssistantMessage', requestId: 'split-fence', props: { text: 'git status\n```', isFirstOfReply: false } })
  expect(rendered).toMatchObject({ type: 'Text', children: ['git status\n```'] })
  expect(f.requests.length).toBe(before)
})


for (const scope of ['all', 'prose', 'none', 'remove', 'off'] as const) {
  test(`configured chat scope ${scope} controls ingress and new assistant messages`, { options: { chat_marks: scope } }, async ($, on) => {
    const f = fixture()
    engine(on, f)
    await $.session.start(SESSION)
    await $.prompt.submit({ text: 'configured prompt', wait: false, origin: ORIGIN })
    await $.session.append({ door: 'response', origin: { kind: 'model', model: 'test' }, uuid: `configured-${scope}`,
      message: { type: 'assistant', role: 'assistant', content: [{ type: 'text', text: 'configured response' }] } })
    expect(f.requests.filter(one => one.operation === 'mark_chat' || one.operation === 'mark_chat_parts').map(one => one.scope)).toEqual(scope === 'all' || scope === 'remove' ? [scope, scope] : [])
  })
}

test('framed paste text shares Markdown context while host tags remain unchanged', { options: { chat_marks: 'all' } }, async ($, on) => {
  const f = fixture()
  engine(on, f)
  await $.session.start(SESSION)
  const text = '```sh\n<pasted_content id="p1">git status</pasted_content id="p1">\n```'
  const result = await $.prompt.submit({ text, wait: false, origin: ORIGIN })
  expect(result.text).toBe(text)
  const call = f.requests.find(one => one.operation === 'mark_chat_parts')!
  expect(call.parts).toEqual(['```sh\n', 'git status', '\n```'])
  expect(call.role).toBe('user')
  expect(call.scope).toBe('all')
})

test('prose marks document edits while prompts, stored chat and progress observations stay unchanged', async ($, on) => {
  const f = fixture()
  f.tools = []
  // An older core would mark chat prose. The adapter must not request that
  // operation in document-only mode, even during a mixed-version upgrade.
  f.marker = request => request.operation === 'mark_chat' ? `${request.text} [unexpected chat mark]`
    : request.operation === 'mark_document_edit' ? `${request.new_text} [document marked]` : undefined
  engine(on, f)
  await $.session.start(SESSION)
  await $.command.run({ command: 'textprov', args: 'prose', origin: ORIGIN, presentation: PRESENTATION })
  const prompt = '@docs/planning/phase-4.md\nPlease execute the plan.'
  expect((await $.prompt.submit({ text: prompt, wait: false, origin: ORIGIN })).text).toBe(prompt)
  await $.turn.start({ turnId: 'document-only', text: prompt })
  const answer = 'Wave 1 is running: four subagents in separate worktrees.'
  const stored = await $.session.append({ door: 'response', origin: { kind: 'model', model: 'test' }, uuid: 'document-only-answer',
    message: { type: 'assistant', role: 'assistant', content: [{ type: 'text', text: answer }] } })
  expect(stored.message!.content[0]!.text).toBe(answer)
  await $.tool.call({ tool: 'Write', file_path: '/project/guide.md', content: 'New document prose.', tool_use_id: 'doc-write' })
  expect(f.tools![0]!.content).toBe('New document prose. [document marked]')
  await $.turn.complete({ turnId: 'document-only', answer, isAborted: false, durationMs: 10, reason: 'answer' })
  expect(observed(f.requests).find(one => one.event_kind === 'assistant_message')!.text).toBe(answer)
})

test('none leaves Write input untouched and remove strips processed file output', async ($, on) => {
  const f = fixture()
  f.tools = []
  engine(on, f, request => request.operation === 'strip_marks' ? 'Supplied file text' : undefined)
  await $.session.start(SESSION)
  await $.command.run({ command: 'textprov', args: 'none', origin: ORIGIN, presentation: PRESENTATION })
  await $.tool.call({ tool: 'Write', file_path: '/project/guide.md', content: 'Supplied file text', tool_use_id: 'none-write' })
  expect(f.tools![0]!.content).toBe('Supplied file text')
  expect(f.requests.filter(request => request.operation === 'mark_document_edit')).toEqual([])
  await $.command.run({ command: 'textprov', args: 'remove', origin: ORIGIN, presentation: PRESENTATION })
  await $.tool.call({ tool: 'Write', file_path: '/project/example.py', content: 'Supplied󠄁 file text', tool_use_id: 'remove-write' })
  expect(f.tools![1]!.content).toBe('Supplied file text')
  expect(f.requests.find(request => request.operation === 'strip_marks')!.text).toBe('Supplied󠄁 file text')
})
