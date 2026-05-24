# Repeat / Stamp Notes Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a selected-notes Repeat action that creates multiple interval-based copies through the existing Copy To preview/apply pipeline.

**Architecture:** Extend the existing note copy request shape with `REPEAT_INTERVAL`, `repeatCount`, and `repeatInterval`. Backend expansion happens inside `NoteCopyService.computeTransformedSlots()`, so conflict preview, apply transactions, realtime batch events, and chart analysis remain unchanged. Frontend adds a focused `RepeatModal` that submits a normal `NoteCopyPreviewRequest` and reuses the existing conflict review state in `EditorPage`.

**Tech Stack:** TypeScript, NestJS, class-validator, Jest, React, Zustand, TanStack Query, Node test runner.

---

## File Structure

- Modify `packages/shared/src/placement-preview.ts`: add repeat mode and repeat request fields to shared copy types.
- Modify `apps/api/src/modules/notes/dto/note-copy.dto.ts`: validate repeat request fields when `mode === 'REPEAT_INTERVAL'`.
- Modify `apps/api/src/modules/notes/note-copy.service.ts`: expand selected notes into repeated slots and include repeat params in selection version.
- Modify `apps/api/src/modules/notes/__tests__/note-copy.service.spec.ts`: cover repeat preview, conflicts, bounds, cap, versioning, and invalid move.
- Create `apps/web/src/features/editor/components/repeat-transform.ts`: pure formatting, parsing, default interval, and validation helpers.
- Create `apps/web/tests/repeat-transform.test.ts`: Node tests for repeat helper behavior.
- Create `apps/web/src/features/editor/components/RepeatModal.tsx`: focused repeat UI that builds a `NoteCopyPreviewRequest`.
- Modify `apps/web/src/features/editor/components/MultiSelectBar.tsx`: add `Repeat` action.
- Modify `apps/web/src/pages/EditorPage.tsx`: open `RepeatModal`, route preview into existing copy review state, and adjust review labels/toasts for repeat.

---

### Task 1: Shared And DTO Repeat Request Shape

**Files:**
- Modify: `packages/shared/src/placement-preview.ts`
- Modify: `apps/api/src/modules/notes/dto/note-copy.dto.ts`

- [ ] **Step 1: Write the failing backend validation expectation**

Add this import to `apps/api/src/modules/notes/__tests__/note-copy.service.spec.ts`:

```ts
import { validate } from 'class-validator'
import { plainToInstance } from 'class-transformer'
import { NoteCopyPreviewDto } from '../dto/note-copy.dto'
```

Add this test block before `describe('NoteCopyService', () => {`:

```ts
describe('NoteCopyPreviewDto repeat validation', () => {
  it('accepts REPEAT_INTERVAL with repeat count and interval', async () => {
    const dto = plainToInstance(NoteCopyPreviewDto, {
      noteIds: ['a', 'b'],
      operation: 'COPY',
      mode: 'REPEAT_INTERVAL',
      repeatCount: 3,
      repeatInterval: 4.0,
    })

    await expect(validate(dto)).resolves.toHaveLength(0)
  })

  it('rejects REPEAT_INTERVAL without repeat parameters', async () => {
    const dto = plainToInstance(NoteCopyPreviewDto, {
      noteIds: ['a', 'b'],
      operation: 'COPY',
      mode: 'REPEAT_INTERVAL',
    })

    const errors = await validate(dto)
    expect(errors.map((error) => error.property).sort()).toEqual(['repeatCount', 'repeatInterval'])
  })
})
```

- [ ] **Step 2: Run validation tests to verify failure**

Run:

```bash
pnpm --dir apps/api test -- note-copy.service.spec.ts --runInBand
```

Expected: FAIL because `REPEAT_INTERVAL`, `repeatCount`, and `repeatInterval` are not yet accepted by `NoteCopyPreviewDto`.

- [ ] **Step 3: Extend shared copy request types**

In `packages/shared/src/placement-preview.ts`, replace the transform mode type and request interface with:

