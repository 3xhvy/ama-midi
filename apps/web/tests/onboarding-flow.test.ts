import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import {
  getNextOnboardingStep,
  getPreviousOnboardingStep,
  ONBOARDING_STEP_IDS,
  parseOnboardingStep,
} from '../src/features/onboarding/onboarding-flow.ts'

describe('onboarding flow', () => {
  it('keeps the approved first-login page order', () => {
    assert.deepEqual(ONBOARDING_STEP_IDS, [
      'welcome',
      'features',
      'notes',
      'profile',
      'ready',
    ])
  })

  it('resolves next and previous steps', () => {
    assert.equal(getNextOnboardingStep('welcome'), 'features')
    assert.equal(getNextOnboardingStep('features'), 'notes')
    assert.equal(getNextOnboardingStep('notes'), 'profile')
    assert.equal(getNextOnboardingStep('profile'), 'ready')
    assert.equal(getNextOnboardingStep('ready'), null)

    assert.equal(getPreviousOnboardingStep('ready'), 'profile')
    assert.equal(getPreviousOnboardingStep('profile'), 'notes')
    assert.equal(getPreviousOnboardingStep('notes'), 'features')
    assert.equal(getPreviousOnboardingStep('features'), 'welcome')
    assert.equal(getPreviousOnboardingStep('welcome'), null)
  })

  it('parses unknown route params as welcome', () => {
    assert.equal(parseOnboardingStep('notes'), 'notes')
    assert.equal(parseOnboardingStep('missing'), 'welcome')
    assert.equal(parseOnboardingStep(undefined), 'welcome')
  })
})
