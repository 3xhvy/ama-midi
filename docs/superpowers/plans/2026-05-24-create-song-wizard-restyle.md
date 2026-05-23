# Create Song Wizard Restyle Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Restyle the Create Song wizard with structured UI/UX, quick-create entry point, import mode presets, member pickers, and full backend materialization of six built-in templates.

**Architecture:** Template definitions live in `packages/shared`. `SongTemplateService` materializes sections/patterns/notes on the API. The web wizard decomposes into step components under `create-wizard/` with pure validation/formatting helpers tested via `node:test`. Quick-create uses the existing project song create endpoint.

**Tech Stack:** NestJS, Prisma, React 18, Vite, TanStack Query, Radix Dialog, Tailwind, TypeScript, Jest (API), node:test (web).

---

## Source Spec

Implement from:

```txt
docs/superpowers/specs/2026-05-24-create-song-wizard-restyle-design.md
```

---

## File Structure

### Shared

| File | Responsibility |
|---|---|
| `packages/shared/src/song-templates.ts` | Six built-in template definitions + `getSongTemplate()` |
| `packages/shared/src/index.ts` | Re-export song-templates |

### API

| File | Responsibility |
|---|---|
| `apps/api/src/modules/songs/song-template.service.ts` | Bulk-create sections/patterns/notes from template |
| `apps/api/src/modules/songs/songs.service.ts` | Call template service after song create |
| `apps/api/src/modules/songs/songs.module.ts` | Register `SongTemplateService` |
| `apps/api/src/modules/songs/dto/create-project-song.dto.ts` | Require `templateId` when `startType === 'TEMPLATE'` |
| `apps/api/src/modules/songs/__tests__/song-template.service.spec.ts` | Template materialization tests |
| `apps/api/src/modules/songs/__tests__/songs.project-flow.spec.ts` | Add template create test |

### Web

| File | Responsibility |
|---|---|
| `apps/web/src/features/songs/create-wizard/wizard-logic.ts` | Pure validation, import modes, review formatting |
| `apps/web/src/features/songs/create-wizard/CreateSongWizardStepper.tsx` | Horizontal step indicator |
| `apps/web/src/features/songs/create-wizard/ImportSongStep.tsx` | Import picker + mode presets |
| `apps/web/src/features/songs/create-wizard/steps/StartStep.tsx` | Start-type cards + template grid |
| `apps/web/src/features/songs/create-wizard/steps/SetupStep.tsx` | Labeled setup form |
| `apps/web/src/features/songs/create-wizard/steps/AssignmentStep.tsx` | Member SearchSelects |
| `apps/web/src/features/songs/create-wizard/steps/ReviewStep.tsx` | Summary card |
| `apps/web/src/features/songs/create-wizard/CreateSongWizard.tsx` | Orchestrator |
| `apps/web/src/features/songs/QuickCreateSongButton.tsx` | Fast-path create button |
| `apps/web/src/features/projects/ProjectPage.tsx` | Quick create + Cmd+N + wizard import path |
| `apps/web/tests/song-templates.test.ts` | Shared template tests |
| `apps/web/tests/create-song-wizard.test.ts` | Wizard logic tests |

Delete after move: `apps/web/src/features/songs/CreateSongWizard.tsx`, `apps/web/src/features/songs/ImportSongStep.tsx`

---

## Task 1: Shared Template Definitions

**Files:**
- Create: `packages/shared/src/song-templates.ts`
- Modify: `packages/shared/src/index.ts`
- Create: `apps/web/tests/song-templates.test.ts`

- [ ] **Step 1: Write the failing test**

Create `apps/web/tests/song-templates.test.ts`:

```typescript
import assert from 'node:assert/strict'
import { test } from 'node:test'
import {
  SONG_TEMPLATES,
  getSongTemplate,
} from '../../../packages/shared/src/song-templates.ts'

test('all six built-in templates resolve', () => {
  const ids = [
    'empty-draft',
    'tap-starter',
    'mixed-mechanics',
    'qa-validation',
    'sectioned-layout',
    'pattern-lab',
  ]
  assert.equal(SONG_TEMPLATES.length, 6)
  for (const id of ids) {
    assert.ok(getSongTemplate(id), `missing template ${id}`)
  }
})

test('HOLD notes in templates have duration > 0', () => {
  for (const tpl of SONG_TEMPLATES) {
    for (const note of tpl.notes ?? []) {
      if (note.noteType === 'HOLD') {
        assert.ok(note.duration && note.duration > 0, `${tpl.id} HOLD missing duration`)
      }
    }
  }
})

test('pattern notes use timeOffset not absolute time', () => {
  const patternLab = getSongTemplate('pattern-lab')
  assert.ok(patternLab?.patterns?.length)
  for (const pattern of patternLab!.patterns!) {
    for (const note of pattern.notes) {
      assert.ok('timeOffset' in note)
      assert.ok(!('time' in note))
    }
  }
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --import tsx --test apps/web/tests/song-templates.test.ts`
Expected: FAIL — module not found

