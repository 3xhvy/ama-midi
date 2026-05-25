import { classifySlots, detectInternalCollision, filterInternalOverlaps, filterUnchangedEchoes, isUnchangedEcho } from '../note-slot-preview'

describe('detectInternalCollision', () => {
  it('returns true when two incoming slots overlap', () => {
    expect(detectInternalCollision([
      { sourceIndex: 0, sourceNoteId: 'a', track: 1, time: 5.0, noteType: 'TAP', title: 'A', description: '' },
      { sourceIndex: 1, sourceNoteId: 'b', track: 1, time: 5.0, noteType: 'TAP', title: 'B', description: '' },
    ])).toBe(true)
  })
})

describe('filterInternalOverlaps', () => {
  it('keeps the first note and drops a duplicate at the same track+time', () => {
    const filtered = filterInternalOverlaps([
      { sourceIndex: 0, sourceNoteId: 'a', track: 1, time: 5.0, noteType: 'TAP', title: 'A', description: '' },
      { sourceIndex: 1, sourceNoteId: 'b', track: 1, time: 5.0, noteType: 'TAP', title: 'B', description: '' },
    ])
    expect(filtered).toHaveLength(1)
    expect(filtered[0].sourceNoteId).toBe('a')
  })

  it('drops a tap that lands inside an earlier hold span', () => {
    const filtered = filterInternalOverlaps([
      { sourceIndex: 0, sourceNoteId: 'hold', track: 1, time: 10.0, noteType: 'HOLD', duration: 2, title: 'Hold', description: '' },
      { sourceIndex: 1, sourceNoteId: 'tap', track: 1, time: 11.0, noteType: 'TAP', title: 'Tap', description: '' },
    ])
    expect(filtered).toHaveLength(1)
    expect(filtered[0].sourceNoteId).toBe('hold')
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

  it('returns conflict when incoming tap overlaps an existing hold span', () => {
    const result = classifySlots(
      [{ sourceIndex: 0, sourceNoteId: 'a', track: 1, time: 12.0, noteType: 'TAP', title: 'A', description: '' }],
      [{ id: 'hold-1', track: 1, time: 10.0, noteType: 'HOLD', duration: 5 }],
      new Set(),
    )
    expect(result.conflicts).toHaveLength(1)
    expect(result.conflicts[0].conflictId).toBe('hold-1')
    expect(result.creatable).toHaveLength(0)
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

describe('isUnchangedEcho', () => {
  it('treats identical TAP at same slot as echo', () => {
    expect(isUnchangedEcho(
      { track: 1, time: 0, noteType: 'TAP', duration: null },
      { track: 1, time: 0, noteType: 'TAP', duration: null },
    )).toBe(true)
  })

  it('treats different note types at same start as not an echo', () => {
    expect(isUnchangedEcho(
      { track: 1, time: 0, noteType: 'HOLD', duration: 1.2 },
      { track: 1, time: 0, noteType: 'TAP', duration: null },
    )).toBe(false)
  })
})

describe('filterUnchangedEchoes', () => {
  const existing = [{ id: 'ex-1', track: 1, time: 0, noteType: 'TAP', duration: null }]

  it('removes echoed existing notes before classification', () => {
    const filtered = filterUnchangedEchoes(
      [
        { sourceIndex: 0, sourceNoteId: '0', track: 1, time: 0, noteType: 'TAP', title: 'Echo', description: '' },
        { sourceIndex: 1, sourceNoteId: '1', track: 2, time: 1, noteType: 'TAP', title: 'New', description: '' },
      ],
      existing,
    )
    expect(filtered).toHaveLength(1)
    expect(filtered[0].track).toBe(2)
  })
})
