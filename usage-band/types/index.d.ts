export type Limit = { percent: number; resetsAt?: string }

export type Usage = {
  contextPercent?: number
  contextTokens?: number
  fiveHour?: Limit
  sevenDay?: Limit
  costUsd?: number
}

declare module 'claude-code' {
  interface PluginState {
    'usage-band': {
      usage: Usage | null
      isHidden: boolean
      lastRequestAt: number | null
      now: number
    }
  }
}