- [ ] **Step 3: Write implementation**

Create `packages/shared/src/song-templates.ts`:

```typescript
import type { NoteType, PatternNote, SongCategory, SongDifficulty } from './types'

export interface SongTemplateSection {
  time: number
  label: string
  color?: string
}

export interface SongTemplatePattern {
  name: string
  notes: PatternNote[]
}

export interface SongTemplateNote {
  track: number
  time: number
  noteType: NoteType
  duration?: number
  title?: string
}

export interface SongTemplateDefinition {
  id: string
  name: string
  description: string
  category: SongCategory
  difficulty: SongDifficulty
  bpm: number
  timeSignature: string
  suggestedName: string
  createsLabel: string
  sections?: SongTemplateSection[]
  patterns?: SongTemplatePattern[]
  notes?: SongTemplateNote[]
}

export const SONG_TEMPLATES: SongTemplateDefinition[] = [
  {
    id: 'empty-draft',
    name: 'Empty Draft',
    description: 'Blank chart with default song settings only.',
    category: 'PROTOTYPE',
    difficulty: 'NORMAL',
    bpm: 120,
    timeSignature: '4/4',
    suggestedName: 'Untitled Draft',
    createsLabel: 'Settings only',
  },
  {
    id: 'tap-starter',
    name: 'Tap Starter',
    description: 'Simple TAP examples to learn basic charting.',
    category: 'PROTOTYPE',
    difficulty: 'EASY',
    bpm: 120,
    timeSignature: '4/4',
    suggestedName: 'Tap Starter',
    createsLabel: 'Starter notes',
    notes: Array.from({ length: 8 }, (_, i) => ({
      track: 1,
      time: 1 + i * 0.5,
      noteType: 'TAP' as const,
    })),
  },
  {
    id: 'mixed-mechanics',
    name: 'Mixed Mechanics',
    description: 'TAP, HOLD, and SWIPE examples on one chart.',
    category: 'PROTOTYPE',
    difficulty: 'NORMAL',
    bpm: 128,
    timeSignature: '4/4',
    suggestedName: 'Mixed Mechanics',
    createsLabel: 'Mechanic examples',
    notes: [
      { track: 1, time: 1, noteType: 'TAP' },
      { track: 2, time: 2, noteType: 'HOLD', duration: 1 },
      { track: 3, time: 4, noteType: 'SWIPE' },
    ],
  },
  {
    id: 'qa-validation',
    name: 'QA Validation',
    description: 'Sections plus overlapping notes for validation testing.',
    category: 'QA_TEST',
    difficulty: 'NORMAL',
    bpm: 100,
    timeSignature: '4/4',
    suggestedName: 'QA Validation',
    createsLabel: 'Sections + edge cases',
    sections: [
      { time: 0, label: 'Intro' },
      { time: 8, label: 'Verse' },
      { time: 16, label: 'Chorus' },
    ],
    notes: [
      { track: 1, time: 4, noteType: 'TAP', title: 'Edge A' },
      { track: 1, time: 4.05, noteType: 'TAP', title: 'Edge B' },
    ],
  },
  {
    id: 'sectioned-layout',
    name: 'Sectioned Layout',
    description: 'Campaign-style Intro / Verse / Chorus / Outro markers.',
    category: 'MAIN_CAMPAIGN',
    difficulty: 'NORMAL',
    bpm: 120,
    timeSignature: '4/4',
    suggestedName: 'Sectioned Layout',
    createsLabel: 'Section markers',
    sections: [
      { time: 0, label: 'Intro' },
      { time: 8, label: 'Verse' },
      { time: 16, label: 'Chorus' },
      { time: 24, label: 'Outro' },
    ],
  },
  {
    id: 'pattern-lab',
    name: 'Pattern Lab',
    description: 'Reusable note patterns for rapid iteration.',
    category: 'TEMPLATE',
    difficulty: 'NORMAL',
    bpm: 120,
    timeSignature: '4/4',
    suggestedName: 'Pattern Lab',
    createsLabel: 'Note patterns',
    patterns: [
      {
        name: 'Basic 4-step',
        notes: [
          { track: 1, timeOffset: 0, noteType: 'TAP' },
          { track: 1, timeOffset: 0.5, noteType: 'TAP' },
          { track: 1, timeOffset: 1, noteType: 'TAP' },
          { track: 1, timeOffset: 1.5, noteType: 'TAP' },
        ],
      },
      {
        name: 'Hold swell',
        notes: [{ track: 2, timeOffset: 0, noteType: 'HOLD', duration: 2 }],
      },
    ],
  },
]

export function getSongTemplate(id: string): SongTemplateDefinition | undefined {
  return SONG_TEMPLATES.find((t) => t.id === id)
}
```