```ts
export type NoteCopyTransformMode = 'TIME_SHIFT' | 'TRACK_SHIFT' | 'TRACK_TIME_ANCHOR' | 'REPEAT_INTERVAL'

export interface NoteCopyPreviewRequest {
  noteIds: string[]
  operation: NoteCopyOperation
  mode: NoteCopyTransformMode
  timeDelta?: number
  targetTrack?: number
  anchorTrack?: number
  anchorTime?: number
  repeatCount?: number
  repeatInterval?: number
}
```

- [ ] **Step 4: Extend DTO validation**

In `apps/api/src/modules/notes/dto/note-copy.dto.ts`, change the `mode` enum and add repeat fields after `anchorTime`:

```ts
  @IsEnum(['TIME_SHIFT', 'TRACK_SHIFT', 'TRACK_TIME_ANCHOR', 'REPEAT_INTERVAL'] as const)
  mode!: NoteCopyTransformMode
```

```ts
  @ValidateIf((dto: NoteCopyPreviewDto) => dto.mode === 'REPEAT_INTERVAL')
  @IsInt()
  @Min(1)
  @Max(500)
  repeatCount!: number

  @ValidateIf((dto: NoteCopyPreviewDto) => dto.mode === 'REPEAT_INTERVAL')
  @IsNumber()
  @Min(0.1)
  @Max(300)
  repeatInterval!: number
```

- [ ] **Step 5: Run validation tests to verify pass**

Run:

```bash
pnpm --dir apps/api test -- note-copy.service.spec.ts --runInBand
```

Expected: PASS for the DTO repeat validation tests. Existing service tests may still pass because no repeat service behavior has been added yet.

- [ ] **Step 6: Commit shared and DTO shape**

Run:

```bash
git add packages/shared/src/placement-preview.ts apps/api/src/modules/notes/dto/note-copy.dto.ts apps/api/src/modules/notes/__tests__/note-copy.service.spec.ts
git commit -m "feat: add repeat copy request shape"
```

---

### Task 2: Backend Repeat Slot Expansion

**Files:**
- Modify: `apps/api/src/modules/notes/note-copy.service.ts`
- Modify: `apps/api/src/modules/notes/__tests__/note-copy.service.spec.ts`

- [ ] **Step 1: Add failing repeat preview tests**

Inside `describe('previewCopy', () => {` in `apps/api/src/modules/notes/__tests__/note-copy.service.spec.ts`, add:

```ts
    it('REPEAT_INTERVAL creates multiple interval copies on the same tracks', async () => {
      const notes = [
        makeNote({ id: 'a', track: 1, time: 1.0, title: 'Kick' }),
        makeNote({ id: 'b', track: 3, time: 1.5, title: 'Snare' }),
      ]
      mockSelection(notes)

      const preview = await service.previewCopy(chartId, {
        noteIds: ['a', 'b'],
        operation: 'COPY',
        mode: 'REPEAT_INTERVAL',
        repeatCount: 3,
        repeatInterval: 4.0,
      }, mockUser)

      expect(preview.mode).toBe('REPEAT_INTERVAL')
      expect(preview.creatable).toHaveLength(6)
      expect(preview.creatable.map((slot) => ({ id: slot.sourceNoteId, track: slot.track, time: slot.time }))).toEqual([
        { id: 'a', track: 1, time: 5.0 },
        { id: 'b', track: 3, time: 5.5 },
        { id: 'a', track: 1, time: 9.0 },
        { id: 'b', track: 3, time: 9.5 },
        { id: 'a', track: 1, time: 13.0 },
        { id: 'b', track: 3, time: 13.5 },
      ])
      expect(preview.summary.totalNotes).toBe(6)
    })

    it('REPEAT_INTERVAL detects conflicts with existing destination notes', async () => {
      const notes = [
        makeNote({ id: 'a', track: 1, time: 1.0 }),
        makeNote({ id: 'b', track: 2, time: 1.5 }),
      ]
      const existing = [makeNote({ id: 'ex-1', track: 1, time: 5.0, title: 'Existing' })]
      mockSelection(notes, existing)

      const preview = await service.previewCopy(chartId, {
        noteIds: ['a', 'b'],
        operation: 'COPY',
        mode: 'REPEAT_INTERVAL',
        repeatCount: 1,
        repeatInterval: 4.0,
      }, mockUser)

      expect(preview.creatable).toHaveLength(1)
      expect(preview.conflicts).toHaveLength(1)
      expect(preview.conflicts[0]).toMatchObject({ conflictId: 'ex-1', sourceNoteId: 'a', track: 1, time: 5.0 })
    })

    it('REPEAT_INTERVAL rejects MOVE operation', async () => {
      const notes = [
        makeNote({ id: 'a', track: 1, time: 1.0 }),
        makeNote({ id: 'b', track: 2, time: 1.5 }),
      ]
      mockSelection(notes)

      await expect(service.previewCopy(chartId, {
        noteIds: ['a', 'b'],
        operation: 'MOVE',
        mode: 'REPEAT_INTERVAL',
        repeatCount: 2,
        repeatInterval: 4.0,
      }, mockUser)).rejects.toThrow(BadRequestException)
    })

    it('REPEAT_INTERVAL rejects generated slots above the copy cap', async () => {
      const notes = [
        makeNote({ id: 'a', track: 1, time: 1.0 }),
        makeNote({ id: 'b', track: 2, time: 1.5 }),
      ]
      mockSelection(notes)

      await expect(service.previewCopy(chartId, {
        noteIds: ['a', 'b'],
        operation: 'COPY',
        mode: 'REPEAT_INTERVAL',
        repeatCount: 251,
        repeatInterval: 0.1,
      }, mockUser)).rejects.toThrow(BadRequestException)
    })

    it('REPEAT_INTERVAL rejects repeated hold notes that end after timeline max', async () => {
      const notes = [
        makeNote({ id: 'a', track: 1, time: 298.0, noteType: 'HOLD', duration: 1.0 }),
        makeNote({ id: 'b', track: 2, time: 298.5 }),
      ]
      mockSelection(notes)

      await expect(service.previewCopy(chartId, {
        noteIds: ['a', 'b'],
        operation: 'COPY',
        mode: 'REPEAT_INTERVAL',
        repeatCount: 1,
        repeatInterval: 1.5,
      }, mockUser)).rejects.toThrow(BadRequestException)
    })

    it('REPEAT_INTERVAL selection version changes when repeat parameters change', async () => {
      const notes = [
        makeNote({ id: 'a', track: 1, time: 1.0 }),
        makeNote({ id: 'b', track: 2, time: 1.5 }),
      ]
      mockSelection(notes)

      const first = await service.previewCopy(chartId, {
        noteIds: ['a', 'b'],
        operation: 'COPY',
        mode: 'REPEAT_INTERVAL',
        repeatCount: 2,
        repeatInterval: 4.0,
      }, mockUser)
      const second = await service.previewCopy(chartId, {
        noteIds: ['a', 'b'],
        operation: 'COPY',
        mode: 'REPEAT_INTERVAL',
        repeatCount: 3,
        repeatInterval: 4.0,
      }, mockUser)

      expect(first.selectionVersion).not.toBe(second.selectionVersion)
    })
```

- [ ] **Step 2: Run backend tests to verify failure**

Run:

```bash
pnpm --dir apps/api test -- note-copy.service.spec.ts --runInBand
```

Expected: FAIL because `REPEAT_INTERVAL` falls through existing transform logic and does not expand slots or reject invalid repeat requests.

- [ ] **Step 3: Add repeat validation and version parameters**

In `apps/api/src/modules/notes/note-copy.service.ts`, update `buildSelectionVersion()` transform params:

```ts
    const transformParams =
      request.mode === 'TIME_SHIFT'
        ? String(request.timeDelta ?? '')
        : request.mode === 'TRACK_SHIFT'
          ? String(request.targetTrack ?? '')
          : request.mode === 'TRACK_TIME_ANCHOR'
            ? `${request.anchorTrack ?? ''},${request.anchorTime ?? ''}`
            : `${request.repeatCount ?? ''},${request.repeatInterval ?? ''}`
```

- [ ] **Step 4: Implement repeat slot expansion**

In `apps/api/src/modules/notes/note-copy.service.ts`, replace `computeTransformedSlots()` with:

