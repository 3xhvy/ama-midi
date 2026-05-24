import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import type { AnalysisWarningDraft } from '../../../packages/shared/src/difficulty/types.ts'
import {
  analysisHelpText,
  analysisReviewStatus,
  formatChartSpeedLabel,
  mainReviewReason,
} from '../src/features/editor/components/analysis-summary-copy.ts'

const warning = (
  code: string,
  message: string,
  metadata?: Record<string, unknown>,
): AnalysisWarningDraft => ({
  code,
  severity: 'WARN',
  message,
  metadata,
})

describe('analysis summary copy', () => {
  it('labels speed as chart speed', () => {
    assert.equal(formatChartSpeedLabel(1), 'Chart speed 1.0x')
  })

  it('uses readable review status labels', () => {
    assert.equal(analysisReviewStatus([]), 'Ready')
    assert.equal(analysisReviewStatus([warning('EXCESSIVE_OFFBEAT', 'Off-beat ratio 69% exceeds EXPERT limit.')]), 'Needs review')
    assert.equal(
      analysisReviewStatus([{ ...warning('HIGH_DENSITY', 'High density.'), severity: 'ERROR' }]),
      'Blocked',
    )
  })

  it('turns excessive off-beat warnings into a plain-language reason', () => {
    const reason = mainReviewReason(
      [warning('EXCESSIVE_OFFBEAT', 'Off-beat ratio 69% exceeds EXPERT limit.')],
      'EXPERT',
    )

    assert.equal(reason?.title, 'Too many off-beat notes for Expert.')
    assert.equal(reason?.detail, '69% off-beat. Target is 65% or lower.')
  })

  it('explains chart speed in the help text', () => {
    assert.match(analysisHelpText, /Chart speed is how fast notes move during gameplay/)
  })
})