Add to `packages/shared/src/index.ts`:

```typescript
export * from './song-templates'
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node --import tsx --test apps/web/tests/song-templates.test.ts`
Expected: PASS (3 tests)

- [ ] **Step 5: Commit**

```bash
git add packages/shared/src/song-templates.ts packages/shared/src/index.ts apps/web/tests/song-templates.test.ts
git commit -m "feat(shared): add built-in song template definitions"
```

---

## Task 2: SongTemplateService

**Files:**
- Create: `apps/api/src/modules/songs/song-template.service.ts`
- Create: `apps/api/src/modules/songs/__tests__/song-template.service.spec.ts`

- [ ] **Step 1: Write the failing test**

Create `apps/api/src/modules/songs/__tests__/song-template.service.spec.ts`:

```typescript
import { BadRequestException } from '@nestjs/common'
import { SongTemplateService } from '../song-template.service'

const prisma = {
  sectionMarker: { createMany: jest.fn() },
  notePattern: { createMany: jest.fn() },
  note: { createMany: jest.fn() },
}

describe('SongTemplateService', () => {
  let service: SongTemplateService

  beforeEach(() => {
    service = new SongTemplateService(prisma as any)
    jest.clearAllMocks()
  })

  it('materializes sections for sectioned-layout', async () => {
    await service.materialize('sectioned-layout', 'song1', 'u1')
    expect(prisma.sectionMarker.createMany).toHaveBeenCalledWith({
      data: expect.arrayContaining([
        expect.objectContaining({ songId: 'song1', label: 'Intro', createdBy: 'u1' }),
        expect.objectContaining({ label: 'Outro' }),
      ]),
    })
  })

  it('materializes notes for tap-starter', async () => {
    await service.materialize('tap-starter', 'song1', 'u1')
    expect(prisma.note.createMany).toHaveBeenCalledWith({
      data: expect.arrayContaining([
        expect.objectContaining({ songId: 'song1', noteType: 'TAP', track: 1 }),
      ]),
    })
    expect(prisma.note.createMany.mock.calls[0][0].data).toHaveLength(8)
  })

  it('materializes patterns for pattern-lab', async () => {
    await service.materialize('pattern-lab', 'song1', 'u1')
    expect(prisma.notePattern.createMany).toHaveBeenCalledWith({
      data: expect.arrayContaining([
        expect.objectContaining({ songId: 'song1', name: 'Basic 4-step', createdBy: 'u1' }),
      ]),
    })
  })

  it('throws for unknown templateId', async () => {
    await expect(service.materialize('nope', 'song1', 'u1')).rejects.toBeInstanceOf(BadRequestException)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd apps/api && pnpm test -- song-template.service.spec.ts`
Expected: FAIL — module not found

- [ ] **Step 3: Write implementation**

Create `apps/api/src/modules/songs/song-template.service.ts`:

```typescript
import { BadRequestException, Injectable } from '@nestjs/common'
import { getSongTemplate } from '@ama-midi/shared'
import { PrismaService } from '../prisma/prisma.service'

@Injectable()
export class SongTemplateService {
  constructor(private readonly prisma: PrismaService) {}

  async materialize(templateId: string, songId: string, userId: string): Promise<void> {
    const template = getSongTemplate(templateId)
    if (!template) throw new BadRequestException(`Unknown template: ${templateId}`)

    if (template.sections?.length) {
      await this.prisma.sectionMarker.createMany({
        data: template.sections.map((s) => ({
          songId,
          time: s.time,
          label: s.label,
          color: s.color ?? '#6C63FF',
          createdBy: userId,
        })),
      })
    }

    if (template.patterns?.length) {
      await this.prisma.notePattern.createMany({
        data: template.patterns.map((p) => ({
          songId,
          name: p.name,
          notes: p.notes as object,
          createdBy: userId,
        })),
      })
    }

    if (template.notes?.length) {
      await this.prisma.note.createMany({
        data: template.notes.map((n) => ({
          songId,
          track: n.track,
          time: n.time,
          title: n.title ?? '',
          description: '',
          noteType: n.noteType,
          duration: n.duration ?? null,
          createdBy: userId,
        })),
      })
    }
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd apps/api && pnpm test -- song-template.service.spec.ts`
Expected: PASS (4 tests)

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/modules/songs/song-template.service.ts apps/api/src/modules/songs/__tests__/song-template.service.spec.ts
git commit -m "feat(api): add SongTemplateService for built-in templates"
```

---

## Task 3: Wire Template Creation in SongsService

**Files:**
- Modify: `apps/api/src/modules/songs/songs.module.ts`
- Modify: `apps/api/src/modules/songs/songs.service.ts`
- Modify: `apps/api/src/modules/songs/dto/create-project-song.dto.ts`
- Modify: `apps/api/src/modules/songs/__tests__/songs.project-flow.spec.ts`

- [ ] **Step 1: Write the failing test**

Add to `apps/api/src/modules/songs/__tests__/songs.project-flow.spec.ts`:

```typescript
import { SongTemplateService } from '../song-template.service'

