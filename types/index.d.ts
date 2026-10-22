// State contract of the textprov mod: the values it keeps in `$.state`.

/** One observation this session recorded, as the chronicle acknowledged it. */
export type TextprovObservation = {
  /** The chronicle's observation UUID. */
  id: string
  /** The adapter's delivery key, stable per event. */
  key: string
  /** The chronicle's event_kind: submission, tool_call, tool_anchor, tool_result, assistant_message. */
  kind: string
  /** Where the text arrived: user, assistant, tool, engine. */
  channel: string
  /** Unicode scalar count of the recorded text; 0 for an unobserved block. */
  chars: number
  /** The built-in tool, for tool_call, tool_anchor and tool_result observations. */
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

/** A submission recorded while the session was idle, waiting for the main-loop turn that starts with it. */
export type TextprovPending = {
  /** The submission's delivery key, also its `prompt` host ID. */
  key: string
  /** The text as it entered the turn, matched against `turn.start`. */
  text: string
}

/** A running turn, kept per loop ('main' or the agent id) from turn.start to turn.complete. */
export type TextprovTurn = {
  turnId: string
  /** The delivery key of the submission that started the turn, when one was matched. */
  submission?: string
}

declare module 'claude-code' {
  interface PluginState {
    textprov: {
      observations: TextprovObservation[]
      failures: TextprovFailure[]
      /** The last capture_sequence handed out; seeded from the chronicle at session start. */
      sequence: number
      pending: TextprovPending | null
      turns: Record<string, TextprovTurn>
    }
  }
}
