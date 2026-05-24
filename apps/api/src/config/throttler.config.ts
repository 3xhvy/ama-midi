const TTL_MS = 60_000

function readLimit(envKey: string, defaultLimit: number): number {
  // Never honor overrides in production — keeps VPS safe if .env is mis-copied.
  if (process.env.NODE_ENV === 'production') return defaultLimit
  const parsed = parseInt(process.env[envKey] ?? '', 10)
  return Number.isFinite(parsed) && parsed > 0 ? parsed : defaultLimit
}

export const globalThrottleLimit = readLimit('THROTTLE_GLOBAL_LIMIT', 100)

export const noteWriteThrottleLimit = readLimit('THROTTLE_NOTE_WRITE_LIMIT', 30)

export const globalThrottlerOptions = {
  name: 'global',
  ttl: TTL_MS,
  limit: globalThrottleLimit,
} as const

export const noteWriteThrottlerOptions = {
  default: { limit: noteWriteThrottleLimit, ttl: TTL_MS },
} as const
