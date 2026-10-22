import { atom, read, update } from 'claude-code'
import type { EngineInterface, PluginOptions, Register, ToolCallResult } from 'claude-code'

import type { TextprovFailure, TextprovObservation } from '../types'
import { bridge } from './bridge'

// Claude adapter for the shared TextProv chronicle. It records observations and
// correlates them by host IDs. It never assigns authorship: a submission is a
// submission, a tool input is a tool input, and a claim exists only when the
// person makes one with `/textprov claim`.

const PROVIDER = 'claude'
const ADAPTER = 'claude-textprov-plugin/0.1.0'
const POLICY = 'claude-textprov-plugin/0.1.0'
const COMMAND = 'textprov'
const KEEP = 500

const observations = atom({ plugin: 'textprov', key: 'observations' } as const, [] as TextprovObservation[])
const failures = atom({ plugin: 'textprov', key: 'failures' } as const, [] as TextprovFailure[])
const sequence = atom({ plugin: 'textprov', key: 'sequence' } as const, 0)

type Visibility = 'structured' | 'model' | 'stored' | 'display'
type Completeness = 'complete' | 'partial' | 'truncated' | 'unobserved'

type Capture = {
  key: string
  kind: string
  channel: string
  visibility: Visibility
  /** `null` records that the block existed but its text was not observed. */
  text: string | null
  completeness?: Completeness
  hostIds?: Record<string, string>
  agentId?: string
  tool?: string
  path?: string
}

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

async function observe(
  $: EngineInterface,
  options: PluginOptions,
  capture: Capture,
): Promise<string | undefined> {
  const seq = await nextSequence($)
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
  if (!ran.ok || typeof ran.result !== 'string') {
    const error = ran.ok ? 'bridge answered no observation id' : ran.error
    const failed = await update($, failures, list => [...list, { key: capture.key, error }].slice(-KEEP))
    $.ui.status(`textprov: ${failed.length} capture failure${failed.length === 1 ? '' : 's'}`)
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
  const list = await update($, observations, list =>
    list.some(one => one.id === row.id) ? list : [...list, row].slice(-KEEP),
  )
  $.ui.status(`textprov: ${list.length} observed`)
  return row.id
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
): Promise<ToolCallResult> {
  const hostIds = { tool_call: e.tool_use_id, path }
  const common = { agentId: e.agentId, tool: e.tool, path }
  const pending = observe($, options, {
    key: `${e.tool_use_id}:call`,
    kind: 'tool_call',
    channel: 'assistant',
    visibility: 'model',
    text,
    hostIds,
    ...common,
  })
  const ran = await run()
  await pending
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
  '/textprov status               bridge, core and database state',
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
  return given
}

function pretty(value: unknown): string {
  return JSON.stringify(value, null, 2)
}

async function listing($: EngineInterface): Promise<string> {
  const list = await read($, observations)
  const failed = await read($, failures)
  const lines = [`textprov: ${list.length} observation${list.length === 1 ? '' : 's'} this session`]
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

async function runCommand($: EngineInterface, options: PluginOptions, args: string): Promise<string> {
  const words = args.trim().split(/\s+/).filter(word => word !== '')
  const verb = words[0] ?? 'list'
  switch (verb) {
    case 'list':
      return listing($)
    case 'help':
      return HELP
    case 'status': {
      const ran = await bridge($, options, { operation: 'status' })
      return ran.ok ? `textprov status\n${pretty(ran.result)}` : `textprov: bridge failed: ${ran.error}`
    }
    case 'inspect': {
      if (words[1] === undefined) return 'usage: /textprov inspect <id>'
      const id = await resolve($, words[1])
      const ran = await bridge($, options, { operation: 'inspect', observation_id: id })
      return ran.ok ? pretty(ran.result) : `textprov: ${ran.error}`
    }
    case 'match': {
      if (words[1] === undefined || words[2] === undefined) return 'usage: /textprov match <source-id> <target-id>'
      const ran = await bridge($, options, {
        operation: 'match',
        source_id: await resolve($, words[1]),
        target_id: await resolve($, words[2]),
      })
      return ran.ok ? pretty(ran.result) : `textprov: ${ran.error}`
    }
    case 'claim': {
      const [, given, start, end, voice, ...rest] = words
      if (given === undefined || start === undefined || end === undefined || voice === undefined) {
        return 'usage: /textprov claim <id> <start> <end> <voice-id> [definition...]'
      }
      const id = await resolve($, given)
      const info = await bridge($, options, { operation: 'inspect', observation_id: id })
      if (!info.ok) return `textprov: ${info.error}`
      const hash = (info.result as { content_hash?: unknown }).content_hash
      if (typeof hash !== 'string') return 'textprov: that observation has no content hash; nothing can be claimed on it'
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
      return ran.ok ? `claim ${String(ran.result)} recorded on ${short(id)} [${start}, ${end}) for ${voice}` : `textprov: ${ran.error}`
    }
    default:
      return `textprov: unknown subcommand "${verb}"\n${HELP}`
  }
}

export const register: Register = (on, options) => {
  on('session.start', async ($, e, next) => {
    await $.command.register({
      name: COMMAND,
      description: 'TextProv attribution chronicle: list, status, inspect, match, claim',
      argumentHint: '[list|status|inspect <id>|match <src> <dst>|claim <id> <start> <end> <voice>]',
    })
    return next(e)
  })

  on('command.run', { command: COMMAND }, async ($, e) => {
    try {
      return { text: await runCommand($, options, e.args) }
    } catch (error) {
      return { text: `textprov: ${error instanceof Error ? error.message : String(error)}` }
    }
  })

  // A submission is observed as it enters the turn, after every rewrite above
  // and beneath. Slash commands and hidden prompts are not submissions.
  on('prompt.submit', async ($, e, next) => {
    const ran = await next(e)
    if (e.command !== undefined || e.isMeta === true || ran.drop !== undefined) return ran
    await observe($, options, {
      key: `prompt:${await nextSequence($)}`,
      kind: 'submission',
      channel: 'user',
      visibility: 'stored',
      text: ran.text,
      hostIds: e.turnId === undefined ? {} : { turn: e.turnId },
    })
    return ran
  })

  on('tool.call', { tool: 'Write' }, ($, e, next) =>
    captureTool($, options, e, e.content, e.file_path, () => next(e)),
  )

  on('tool.call', { tool: 'Edit' }, ($, e, next) =>
    captureTool($, options, e, e.new_string, e.file_path, () => next(e)),
  )

  // The final answer as the engine reports it: display text, not the stored
  // row, so it is recorded with display visibility.
  on('turn.complete', async ($, e, next) => {
    const ran = await next(e)
    if (e.answer !== '') {
      await observe($, options, {
        key: `turn:${e.turnId}:answer`,
        kind: 'assistant_message',
        channel: 'assistant',
        visibility: 'display',
        text: e.answer,
        completeness: e.isAborted ? 'partial' : 'complete',
        hostIds: { turn: e.turnId },
        agentId: e.agentId,
      })
    }
    return ran
  })
}