// In beforeEach, inject template service mock:
const templates = { materialize: jest.fn() }

beforeEach(() => {
  service = new SongsService(
    prisma as unknown as PrismaService,
    access as unknown as ProjectAccessService,
    templates as unknown as SongTemplateService,
  )
  jest.clearAllMocks()
})

it('materializes template when startType is TEMPLATE', async () => {
  const row = { /* same shape as blank test */ id: 'song1', projectId: 'project1', name: 'Tap Starter', /* ... */ }
  prisma.song.create.mockResolvedValue(row)

  await service.createInProject('project1', {
    name: 'Tap Starter',
    category: 'PROTOTYPE',
    difficulty: 'EASY',
    bpm: 120,
    timeSignature: '4/4',
    startType: 'TEMPLATE',
    templateId: 'tap-starter',
  }, user)

  expect(templates.materialize).toHaveBeenCalledWith('tap-starter', 'song1', 'u1')
})
```

Update constructor in `songs.service.ts` to accept `SongTemplateService` (test will fail until wired).

- [ ] **Step 2: Run test to verify it fails**

Run: `cd apps/api && pnpm test -- songs.project-flow.spec.ts`
Expected: FAIL — constructor arity or materialize not called

- [ ] **Step 3: Write implementation**

Update `apps/api/src/modules/songs/dto/create-project-song.dto.ts` — add after `templateId` field:

```typescript
@ValidateIf((dto) => dto.startType === 'TEMPLATE')
@IsString()
@MinLength(1)
templateId?: string
```

Remove `@IsOptional()` from `templateId` when TEMPLATE (use ValidateIf instead of optional).

Update `apps/api/src/modules/songs/songs.service.ts` constructor and `createInProject`:

```typescript
constructor(
  private readonly prisma: PrismaService,
  private readonly access: ProjectAccessService,
  private readonly templates: SongTemplateService,
) {}

// Inside createInProject, after song row created:
if (dto.startType === 'TEMPLATE') {
  if (!dto.templateId) throw new BadRequestException('templateId is required for TEMPLATE start')
  await this.templates.materialize(dto.templateId, row.id, user.id)
}
```

Update `apps/api/src/modules/songs/songs.module.ts`:

```typescript
import { SongTemplateService } from './song-template.service'

providers: [SongsService, SongTemplateService],
```

Fix existing test `beforeEach` to pass a mock `SongTemplateService`.

- [ ] **Step 4: Run test to verify it passes**

Run: `cd apps/api && pnpm test -- songs.project-flow.spec.ts song-template.service.spec.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/modules/songs/songs.service.ts apps/api/src/modules/songs/songs.module.ts apps/api/src/modules/songs/dto/create-project-song.dto.ts apps/api/src/modules/songs/__tests__/songs.project-flow.spec.ts
git commit -m "feat(api): materialize templates on project song create"
```

---

## Task 4: Wizard Pure Logic + Tests

**Files:**
- Create: `apps/web/src/features/songs/create-wizard/wizard-logic.ts`
- Create: `apps/web/tests/create-song-wizard.test.ts`

- [ ] **Step 1: Write the failing test**

Create `apps/web/tests/create-song-wizard.test.ts`:

```typescript
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
import type { ImportSongOptions } from '@ama-midi/shared'

test('validateStartStep requires import source', () => {
  const err = validateStartStep('IMPORT', null, { sourceSongId: '', copySettings: true, copySections: true, copyPatterns: false, copyNotes: false })
  assert.equal(err, 'Choose a source song')
  assert.equal(validateStartStep('IMPORT', null, { sourceSongId: 's1', copySettings: true, copySections: true, copyPatterns: false, copyNotes: false }), null)
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
    copySettings: true, copySections: true, copyPatterns: false, copyNotes: false,
  })
  assert.equal(getImportModeFromOptions({ copySettings: true, copySections: true, copyPatterns: true, copyNotes: true, sourceSongId: 'x' }), 'full')
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --import tsx --test apps/web/tests/create-song-wizard.test.ts`
Expected: FAIL — module not found

- [ ] **Step 3: Write implementation**

Create `apps/web/src/features/songs/create-wizard/wizard-logic.ts`:

```typescript
import {
  getSongTemplate,
  SongCategoryEnum,
  SongDifficultyEnum,
  SUPPORTED_TIME_SIGNATURES,
  type ImportSongOptions,
  type SongCategory,
  type SongDifficulty,
} from '@ama-midi/shared'

export type WizardStep = 'start' | 'setup' | 'assignment' | 'review'
export type StartType = 'BLANK' | 'TEMPLATE' | 'IMPORT'
export type ImportMode = 'structure' | 'pattern' | 'full' | 'custom'