```ts
  private computeTransformedSlots(
    notes: SelectionNoteRow[],
    request: NoteCopyPreviewRequest,
  ): { slots: IncomingSlot[]; minTime: number; minTrack: number } {
    const minTrack = Math.min(...notes.map((note) => note.track))
    const minTime = Math.min(...notes.map((note) => note.time))

    if (request.mode === 'REPEAT_INTERVAL') {
      return this.computeRepeatedSlots(notes, request, minTime, minTrack)
    }

    let trackDelta = 0
    let timeDelta = 0

    switch (request.mode) {
      case 'TIME_SHIFT':
        timeDelta = request.timeDelta ?? 0
        break
      case 'TRACK_SHIFT':
        trackDelta = (request.targetTrack ?? minTrack) - minTrack
        break
      case 'TRACK_TIME_ANCHOR':
        timeDelta = snapTime((request.anchorTime ?? minTime) - minTime)
        trackDelta = (request.anchorTrack ?? minTrack) - minTrack
        break
    }

    const slots: IncomingSlot[] = []

    for (let sourceIndex = 0; sourceIndex < notes.length; sourceIndex++) {
      const note = notes[sourceIndex]
      const track = note.track + trackDelta
      const time = snapTime(note.time + timeDelta)
      this.assertDestinationInRange(track, time, note)

      slots.push({
        sourceIndex,
        sourceNoteId: note.id,
        track,
        time,
        noteType: note.noteType,
        duration: note.duration,
        title: note.title,
        description: note.description,
      })
    }

    return { slots, minTime, minTrack }
  }
```

Add these methods below `computeTransformedSlots()`:

```ts
  private computeRepeatedSlots(
    notes: SelectionNoteRow[],
    request: NoteCopyPreviewRequest,
    minTime: number,
    minTrack: number,
  ): { slots: IncomingSlot[]; minTime: number; minTrack: number } {
    if (request.operation !== 'COPY') {
      throw new BadRequestException('REPEAT_INTERVAL only supports COPY operation')
    }

    const repeatCount = request.repeatCount ?? 0
    const repeatInterval = request.repeatInterval ?? 0

    if (!Number.isInteger(repeatCount) || repeatCount < 1) {
      throw new BadRequestException('repeatCount must be at least 1')
    }
    if (!Number.isFinite(repeatInterval) || repeatInterval <= 0) {
      throw new BadRequestException('repeatInterval must be greater than 0')
    }
    if (notes.length * repeatCount > MAX_NOTE_IDS) {
      throw new BadRequestException(`Cannot create more than ${MAX_NOTE_IDS} notes at once`)
    }

    const slots: IncomingSlot[] = []
    for (let repeatIndex = 1; repeatIndex <= repeatCount; repeatIndex++) {
      for (let sourceIndex = 0; sourceIndex < notes.length; sourceIndex++) {
        const note = notes[sourceIndex]
        const track = note.track
        const time = snapTime(note.time + repeatInterval * repeatIndex)
        this.assertDestinationInRange(track, time, note)

        slots.push({
          sourceIndex,
          sourceNoteId: note.id,
          track,
          time,
          noteType: note.noteType,
          duration: note.duration,
          title: note.title,
          description: note.description,
        })
      }
    }

    return { slots, minTime, minTrack }
  }

  private assertDestinationInRange(
    track: number,
    time: number,
    note: SelectionNoteRow,
  ): void {
    if (track < TRACK_MIN || track > TRACK_MAX) {
      throw new BadRequestException(`Track ${track} is out of range`)
    }
    if (time < TIME_MIN || time > TIME_MAX) {
      throw new BadRequestException(`Time ${time} is out of range`)
    }
    if (note.noteType === 'HOLD' && note.duration != null && note.duration > 0) {
      const endTime = snapTime(time + note.duration)
      if (endTime > TIME_MAX) {
        throw new BadRequestException(`HOLD end time ${endTime} is out of range`)
      }
    }
  }
```

- [ ] **Step 5: Run backend tests to verify pass**

Run:

```bash
pnpm --dir apps/api test -- note-copy.service.spec.ts --runInBand
```

Expected: PASS for all note copy tests.

- [ ] **Step 6: Commit backend repeat behavior**

Run:

```bash
git add apps/api/src/modules/notes/note-copy.service.ts apps/api/src/modules/notes/__tests__/note-copy.service.spec.ts
git commit -m "feat: repeat selected notes in copy service"
```

