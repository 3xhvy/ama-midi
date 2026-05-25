/** Home-row keys → track lanes (avoids zoom shortcuts 1/2/4/8). */
export const TAP_KEY_TO_TRACK: Record<string, number> = {
  a: 1,
  s: 2,
  d: 3,
  f: 4,
  j: 5,
  k: 6,
  l: 7,
  ';': 8,
}

export const TRACK_TO_TAP_KEY: Record<number, string> = {
  1: 'A',
  2: 'S',
  3: 'D',
  4: 'F',
  5: 'J',
  6: 'K',
  7: 'L',
  8: ';',
}

export function getTrackFromTapKey(key: string): number | null {
  return TAP_KEY_TO_TRACK[key.toLowerCase()] ?? null
}

export function isTapKey(key: string): boolean {
  return key.toLowerCase() in TAP_KEY_TO_TRACK
}
