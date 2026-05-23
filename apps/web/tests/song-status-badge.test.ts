import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { SongStatusEnum } from '../../../packages/shared/src/enums.ts'

describe('SongStatusEnum consistency', () => {
  it('uses title-case labels for every status', () => {
    assert.equal(SongStatusEnum.label('DRAFT'), 'Draft')
    assert.equal(SongStatusEnum.label('IN_REVIEW'), 'In Review')
    assert.equal(SongStatusEnum.label('NEEDS_FIX'), 'Needs Fix')
    assert.equal(SongStatusEnum.label('PUBLISHED'), 'Published')
  })

  it('assigns distinct colors per status', () => {
    const colors = SongStatusEnum.keys.map((key) => SongStatusEnum.color(key))
    assert.equal(new Set(colors).size, colors.length)
  })
})
