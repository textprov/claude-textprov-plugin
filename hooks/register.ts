import { atom, read, update } from 'claude-code'
import type { EngineInterface, PluginOptions, Register, ToolCallResult } from 'claude-code'

import type {
  TextprovCapture,
  TextprovFailure,
  TextprovObservation,
  TextprovPending,
  TextprovTurn,
} from '../types'
import { bridge } from './bridge'

// Claude adapter for the shared TextProv chronicle. It records observations and
// correlates them by host IDs. It never assigns authorship: a submission is a
// submission, a tool input is a tool input, and a claim exists only when the
// person makes one with `/textprov claim`.

const PROVIDER = 'claude'
const VERSION = '0.1.1' // keep in step with .claude-plugin/plugin.json
const ADAPTER = `claude-textprov-plugin/${VERSION}`
const POLICY = ADAPTER
const COMMAND = 'textprov'
const KEEP = 500
/** The loop key of the main conversation in the `turns` map; subagents use their agent id. */
const MAIN = 'main'
/** How soon an unanswered capture is retried on its own, if no event retries it first. */
const RETRY_MS = 500
/** How many times a capture is handed to the bridge before it is given up as a failure. */
const ATTEMPTS = 3

const observations = atom({ plugin: 'textprov', key: 'observations' } as const, [] as TextprovObservation[])
const failures = atom({ plugin: 'textprov', key: 'failures' } as const, [] as TextprovFailure[])
const sequence = atom({ plugin: 'textprov', key: 'sequence' } as const, 0)
const pending = atom({ plugin: 'textprov', key: 'pending' } as const, null as TextprovPending | null)
const turns = atom({ plugin: 'textprov', key: 'turns' } as const, {} as Record<string, TextprovTurn>)
const backlog = atom({ plugin: 'textprov', key: 'backlog' } as const, [] as TextprovCapture[])

async function nextSequence($: EngineInterface): Promise<number> {
  let value = 0
  await update($, sequence, n => (value = n + 1))
  return value
}

function scalars(text: string): number {
  let count = 0
  for (const _ of text) count += 1
  return count
}

// The host labels the status line with the plugin's name, so the line itself
// carries only the counts.
async function showStatus($: EngineInterface): Promise<void> {
  const parts = [`${(await read($, observations)).length} observed`]
  const failed = (await read($, failures)).length
  if (failed > 0) parts.push(`${failed} failed`)
  const waiting = (await read($, backlog)).length
  if (waiting > 0) parts.push(`${waiting} to retry`)
  $.ui.status(parts.join(', '))
}

async function fail($: EngineInterface, key: string, error: string): Promise<void> {
  await update($, failures, list => [...list, { key, error }].slice(-KEEP))
  await showStatus($)
}

async function observe($: EngineInterface, options: PluginOptions, capture: TextprovCapture): Promise<string | undefined> {
  const seq = capture.sequence ?? (await nextSequence($))
  const host = await $.session.version()
  const ran = await bridge($, options, {
    operation: 'observe',
    provider: PROVIDER,
    adapter: ADAPTER,
    host_version: host.version,
    session_id: await $.session.id(),
    agent_id: capture.agentId ?? null,
    delivery_key: capture.key,
    event_kind: capture.kind,
    channel: capture.channel,
    visibility: capture.visibility,
    completeness: capture.completeness ?? (capture.text === null ? 'unobserved' : 'complete'),
    text: capture.text,
    host_ids: capture.hostIds ?? {},
    capture_sequence: seq,
  })
  if (!ran.ok) {
    const attempts = (capture.attempts ?? 0) + 1
    if (ran.retryable === true && attempts < ATTEMPTS) {
      // The interrupt that aborted this dispatch killed the bridge process, not
      // the event. The capture keeps its sequence number and is written by the
      // next dispatch, or by the timer when nothing else comes first.
      await update($, backlog, list => [...list, { ...capture, sequence: seq, attempts }])
      await showStatus($)
      $.clock.after(RETRY_MS, () => {
        void flush($, options)
      })
    } else {
      await fail($, capture.key, ran.error)
    }
    return undefined
  }
  if (typeof ran.result !== 'string') {
    await fail($, capture.key, 'bridge answered no observation id')
    return undefined
  }
  const row: TextprovObservation = {
    id: ran.result,
    key: capture.key,
    kind: capture.kind,
    channel: capture.channel,
    chars: capture.text === null ? 0 : scalars(capture.text),
    ...(capture.tool === undefined ? {} : { tool: capture.tool }),
    ...(capture.path === undefined ? {} : { path: capture.path }),
    ...(capture.agentId === undefined ? {} : { agentId: capture.agentId }),
  }
  await update($, observations, list => (list.some(one => one.id === row.id) ? list : [...list, row].slice(-KEEP)))
  await showStatus($)
  return row.id
}

