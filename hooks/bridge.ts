import type { EngineInterface, PluginOptions } from 'claude-code'

/** One JSON request for scripts/textprov_bridge.py: the chronicle's operation and its keyword arguments. */
export type BridgeRequest = { operation: string } & Record<string, unknown>

/** `retryable`: the bridge never answered (the host killed it, or could not start it), so the same request may be run again. */
export type BridgeResult = { ok: true; result: unknown } | { ok: false; error: string; retryable?: true }

function text(options: PluginOptions, name: string): string | undefined {
  const value = options[name]
  return typeof value === 'string' && value.trim() !== '' ? value.trim() : undefined
}

/**
 * Runs one chronicle operation through the Python bridge in a separate process.
 *
 * Every call opens and closes the project's database, so parallel hook
 * dispatches and other hook processes share it safely. A refusal from the
 * core (an invalid range, a reused delivery key) comes back as `{ ok: false }`
 * with the core's reason; nothing is retried or guessed here.
 */
export async function bridge(
  $: EngineInterface,
  options: PluginOptions,
  request: BridgeRequest,
): Promise<BridgeResult> {
  const argv = [
    text(options, 'python') ?? 'python3',
    `${$.plugin.root}/scripts/textprov_bridge.py`,
    '--root',
    await $.session.root(),
  ]
  const checkout = text(options, 'textprov_python')
  if (checkout !== undefined) argv.push('--textprov-python', checkout)
  const dataDir = text(options, 'data_dir')
  if (dataDir !== undefined) argv.push('--data-dir', dataDir)

  let ran
  try {
    ran = await $.process.run(argv, { stdin: JSON.stringify(request), timeoutMs: 20_000 })
  } catch (error) {
    // An interrupt aborts the dispatch this hook runs in, and that kills its
    // child; the request itself was sound, so the caller may run it again. A
    // refusal from the core, below, is final.
    return { ok: false, error: `bridge did not run: ${String(error)}`, retryable: true }
  }

  if (ran.exitCode === 0) {
    const parsed = parse(ran.stdout)
    if (parsed !== undefined && 'result' in parsed) return { ok: true, result: parsed.result }
    return { ok: false, error: `bridge printed no result: ${ran.stdout.trim().slice(0, 200)}` }
  }
  const parsed = parse(ran.stderr)
  if (parsed !== undefined && typeof parsed.error === 'string') return { ok: false, error: parsed.error }
  const tail = (ran.stderr.trim() || ran.stdout.trim()).slice(-300)
  return { ok: false, error: `bridge exited ${ran.exitCode}: ${tail}` }
}

function parse(source: string): Record<string, unknown> | undefined {
  try {
    const value: unknown = JSON.parse(source)
    return value !== null && typeof value === 'object' ? (value as Record<string, unknown>) : undefined
  } catch {
    return undefined
  }
}