export interface SetupFields {
  name: string
  category: SongCategory
  difficulty: SongDifficulty
  bpm: number
  timeSignature: string
}

export function validateStartStep(
  startType: StartType,
  templateId: string | null,
  importOptions: ImportSongOptions | null,
): string | null {
  if (startType === 'IMPORT' && !importOptions?.sourceSongId) return 'Choose a source song'
  if (startType === 'TEMPLATE' && !templateId) return 'Choose a template'
  return null
}

export function validateSetupStep(fields: { name: string; bpm: number; timeSignature: string }): string | null {
  if (!fields.name.trim()) return 'Song name is required'
  if (fields.bpm < 40 || fields.bpm > 300) return 'BPM must be between 40 and 300'
  if (!SUPPORTED_TIME_SIGNATURES.includes(fields.timeSignature as typeof SUPPORTED_TIME_SIGNATURES[number])) {
    return 'Choose a supported time signature'
  }
  return null
}

export function applyTemplateDefaults(templateId: string): SetupFields {
  const tpl = getSongTemplate(templateId)
  if (!tpl) throw new Error(`Unknown template: ${templateId}`)
  return {
    name: tpl.suggestedName,
    category: tpl.category,
    difficulty: tpl.difficulty,
    bpm: tpl.bpm,
    timeSignature: tpl.timeSignature,
  }
}

export function importModeToOptions(mode: ImportMode): Omit<ImportSongOptions, 'sourceSongId'> {
  switch (mode) {
    case 'structure': return { copySettings: true, copySections: true, copyPatterns: false, copyNotes: false }
    case 'pattern': return { copySettings: true, copySections: true, copyPatterns: true, copyNotes: false }
    case 'full': return { copySettings: true, copySections: true, copyPatterns: true, copyNotes: true }
    case 'custom': return { copySettings: true, copySections: true, copyPatterns: false, copyNotes: false }
  }
}

export function getImportModeFromOptions(opts: ImportSongOptions): ImportMode {
  const { copySettings, copySections, copyPatterns, copyNotes } = opts
  if (copySettings && copySections && !copyPatterns && !copyNotes) return 'structure'
  if (copySettings && copySections && copyPatterns && !copyNotes) return 'pattern'
  if (copySettings && copySections && copyPatterns && copyNotes) return 'full'
  return 'custom'
}

export function buildReviewSummary(input: {
  startType: StartType
  templateId?: string | null
  templateName?: string | null
  importSourceName?: string | null
  name: string
  category: SongCategory
  difficulty: SongDifficulty
  bpm: number
  timeSignature: string
  composerName?: string | null
  qaName?: string | null
}) {
  const startLine =
    input.startType === 'BLANK' ? 'Blank song'
    : input.startType === 'TEMPLATE' ? `Template: ${input.templateName ?? input.templateId}`
    : `Import from: "${input.importSourceName ?? 'Unknown'}"`

  const detailsLine = `${input.name} · ${SongCategoryEnum.label(input.category)} · ${SongDifficultyEnum.label(input.difficulty)} · ${input.bpm} BPM · ${input.timeSignature}`

  return { startLine, detailsLine }
}

export const WIZARD_STEPS: { id: WizardStep; label: string }[] = [
  { id: 'start', label: 'Start' },
  { id: 'setup', label: 'Setup' },
  { id: 'assignment', label: 'Assignment' },
  { id: 'review', label: 'Review' },
]
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node --import tsx --test apps/web/tests/create-song-wizard.test.ts`
Expected: PASS (6 tests)

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/features/songs/create-wizard/wizard-logic.ts apps/web/tests/create-song-wizard.test.ts
git commit -m "feat(web): add create song wizard pure logic helpers"
```

---

## Task 5: Wizard Stepper Component

**Files:**
- Create: `apps/web/src/features/songs/create-wizard/CreateSongWizardStepper.tsx`

- [ ] **Step 1: Create stepper component**