---

### Task 3: Frontend Repeat Helpers

**Files:**
- Create: `apps/web/src/features/editor/components/repeat-transform.ts`
- Create: `apps/web/tests/repeat-transform.test.ts`

- [ ] **Step 1: Write failing helper tests**

Create `apps/web/tests/repeat-transform.test.ts`:

```ts
import assert from 'node:assert/strict'
import { test } from 'node:test'
import {
  MAX_REPEAT_GENERATED_NOTES,
  formatRepeatInterval,
  getRepeatDefaults,
  parseRepeatCountDraft,
  parseRepeatIntervalDraft,
  sanitizeRepeatCountDraft,
  sanitizeRepeatIntervalDraft,
  validateRepeatRequest,
} from '../src/features/editor/components/repeat-transform.ts'

const notes = [
  { id: 'a', songId: 'song', chartId: 'chart', track: 1, time: 1.0, title: 'A', description: '', createdBy: 'u', creatorName: 'User', createdAt: '', updatedAt: '', noteType: 'TAP' as const },
  { id: 'b', songId: 'song', chartId: 'chart', track: 2, time: 2.5, title: 'B', description: '', createdBy: 'u', creatorName: 'User', createdAt: '', updatedAt: '', noteType: 'TAP' as const },
]

test('repeat defaults use three copies and one measure interval', () => {
  assert.deepEqual(getRepeatDefaults(notes, 120, '4/4'), {
    repeatCountDraft: '3',
    repeatIntervalDraft: '2.0',
  })
})

test('selection length interval is based on selected note span', () => {
  assert.equal(formatRepeatInterval(2.5 - 1.0), '1.5')
})

test('repeat drafts sanitize and parse numeric input', () => {
  assert.equal(sanitizeRepeatCountDraft('03abc'), '3')
  assert.equal(parseRepeatCountDraft('3'), 3)
  assert.equal(parseRepeatCountDraft('0'), null)
  assert.equal(sanitizeRepeatIntervalDraft('04.25s'), '4.25')
  assert.equal(parseRepeatIntervalDraft('4.25'), 4.3)
  assert.equal(parseRepeatIntervalDraft('0'), null)
})

test('repeat validation blocks generated notes over cap', () => {
  assert.equal(MAX_REPEAT_GENERATED_NOTES, 500)
  assert.equal(validateRepeatRequest(notes, 251, 0.1), 'Repeat would create 502 notes; limit is 500')
})

test('repeat validation accepts a bounded request', () => {
  assert.equal(validateRepeatRequest(notes, 3, 4.0), null)
})
```

- [ ] **Step 2: Run helper test to verify failure**

Run:

```bash
node --import tsx --test apps/web/tests/repeat-transform.test.ts
```

Expected: FAIL because `repeat-transform.ts` does not exist.

- [ ] **Step 3: Implement repeat helper module**

Create `apps/web/src/features/editor/components/repeat-transform.ts`:

