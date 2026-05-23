import assert from 'node:assert/strict'
import { test } from 'node:test'
import {
  validateStartStep,
  validateSetupStep,
  applyTemplateDefaults,
  importModeToOptions,
  getImportModeFromOptions,
  buildReviewSummary,
} from '../src/features/songs/create-wizard/wizard-logic.ts'

test('validateStartStep requires import source', () => {
  const err = validateStartStep('IMPORT', null, {
    sourceSongId: '',
    copySettings: true,
    copySections: true,
    copyPatterns: false,
    copyNotes: false,
  })
  assert.equal(err, 'Choose a source song')
  assert.equal(
    validateStartStep('IMPORT', null, {
      sourceSongId: 's1',
      copySettings: true,
      copySections: true,
      copyPatterns: false,
      copyNotes: false,
    }),
    null,
  )
})

test('validateStartStep requires template selection', () => {
  assert.equal(validateStartStep('TEMPLATE', null, null), 'Choose a template')
  assert.equal(validateStartStep('TEMPLATE', 'tap-starter', null), null)
})

test('validateSetupStep requires name and valid bpm', () => {
  assert.equal(validateSetupStep({ name: '', bpm: 120, timeSignature: '4/4' }), 'Song name is required')
  assert.equal(validateSetupStep({ name: 'A', bpm: 10, timeSignature: '4/4' }), 'BPM must be between 40 and 300')
  assert.equal(validateSetupStep({ name: 'A', bpm: 120, timeSignature: '4/4' }), null)
})

test('applyTemplateDefaults prefills from template', () => {
  const next = applyTemplateDefaults('tap-starter')
  assert.equal(next.name, 'Tap Starter')
  assert.equal(next.category, 'PROTOTYPE')
  assert.equal(next.difficulty, 'EASY')
  assert.equal(next.bpm, 120)
})

test('import mode presets map correctly', () => {
  assert.deepEqual(importModeToOptions('structure'), {
    copySettings: true,
    copySections: true,
    copyPatterns: false,
    copyNotes: false,
  })
  assert.equal(
    getImportModeFromOptions({
      copySettings: true,
      copySections: true,
      copyPatterns: true,
      copyNotes: true,
      sourceSongId: 'x',
    }),
    'full',
  )
})

test('buildReviewSummary uses human labels', () => {
  const summary = buildReviewSummary({
    startType: 'TEMPLATE',
    templateId: 'tap-starter',
    templateName: 'Tap Starter',
    name: 'My Song',
    category: 'PROTOTYPE',
    difficulty: 'EASY',
    bpm: 120,
    timeSignature: '4/4',
    composerName: 'Composer',
    qaName: null,
  })
  assert.match(summary.startLine, /Tap Starter/)
  assert.match(summary.detailsLine, /Easy/)
})
