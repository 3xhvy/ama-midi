import { noteEnd, noteRange, overlapsAny, rangesOverlap } from '../note-overlap'

describe('note-overlap', () => {
  it('treats HOLD span as time + duration', () => {
    expect(noteEnd({ time: 2, noteType: 'HOLD', duration: 1.5 })).toBe(3.5)
  })

  it('detects HOLD overlapping TAP inside its span', () => {
    const hold = { time: 4, noteType: 'HOLD', duration: 2 }
    const tap = { time: 5, noteType: 'TAP', duration: null }
    expect(overlapsAny(hold, [tap])).toBe(true)
  })

  it('allows adjacent HOLD and TAP at hold end time', () => {
    const hold = { time: 4, noteType: 'HOLD', duration: 2 }
    const tap = { time: 6, noteType: 'TAP', duration: null }
    expect(rangesOverlap(noteRange(hold), noteRange(tap))).toBe(false)
  })
})
