import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { CHART_READ_ONLY_MESSAGES, resolveChartEditAccess } from '../../../packages/shared/src/chart-edit-access.ts'

describe('resolveChartEditAccess', () => {
  it('denies edit for project READ permission', () => {
    const result = resolveChartEditAccess({
      isPlatformAdmin: false,
      platformRole: 'COMPOSER',
      projectPermission: 'READ',
      songStatus: 'DRAFT',
    })
    assert.equal(result.canEditChart, false)
    assert.equal(result.readOnlyReason, 'project_read')
    assert.match(CHART_READ_ONLY_MESSAGES.project_read, /read-only access/)
  })

  it('allows edit for project EDIT on draft songs', () => {
    const result = resolveChartEditAccess({
      isPlatformAdmin: false,
      platformRole: 'COMPOSER',
      projectPermission: 'EDIT',
      songStatus: 'DRAFT',
    })
    assert.equal(result.canEditChart, true)
    assert.equal(result.readOnlyReason, null)
  })

  it('denies edit for published songs even with EDIT permission', () => {
    const result = resolveChartEditAccess({
      isPlatformAdmin: false,
      platformRole: 'COMPOSER',
      projectPermission: 'EDIT',
      songStatus: 'PUBLISHED',
    })
    assert.equal(result.canEditChart, false)
    assert.equal(result.readOnlyReason, 'published')
  })
})
