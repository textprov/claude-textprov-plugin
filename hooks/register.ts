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
const VERSION = '0.1.2' // keep in step with .claude-plugin/plugin.json
const ADAPTER = `claude-textprov-plugin/${VERSION}`
const COMMAND = 'textprov'
const KEEP = 500
/** The loop key of the main conversation in the `turns` map; subagents use their agent id. */
const MAIN = 'main'
/** How soon an unanswered capture is retried on its own, if no event retries it first. */
const RETRY_MS = 500
/** How many times a capture is handed to the bridge before it is given up as a failure. */
const ATTEMPTS = 3
/** How many sessions' failure lists `$.store` keeps, this one included. */
const STORED_SESSIONS = 10
/** A pasted block as the host wraps it in the prompt text. */
const PASTE = /<pasted_content id="([^"]+)">([\s\S]*?)<\/pasted_content id="\1">/g

const observations = atom({ plugin: 'textprov', key: 'observations' } as const, [] as TextprovObservation[])
const failures = atom({ plugin: 'textprov', key: 'failures' } as const, [] as TextprovFailure[])
const sequence = atom({ plugin: 'textprov', key: 'sequence' } as const, 0)
const pending = atom({ plugin: 'textprov', key: 'pending' } as const, null as TextprovPending | null)
const turns = atom({ plugin: 'textprov', key: 'turns' } as const, {} as Record<string, TextprovTurn>)
const adapter = atom({ plugin: 'textprov', key: 'adapter' } as const, null as string | null)
const backlog = atom({ plugin: 'textprov', key: 'backlog' } as const, [] as TextprovCapture[])
const since = atom({ plugin: 'textprov', key: 'since' } as const, null as string | null)
const captureNamespace = atom({ plugin: 'textprov', key: 'captureNamespace' } as const, null as string | null)

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

