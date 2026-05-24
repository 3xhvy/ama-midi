import { ActivityAggregator } from './aggregate-actions'
import type { ActivityActor } from '../events'

const actor: ActivityActor = { id: 'u1', name: 'Huy', avatarUrl: null }

function action(at: number, weight = 1) {
  return {
    type: 'NOTE_CREATED' as const,
    at,
    weight,
    label: `note at ${at}`,
  }
}

describe('ActivityAggregator', () => {
  it('emits individual results for the first three actions', () => {
    const agg = new ActivityAggregator()
    expect(agg.push(actor, action(1000)).kind).toBe('individual')
    expect(agg.push(actor, action(2000)).kind).toBe('individual')
    const third = agg.push(actor, action(3000))
    expect(third).toMatchObject({ kind: 'individual' })
  })

  it('replaces the first three toasts when the fourth action crosses the burst threshold', () => {
    const agg = new ActivityAggregator()
    agg.push(actor, action(1000))
    agg.push(actor, action(2000))
    agg.push(actor, action(3000))

    const result = agg.push(actor, action(4000))

    expect(result.kind).toBe('burst')
    if (result.kind !== 'burst') throw new Error('expected burst')
    expect(result.burst.total).toBe(4)
    expect(result.replacedToastIds).toEqual([
      'activity-u1-1000-0',
      'activity-u1-1000-1',
      'activity-u1-1000-2',
    ])
  })

  it('emits burst updates after the threshold', () => {
    const agg = new ActivityAggregator()
    agg.push(actor, action(1000))
    agg.push(actor, action(2000))
    agg.push(actor, action(3000))
    agg.push(actor, action(4000))

    const result = agg.push(actor, action(5000))

    expect(result.kind).toBe('burst-update')
    if (result.kind !== 'burst-update') throw new Error('expected update')
    expect(result.burst.total).toBe(5)
  })

  it('starts a new window after thirty seconds from the first action', () => {
    const agg = new ActivityAggregator()
    agg.push(actor, action(1000))
    agg.push(actor, action(2000))
    agg.push(actor, action(3000))

    const result = agg.push(actor, action(32001))

    expect(result.kind).toBe('individual')
    if (result.kind !== 'individual') throw new Error('expected individual')
    expect(result.toastId).toBe('activity-u1-32001-0')
  })

  it('uses weight to create an immediate burst for a large batch', () => {
    const agg = new ActivityAggregator()
    const result = agg.push(actor, {
      type: 'NOTE_CREATED',
      at: 1000,
      weight: 15,
      label: '15 pasted notes',
    })

    expect(result.kind).toBe('burst')
    if (result.kind !== 'burst') throw new Error('expected burst')
    expect(result.burst.total).toBe(15)
    expect(result.replacedToastIds).toEqual([])
  })
})