```tsx
import { CheckIcon } from '@radix-ui/react-icons'
import { cn } from '../../../lib/utils'
import { WIZARD_STEPS, type WizardStep } from './wizard-logic'

export function CreateSongWizardStepper({
  current,
  onStepClick,
}: {
  current: WizardStep
  onStepClick: (step: WizardStep) => void
}) {
  const currentIndex = WIZARD_STEPS.findIndex((s) => s.id === current)

  return (
    <nav aria-label="Wizard progress" className="mb-5 flex items-center gap-1">
      {WIZARD_STEPS.map((step, index) => {
        const done = index < currentIndex
        const active = step.id === current
        const clickable = done

        return (
          <div key={step.id} className="flex min-w-0 flex-1 items-center gap-1">
            <button
              type="button"
              disabled={!clickable}
              onClick={() => clickable && onStepClick(step.id)}
              className={cn(
                'flex min-w-0 items-center gap-1.5 text-xs font-medium transition-colors',
                active && 'text-primary',
                done && 'text-shell-text cursor-pointer hover:text-primary',
                !active && !done && 'text-shell-muted cursor-default',
              )}
            >
              <span className={cn(
                'flex h-5 w-5 shrink-0 items-center justify-center rounded-full border text-[10px]',
                active && 'border-primary bg-primary text-white',
                done && 'border-primary bg-primary/10 text-primary',
                !active && !done && 'border-shell-border text-shell-muted',
              )}>
                {done ? <CheckIcon className="h-3 w-3" /> : index + 1}
              </span>
              <span className="truncate">{step.label}</span>
            </button>
            {index < WIZARD_STEPS.length - 1 && (
              <div className={cn('h-px flex-1', done ? 'bg-primary/40' : 'bg-shell-border')} />
            )}
          </div>
        )
      })}
    </nav>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/web/src/features/songs/create-wizard/CreateSongWizardStepper.tsx
git commit -m "feat(web): add create song wizard stepper"
```

---

## Task 6: Refactored ImportSongStep

**Files:**
- Create: `apps/web/src/features/songs/create-wizard/ImportSongStep.tsx`
- Delete: `apps/web/src/features/songs/ImportSongStep.tsx` (after wizard wired)

- [ ] **Step 1: Create ImportSongStep with mode presets**

```tsx
import { useMemo, useState } from 'react'
import { SearchSelect, ToggleGroup } from '../../../components/ui'
import type { ImportSongOptions, Song } from '@ama-midi/shared'
import { getImportModeFromOptions, importModeToOptions, type ImportMode } from './wizard-logic'

const MODES = [
  { value: 'structure', label: 'Structure' },
  { value: 'pattern', label: 'Patterns' },
  { value: 'full', label: 'Full' },
  { value: 'custom', label: 'Custom' },
]

export function ImportSongStep({
  songs,
  projectNames,
  value,
  onChange,
}: {
  songs: Song[]
  projectNames: Record<string, string>
  value: ImportSongOptions
  onChange: (value: ImportSongOptions) => void
}) {
  const [includeArchived, setIncludeArchived] = useState(false)
  const mode = getImportModeFromOptions(value)

  const options = useMemo(
    () => songs
      .filter((s) => includeArchived || !s.archivedAt)
      .map((s) => ({
        value: s.id,
        label: s.name,
        description: projectNames[s.projectId] ?? s.projectId,
      })),
    [includeArchived, projectNames, songs],
  )

  function setMode(next: ImportMode) {
    onChange({ ...value, ...importModeToOptions(next) })
  }

  function patch(next: Partial<ImportSongOptions>) {
    onChange({ ...value, ...next })
  }

  return (
    <div className="space-y-4 rounded-lg border border-shell-border bg-shell-bg/50 p-4">
      <div className="space-y-1.5">
        <span className="text-xs text-shell-muted">Source song</span>
        <SearchSelect
          options={options}
          value={value.sourceSongId}
          onChange={(v) => patch({ sourceSongId: typeof v === 'string' ? v : v[0] ?? '' })}
          placeholder="Choose source song"
          searchPlaceholder="Search songs"
          emptyMessage="No songs available"
        />
      </div>

      <label className="flex items-center gap-2 text-xs text-shell-muted">
        <input type="checkbox" checked={includeArchived} onChange={(e) => setIncludeArchived(e.target.checked)} />
        Include archived
      </label>

      <div className="space-y-1.5">
        <span className="text-xs text-shell-muted">Import mode</span>
        <ToggleGroup items={MODES} value={mode} onValueChange={(v) => setMode(v as ImportMode)} />
      </div>

      {mode === 'custom' && (
        <div className="space-y-2">
          {([
            ['copySettings', 'Settings'],
            ['copySections', 'Sections'],
            ['copyPatterns', 'Patterns'],
            ['copyNotes', 'Notes'],
          ] as const).map(([key, label]) => (
            <label key={key} className="flex items-center gap-2 text-sm text-shell-text">
              <input
                type="checkbox"
                checked={value[key]}
                onChange={(e) => patch({ [key]: e.target.checked })}
              />
              {label}
            </label>
          ))}
        </div>
      )}

      {value.copyNotes && (
        <p className="rounded-md border border-warning/40 bg-warning/10 px-3 py-2 text-xs text-warning">
          This creates an independent copy of the source chart. Future edits will not sync with the original song.
        </p>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/web/src/features/songs/create-wizard/ImportSongStep.tsx
git commit -m "feat(web): refactor import step with mode presets"
```

---

## Task 7: Wizard Step Components

**Files:**
- Create: `apps/web/src/features/songs/create-wizard/steps/StartStep.tsx`
- Create: `apps/web/src/features/songs/create-wizard/steps/SetupStep.tsx`
- Create: `apps/web/src/features/songs/create-wizard/steps/AssignmentStep.tsx`
- Create: `apps/web/src/features/songs/create-wizard/steps/ReviewStep.tsx`

