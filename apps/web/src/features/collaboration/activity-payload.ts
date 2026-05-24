import type { ActivityActor, RealtimeActivityPayload } from '@ama-midi/shared'

export function unwrapActivityPayload<T>(
  payload: T | RealtimeActivityPayload<T>,
): { actor: ActivityActor | null; data: T } {
  if (
    payload &&
    typeof payload === 'object' &&
    'actor' in payload &&
    'data' in payload
  ) {
    return payload as RealtimeActivityPayload<T>
  }
  return { actor: null, data: payload as T }
}