/** Writes the captures an interrupt left behind; the chronicle takes a repeated key with the same payload as the same event. */
async function flush($: EngineInterface, options: PluginOptions): Promise<void> {
  let taken: TextprovCapture[] = []
  await update($, backlog, list => {
    taken = list
    return []
  })
  for (const capture of taken) await observe($, options, capture)
}

/** The turn running in a loop, as turn.start reported it; undefined between turns. */
async function runningTurn($: EngineInterface, agentId: string | undefined): Promise<TextprovTurn | undefined> {
  return (await read($, turns))[agentId ?? MAIN]
}

type ToolEnvelope = { tool: string; tool_use_id: string; agentId?: string }

/** Records a Write or Edit input before the tool runs, and its result after. */
async function captureTool(
  $: EngineInterface,
  options: PluginOptions,
  e: ToolEnvelope,
  text: string,
  path: string,
  run: () => Promise<ToolCallResult>,
  anchor?: string,
): Promise<ToolCallResult> {
  await flush($, options)
  const turn = await runningTurn($, e.agentId)
  const hostIds = { tool_call: e.tool_use_id, path, ...(turn === undefined ? {} : { turn: turn.turnId }) }
  const common = { agentId: e.agentId, tool: e.tool, path }
  const captures = [
    observe($, options, {
      key: `${e.tool_use_id}:call`,
      kind: 'tool_call',
      channel: 'assistant',
      visibility: 'model',
      text,
      hostIds,
      ...common,
    }),
  ]
  // An Edit's old_string: text the assistant quoted from the file to place
  // the edit. Recorded on its own so the attribution layer can tell anchor
  // lines repeated in new_string from text the edit inserted.
  if (anchor !== undefined) {
    captures.push(
      observe($, options, {
        key: `${e.tool_use_id}:anchor`,
        kind: 'tool_anchor',
        channel: 'assistant',
        visibility: 'model',
        text: anchor,
        hostIds,
        ...common,
      }),
    )
  }
  const ran = await run()
  await Promise.all(captures)
  if (ran.deny !== undefined) {
    await observe($, options, {
      key: `${e.tool_use_id}:result`,
      kind: 'tool_result',
      channel: 'engine',
      visibility: 'model',
      text: null,
      hostIds: { tool_call: e.tool_use_id },
      ...common,
    })
    return ran
  }
  // The model-facing text when the engine relays it; otherwise the structured
  // record, serialized here and labelled as such.
  const relayed = typeof ran.text === 'string' ? ran.text : undefined
  await observe($, options, {
    key: `${e.tool_use_id}:result`,
    kind: 'tool_result',
    channel: 'tool',
    visibility: relayed === undefined ? 'structured' : 'model',
    text: relayed ?? JSON.stringify(ran.result ?? null),
    hostIds: { tool_call: e.tool_use_id },
    ...common,
  })
  return ran
}

const HELP = [
  '/textprov                      list this session\'s observations',
  '/textprov status               bridge, core, database and plugin state',
  '/textprov inspect <id>         metadata, ID joins and claims of one observation',
  '/textprov match <src> <dst>    exact occurrences of the source block in the target',
  '/textprov claim <id> <start> <end> <voice> [definition...]',
  '                               record an explicit attribution claim on a scalar range',
  'IDs may be unambiguous prefixes of observation IDs listed by /textprov.',
].join('\n')

function short(id: string): string {
  return id.slice(0, 8)
}

async function resolve($: EngineInterface, given: string): Promise<string> {
  const list = await read($, observations)
  const hits = list.filter(one => one.id.startsWith(given))
  if (hits.length === 1) return hits[0]!.id
  if (hits.length > 1) throw new Error(`"${given}" matches ${hits.length} observations; give more characters`)
  if (/^[0-9a-f]{8}-[0-9a-f-]{27}$/i.test(given)) return given
  throw new Error(`no observation matches "${given}" in this process's list; an older one needs its full ID`)
}

function pretty(value: unknown): string {
  return JSON.stringify(value, null, 2)
}

