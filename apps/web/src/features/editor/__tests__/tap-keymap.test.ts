import { describe, it, expect } from 'vitest'
import { getTrackFromTapKey, isTapKey, TAP_KEY_TO_TRACK } from '../tap-keymap'

describe('tap-keymap', () => {
  it('maps home row keys to tracks 1–8', () => {
    expect(TAP_KEY_TO_TRACK.a).toBe(1)
    expect(TAP_KEY_TO_TRACK.f).toBe(4)
    expect(TAP_KEY_TO_TRACK.j).toBe(5)
    expect(TAP_KEY_TO_TRACK[';']).toBe(8)
  })

  it('getTrackFromTapKey is case-insensitive', () => {
    expect(getTrackFromTapKey('A')).toBe(1)
    expect(getTrackFromTapKey('K')).toBe(6)
  })

  it('isTapKey rejects digit keys used for zoom', () => {
    expect(isTapKey('1')).toBe(false)
    expect(isTapKey('a')).toBe(true)
  })
})
