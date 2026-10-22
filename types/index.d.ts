// State contract of the textprov mod: the values it keeps in `$.state`.

/** One observation this session recorded, as the chronicle acknowledged it. */
export type TextprovObservation = {
  /** The chronicle's observation UUID. */
  id: string
  /** The adapter's delivery key, stable per event. */
  key: string
  /** The chronicle's event_kind: submission, tool_call, tool_result, assistant_message. */
  kind: string
  /** Where the text arrived: user, assistant, tool, engine. */
  channel: string
  /** Unicode scalar count of the recorded text; 0 for an unobserved block. */
  chars: number
  /** The built-in tool, for tool_call and tool_result observations. */
  tool?: string
  /** The file the tool call named, when it named one. */
  path?: string
  /** The subagent the event belonged to; absent for the main conversation. */
  agentId?: string
}

/** A capture the bridge refused or could not run; the event is not in the chronicle. */
export type TextprovFailure = {
  key: string
  error: string
}

declare module 'claude-code' {
  interface PluginState {
    textprov: {
      observations: TextprovObservation[]
      failures: TextprovFailure[]
      sequence: number
    }
  }
}