- [ ] **Step 1: Create StartStep**

`StartStep.tsx` — three selectable cards for BLANK/TEMPLATE/IMPORT. When TEMPLATE: 2-col grid of `SONG_TEMPLATES` cards showing name, description, chips, `createsLabel` badge. Selected template: primary border. When user picks new template while `setupTouched`: render inline confirm banner with Keep/Apply buttons calling `onTemplateOverwriteChoice('keep' | 'apply')`. When IMPORT: render `<ImportSongStep />`.

Key props:

```typescript
interface StartStepProps {
  startType: StartType
  templateId: string | null
  importOptions: ImportSongOptions
  setupTouched: boolean
  pendingTemplateId: string | null  // triggers overwrite confirm
  songs: Song[]
  projectNames: Record<string, string>
  onStartTypeChange: (type: StartType) => void
  onTemplateSelect: (id: string) => void
  onTemplateOverwriteChoice: (choice: 'keep' | 'apply') => void
  onImportChange: (opts: ImportSongOptions) => void
}
```

Card styling pattern:

```tsx
<button
  type="button"
  className={cn(
    'rounded-lg border p-3 text-left transition-colors',
    selected ? 'border-primary bg-primary/5' : 'border-shell-border hover:border-shell-muted',
  )}
>
```

- [ ] **Step 2: Create SetupStep**

Labeled fields per `EditSongModal`. Category/Difficulty as `<select>` with enum labels. BPM + time signature in `grid grid-cols-2 gap-3`. Show `error` string below form when validation fails. Call `onSetupChange` on every edit (orchestrator sets `setupTouched = true`).

- [ ] **Step 3: Create AssignmentStep**

Use `useProjectMembers(projectId)` inside orchestrator; pass filtered options down.

```typescript
const composerOptions = members
  .filter((m) => m.permission === 'EDIT' || m.permission === 'ADMIN')
  .map((m) => ({ value: m.userId, label: m.userName }))

const qaOptions = members
  .filter((m) => ['READ', 'EDIT', 'ADMIN'].includes(m.permission))
  .map((m) => ({ value: m.userId, label: m.userName }))
```

Show empty state paragraph when both lists empty. Status: `<SongStatusBadge status="DRAFT" />`.

- [ ] **Step 4: Create ReviewStep**

Grouped summary using `buildReviewSummary()` plus extra sections for import/template. Render as bordered card with `dl` rows. Never show raw enum keys.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/features/songs/create-wizard/steps/
git commit -m "feat(web): add create song wizard step components"
```

---

## Task 8: Wizard Orchestrator

**Files:**
- Create: `apps/web/src/features/songs/create-wizard/CreateSongWizard.tsx`
- Modify: `apps/web/src/features/songs/useSongs.ts` (add error toast on create)
- Delete: `apps/web/src/features/songs/CreateSongWizard.tsx`

- [ ] **Step 1: Add create mutation error toast**

In `useCreateProjectSong`, add:

```typescript
onError: () => { toast.error('Could not create song') },
```

- [ ] **Step 2: Create orchestrator**

`CreateSongWizard.tsx` responsibilities:
- Hold all wizard state (step, startType, templateId, setup fields, assignments, importOptions, setupTouched, stepError, pendingTemplateId)
- Load `useProjects()` for `projectNames` map: `Object.fromEntries(projects.map(p => [p.id, p.name]))`
- Load `useSongs()` for import sources
- Load `useProjectMembers(projectId)` for assignment step
- Default `assignedComposerId` to current user if in composer options
- On template select: if `setupTouched`, set `pendingTemplateId` instead of applying immediately; on confirm apply call `applyTemplateDefaults`
- `goNext()`: run step validator, set `stepError`, advance if null
- `goBack()`: decrement step, clear `stepError`
- `create(openEditor)`: build `CreateProjectSongInput` including `templateId` when TEMPLATE
- Modal: `max-w-[560px]`, body scroll, footer Back/Next or Create buttons `size="sm"`

- [ ] **Step 3: Update ProjectPage import**

```typescript
import { CreateSongWizard } from '../songs/create-wizard/CreateSongWizard'
```

- [ ] **Step 4: Delete old files**

Remove `apps/web/src/features/songs/CreateSongWizard.tsx` and `apps/web/src/features/songs/ImportSongStep.tsx`.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/features/songs/create-wizard/CreateSongWizard.tsx apps/web/src/features/songs/useSongs.ts apps/web/src/features/projects/ProjectPage.tsx
git rm apps/web/src/features/songs/CreateSongWizard.tsx apps/web/src/features/songs/ImportSongStep.tsx
git commit -m "feat(web): wire create song wizard orchestrator"
```

