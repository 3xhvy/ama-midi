import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { unwrapActivityPayload } from '../src/features/collaboration/activity-payload.ts'

describe('unwrapActivityPayload', () => {
  it('unwraps activity payloads', () => {
    const actor = { id: 'u1', name: 'Huy', avatarUrl: null }
    const result = unwrapActivityPayload({ actor, data: { id: 'n1' } })
    assert.deepEqual(result, {
      actor,
      data: { id: 'n1' },
    })
  })

  it('keeps legacy payloads usable', () => {
    const result = unwrapActivityPayload({ id: 'n1' })
    assert.deepEqual(result, {
      actor: null,
      data: { id: 'n1' },
    })
  })
})