```ts
import { measureDuration, type Note } from '@ama-midi/shared'

export const MAX_REPEAT_GENERATED_NOTES = 500

export function formatRepeatInterval(value: number): string {
  return Number(value.toFixed(1)).toFixed(1)
}

export function sanitizeRepeatCountDraft(value: string): string {
  const digits = value.replace(/\D/g, '').replace(/^0+(?=\d)/, '')
  return digits === '0' ? '' : digits
}

export function parseRepeatCountDraft(value: string): number | null {
  const parsed = Number.parseInt(value, 10)
  if (!Number.isInteger(parsed) || parsed < 1) return null
  return parsed
}

export function sanitizeRepeatIntervalDraft(value: string): string {
  const numeric = value.replace(/[^\d.]/g, '')
  const [whole = '', ...decimalParts] = numeric.split('.')
  const decimal = decimalParts.join('')
  const wholeWithoutLeadingZeroes = whole.replace(/^0+(?=\d)/, '')

  if (numeric.startsWith('.')) return `0.${decimal}`
  if (!numeric.includes('.')) return wholeWithoutLeadingZeroes.replace(/^0+$/, '0')
  if (wholeWithoutLeadingZeroes === '') return `0.${decimal}`

  return `${wholeWithoutLeadingZeroes}.${decimal}`
}

export function parseRepeatIntervalDraft(value: string): number | null {
  const parsed = Number.parseFloat(value.trim())
  if (!Number.isFinite(parsed) || parsed <= 0) return null
  return Number(parsed.toFixed(1))
}

export function getSelectionLengthInterval(notes: Pick<Note, 'time'>[]): number {
  if (notes.length < 2) return 0.1
  const times = notes.map((note) => note.time)
  return Math.max(0.1, Number((Math.max(...times) - Math.min(...times)).toFixed(1)))
}

export function getRepeatDefaults(
  notes: Pick<Note, 'time'>[],
  bpm: number,
  timeSignature: string,
): { repeatCountDraft: string; repeatIntervalDraft: string } {
  return {
    repeatCountDraft: '3',
    repeatIntervalDraft: formatRepeatInterval(measureDuration(bpm, timeSignature)),
  }
}

export function validateRepeatRequest(
  notes: Pick<Note, 'id'>[],
  repeatCount: number | null,
  repeatInterval: number | null,
): string | null {
  if (repeatCount == null) return 'Enter at least 1 copy'
  if (repeatInterval == null) return 'Enter an interval greater than 0.0s'

  const generated = notes.length * repeatCount
  if (generated > MAX_REPEAT_GENERATED_NOTES) {
    return `Repeat would create ${generated} notes; limit is ${MAX_REPEAT_GENERATED_NOTES}`
  }

  return null
}
```

- [ ] **Step 4: Run helper test to verify pass**

Run:

```bash
node --import tsx --test apps/web/tests/repeat-transform.test.ts
```

Expected: PASS for all repeat helper tests.

- [ ] **Step 5: Commit frontend helpers**

Run:

```bash
git add apps/web/src/features/editor/components/repeat-transform.ts apps/web/tests/repeat-transform.test.ts
git commit -m "feat: add repeat note transform helpers"
```

---

### Task 4: Repeat Modal And Editor Wiring

**Files:**
- Create: `apps/web/src/features/editor/components/RepeatModal.tsx`
- Modify: `apps/web/src/features/editor/components/MultiSelectBar.tsx`
- Modify: `apps/web/src/pages/EditorPage.tsx`

- [ ] **Step 1: Add MultiSelectBar repeat prop and button**

In `apps/web/src/features/editor/components/MultiSelectBar.tsx`, add `onRepeat` to props:

```ts
  onRepeat:           () => void
```

Update function params:

```ts
  count, canEdit, onContinuePattern, onRepeat, onSavePattern, onCopyTo, onDelete, onDeselect, copyDisabled,
```

Add this button after `Continue pattern`:

```tsx
      {canEdit && (
        <Button
          size="sm"
          variant="secondary"
          icon={<CopyIcon />}
          onClick={onRepeat}
          className="px-2"
        >
          Repeat
        </Button>
      )}
```

- [ ] **Step 2: Create RepeatModal**

Create `apps/web/src/features/editor/components/RepeatModal.tsx`:

