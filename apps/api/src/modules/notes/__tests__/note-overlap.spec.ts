import { noteEnd, noteRange, overlapsAny, rangesOverlap, findOverlapping, notesOverlap } from '../note-overlap'

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

describe('pattern paste overlap helpers', () => {
  it('treats tap notes at the same track and time as overlapping', () => {
    expect(notesOverlap(
      { track: 2, time: 42.5, noteType: 'TAP' },
      { track: 2, time: 42.5, noteType: 'TAP' },
    )).toBe(true)
  })

  it('does not conflict across different tracks', () => {
    expect(notesOverlap(
      { track: 2, time: 42.5, noteType: 'TAP' },
      { track: 3, time: 42.5, noteType: 'TAP' },
    )).toBe(false)
  })

  it('finds an existing hold note that overlaps a pasted tap', () => {
    const existing = [
      { id: 'n1', track: 4, time: 10, noteType: 'HOLD', duration: 2 },
    ]
    expect(findOverlapping({ track: 4, time: 11, noteType: 'TAP' }, existing)?.id).toBe('n1')
  })
})