---

## Task 9: Quick Create + Keyboard Shortcut

**Files:**
- Create: `apps/web/src/features/songs/QuickCreateSongButton.tsx`
- Modify: `apps/web/src/features/projects/ProjectPage.tsx`

- [ ] **Step 1: Create QuickCreateSongButton**

```tsx
import { useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import { Button } from '../../components/ui'
import { useAuthStore } from '../../store/auth.store'
import { useCreateProjectSong } from './useSongs'

export function QuickCreateSongButton({
  projectId,
  disabled,
}: {
  projectId: string
  disabled?: boolean
}) {
  const navigate = useNavigate()
  const user = useAuthStore((s) => s.user)
  const createSong = useCreateProjectSong(projectId)

  function quickCreate() {
    createSong.mutate(
      {
        name: 'Untitled',
        category: 'PROTOTYPE',
        difficulty: 'NORMAL',
        bpm: 120,
        timeSignature: '4/4',
        startType: 'BLANK',
        assignedComposerId: user?.id ?? null,
        assignedQaId: null,
      },
      {
        onSuccess: (song) => navigate(`/projects/${projectId}/songs/${song.id}`),
        onError: () => toast.error('Could not create song'),
      },
    )
  }

  return (
    <Button size="sm" rounded onClick={quickCreate} disabled={disabled} loading={createSong.isPending}>
      Quick Create
    </Button>
  )
}
```

Export `quickCreateRef` or accept `id` prop if needed for keyboard trigger — alternatively expose imperative handle via callback ref on ProjectPage.

- [ ] **Step 2: Update ProjectPage**

Replace single button with:

```tsx
<QuickCreateSongButton projectId={projectId} disabled={wizardOpen} />
<Button size="sm" variant="secondary" rounded onClick={() => setWizardOpen(true)}>
  + New Song
</Button>
```

Add Cmd+N listener:

```typescript
useEffect(() => {
  function onKeyDown(e: KeyboardEvent) {
    if (wizardOpen) return
    const tag = (e.target as HTMLElement)?.tagName
    if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return
    if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'n') {
      e.preventDefault()
      document.getElementById('quick-create-trigger')?.click()
    }
  }
  window.addEventListener('keydown', onKeyDown)
  return () => window.removeEventListener('keydown', onKeyDown)
}, [wizardOpen])
```

Add `id="quick-create-trigger"` to Quick Create button.

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/features/songs/QuickCreateSongButton.tsx apps/web/src/features/projects/ProjectPage.tsx
git commit -m "feat(web): add quick create song button and Cmd+N shortcut"
```

---

## Task 10: Final Verification

- [ ] **Step 1: Run shared/web tests**

```bash
node --import tsx --test apps/web/tests/song-templates.test.ts apps/web/tests/create-song-wizard.test.ts
```

Expected: all PASS

- [ ] **Step 2: Run API tests**

```bash
cd apps/api && pnpm test -- song-template.service.spec.ts songs.project-flow.spec.ts
```

Expected: all PASS

- [ ] **Step 3: Run lint**

```bash
pnpm lint
```

Expected: no errors

- [ ] **Step 4: Run build**

```bash
pnpm build
```

Expected: success

- [ ] **Step 5: Manual smoke test**

1. Open project page → Quick Create → editor opens with "Untitled"
2. Cmd+N → same behavior (when not in input)
3. + New Song → wizard opens at 560px with stepper
4. Template flow: pick Tap Starter → setup prefilled → review → Create and open → 8 notes in editor
5. Import flow: pick source → Structure only → verify sections copied, notes not
6. Assignment: member names in dropdowns, not UUIDs

- [ ] **Step 6: Commit any fixups**

```bash
git commit -m "chore: fix create song wizard restyle verification issues"
```

---

## Spec Coverage Checklist

| Spec requirement | Task |
|---|---|
| Quick Create button | Task 9 |
| Cmd+N shortcut | Task 9 |
| 560px modal | Task 8 |
| Stepper Start→Setup→Assignment→Review | Task 5, 8 |
| Start type cards | Task 7 |
| Template grid (6 templates) | Task 1, 7 |
| Template overwrite confirm | Task 4, 7, 8 |
| Setup labeled form + selects | Task 7 |
| Assignment member SearchSelect | Task 7 |
| Review human-readable summary | Task 4, 7 |
| Import cross-project SearchSelect | Task 6, 8 |
| Import mode presets | Task 4, 6 |
| Notes copy warning | Task 6 |
| Template materialization API | Task 1, 2, 3 |
| templateId required when TEMPLATE | Task 3 |
| Error toasts | Task 8, 9 |
| Tests | Tasks 1, 2, 3, 4, 10 |

---

## Out of Scope (do not implement)

- Generic WizardShell component
- Drawer layout
- Non-Draft initial status at create
- Project-owned DB templates
- Duplicate name warnings