// Command output is shown under the command's name, so none of it repeats "textprov:".

async function listing($: EngineInterface): Promise<string> {
  const list = await read($, observations)
  const failed = await read($, failures)
  const lines = [`${list.length} observation${list.length === 1 ? '' : 's'} this session`]
  for (const one of list) {
    const where = one.path !== undefined ? ` ${one.path}` : ''
    const agent = one.agentId !== undefined ? ` agent=${one.agentId}` : ''
    const tool = one.tool !== undefined ? ` ${one.tool}` : ''
    lines.push(
      `  ${short(one.id)}  ${one.kind.padEnd(17)} ${one.channel.padEnd(9)} ${String(one.chars).padStart(6)} chars${tool}${where}${agent}`,
    )
  }
  if (failed.length > 0) {
    lines.push(`${failed.length} capture failure${failed.length === 1 ? '' : 's'}; the last one: ${failed[failed.length - 1]!.error}`)
  }
  if (list.length === 0 && failed.length === 0) lines.push('  nothing captured yet')
  return lines.join('\n')
}

/** What the bridge cannot know: this plugin, this host, this session and its capture state. */
async function pluginStatus($: EngineInterface): Promise<Record<string, unknown>> {
  const list = await read($, observations)
  const failed = await read($, failures)
  const host = await $.session.version()
  return {
    adapter: ADAPTER,
    policy_version: POLICY,
    host_version: host.version,
    session_id: await $.session.id(),
    sequence: await read($, sequence),
    observations: list.length,
    failures: failed.length,
    ...(failed.length === 0 ? {} : { last_failure: failed[failed.length - 1]!.error }),
  }
}

async function runCommand($: EngineInterface, options: PluginOptions, args: string): Promise<string> {
  await flush($, options)
  const words = args.trim().split(/\s+/).filter(word => word !== '')
  const verb = words[0] ?? 'list'
  switch (verb) {
    case 'list':
      return listing($)
    case 'help':
      return HELP
    case 'status': {
      const ran = await bridge($, options, { operation: 'status' })
      const plugin = await pluginStatus($)
      if (!ran.ok) return pretty({ bridge_error: ran.error, plugin })
      const report = ran.result !== null && typeof ran.result === 'object' ? ran.result : { result: ran.result }
      return pretty({ ...report, plugin })
    }
    case 'inspect': {
      if (words[1] === undefined) return 'usage: /textprov inspect <id>'
      const id = await resolve($, words[1])
      const ran = await bridge($, options, { operation: 'inspect', observation_id: id })
      return ran.ok ? pretty(ran.result) : ran.error
    }
    case 'match': {
      if (words[1] === undefined || words[2] === undefined) return 'usage: /textprov match <source-id> <target-id>'
      const ran = await bridge($, options, {
        operation: 'match',
        source_id: await resolve($, words[1]),
        target_id: await resolve($, words[2]),
      })
      return ran.ok ? pretty(ran.result) : ran.error
    }
    case 'claim': {
      const [, given, start, end, voice, ...rest] = words
      if (given === undefined || start === undefined || end === undefined || voice === undefined) {
        return 'usage: /textprov claim <id> <start> <end> <voice-id> [definition...]'
      }
      const id = await resolve($, given)
      const info = await bridge($, options, { operation: 'inspect', observation_id: id })
      if (!info.ok) return info.error
      const hash = (info.result as { content_hash?: unknown }).content_hash
      if (typeof hash !== 'string') return 'that observation has no content hash; nothing can be claimed on it'
      const ran = await bridge($, options, {
        operation: 'claim',
        observation_id: id,
        start: Number(start),
        end: Number(end),
        content_hash: hash,
        voice_context: `claude:${await $.session.id()}`,
        voice_id: voice,
        voice_definition: rest.length > 0 ? rest.join(' ') : `"${voice}" as supplied by the person through /textprov claim`,
        basis: 'user_command',
        policy_version: POLICY,
        supporting_ids: [],
      })
      return ran.ok ? `claim ${String(ran.result)} recorded on ${short(id)} [${start}, ${end}) for ${voice}` : ran.error
    }
    default:
      return `unknown subcommand "${verb}"\n${HELP}`
  }
}

