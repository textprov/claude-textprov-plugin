import { expect, test } from 'claude-code/testing'
import type { On } from 'claude-code'

type Request = Record<string, unknown>

const ORIGIN = { kind: 'composer' } as const
const PRESENTATION = { isFullscreen: false, columns: 80 } as const

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
  on('tool.call', () => ({ result: {} }))
  on('turn.complete', (_, e) => ({ text: e.answer }))
  on('process.run', (_, e) => {
    const request = JSON.parse(e.init?.stdin ?? '{}') as Request
    requests.push(request)
    const result = answer?.(request) ?? (request.operation === 'observe' ? `obs-${++minted}` : {})
    return {
      value: { exitCode: 0, stdout: JSON.stringify({ result }), stderr: '', isStdoutTruncated: false, isStderrTruncated: false },
    }
  })
}

test('a submission is observed as stored user text, with no claim', async ($, on) => {
  const requests: Request[] = []
  engine(on, requests)
  await $.session.start({ cwd: '/project', surface: 'terminal', isInteractive: true })
  await $.prompt.submit({ text: 'Keep the original wording.', wait: false, origin: ORIGIN })

  expect(requests.length).toBe(1)
  const observed = requests[0]!
  expect(observed.operation).toBe('observe')
  expect(observed.event_kind).toBe('submission')
  expect(observed.channel).toBe('user')
  expect(observed.visibility).toBe('stored')
  expect(observed.text).toBe('Keep the original wording.')
  expect(observed.session_id).toBe('session-test')
  expect(observed.provider).toBe('claude')
  expect(observed.completeness).toBe('complete')
})

test('a slash command is not a submission', async ($, on) => {
  const requests: Request[] = []
  engine(on, requests)
  await $.session.start({ cwd: '/project', surface: 'terminal', isInteractive: true })
  await $.prompt.submit({ text: '/textprov', command: { name: 'textprov', args: '' }, wait: false, origin: ORIGIN })
  expect(requests.length).toBe(0)
})

test('a Write is observed as a call and a result joined by tool_call', async ($, on) => {
  const requests: Request[] = []
  engine(on, requests)
  await $.session.start({ cwd: '/project', surface: 'terminal', isInteractive: true })
  await $.tool.call({ tool: 'Write', file_path: '/project/notes.md', content: 'Draft: Keep the original wording.' })

  const call = requests.find(one => one.event_kind === 'tool_call')
  const result = requests.find(one => one.event_kind === 'tool_result')
  expect(call).toBeDefined()
  expect(result).toBeDefined()
  expect(call!.text).toBe('Draft: Keep the original wording.')
  expect(call!.channel).toBe('assistant')
  expect(call!.visibility).toBe('model')
  expect((call!.host_ids as Record<string, string>).path).toBe('/project/notes.md')
  const id = (call!.host_ids as Record<string, string>).tool_call
  expect(typeof id).toBe('string')
  expect((result!.host_ids as Record<string, string>).tool_call).toBe(id)
  expect(result!.channel).toBe('tool')
  expect(result!.visibility).toBe('structured')
  expect(String(call!.delivery_key)).toBe(`${id}:call`)
  expect(String(result!.delivery_key)).toBe(`${id}:result`)
})

test('the list command shows what was captured and the status command adds the plugin to the bridge report', async ($, on) => {
  const requests: Request[] = []
  engine(on, requests, request => (request.operation === 'status' ? { core: { available: true } } : undefined))
  await $.session.start({ cwd: '/project', surface: 'terminal', isInteractive: true })
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
  await $.session.start({ cwd: '/project', surface: 'terminal', isInteractive: true })
  const submitted = await $.prompt.submit({ text: 'hello', wait: false, origin: ORIGIN })
  expect(submitted.text).toBe('hello')

  const listed = await $.command.run({ command: 'textprov', args: 'list', origin: ORIGIN, presentation: PRESENTATION })
  expect(listed.text).toContain('0 observations this session')
  expect(listed.text).toContain('1 capture failure')
  expect(listed.text).toContain('no chronicle module')
})
