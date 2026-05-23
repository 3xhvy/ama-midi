import { classifySlots, detectInternalCollision } from '../note-slot-preview'

describe('detectInternalCollision', () => {
  it('returns true when two incoming slots overlap', () => {
    expect(detectInternalCollision([
      { sourceIndex: 0, sourceNoteId: 'a', track: 1, time: 5.0, noteType: 'TAP', title: 'A', description: '' },
      { sourceIndex: 1, sourceNoteId: 'b', track: 1, time: 5.0, noteType: 'TAP', title: 'B', description: '' },
    ])).toBe(true)
  })
})

describe('classifySlots', () => {
  const existing = [
    { id: 'ex-1', track: 1, time: 5.0, noteType: 'TAP', duration: null },
  ]

  it('returns creatable when slot is empty', () => {
    const result = classifySlots(
      [{ sourceIndex: 0, sourceNoteId: 'a', track: 2, time: 5.0, noteType: 'TAP', title: 'A', description: '' }],
      existing,
      new Set(),
    )
    expect(result.creatable).toHaveLength(1)
    expect(result.conflicts).toHaveLength(0)
    expect(result.internalCollision).toBe(false)
  })

  it('returns conflict when slot occupied', () => {
    const result = classifySlots(
      [{ sourceIndex: 0, sourceNoteId: 'a', track: 1, time: 5.0, noteType: 'TAP', title: 'A', description: '' }],
      existing,
      new Set(),
    )
    expect(result.conflicts).toHaveLength(1)
    expect(result.conflicts[0].conflictId).toBe('ex-1')
  })

  it('excludes ignored ids from overlap (MOVE)', () => {
    const result = classifySlots(
      [{ sourceIndex: 0, sourceNoteId: 'a', track: 1, time: 5.0, noteType: 'TAP', title: 'A', description: '' }],
      [{ id: 'a', track: 1, time: 5.0, noteType: 'TAP', duration: null }],
      new Set(['a']),
    )
    expect(result.creatable).toHaveLength(1)
    expect(result.conflicts).toHaveLength(0)
  })
})
