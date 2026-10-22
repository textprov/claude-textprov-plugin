import { expect, test } from 'claude-code/testing'
import type { On } from 'claude-code'

type Request = Record<string, unknown>
type Ids = Record<string, string>

const ORIGIN = { kind: 'composer' } as const
const PRESENTATION = { isFullscreen: false, columns: 80 } as const
const SESSION = { cwd: '/project', surface: 'terminal', isInteractive: true } as const

/** Stands in for the engine and for the Python bridge: every request is kept, every observe answered with a fresh id. */
function engine(on: On, requests: Request[], answer?: (request: Request) => unknown) {
  let minted = 0
  on('session.start', (_, e) => ({ cwd: e.cwd }))
  on('command.register', () => ({ value: { command: 'textprov' } }))
  on('session.id', () => ({ value: 'session-test' }))
  on('session.root', () => ({ value: '/project' }))
  on('session.version', () => ({ value: { version: '0.0.0-test' } }))
  on('ui.status', () => ({ value: undefined }))
  on('prompt.submit', (_, e) => ({ text: e.text }))
  on('turn.start', (_, e) => ({ turnId: e.turnId }))
  on('tool.call', () => ({ result: {} }))
  on('turn.complete', (_, e) => ({ text: e.answer }))
  on('process.run', (_, e) => {
    const request = JSON.parse(e.init?.stdin ?? '{}') as Request
    requests.push(request)
    const given = answer?.(request)
    const result = given !== undefined ? given : request.operation === 'observe' ? `obs-${++minted}` : request.operation === 'sequence' ? 0 : {}
    return {
      value: { exitCode: 0, stdout: JSON.stringify({ result }), stderr: '', isStdoutTruncated: false, isStderrTruncated: false },
    }
  })
}

const observed = (requests: Request[]) => requests.filter(one => one.operation === 'observe')

test('a submission is observed as stored user text, with no claim', async ($, on) => {
  const requests: Request[] = []
  engine(on, requests)
  await $.session.start(SESSION)
  await $.prompt.submit({ text: 'Keep the original wording.', wait: false, origin: ORIGIN })

  const captured = observed(requests)
  expect(captured.length).toBe(1)
  const one = captured[0]!
  expect(one.event_kind).toBe('submission')
  expect(one.channel).toBe('user')
  expect(one.visibility).toBe('stored')
  expect(one.text).toBe('Keep the original wording.')
  expect(one.session_id).toBe('session-test')
  expect(one.provider).toBe('claude')
  expect(one.completeness).toBe('complete')
})

test('a slash command is not a submission', async ($, on) => {
  const requests: Request[] = []
  engine(on, requests)
  await $.session.start(SESSION)
  await $.prompt.submit({ text: '/textprov', command: { name: 'textprov', args: '' }, wait: false, origin: ORIGIN })
  expect(observed(requests).length).toBe(0)
})

test('the submission key carries its capture sequence, and the answer joins the prompt through the turn', async ($, on) => {
  const requests: Request[] = []
  engine(on, requests)
  await $.session.start(SESSION)
  await $.prompt.submit({ text: 'hello', wait: false, origin: ORIGIN })
  await $.turn.start({ text: 'hello', turnId: 'turn-1' })
  await $.turn.complete({ answer: 'Hi.', durationMs: 1, isAborted: false, turnId: 'turn-1', reason: 'answer' })

  const [submission, answer] = observed(requests)
  expect(submission!.delivery_key).toBe('prompt:1')
  expect(submission!.capture_sequence).toBe(1)
  expect((submission!.host_ids as Ids).prompt).toBe('prompt:1')
  expect((submission!.host_ids as Ids).turn).toBeUndefined()
  expect(answer!.event_kind).toBe('assistant_message')
  expect(answer!.capture_sequence).toBe(2)
  expect((answer!.host_ids as Ids).turn).toBe('turn-1')
  expect((answer!.host_ids as Ids).prompt).toBe('prompt:1')
})

test('a continued turn claims no submission', async ($, on) => {
  const requests: Request[] = []
  engine(on, requests)
  await $.session.start(SESSION)
  await $.turn.start({ text: '', turnId: 'turn-2' })
  await $.turn.complete({ answer: 'Done.', durationMs: 1, isAborted: false, turnId: 'turn-2', reason: 'answer' })

  const [answer] = observed(requests)
  expect((answer!.host_ids as Ids).turn).toBe('turn-2')
  expect((answer!.host_ids as Ids).prompt).toBeUndefined()
})

test('the sequence continues from the chronicle when a session is loaded again', async ($, on) => {
  const requests: Request[] = []
  engine(on, requests, request => (request.operation === 'sequence' ? 7 : undefined))
  await $.session.start(SESSION)
  expect(requests[0]!.operation).toBe('sequence')
  expect(requests[0]!.session_id).toBe('session-test')
  await $.prompt.submit({ text: 'again', wait: false, origin: ORIGIN })

  const [submission] = observed(requests)
  expect(submission!.delivery_key).toBe('prompt:8')
  expect(submission!.capture_sequence).toBe(8)
})