function storeKey(sessionId: string): string {
  return `failures:${sessionId}`
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

/** Records a failure for the session, in state and in the store, so a resumed process still lists it. */
async function fail($: EngineInterface, key: string, error: string): Promise<void> {
  const failed = await update($, failures, list => [...list, { key, error, at: new Date().toISOString() }].slice(-KEEP))
  await $.store.set(storeKey(await $.session.id()), failed)
  await showStatus($)
}

async function observe($: EngineInterface, options: PluginOptions, capture: TextprovCapture): Promise<string | undefined> {
  const seq = capture.sequence ?? (await nextSequence($))
  const host = await $.session.version()
  const ran = await bridge($, options, {
    operation: 'observe',
    provider: PROVIDER,
    adapter: (await read($, adapter)) ?? ADAPTER,
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
    attributes: capture.attributes ?? {},
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

function loopIds(agentId: string | undefined): Record<string, string> {
  return agentId === undefined ? {} : { agent: agentId }
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
  attributes?: Record<string, boolean>,
): Promise<ToolCallResult> {
  await flush($, options)
  const turn = await runningTurn($, e.agentId)
  const hostIds = {
    tool_call: e.tool_use_id,
    path,
    ...(turn === undefined ? {} : { turn: turn.turnId }),
    ...loopIds(e.agentId),
  }
  const common = { agentId: e.agentId, tool: e.tool, path, attributes }
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
      hostIds: { tool_call: e.tool_use_id, ...loopIds(e.agentId) },
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
    hostIds: { tool_call: e.tool_use_id, ...loopIds(e.agentId) },
    ...common,
  })
  return ran
}

const CLAIM_USAGE = [
  'usage: /textprov claim <id> <start> <end> <voice-id> [definition...] [--support <id>] [--cross-agent]',
  '  records that scalars [start, end) of the observation belong to a voice.',
  '  start and end count Unicode scalars from 0, end excluded, on grapheme boundaries;',
  '  inspect shows scalar_length. voice-id is a TextProv voice such as Voice1;',
  '  Voice0 is unattributed text and needs no claim. The definition says who the voice is.',
  '  example: /textprov claim 5410ad26 0 152 Voice1 the person typing at the prompt',
  '  --support may be repeated; --cross-agent permits support within this provider/session.',
  '  use -- before a definition containing words that begin with --.',
].join('\n')

const HELP = [
  '/textprov                      list what this process captured',
  '/textprov list --session [--cross-agent] [--limit N] [--before <id>]',
  '                               page durable session metadata with full observation IDs',
  '/textprov status               bridge, core, database and plugin state',
  '/textprov inspect <id> [--cross-agent]    metadata, ID joins, claims and text expiry',
  '/textprov match <src> <dst> [--policy exact-v1|line-endings-v1|common-indent-v1]',
  '                               [--partial] [--min-chars N] [--cross-agent]',
  '/textprov claim <id> <start> <end> <voice-id> [definition...]',
  '                               record an explicit attribution claim on a scalar range',
  '/textprov transfer <JSON>      accept a selected passage and selected supplied claims',
  '/textprov resolve <JSON>       show resolved claims and unattributed gaps',
  '/textprov export <JSON>        return experimental classification text and its report',
  'IDs may be unambiguous prefixes of observation IDs listed by /textprov.',
  'Matching defaults to exact-v1, full source, minimum 16 scalars for partial candidates.',
  'Cross-agent operations stay within one provider/session; no match creates a claim.',
  CLAIM_USAGE,
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

/** A full UUID is an identifier, never permission to read another session. */
async function scopedInspection($: EngineInterface, options: PluginOptions, id: string, crossAgent: boolean): Promise<Record<string, unknown>> {
  const ran = await bridge($, options, { operation: 'inspect', observation_id: id, cross_agent: crossAgent })
  if (!ran.ok) throw new Error(ran.error)
  if (ran.result === null || typeof ran.result !== 'object') throw new Error('core returned no observation metadata')
  const info = ran.result as Record<string, unknown>
  if (info.provider !== PROVIDER || info.session_id !== (await $.session.id())) throw new Error('observation is outside the current Claude provider/session')
  if (!crossAgent && info.agent_id !== null) throw new Error('observation belongs to another agent; use --cross-agent within this session')
  return info
}

function pretty(value: unknown): string {
  return JSON.stringify(value, null, 2)
}

async function sessionState($: EngineInterface, options: PluginOptions): Promise<Record<string, unknown>> {
  const ran = await bridge($, options, { operation: 'session', provider: PROVIDER, session_id: await $.session.id() })
  if (!ran.ok) return { error: ran.error }
  return ran.result !== null && typeof ran.result === 'object' ? (ran.result as Record<string, unknown>) : {}
}

// Command output is shown under the command's name, so none of it repeats "textprov:".

async function listing($: EngineInterface, options: PluginOptions): Promise<string> {
  const list = await read($, observations)
  const failed = await read($, failures)
  const waiting = await read($, backlog)
  const lines = [`${list.length} observation${list.length === 1 ? '' : 's'} captured by this process since ${await read($, since)}`]
  const session = await sessionState($, options)
  if (typeof session.observations === 'number') lines.push(`the chronicle holds ${session.observations} for this session`)
  for (const one of list) {
    const where = one.path !== undefined ? ` ${one.path}` : ''
    const agent = one.agentId !== undefined ? ` agent=${one.agentId}` : ''
    const tool = one.tool !== undefined ? ` ${one.tool}` : ''
    lines.push(
      `  ${short(one.id)}  ${one.kind.padEnd(17)} ${one.channel.padEnd(9)} ${String(one.chars).padStart(6)} chars${tool}${where}${agent}`,
    )
  }
  if (waiting.length > 0) lines.push(`${waiting.length} capture${waiting.length === 1 ? '' : 's'} waiting to be retried`)
  if (failed.length > 0) {
    const last = failed[failed.length - 1]!
    lines.push(`${failed.length} capture failure${failed.length === 1 ? '' : 's'} this session; the last one: ${last.key}: ${last.error}`)
  }
  if (list.length === 0 && failed.length === 0) lines.push('  nothing captured yet')
  return lines.join('\n')
}

/** What the bridge cannot know: this plugin, this host, this session and its capture state. */
async function pluginStatus($: EngineInterface, options: PluginOptions): Promise<Record<string, unknown>> {
  const list = await read($, observations)
  const failed = await read($, failures)
  const host = await $.session.version()
  const pinned = (await read($, adapter)) ?? ADAPTER
  return {
    adapter: pinned,
    policy_version: pinned,
    loaded_version: VERSION,
    host_version: host.version,
    session_id: await $.session.id(),
    since: await read($, since),
    capture_namespace: await read($, captureNamespace),
    sequence: await read($, sequence),
    observations: list.length,
    to_retry: (await read($, backlog)).length,
    failures: failed.length,
    ...(failed.length === 0 ? {} : { last_failure: failed[failed.length - 1] }),
    session: await sessionState($, options),
  }
}

/** Explicit comparison and scope options; positional claim text stays literal after --. */
function commandOptions(verb: string, words: string[]) {
  const positional: string[] = []
  const supporting: string[] = []
  let crossAgent = false
  let policy = 'exact-v1'
  let partial = false
  let minChars = 16
  for (let index = 0; index < words.length; index += 1) {
    const word = words[index]!
    if (word === '--') {
      positional.push(...words.slice(index + 1))
      break
    }
    if (word === '--cross-agent') crossAgent = true
    else if (word === '--partial' && verb === 'match') partial = true
    else if ((word === '--policy' || word === '--min-chars') && verb === 'match') {
      const value = words[++index]
      if (value === undefined || value.startsWith('--')) throw new Error(`${word} needs a value`)
      if (word === '--policy') {
        if (!['exact-v1', 'line-endings-v1', 'common-indent-v1'].includes(value)) throw new Error(`unknown comparison policy "${value}"`)
        policy = value
      } else {
        if (!/^[1-9]\d*$/.test(value) || !Number.isSafeInteger(Number(value))) throw new Error('--min-chars must be a positive whole number')
        minChars = Number(value)
      }
    } else if (word === '--support' && verb === 'claim') {
      const value = words[++index]
      if (value === undefined || value.startsWith('--')) throw new Error('--support needs an observation ID')
      supporting.push(value)
    } else if (word.startsWith('--')) throw new Error(`unknown option "${word}" for ${verb}`)
    else positional.push(word)
  }
  return { positional, supporting, crossAgent, policy, partial, minChars }
}

async function sessionListing($: EngineInterface, options: PluginOptions, words: string[]): Promise<string> {
  if (!words.includes('--session')) return 'usage: /textprov list --session [--cross-agent] [--limit N] [--before <id>]'
  let crossAgent = false
  let limit = 100
  let before: string | undefined
  for (let index = 0; index < words.length; index += 1) {
    const word = words[index]!
    if (word === '--session') continue
    if (word === '--cross-agent') crossAgent = true
    else if (word === '--limit') {
      const value = words[++index] ?? ''
      if (!/^[1-9]\d*$/.test(value) || Number(value) > 1000) return '--limit must be a whole number from 1 to 1000'
      limit = Number(value)
    } else if (word === '--before') {
      const value = words[++index]
      if (value === undefined || value.startsWith('--')) return '--before needs an observation ID'
      before = await resolve($, value)
    } else return `unknown option "${word}" for session listing`
  }
  const scope = { provider: PROVIDER, session_id: await $.session.id(), agent_id: null, cross_agent: crossAgent }
  const ran = await bridge($, options, { operation: 'list_observations', ...scope, limit, ...(before === undefined ? {} : { before_id: before }) })
  return ran.ok ? pretty({ scope, ...(ran.result as Record<string, unknown>) }) : ran.error
}

async function runCommand($: EngineInterface, options: PluginOptions, args: string): Promise<string> {
  await flush($, options)
  // JSON keeps hashes, claim IDs and voice mappings explicit, and preserves
  // spaces inside definitions. No candidate, hash or classification is guessed.
  const raw = args.trim().match(/^(transfer|resolve|export)(?:\s+([\s\S]*))?$/)
  if (raw !== null) {
    const operation = raw[1]!
    if (raw[2] === undefined) return `usage: /textprov ${operation} <JSON object of core arguments>`
    let payload: unknown
    try {
      payload = JSON.parse(raw[2])
    } catch {
      return `${operation} needs a valid JSON object`
    }
    if (payload === null || typeof payload !== 'object' || Array.isArray(payload)) return `${operation} needs a JSON object`
    const request = { ...(payload as Record<string, unknown>) }
    if ('operation' in request) return 'operation is selected by the subcommand; omit it from the JSON object'
    if ('cross_agent' in request && typeof request.cross_agent !== 'boolean') return 'cross_agent must be a boolean'
    const crossAgent = request.cross_agent === true
    for (const name of ['observation_id', 'source_id', 'target_id']) {
      if (typeof request[name] === 'string') {
        request[name] = await resolve($, request[name])
        await scopedInspection($, options, request[name] as string, crossAgent)
      }
    }
    // resolve/export have no core cross-agent parameter; this flag controls
    // access to their selected observation in the host session only.
    if (operation !== 'transfer') delete request.cross_agent
    const ran = await bridge($, options, { ...request, operation })
    return ran.ok ? pretty(ran.result) : ran.error
  }
  const words = args.trim().split(/\s+/).filter(word => word !== '')
  const verb = words[0] ?? 'list'
  switch (verb) {
    case 'list':
      return words.length <= 1 ? listing($, options) : sessionListing($, options, words.slice(1))
    case 'help':
      return HELP
    case 'status': {
      const ran = await bridge($, options, { operation: 'status' })
      const plugin = await pluginStatus($, options)
      if (!ran.ok) return pretty({ bridge_error: ran.error, plugin })
      const report = ran.result !== null && typeof ran.result === 'object' ? ran.result : { result: ran.result }
      return pretty({ ...report, plugin })
    }
    case 'inspect': {
      const flags = commandOptions(verb, words.slice(1))
      if (flags.positional.length !== 1) return 'usage: /textprov inspect <id> [--cross-agent]'
      const id = await resolve($, flags.positional[0]!)
      return pretty(await scopedInspection($, options, id, flags.crossAgent))
    }
    case 'match': {
      const flags = commandOptions(verb, words.slice(1))
      if (flags.positional.length !== 2) return 'usage: /textprov match <source-id> <target-id> [--policy <policy>] [--partial] [--min-chars N] [--cross-agent]'
      const source = await resolve($, flags.positional[0]!)
      const target = await resolve($, flags.positional[1]!)
      await Promise.all([source, target].map(id => scopedInspection($, options, id, flags.crossAgent)))
      const ran = await bridge($, options, {
        operation: 'match',
        source_id: source,
        target_id: target,
        cross_agent: flags.crossAgent,
        policy: flags.policy,
        partial: flags.partial,
        min_match_chars: flags.minChars,
      })
      return ran.ok ? pretty(ran.result) : ran.error
    }
    case 'claim': {
      const flags = commandOptions(verb, words.slice(1))
      const [given, start, end, voice, ...rest] = flags.positional
      if (given === undefined || start === undefined || end === undefined || voice === undefined) return CLAIM_USAGE
      if (!/^\d+$/.test(start) || !/^\d+$/.test(end)) return `start and end must be whole numbers\n${CLAIM_USAGE}`
      const id = await resolve($, given)
      const info = await scopedInspection($, options, id, flags.crossAgent)
      const hash = info.content_hash
      if (typeof hash !== 'string') return 'that observation has no content hash; nothing can be claimed on it'
      const supporting = await Promise.all(flags.supporting.map(given => resolve($, given)))
      await Promise.all(supporting.map(id => scopedInspection($, options, id, flags.crossAgent)))
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
        policy_version: (await read($, adapter)) ?? ADAPTER,
        supporting_ids: supporting,
        cross_agent: flags.crossAgent,
      })
      return ran.ok ? `claim ${String(ran.result)} recorded on ${short(id)} [${start}, ${end}) for ${voice}` : ran.error
    }
    default:
      return `unknown subcommand "${verb}"\n${HELP}`
  }
}

/** Keeps the store to the last few sessions' failure lists, this session's always included. */
async function pruneStore($: EngineInterface, mine: string): Promise<void> {
  const others = (await $.store.keys()).filter(key => key.startsWith('failures:') && key !== storeKey(mine))
  for (const key of others.slice(0, Math.max(0, others.length - (STORED_SESSIONS - 1)))) await $.store.delete(key)
}

export const register: Register = (on, options) => {
  on('session.start', async ($, e, next) => {
    await $.command.register({
      name: COMMAND,
      description: 'TextProv attribution chronicle: inspect, compare, claim, transfer, resolve and export',
      argumentHint: '[list|status|inspect <id>|match <src> <dst>|claim <id> <start> <end> <VoiceN>|transfer <JSON>|resolve <JSON>|export <JSON>]',
    })
    const id = await $.session.id()
    // Hydrate durable failures before initialization can append another one.
    // Otherwise a namespace failure could overwrite the previous process's history.
    const stored = await $.store.get(storeKey(id))
    if (Array.isArray(stored)) await update($, failures, list => (list.length === 0 ? (stored as TextprovFailure[]) : list))
    await pruneStore($, id)
    // The adapter string is pinned at the session's first load. A hot reload
    // of a newer module keeps recording under it, so the chronicle's duplicate
    // check (scope, adapter, delivery key) holds for the whole session.
    await update($, adapter, current => current ?? ADAPTER)
    // The session summary is an observational snapshot, not an allocator.
    // Separate resumed processes need separate identities even if both seed
    // their counters from the same snapshot. Hot reload preserves this atom.
    try {
      await update($, captureNamespace, current => current ?? crypto.randomUUID())
    } catch (error) {
      await fail($, 'capture_namespace', `cannot establish capture identity: ${String(error)}`)
    }
    await update($, since, current => current ?? new Date().toISOString())
    // A resumed session keeps its id but not this module's counter; the chronicle
    // already holds this session's last capture_sequence, so the counter continues
    // from it for continuity. Capture identity comes from the process namespace,
    // not this non-atomic counter; concurrent processes may share a sequence.
    const seeded = await bridge($, options, { operation: 'session', provider: PROVIDER, session_id: id })
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
    const namespace = await read($, captureNamespace)
    if (namespace === null) {
      await fail($, 'prompt', 'capture identity unavailable; submission was not captured')
      return next(e)
    }
    const seq = await nextSequence($)
    const key = `prompt:${namespace}:${seq}`
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
    // Each pasted block is also recorded on its own, exactly as the host
    // delivered it inside its wrapper, so a later layer can look for its source
    // without the wrapper in the way.
    for (const [, id, body] of ran.text.matchAll(PASTE)) {
      await observe($, options, {
        key: `${key}:paste:${id}`,
        kind: 'pasted_block',
        channel: 'user',
        visibility: 'stored',
        text: body!,
        hostIds: { prompt: key, paste: id! },
      })
    }
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
    captureTool($, options, e, e.new_string, e.file_path, () => next(e), e.old_string, { replace_all: e.replace_all ?? false }),
  )

  // The task a subagent is given is assistant text written in the parent's
  // loop. It is recorded there with the Agent call's id and the started agent's
  // id; every capture in the subagent's loop carries that agent id too, so the
  // two sides join on `agent` although they sit in different scopes.
  on('agent.spawn', async ($, e, next) => {
    const ran = await next(e)
    if (ran.deny !== undefined || ran.agentId === undefined) return ran
    const turn = await runningTurn($, e.parentAgentId)
    await observe($, options, {
      key: `agent:${ran.agentId}:task`,
      kind: 'agent_task',
      channel: 'assistant',
      visibility: 'model',
      text: e.prompt,
      hostIds: {
        agent: ran.agentId,
        ...(e.tool_use_id === '' ? {} : { tool_call: e.tool_use_id }),
        ...(turn === undefined ? {} : { turn: turn.turnId }),
        ...(e.parentAgentId === undefined ? {} : { parent_agent: e.parentAgentId }),
      },
      agentId: e.parentAgentId,
      tool: 'Agent',
    })
    return ran
  })

  // The final answer as the engine reports it: display text, not the stored
  // row, so it is recorded with display visibility. An aborted turn that
  // produced no text leaves no answer row.
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
        hostIds: {
          turn: e.turnId,
          ...(started?.submission === undefined ? {} : { prompt: started.submission }),
          ...loopIds(e.agentId),
        },
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
