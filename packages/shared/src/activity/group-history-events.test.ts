import { groupHistoryEvents } from './group-history-events'
import type { EditorEventRow } from '../events'

function row(id: string, userId: string, createdAt: string, eventType = 'NOTE_CREATED'): EditorEventRow {
  return {
    id,
    songId: 'song-1',
    chartId: 'chart-1',
    entityType: 'NOTE',
    entityId: id,
    eventType: eventType as EditorEventRow['eventType'],
    userId,
    beforeState: null,
    afterState: { track: 1, time: 1 },
    batchId: null,
    undoable: true,
    undoneByEventId: null,
    createdAt,
    user: { id: userId, name: userId, avatarUrl: null },
  }
}

describe('groupHistoryEvents', () => {
  it('leaves one to three events as individual rows', () => {
    const grouped = groupHistoryEvents([
      row('e3', 'u1', '2026-05-24T10:00:03.000Z'),
      row('e2', 'u1', '2026-05-24T10:00:02.000Z'),
      row('e1', 'u1', '2026-05-24T10:00:01.000Z'),
    ])

    expect(grouped).toHaveLength(3)
    expect(grouped.every(item => item.kind === 'event')).toBe(true)
  })

  it('groups four same-user events within thirty seconds', () => {
    const grouped = groupHistoryEvents([
      row('e4', 'u1', '2026-05-24T10:00:04.000Z'),
      row('e3', 'u1', '2026-05-24T10:00:03.000Z'),
      row('e2', 'u1', '2026-05-24T10:00:02.000Z'),
      row('e1', 'u1', '2026-05-24T10:00:01.000Z'),
    ])

    expect(grouped).toHaveLength(1)
    expect(grouped[0]).toMatchObject({ kind: 'burst', total: 4 })
  })

  it('does not group different users together', () => {
    const grouped = groupHistoryEvents([
      row('e4', 'u2', '2026-05-24T10:00:04.000Z'),
      row('e3', 'u1', '2026-05-24T10:00:03.000Z'),
      row('e2', 'u1', '2026-05-24T10:00:02.000Z'),
      row('e1', 'u1', '2026-05-24T10:00:01.000Z'),
    ])

    expect(grouped).toHaveLength(4)
  })

  it('starts a new group after thirty seconds', () => {
    const grouped = groupHistoryEvents([
      row('e4', 'u1', '2026-05-24T10:00:40.000Z'),
      row('e3', 'u1', '2026-05-24T10:00:03.000Z'),
      row('e2', 'u1', '2026-05-24T10:00:02.000Z'),
      row('e1', 'u1', '2026-05-24T10:00:01.000Z'),
    ])

    expect(grouped).toHaveLength(4)
  })
})
