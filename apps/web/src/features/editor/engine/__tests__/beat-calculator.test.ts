import {
  beatDuration, measureDuration, timeToBeat, beatToTime, snapTime,
} from '../beat-calculator'

describe('beat-calculator', () => {
  it('beatDuration: 120bpm → 0.5s', () => {
    expect(beatDuration(120)).toBe(0.5)
  })

  it('measureDuration: 120bpm 4/4 → 2.0s', () => {
    expect(measureDuration(120, '4/4')).toBe(2)
  })

  it('timeToBeat: 0s @ 120bpm → bar 1 beat 1', () => {
    expect(timeToBeat(0, 120)).toEqual({ measure: 1, beat: 1 })
  })

  it('timeToBeat: 0.5s @ 120bpm → bar 1 beat 2', () => {
    expect(timeToBeat(0.5, 120)).toEqual({ measure: 1, beat: 2 })
  })

  it('timeToBeat: 2.0s @ 120bpm → bar 2 beat 1', () => {
    expect(timeToBeat(2.0, 120)).toEqual({ measure: 2, beat: 1 })
  })

  it('beatToTime: bar 2 beat 1 @ 120bpm → 2.0s', () => {
    expect(beatToTime(2, 1, 120)).toBe(2)
  })

  it('snapTime 0.1s mode: 0.27 → 0.3', () => {
    expect(snapTime(0.27, '0.1s', 120)).toBeCloseTo(0.3, 5)
  })

  it('snapTime beat mode: 0.6 @ 120bpm → 0.5', () => {
    expect(snapTime(0.6, 'beat', 120)).toBe(0.5)
  })

  it('snapTime halfBeat mode: 0.4 @ 120bpm → 0.5', () => {
    expect(snapTime(0.4, 'halfBeat', 120)).toBe(0.5)
  })
})