```tsx
import { useState } from 'react'
import type { Note, NoteCopyPreview, NoteCopyPreviewRequest } from '@ama-midi/shared'
import { measureDuration } from '@ama-midi/shared'
import { Button, Modal } from '../../../components/ui'
import { toast } from 'sonner'
import { usePreviewNoteCopy } from '../hooks/useNoteCopy'
import {
  formatRepeatInterval,
  getRepeatDefaults,
  getSelectionLengthInterval,
  parseRepeatCountDraft,
  parseRepeatIntervalDraft,
  sanitizeRepeatCountDraft,
  sanitizeRepeatIntervalDraft,
  validateRepeatRequest,
} from './repeat-transform'

interface Props {
  chartId: string
  selectedNotes: Note[]
  bpm: number
  timeSignature: string
  onCancel: () => void
  onPreviewReady: (preview: NoteCopyPreview, request: NoteCopyPreviewRequest) => void
}

export function RepeatModal({
  chartId,
  selectedNotes,
  bpm,
  timeSignature,
  onCancel,
  onPreviewReady,
}: Props) {
  const previewCopy = usePreviewNoteCopy(chartId)
  const defaults = getRepeatDefaults(selectedNotes, bpm, timeSignature)
  const [repeatCountDraft, setRepeatCountDraft] = useState(defaults.repeatCountDraft)
  const [repeatIntervalDraft, setRepeatIntervalDraft] = useState(defaults.repeatIntervalDraft)
  const [validating, setValidating] = useState(false)

  const repeatCount = parseRepeatCountDraft(repeatCountDraft)
  const repeatInterval = parseRepeatIntervalDraft(repeatIntervalDraft)
  const validationError = validateRepeatRequest(selectedNotes, repeatCount, repeatInterval)
  const generatedCount = repeatCount == null ? 0 : selectedNotes.length * repeatCount

  function setOneBeat() {
    setRepeatIntervalDraft(formatRepeatInterval(60 / bpm))
  }

  function setOneMeasure() {
    setRepeatIntervalDraft(formatRepeatInterval(measureDuration(bpm, timeSignature)))
  }

  function setSelectionLength() {
    setRepeatIntervalDraft(formatRepeatInterval(getSelectionLengthInterval(selectedNotes)))
  }

  function buildRequest(): NoteCopyPreviewRequest {
    return {
      noteIds: selectedNotes.map((note) => note.id),
      operation: 'COPY',
      mode: 'REPEAT_INTERVAL',
      repeatCount: repeatCount!,
      repeatInterval: repeatInterval!,
    }
  }

  function handleValidate() {
    if (validationError) {
      toast.error(validationError)
      return
    }

    const request = buildRequest()
    setValidating(true)
    previewCopy.mutate(request, {
      onSuccess: (preview) => {
        setValidating(false)
        onPreviewReady(preview, request)
      },
      onError: () => {
        setValidating(false)
        toast.error('Could not preview repeat')
      },
    })
  }

  return (
    <Modal.Root open onOpenChange={(open) => !open && onCancel()}>
      <Modal.Content className="max-w-[420px]">
        <Modal.Header onClose={onCancel}>Repeat Notes</Modal.Header>
        <Modal.Body>
          <div className="space-y-4">
            <p className="text-xs" style={{ color: 'var(--modal-muted)' }}>
              {selectedNotes.length} selected notes. Creates {generatedCount} repeated notes.
            </p>

            <div>
              <label className="mb-1 block text-xs" style={{ color: 'var(--modal-muted)' }}>
                Copies
              </label>
              <input
                type="text"
                inputMode="numeric"
                value={repeatCountDraft}
                onChange={(event) => setRepeatCountDraft(sanitizeRepeatCountDraft(event.target.value))}
                className="w-full rounded border px-3 py-2 text-sm font-mono outline-none focus:ring-2 focus:ring-primary/30"
                style={{
                  backgroundColor: 'var(--modal-input-bg)',
                  borderColor: 'var(--modal-input-border)',
                  color: 'var(--modal-input-text)',
                }}
                aria-label="Repeat copy count"
                autoFocus
              />
            </div>

            <div>
              <label className="mb-1 block text-xs" style={{ color: 'var(--modal-muted)' }}>
                Interval
              </label>
              <div className="flex items-center gap-1">
                <input
                  type="text"
                  inputMode="decimal"
                  value={repeatIntervalDraft}
                  onChange={(event) => setRepeatIntervalDraft(sanitizeRepeatIntervalDraft(event.target.value))}
                  onBlur={() => {
                    if (repeatInterval != null) setRepeatIntervalDraft(formatRepeatInterval(repeatInterval))
                  }}
                  className="min-w-0 flex-1 rounded border px-3 py-2 text-sm font-mono outline-none focus:ring-2 focus:ring-primary/30"
                  style={{
                    backgroundColor: 'var(--modal-input-bg)',
                    borderColor: 'var(--modal-input-border)',
                    color: 'var(--modal-input-text)',
                  }}
                  aria-label="Repeat interval in seconds"
                />
                <span className="text-xs" style={{ color: 'var(--modal-muted)' }}>s</span>
              </div>
              <div className="mt-2 flex flex-wrap gap-1.5">
                <button type="button" onClick={setOneBeat} className="rounded border border-shell-border px-2 py-1 text-xs text-shell-muted hover:text-shell-text">
                  1 beat
                </button>
                <button type="button" onClick={setOneMeasure} className="rounded border border-shell-border px-2 py-1 text-xs text-shell-muted hover:text-shell-text">
                  1 measure
                </button>
                <button type="button" onClick={setSelectionLength} className="rounded border border-shell-border px-2 py-1 text-xs text-shell-muted hover:text-shell-text">
                  Selection length
                </button>
              </div>
            </div>

            {validationError && <p className="text-xs text-error">{validationError}</p>}
          </div>
        </Modal.Body>
        <Modal.Footer>
          <Button size="sm" variant="ghost" onClick={onCancel}>
            Cancel
          </Button>
          <Button
            size="sm"
            variant="primary"
            disabled={validationError != null}
            loading={validating || previewCopy.isPending}
            onClick={handleValidate}
          >
            Validate
          </Button>
        </Modal.Footer>
      </Modal.Content>
    </Modal.Root>
  )
}
```