export const register: Register = (on, options) => {
  on('session.start', async ($, e, next) => {
    await $.command.register({
      name: COMMAND,
      description: 'TextProv attribution chronicle: list, status, inspect, match, claim',
      argumentHint: '[list|status|inspect <id>|match <src> <dst>|claim <id> <start> <end> <voice>]',
    })
    // A resumed session keeps its id but not this module's counter; the chronicle
    // already holds this session's last capture_sequence, so the counter continues
    // from it and no `prompt:N` key is minted twice in the session's scope.
    const seeded = await bridge($, options, { operation: 'session', provider: PROVIDER, session_id: await $.session.id() })
    const last = seeded.ok ? (seeded.result as { last_sequence?: unknown }).last_sequence : undefined
    if (typeof last === 'number') {
      await update($, sequence, n => Math.max(n, last))
    } else {
      await fail($, 'session', seeded.ok ? 'bridge answered no last_sequence' : seeded.error)
    }
    return next(e)
  })

  on('command.run', { command: COMMAND }, async ($, e) => {
    try {
      return { text: await runCommand($, options, e.args) }
    } catch (error) {
      return { text: error instanceof Error ? error.message : String(error) }
    }
  })

  // A submission is observed as it enters the turn, after every rewrite above
  // and beneath. Slash commands and hidden prompts are not submissions. The key
  // carries the same number the record keeps as capture_sequence.
  //
  // The engine may start the turn inside `next(e)` (a headless run does), so
  // the submission is announced as pending before `next`, and the turn that
  // starts with its text claims it at turn.start, which may run before or after
  // this hook resumes. The answer joins the submission through `prompt` either
  // way; the submission records the turn only when it is already known here.
  //
  // A prompt typed while a turn runs is queued by the host, which may deliver
  // it into that turn, start the next turn with it, or never deliver it; this
  // hook fires at queueing and cannot tell. That turn is recorded as
  // `submitted_during`, a fact about timing, never as the prompt's `turn`.
  on('prompt.submit', async ($, e, next) => {
    if (e.command !== undefined || e.isMeta === true) return next(e)
    await flush($, options)
    const seq = await nextSequence($)
    const key = `prompt:${seq}`
    await update($, pending, () => ({ key, text: e.text }))
    const ran = await next(e)
    if (ran.drop !== undefined) {
      await update($, pending, waiting => (waiting?.key === key ? null : waiting))
      return ran
    }
    const started = await runningTurn($, undefined)
    const hostIds: Record<string, string> = { prompt: key }
    if (started?.submission === key) hostIds.turn = started.turnId
    else if (e.turnId !== undefined) hostIds.submitted_during = e.turnId
    await observe($, options, {
      key,
      kind: 'submission',
      channel: 'user',
      visibility: 'stored',
      text: ran.text,
      hostIds,
      sequence: seq,
    })
    return ran
  })

  on('turn.start', async ($, e, next) => {
    let submission: string | undefined
    if (e.agentId === undefined) {
      const waiting = await read($, pending)
      if (waiting !== null && waiting.text.trim() === e.text.trim()) {
        submission = waiting.key
        await update($, pending, () => null)
      }
    }
    const turn: TextprovTurn = { turnId: e.turnId, ...(submission === undefined ? {} : { submission }) }
    await update($, turns, map => ({ ...map, [e.agentId ?? MAIN]: turn }))
    return next(e)
  })

  on('tool.call', { tool: 'Write' }, ($, e, next) =>
    captureTool($, options, e, e.content, e.file_path, () => next(e)),
  )

  on('tool.call', { tool: 'Edit' }, ($, e, next) =>
    captureTool($, options, e, e.new_string, e.file_path, () => next(e), e.old_string),
  )

  // The final answer as the engine reports it: display text, not the stored
  // row, so it is recorded with display visibility.
  on('turn.complete', async ($, e, next) => {
    const ran = await next(e)
    await flush($, options)
    const loop = e.agentId ?? MAIN
    const turn = (await read($, turns))[loop]
    const started = turn !== undefined && turn.turnId === e.turnId ? turn : undefined
    if (e.answer !== '') {
      await observe($, options, {
        key: `turn:${e.turnId}:answer`,
        kind: 'assistant_message',
        channel: 'assistant',
        visibility: 'display',
        text: e.answer,
        completeness: e.isAborted ? 'partial' : 'complete',
        hostIds: started?.submission === undefined ? { turn: e.turnId } : { turn: e.turnId, prompt: started.submission },
        agentId: e.agentId,
      })
    }
    if (started !== undefined) {
      await update($, turns, map => {
        const { [loop]: _, ...rest } = map
        return rest
      })
    }
    return ran
  })
}