test('a Write is observed as a call and a result joined by tool_call and the running turn', async ($, on) => {
  const requests: Request[] = []
  engine(on, requests)
  await $.session.start(SESSION)
  await $.turn.start({ text: 'write it', turnId: 'turn-3' })
  await $.tool.call({ tool: 'Write', file_path: '/project/notes.md', content: 'Draft: Keep the original wording.' })

  const call = requests.find(one => one.event_kind === 'tool_call')
  const result = requests.find(one => one.event_kind === 'tool_result')
  expect(call).toBeDefined()
  expect(result).toBeDefined()
  expect(call!.text).toBe('Draft: Keep the original wording.')
  expect(call!.channel).toBe('assistant')
  expect(call!.visibility).toBe('model')
  expect((call!.host_ids as Ids).path).toBe('/project/notes.md')
  expect((call!.host_ids as Ids).turn).toBe('turn-3')
  const id = (call!.host_ids as Ids).tool_call
  expect(typeof id).toBe('string')
  expect((result!.host_ids as Ids).tool_call).toBe(id)
  expect(result!.channel).toBe('tool')
  expect(result!.visibility).toBe('structured')
  expect(String(call!.delivery_key)).toBe(`${id}:call`)
  expect(String(result!.delivery_key)).toBe(`${id}:result`)
  expect(requests.some(one => one.event_kind === 'tool_anchor')).toBe(false)
})

test('an Edit records its anchor beside the new string', async ($, on) => {
  const requests: Request[] = []
  engine(on, requests)
  await $.session.start(SESSION)
  await $.tool.call({
    tool: 'Edit',
    file_path: '/project/notes.md',
    old_string: '## Heading\n',
    new_string: '## Heading\n\nA new paragraph.\n',
  })

  const call = requests.find(one => one.event_kind === 'tool_call')
  const anchor = requests.find(one => one.event_kind === 'tool_anchor')
  expect(call!.text).toBe('## Heading\n\nA new paragraph.\n')
  expect(anchor!.text).toBe('## Heading\n')
  expect(anchor!.channel).toBe('assistant')
  expect(anchor!.visibility).toBe('model')
  const id = (call!.host_ids as Ids).tool_call
  expect((anchor!.host_ids as Ids).tool_call).toBe(id)
  expect((anchor!.host_ids as Ids).path).toBe('/project/notes.md')
  expect(String(anchor!.delivery_key)).toBe(`${id}:anchor`)
})

test('the list command shows what was captured and the status command adds the plugin to the bridge report', async ($, on) => {
  const requests: Request[] = []
  engine(on, requests, request => (request.operation === 'status' ? { core: { available: true } } : undefined))
  await $.session.start(SESSION)
  await $.prompt.submit({ text: 'hello', wait: false, origin: ORIGIN })

  const listed = await $.command.run({ command: 'textprov', args: '', origin: ORIGIN, presentation: PRESENTATION })
  expect(listed.text).toContain('1 observation this session')
  expect(listed.text).toContain('submission')
  expect(listed.text).toContain('obs-1'.slice(0, 8))
  expect(listed.text!.startsWith('textprov')).toBe(false)

  const status = await $.command.run({ command: 'textprov', args: 'status', origin: ORIGIN, presentation: PRESENTATION })
  expect(status.text).toContain('"available": true')
  expect(status.text).toContain('"adapter": "claude-textprov-plugin/0.1.0"')
  expect(status.text).toContain('"session_id": "session-test"')
  expect(status.text).toContain('"host_version": "0.0.0-test"')
  expect(status.text).toContain('"observations": 1')
  expect(status.text).toContain('"failures": 0')
  expect(requests[requests.length - 1]!.operation).toBe('status')
})

test('a bridge failure is reported, never silently dropped', async ($, on) => {
  const requests: Request[] = []
  on('session.start', (_, e) => ({ cwd: e.cwd }))
  on('command.register', () => ({ value: { command: 'textprov' } }))
  on('session.id', () => ({ value: 'session-test' }))
  on('session.root', () => ({ value: '/project' }))
  on('session.version', () => ({ value: { version: '0.0.0-test' } }))
  on('ui.status', () => ({ value: undefined }))
  on('prompt.submit', (_, e) => ({ text: e.text }))
  on('process.run', (_, e) => {
    requests.push(JSON.parse(e.init?.stdin ?? '{}') as Request)
    return {
      value: {
        exitCode: 1,
        stdout: '',
        stderr: JSON.stringify({ error: 'RuntimeError: textprov has no chronicle module' }),
        isStdoutTruncated: false,
        isStderrTruncated: false,
      },
    }
  })
  await $.session.start(SESSION)
  const submitted = await $.prompt.submit({ text: 'hello', wait: false, origin: ORIGIN })
  expect(submitted.text).toBe('hello')

  const listed = await $.command.run({ command: 'textprov', args: 'list', origin: ORIGIN, presentation: PRESENTATION })
  expect(listed.text).toContain('0 observations this session')
  // One failure for the sequence seed at session start, one for the submission.
  expect(listed.text).toContain('2 capture failures')
  expect(listed.text).toContain('no chronicle module')
})
