import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { summariseIssues } from '../src/features/validation/validation-summary.ts'

describe('summariseIssues', () => {
  it('counts errors, warnings, and total from the same issues array', () => {
    const summary = summariseIssues([
      { ruleId: 'a', severity: 'error', message: 'e1' },
      { ruleId: 'b', severity: 'error', message: 'e2' },
      { ruleId: 'c', severity: 'warning', message: 'w1' },
      { ruleId: 'd', severity: 'warning', message: 'w2' },
    ])
    assert.deepEqual(summary, { errors: 2, warnings: 2, total: 4 })
  })

  it('returns zeros when there are no issues', () => {
    assert.deepEqual(summariseIssues([]), { errors: 0, warnings: 0, total: 0 })
  })
})