- [ ] **Step 3: Wire RepeatModal into EditorPage**

In `apps/web/src/pages/EditorPage.tsx`, add import:

```ts
import { RepeatModal }       from '../features/editor/components/RepeatModal'
```

Add state beside `showCopyTo`:

```ts
  const [showRepeat,          setShowRepeat]          = useState(false)
```

Update `resetCopyState()`:

```ts
    setShowRepeat(false)
```

Update `handleCopyPreviewReady()`:

```ts
    setShowRepeat(false)
```

Update success toast in `handleApplyCopy()`:

```ts
          const verb = copyPreview.mode === 'REPEAT_INTERVAL'
            ? 'Repeated'
            : copyPreview.operation === 'MOVE'
              ? 'Moved'
              : 'Copied'
```

Update `copyReviewTitle`:

```ts
  const copyReviewTitle = copyPreview?.mode === 'REPEAT_INTERVAL'
    ? 'Repeat Notes'
    : copyPreview?.operation === 'MOVE'
      ? 'Move Notes'
      : 'Copy Notes'
```

Update `ConflictReviewModal` apply label:

```tsx
          applyLabel={copyPreview.mode === 'REPEAT_INTERVAL' ? 'Repeat' : copyPreview.operation === 'MOVE' ? 'Move' : 'Copy'}
```

Pass `onRepeat` to `MultiSelectBar`:

```tsx
        onRepeat={() => setShowRepeat(true)}
```

Render `RepeatModal` after `CopyToModal`:

```tsx
      {showRepeat && canEdit && chartId && (
        <RepeatModal
          chartId={chartId}
          selectedNotes={selectedNoteObjects}
          bpm={song?.bpm ?? 120}
          timeSignature={song?.timeSignature ?? '4/4'}
          onCancel={resetCopyState}
          onPreviewReady={handleCopyPreviewReady}
        />
      )}
```

- [ ] **Step 4: Run frontend helper test and build**

Run:

```bash
node --import tsx --test apps/web/tests/repeat-transform.test.ts
pnpm --dir apps/web build
```

Expected: helper tests PASS and web build succeeds.

- [ ] **Step 5: Commit frontend wiring**

Run:

```bash
git add apps/web/src/features/editor/components/RepeatModal.tsx apps/web/src/features/editor/components/MultiSelectBar.tsx apps/web/src/pages/EditorPage.tsx
git commit -m "feat: add repeat notes editor flow"
```

---

### Task 5: Final Verification

**Files:**
- Verify: all files changed by Tasks 1-4

- [ ] **Step 1: Run focused backend tests**

Run:

```bash
pnpm --dir apps/api test -- note-copy.service.spec.ts --runInBand
```

Expected: PASS.

- [ ] **Step 2: Run focused frontend helper tests**

Run:

```bash
node --import tsx --test apps/web/tests/repeat-transform.test.ts
```

Expected: PASS.

- [ ] **Step 3: Run production builds**

Run:

```bash
pnpm --dir apps/api build
pnpm --dir apps/web build
```

Expected: both builds succeed.

- [ ] **Step 4: Inspect final git status**

Run:

```bash
git status --short
```

Expected: only unrelated pre-existing worktree changes remain, or a clean worktree if those changes were not present in the execution environment.

