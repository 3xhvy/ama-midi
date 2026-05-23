# Paste Pattern Conflict Review UI — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the minimal inline conflict list in `PatternPanel.tsx` with a full-screen git-style conflict resolver — split layout, diff cards, context strip, keyboard shortcuts, and 409 recovery.

**Architecture:** Extract the REVIEW phase into a dedicated `ConflictReviewModal` component. `PatternPanel` keeps its state machine and `resolutions` map (needed for the apply call) and passes them as props. All REVIEW-internal state (`activeIndex`, banner) lives inside the modal.

**Tech Stack:** React 18, TypeScript, Tailwind CSS, `@ama-midi/shared` types, Node.js built-in test runner (`node:test`)

---

## File Map

| File | Action | Purpose |
|---|---|---|
| `apps/web/src/features/editor/components/conflict-formatters.ts` | **Create** | `formatTime()` and `formatOffset()` — mandatory for all time values |
| `apps/web/tests/conflict-formatters.test.ts` | **Create** | Unit tests for the formatters |
| `apps/web/src/features/editor/components/ConflictListItem.tsx` | **Create** | Single row in the left conflict list panel |
| `apps/web/src/features/editor/components/ConflictDiffCards.tsx` | **Create** | Before/after diff card pair with color states |
| `apps/web/src/features/editor/components/ConflictContextStrip.tsx` | **Create** | Surrounding notes strip on same track |
| `apps/web/src/features/editor/components/ConflictReviewModal.tsx` | **Create** | Root modal shell — assembles all sub-components, handles keyboard |
| `apps/web/src/features/editor/components/PatternPanel.tsx` | **Modify** | Wire in `ConflictReviewModal`, update 409 handling, remove old REVIEW JSX |

---

## Task 1: Formatters

**Files:**
- Create: `apps/web/src/features/editor/components/conflict-formatters.ts`
- Create: `apps/web/tests/conflict-formatters.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
// apps/web/tests/conflict-formatters.test.ts
import assert from 'node:assert/strict'
import { test } from 'node:test'
import {
  formatTime,
  formatOffset,
} from '../src/features/editor/components/conflict-formatters.ts'

test('formatTime rounds to 1 decimal and appends s', () => {
  assert.equal(formatTime(20.1),             '20.1s')
  assert.equal(formatTime(20.09999999999),   '20.1s')
  assert.equal(formatTime(0),                '0.0s')
  assert.equal(formatTime(300),              '300.0s')
})

test('formatOffset includes sign and rounds to 1 decimal', () => {
  assert.equal(formatOffset(3.09999999999),  '+3.1s')
  assert.equal(formatOffset(0),              '+0.0s')
  assert.equal(formatOffset(-0.5),           '-0.5s')
  assert.equal(formatOffset(0.1 + 0.2),      '+0.3s')
})
```

- [ ] **Step 2: Run test to confirm it fails**

```bash
cd apps/web && node --experimental-strip-types --test tests/conflict-formatters.test.ts
```

Expected: `ReferenceError: formatTime is not defined` or module not found.

- [ ] **Step 3: Write the implementation**

```typescript
// apps/web/src/features/editor/components/conflict-formatters.ts

export function formatTime(seconds: number): string {
  return `${seconds.toFixed(1)}s`
}

export function formatOffset(seconds: number): string {
  const rounded = Math.round(seconds * 10) / 10
  return `${rounded >= 0 ? '+' : ''}${rounded.toFixed(1)}s`
}
```

- [ ] **Step 4: Run test to confirm it passes**

```bash
cd apps/web && node --experimental-strip-types --test tests/conflict-formatters.test.ts
```

Expected: `✓ formatTime rounds to 1 decimal and appends s` and `✓ formatOffset includes sign and rounds to 1 decimal`.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/features/editor/components/conflict-formatters.ts apps/web/tests/conflict-formatters.test.ts
git commit -m "feat(editor): add conflict-formatters with formatTime and formatOffset"
```

---

## Task 2: ConflictListItem

**Files:**
- Create: `apps/web/src/features/editor/components/ConflictListItem.tsx`

- [ ] **Step 1: Create the component**

```tsx
// apps/web/src/features/editor/components/ConflictListItem.tsx
import { trackColor } from '@ama-midi/shared'
import type { ConflictAction, PatternPasteConflict } from '@ama-midi/shared'
import { formatTime } from './conflict-formatters'

interface Props {
  conflict:   PatternPasteConflict
  resolution: ConflictAction | undefined
  isActive:   boolean
  onClick:    () => void
}

const NOTE_TYPE_COLORS: Record<string, string> = {
  TAP:   'bg-[#EEF0FF] text-[#6C63FF]',
  HOLD:  'bg-red-50 text-red-500',
  SWIPE: 'bg-blue-50 text-blue-500',
}

function TypePill({ type }: { type: string }) {
  return (
    <span className={`inline-block px-1.5 py-0.5 rounded text-[9px] font-semibold ${NOTE_TYPE_COLORS[type] ?? 'bg-slate-100 text-slate-500'}`}>
      {type}
    </span>
  )
}

function StatusDot({ resolution }: { resolution: ConflictAction | undefined }) {
  const color = resolution === 'KEEP_EXISTING'
    ? 'bg-emerald-500'
    : resolution === 'REPLACE_WITH_PATTERN'
    ? 'bg-red-500'
    : 'bg-amber-300'
  return <span className={`w-2 h-2 rounded-full flex-shrink-0 ${color}`} />
}

export function ConflictListItem({ conflict, resolution, isActive, onClick }: Props) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`w-full text-left px-3 py-2.5 flex items-start gap-2 transition-colors ${
        isActive
          ? 'bg-[#EEF0FF] border-l-2 border-[#6C63FF]'
          : 'border-l-2 border-transparent hover:bg-slate-50'
      }`}
    >
      <span
        className="w-2.5 h-2.5 rounded-full flex-shrink-0 mt-0.5"
        style={{ backgroundColor: trackColor(conflict.track) }}
      />
      <div className="flex-1 min-w-0">
        <div className="text-xs font-semibold text-slate-700 truncate">
          T{conflict.track} · {formatTime(conflict.time)}
        </div>
        <div className="flex items-center gap-1 mt-0.5">
          <TypePill type={conflict.existingNote.noteType} />
          <span className="text-[9px] text-slate-400">→</span>
          <TypePill type={conflict.patternNote.noteType} />
        </div>
        <div className="text-[10px] text-slate-400 truncate mt-0.5">
          {conflict.existingNote.creatorName}
        </div>
      </div>
      <StatusDot resolution={resolution} />
    </button>
  )
}
```

- [ ] **Step 2: Check TypeScript compiles**

```bash
cd apps/web && npx tsc --noEmit 2>&1 | grep ConflictListItem
```

Expected: no output (no errors).

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/features/editor/components/ConflictListItem.tsx
git commit -m "feat(editor): add ConflictListItem for conflict list panel"
```

---

## Task 3: ConflictDiffCards

**Files:**
- Create: `apps/web/src/features/editor/components/ConflictDiffCards.tsx`

- [ ] **Step 1: Create the component**

```tsx
// apps/web/src/features/editor/components/ConflictDiffCards.tsx
import { Avatar } from '../../../components/ui/Avatar'
import type { ConflictAction, PatternPasteConflict } from '@ama-midi/shared'
import { formatTime, formatOffset } from './conflict-formatters'

interface Props {
  conflict:   PatternPasteConflict
  resolution: ConflictAction | undefined
}

const NOTE_TYPE_COLORS: Record<string, string> = {
  TAP:   'bg-[#EEF0FF] text-[#6C63FF]',
  HOLD:  'bg-red-50 text-red-500',
  SWIPE: 'bg-blue-50 text-blue-500',
}

function TypePill({ type }: { type: string }) {
  return (
    <span className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-semibold ${NOTE_TYPE_COLORS[type] ?? 'bg-slate-100 text-slate-500'}`}>
      {type}
    </span>
  )
}

function formatDate(iso: string): string {
  const d = new Date(iso)
  const date = d.toISOString().slice(0, 10)
  const time = d.toTimeString().slice(0, 5)
  return `${date} · ${time}`
}

export function ConflictDiffCards({ conflict, resolution }: Props) {
  const { existingNote, patternNote } = conflict
  const isReplacing = resolution === 'REPLACE_WITH_PATTERN'
  const isKeeping   = resolution === 'KEEP_EXISTING'

  const existingCls = isReplacing
    ? 'border-slate-200 bg-slate-50 opacity-50'
    : isKeeping
    ? 'border-red-200 bg-red-50'
    : 'border-slate-200 bg-slate-50'

  const patternCls = isKeeping
    ? 'border-slate-200 bg-slate-50 opacity-50'
    : isReplacing
    ? 'border-[#6C63FF] bg-[#F5F3FF]'
    : 'border-slate-200 bg-slate-50'

  const existingLabel = isReplacing
    ? 'EXISTING — WILL BE REMOVED'
    : isKeeping
    ? 'EXISTING — WILL BE KEPT'
    : 'EXISTING NOTE'

  const existingLabelCls = isReplacing
    ? 'text-slate-400'
    : isKeeping
    ? 'text-red-500'
    : 'text-slate-400'

  const patternLabel = isKeeping
    ? 'PATTERN — WILL BE SKIPPED'
    : isReplacing
    ? 'PATTERN — WILL BE CREATED'
    : 'PATTERN NOTE'

  const patternLabelCls = isKeeping
    ? 'text-slate-400'
    : isReplacing
    ? 'text-[#6C63FF]'
    : 'text-slate-400'

  return (
    <div className="flex items-start gap-3">
      {/* Existing note card */}
      <div className={`flex-1 rounded-xl border p-4 transition-all ${existingCls}`}>
        <div className={`text-[9px] font-bold tracking-wider mb-3 ${existingLabelCls}`}>
          {existingLabel}
        </div>
        <div className={`text-base font-bold text-slate-800 mb-2 ${isReplacing ? 'line-through text-slate-400' : ''}`}>
          {existingNote.title}
        </div>
        <TypePill type={existingNote.noteType} />
        {existingNote.duration != null && (
          <div className="text-xs text-slate-500 mt-2">
            Duration: {formatTime(existingNote.duration)}
          </div>
        )}
        <div className="flex items-center gap-2 mt-3">
          <Avatar
            src={existingNote.creatorAvatarUrl}
            name={existingNote.creatorName}
            size="xs"
          />
          <span className="text-xs text-slate-600">{existingNote.creatorName}</span>
        </div>
        <div className="text-[10px] text-slate-400 mt-1">
          {formatDate(existingNote.createdAt)}
        </div>
      </div>

      {/* Arrow */}
      <div className="flex-shrink-0 mt-8 text-slate-300 text-lg">→</div>

      {/* Pattern note card */}
      <div className={`flex-1 rounded-xl border p-4 transition-all ${patternCls}`}>
        <div className={`text-[9px] font-bold tracking-wider mb-3 ${patternLabelCls}`}>
          {patternLabel}
        </div>
        <div className="text-base font-bold text-slate-400 mb-2">New note</div>
        <TypePill type={patternNote.noteType} />
        {patternNote.duration != null && (
          <div className="text-xs text-slate-500 mt-2">
            Duration: {formatTime(patternNote.duration)}
          </div>
        )}
        {patternNote.duration == null && (
          <div className="text-xs text-slate-400 mt-2">No duration</div>
        )}
        <div className="text-xs text-slate-400 mt-3">
          offset {formatOffset(patternNote.timeOffset)} from paste point
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Check TypeScript compiles**

```bash
cd apps/web && npx tsc --noEmit 2>&1 | grep ConflictDiffCards
```

Expected: no output.

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/features/editor/components/ConflictDiffCards.tsx
git commit -m "feat(editor): add ConflictDiffCards with kept/discarded/incoming states"
```

---

## Task 4: ConflictContextStrip

**Files:**
- Create: `apps/web/src/features/editor/components/ConflictContextStrip.tsx`

- [ ] **Step 1: Create the component**

```tsx
// apps/web/src/features/editor/components/ConflictContextStrip.tsx
import { trackColor } from '@ama-midi/shared'
import type { PatternPasteConflict, PatternPastePreview } from '@ama-midi/shared'
import { formatTime } from './conflict-formatters'

interface ContextEntry {
  time:       number
  isConflict: boolean
}

interface Props {
  conflict: PatternPasteConflict
  preview:  PatternPastePreview
}

export function ConflictContextStrip({ conflict, preview }: Props) {
  // Gather all notes on the same track from the preview data
  const trackNotes: ContextEntry[] = []

  // Other conflicts on same track
  for (const c of preview.conflicts) {
    if (c.track === conflict.track) {
      trackNotes.push({ time: c.time, isConflict: c.conflictId === conflict.conflictId })
    }
  }

  // Creatable pattern notes on same track
  for (const n of preview.creatable) {
    if (n.track === conflict.track) {
      trackNotes.push({ time: n.time, isConflict: false })
    }
  }

  // Sort by time, deduplicate by time
  const seen = new Set<number>()
  const sorted = trackNotes
    .filter(n => { if (seen.has(n.time)) return false; seen.add(n.time); return true })
    .sort((a, b) => a.time - b.time)

  const conflictIdx = sorted.findIndex(n => n.isConflict)

  const before = sorted.slice(Math.max(0, conflictIdx - 2), conflictIdx)
  const after  = sorted.slice(conflictIdx + 1, conflictIdx + 3)
  const color  = trackColor(conflict.track)

  return (
    <div className="rounded-lg border border-slate-100 bg-[#F8F7FF] px-3 py-2.5">
      <div className="text-[9px] font-semibold uppercase tracking-wider text-slate-400 mb-2">
        Surrounding context — Track {conflict.track}
      </div>
      <div className="flex items-end gap-4">
        {before.map(n => (
          <div key={n.time} className="flex flex-col items-center gap-1">
            <span className="w-3 h-3 rounded-full" style={{ backgroundColor: color }} />
            <span className="text-[8px] text-slate-400 font-mono">{formatTime(n.time)}</span>
          </div>
        ))}

        {/* Conflict marker */}
        <div className="flex flex-col items-center gap-1">
          <span className="w-3.5 h-3.5 rounded-full border-2 border-red-500 bg-red-50 flex items-center justify-center text-[7px] font-bold text-red-500">
            !
          </span>
          <span className="text-[8px] font-mono font-semibold text-red-500">{formatTime(conflict.time)}</span>
        </div>

        {after.map(n => (
          <div key={n.time} className="flex flex-col items-center gap-1">
            <span className="w-3 h-3 rounded-full" style={{ backgroundColor: color }} />
            <span className="text-[8px] text-slate-400 font-mono">{formatTime(n.time)}</span>
          </div>
        ))}
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Check TypeScript compiles**

```bash
cd apps/web && npx tsc --noEmit 2>&1 | grep ConflictContextStrip
```

Expected: no output.

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/features/editor/components/ConflictContextStrip.tsx
git commit -m "feat(editor): add ConflictContextStrip showing track neighbors"
```

---

## Task 5: ConflictReviewModal

**Files:**
- Create: `apps/web/src/features/editor/components/ConflictReviewModal.tsx`

- [ ] **Step 1: Create the component**

```tsx
// apps/web/src/features/editor/components/ConflictReviewModal.tsx
import { useState, useEffect, useCallback } from 'react'
import type { ConflictAction, PatternPastePreview } from '@ama-midi/shared'
import { trackColor } from '@ama-midi/shared'
import { ConflictListItem } from './ConflictListItem'
import { ConflictDiffCards } from './ConflictDiffCards'
import { ConflictContextStrip } from './ConflictContextStrip'
import { formatTime } from './conflict-formatters'

interface Props {
  preview:                  PatternPastePreview
  resolutions:              Record<string, ConflictAction>
  onResolve:                (conflictId: string, action: ConflictAction) => void
  onApply:                  () => void
  onCancel:                 () => void
  patternName:              string
  hasConflictChanged?:      boolean
  onDismissConflictBanner?: () => void
}

export function ConflictReviewModal({
  preview,
  resolutions,
  onResolve,
  onApply,
  onCancel,
  patternName,
  hasConflictChanged,
  onDismissConflictBanner,
}: Props) {
  const conflicts = preview.conflicts
  const [activeIndex, setActiveIndex] = useState(0)

  // Derived values
  const unresolved   = conflicts.filter(c => resolutions[c.conflictId] === undefined)
  const keepCount    = conflicts.filter(c => resolutions[c.conflictId] === 'KEEP_EXISTING').length
  const replaceCount = conflicts.filter(c => resolutions[c.conflictId] === 'REPLACE_WITH_PATTERN').length
  const skipCount    = keepCount
  const createCount  = preview.summary.creatableNotes + replaceCount
  const allResolved  = unresolved.length === 0
  const applyDisabled = !allResolved || (createCount + replaceCount === 0)

  const activeConflict = conflicts[activeIndex]

  function resolveAndAdvance(conflictId: string, action: ConflictAction) {
    onResolve(conflictId, action)
    // Find next unresolved after current index (pre-update snapshot — current conflict
    // is still in resolutions as undefined, but we skip it by starting at activeIndex + 1)
    const next = conflicts.findIndex((c, i) => i > activeIndex && resolutions[c.conflictId] === undefined)
    if (next !== -1) setActiveIndex(next)
  }

  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return
    switch (e.key) {
      case 'ArrowLeft':
        e.preventDefault()
        setActiveIndex(i => Math.max(0, i - 1))
        break
      case 'ArrowRight':
        e.preventDefault()
        setActiveIndex(i => Math.min(conflicts.length - 1, i + 1))
        break
      case 'k':
      case 'K':
        if (activeConflict) resolveAndAdvance(activeConflict.conflictId, 'KEEP_EXISTING')
        break
      case 'r':
      case 'R':
        if (activeConflict) resolveAndAdvance(activeConflict.conflictId, 'REPLACE_WITH_PATTERN')
        break
      case 'Escape':
        onCancel()
        break
      case 'Enter':
        if (!applyDisabled) onApply()
        break
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [conflicts, activeIndex, resolutions, activeConflict, applyDisabled, onCancel, onApply])

  useEffect(() => {
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [handleKeyDown])

  if (!activeConflict) return null

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      style={{ backgroundColor: 'rgba(8,6,20,0.72)' }}
      onClick={onCancel}
    >
      <div
        className="flex flex-col rounded-2xl overflow-hidden"
        style={{
          width: '80vw',
          maxWidth: 860,
          height: 560,
          backgroundColor: 'var(--modal-bg)',
          boxShadow: '0 24px 60px rgba(0,0,0,0.30), 0 0 0 1px rgba(108,99,255,0.14)',
        }}
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex-shrink-0 px-6 py-4 border-b" style={{ borderColor: 'var(--modal-border)' }}>
          <div className="flex items-start justify-between gap-4">
            <div>
              <h2 className="text-sm font-semibold" style={{ color: 'var(--modal-text)' }}>
                Paste Pattern — {patternName}
              </h2>
              <p className="text-xs mt-0.5" style={{ color: 'var(--modal-muted)' }}>
                Pasting at {formatTime(preview.startTime)} · {preview.summary.totalPatternNotes} pattern notes
              </p>
              <div className="flex items-center gap-2 mt-2">
                <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-600">
                  {preview.summary.creatableNotes} will be created
                </span>
                <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-red-50 text-red-500">
                  {preview.summary.conflictCount} conflicts
                </span>
                <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-amber-50 text-amber-600">
                  {preview.summary.affectedExistingNotes} notes affected
                </span>
              </div>
            </div>
            <button
              type="button"
              onClick={onCancel}
              className="text-xl leading-none hover:opacity-60 flex-shrink-0 mt-1"
              style={{ color: 'var(--modal-muted)' }}
            >
              ✕
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="flex flex-row flex-1 overflow-hidden">
          {/* Left panel */}
          <div className="w-[220px] flex-shrink-0 border-r overflow-y-auto" style={{ borderColor: 'var(--modal-border)' }}>
            <div className="flex items-center justify-between px-3 py-2 border-b" style={{ borderColor: 'var(--modal-border)' }}>
              <span className="text-[9px] font-bold uppercase tracking-wider text-slate-400">Conflicts</span>
              {unresolved.length > 0 ? (
                <span className="text-[9px] font-semibold px-2 py-0.5 rounded-full bg-amber-50 text-amber-600">
                  {unresolved.length} unresolved
                </span>
              ) : (
                <span className="text-[9px] font-semibold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-600">
                  All resolved ✓
                </span>
              )}
            </div>
            {conflicts.map((c, i) => (
              <ConflictListItem
                key={c.conflictId}
                conflict={c}
                resolution={resolutions[c.conflictId]}
                isActive={i === activeIndex}
                onClick={() => setActiveIndex(i)}
              />
            ))}
          </div>

          {/* Right detail panel */}
          <div className="flex-1 flex flex-col overflow-y-auto p-5 gap-4">
            {/* 409 banner */}
            {hasConflictChanged && (
              <div className="flex items-center justify-between rounded-md border border-amber-300 bg-amber-50 px-3 py-2">
                <span className="text-xs text-amber-800">⚠ Conflicts changed — review again</span>
                <button
                  type="button"
                  onClick={onDismissConflictBanner}
                  className="text-amber-600 hover:opacity-60 text-xs ml-3"
                >
                  ✕
                </button>
              </div>
            )}

            {/* Detail header */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span
                  className="w-2.5 h-2.5 rounded-full"
                  style={{ backgroundColor: trackColor(activeConflict.track) }}
                />
                <span className="text-sm font-semibold" style={{ color: 'var(--modal-text)' }}>
                  Track {activeConflict.track} · {formatTime(activeConflict.time)}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  disabled={activeIndex === 0}
                  onClick={() => setActiveIndex(i => Math.max(0, i - 1))}
                  className="rounded-lg border px-3 py-1.5 text-xs disabled:opacity-30 hover:bg-slate-50"
                  style={{ borderColor: 'var(--modal-border)', color: 'var(--modal-text)' }}
                >
                  ← Prev
                </button>
                <span className="text-xs" style={{ color: 'var(--modal-muted)' }}>
                  {activeIndex + 1} of {conflicts.length}
                </span>
                <button
                  type="button"
                  disabled={activeIndex === conflicts.length - 1}
                  onClick={() => setActiveIndex(i => Math.min(conflicts.length - 1, i + 1))}
                  className="rounded-lg border px-3 py-1.5 text-xs disabled:opacity-30 hover:bg-slate-50"
                  style={{ borderColor: 'var(--modal-border)', color: 'var(--modal-text)' }}
                >
                  Next →
                </button>
              </div>
            </div>

            {/* Diff cards */}
            <ConflictDiffCards
              conflict={activeConflict}
              resolution={resolutions[activeConflict.conflictId]}
            />

            {/* Context strip */}
            <ConflictContextStrip conflict={activeConflict} preview={preview} />

            {/* Action buttons */}
            <div className="flex gap-3 mt-auto">
              <button
                type="button"
                onClick={() => resolveAndAdvance(activeConflict.conflictId, 'KEEP_EXISTING')}
                className={`flex-1 rounded-xl border py-3 text-sm font-semibold transition-colors ${
                  resolutions[activeConflict.conflictId] === 'KEEP_EXISTING'
                    ? 'bg-[#EEF0FF] text-[#6C63FF] border-[#6C63FF]'
                    : 'bg-white text-slate-500 border-slate-200 hover:bg-[#F5F3FF] hover:border-slate-300'
                }`}
              >
                {resolutions[activeConflict.conflictId] === 'KEEP_EXISTING' ? '✓ ' : ''}Keep Existing
              </button>
              <button
                type="button"
                onClick={() => resolveAndAdvance(activeConflict.conflictId, 'REPLACE_WITH_PATTERN')}
                className={`flex-1 rounded-xl border py-3 text-sm font-semibold transition-colors ${
                  resolutions[activeConflict.conflictId] === 'REPLACE_WITH_PATTERN'
                    ? 'bg-red-50 text-red-500 border-red-500'
                    : 'bg-white text-slate-500 border-slate-200 hover:bg-red-50 hover:border-red-200'
                }`}
              >
                {resolutions[activeConflict.conflictId] === 'REPLACE_WITH_PATTERN' ? '✕ ' : ''}Replace With Pattern
              </button>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div
          className="flex-shrink-0 flex items-center justify-between px-6 py-3 border-t"
          style={{ borderColor: 'var(--modal-border)' }}
        >
          <div className="text-xs" style={{ color: 'var(--modal-muted)' }}>
            {unresolved.length > 0 && (
              <span className="font-semibold text-amber-600">{unresolved.length} unresolved · </span>
            )}
            Create <strong>{createCount}</strong> · Replace <strong>{replaceCount}</strong> · Skip <strong>{skipCount}</strong>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onCancel}
              className="rounded-xl border px-4 py-2 text-sm"
              style={{ borderColor: 'var(--modal-border)', color: 'var(--modal-text)' }}
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={onApply}
              disabled={applyDisabled}
              className={`rounded-xl px-4 py-2 text-sm font-semibold transition-colors ${
                applyDisabled
                  ? 'opacity-40 cursor-not-allowed bg-[#6C63FF] text-white'
                  : 'bg-[#6C63FF] text-white hover:bg-[#5a52e0]'
              }`}
            >
              {allResolved ? `Paste ${createCount} notes →` : 'Resolve all to apply'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Check TypeScript compiles**

```bash
cd apps/web && npx tsc --noEmit 2>&1 | grep ConflictReviewModal
```

Expected: no output.

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/features/editor/components/ConflictReviewModal.tsx
git commit -m "feat(editor): add ConflictReviewModal with keyboard nav and auto-advance"
```

---

## Task 6: Wire into PatternPanel

**Files:**
- Modify: `apps/web/src/features/editor/components/PatternPanel.tsx`

This task does four things:
1. Add `conflictChanged` state + `mergeResolutions` helper
2. Update `handleValidate` to start with empty resolutions (not all `KEEP_EXISTING`)
3. Update `handleApply` 409 handler to use `mergeResolutions` and set `conflictChanged`
4. Replace the REVIEW inline JSX + `CONFIRM_REPLACE_ALL` step with `<ConflictReviewModal>`

- [ ] **Step 1: Add the import at the top of PatternPanel.tsx**

Find the existing imports block and add:

```typescript
import { ConflictReviewModal } from './ConflictReviewModal'
import type { PatternPasteConflict } from '@ama-midi/shared'
```

- [ ] **Step 2: Update the PasteStep type — remove CONFIRM_REPLACE_ALL**

Find:
```typescript
type PasteStep = 'INPUT' | 'VALIDATING' | 'REVIEW' | 'CONFIRM_REPLACE_ALL' | 'APPLYING'
```

Replace with:
```typescript
type PasteStep = 'INPUT' | 'VALIDATING' | 'REVIEW' | 'APPLYING'
```

- [ ] **Step 3: Add conflictChanged state**

After the existing `const [resolutions, setResolutions] = useState...` line, add:

```typescript
const [conflictChanged, setConflictChanged] = useState(false)
```

- [ ] **Step 4: Add mergeResolutions helper**

Add this function inside `PatternPanel`, above `handleValidate`:

```typescript
function mergeResolutions(
  oldResolutions: Record<string, ConflictAction>,
  newConflicts: PatternPasteConflict[],
): Record<string, ConflictAction> {
  const result: Record<string, ConflictAction> = {}
  for (const c of newConflicts) {
    if (oldResolutions[c.conflictId] === 'REPLACE_WITH_PATTERN') {
      result[c.conflictId] = 'REPLACE_WITH_PATTERN'
    }
    // All other conflicts start unresolved (undefined)
  }
  return result
}
```

- [ ] **Step 5: Update handleValidate to start with empty resolutions**

Find inside `handleValidate`:
```typescript
onSuccess: (next) => {
  setPreview(next)
  setResolutions(Object.fromEntries(
    next.conflicts.map((conflict) => [conflict.conflictId, 'KEEP_EXISTING']),
  ))
  setStep('REVIEW')
},
```

Replace with:
```typescript
onSuccess: (next) => {
  setPreview(next)
  setResolutions({})
  setConflictChanged(false)
  setStep('REVIEW')
},
```

- [ ] **Step 6: Update handleApply 409 handler to use mergeResolutions**

Find inside `handleApply`'s `onError`:
```typescript
if (err?.status === 409 && nextPreview) {
  setPreview(nextPreview)
  setResolutions(Object.fromEntries(
    nextPreview.conflicts.map((conflict) => [conflict.conflictId, 'KEEP_EXISTING']),
  ))
  toast.warning('Paste changed while you were reviewing. Review the updated conflicts.')
  return
}
```

Replace with:
```typescript
if (err?.status === 409 && nextPreview) {
  setPreview(nextPreview)
  setResolutions(mergeResolutions(resolutions, nextPreview.conflicts))
  setConflictChanged(true)
  toast.warning('Paste changed while you were reviewing. Review the updated conflicts.')
  return
}
```

- [ ] **Step 7: Add handleResolve function**

Add this function inside `PatternPanel`, below `handleApply`:

```typescript
function handleResolve(conflictId: string, action: ConflictAction) {
  setResolutions(prev => ({ ...prev, [conflictId]: action }))
}
```

- [ ] **Step 8: Replace the REVIEW inline JSX and CONFIRM_REPLACE_ALL block**

The `pasteTarget &&` block currently renders a `<Modal.Root>` containing INPUT, VALIDATING, REVIEW, and CONFIRM_REPLACE_ALL steps. You will:

a) Keep the `<Modal.Root>` block exactly as is for INPUT and VALIDATING steps.

b) Remove the entire `step === 'REVIEW' && preview && (...)` block from inside `<Modal.Body>`.

c) Remove the `step === 'CONFIRM_REPLACE_ALL' && preview && (...)` block from inside `<Modal.Body>`.

d) Remove the `step === 'CONFIRM_REPLACE_ALL'` button group from `<Modal.Footer>`.

e) Remove the `step === 'REVIEW' && preview && (...)` paste button from `<Modal.Footer>`.

f) Remove `handleReplaceAllConfirm` function — it's no longer needed.

g) Remove the `affectedCreators` derived value — no longer needed.

h) Add `<ConflictReviewModal>` rendered when `step === 'REVIEW' && preview && pasteTarget`:

```tsx
{step === 'REVIEW' && preview && pasteTarget && (
  <ConflictReviewModal
    preview={preview}
    resolutions={resolutions}
    onResolve={handleResolve}
    onApply={handleApply}
    onCancel={resetPasteState}
    patternName={pasteTarget.name}
    hasConflictChanged={conflictChanged}
    onDismissConflictBanner={() => setConflictChanged(false)}
  />
)}
```

Place this just before the closing `</>` of the `pasteTarget && (...)` block, outside the `<Modal.Root>`.

- [ ] **Step 9: Check TypeScript compiles cleanly**

```bash
cd apps/web && npx tsc --noEmit 2>&1 | head -20
```

Expected: no errors. If there are errors about `CONFIRM_REPLACE_ALL` still referenced somewhere, remove those references too.

- [ ] **Step 10: Run the full test suite**

```bash
cd apps/web && node --experimental-strip-types --test tests/*.test.ts 2>&1 | tail -20
```

Expected: all existing tests pass, plus the two new conflict-formatter tests.

- [ ] **Step 11: Commit**

```bash
git add apps/web/src/features/editor/components/PatternPanel.tsx
git commit -m "feat(editor): wire ConflictReviewModal into PatternPanel, fix 409 resolution merge"
```

---

## Task 7: Manual verification

- [ ] **Step 1: Start the dev server**

```bash
pnpm dev
```

Open `http://localhost:3000`.

- [ ] **Step 2: Trigger the conflict resolver**

1. Open a song in the editor that has notes
2. Select 2+ notes that overlap with existing notes on the same track/time
3. Save as a pattern (Toolbar → Save selection as pattern)
4. In the Pattern Panel, click Paste on that pattern
5. Set the paste time to overlap with existing notes
6. Click Validate — the conflict resolver should open

- [ ] **Step 3: Verify acceptance criteria**

| Check | Expected |
|---|---|
| Modal size | ~80% viewport width, 560px tall, rounded corners |
| Header | Pattern name, stat chips (green/red/amber) |
| Left panel | All conflicts listed; amber dot on unresolved |
| Active item | Purple left border + blue-tinted background |
| Diff cards | Both neutral (grey) until resolved |
| Click Keep Existing | Existing card turns red-tinted, pattern card dims; auto-advances to next unresolved |
| Click Replace With Pattern | Pattern card turns purple-tinted, existing dims + strikethrough; auto-advances |
| K key | Same as clicking Keep Existing |
| R key | Same as clicking Replace With Pattern |
| ← → keys | Navigate between conflicts without resolving |
| Prev/Next buttons | Navigate between conflicts without resolving |
| Footer counts | Create/Replace/Skip update in real time as you resolve |
| Apply button | Disabled ("Resolve all to apply") until all resolved |
| Apply button | Enabled once all resolved — label shows "Paste N notes →" |
| Escape | Closes modal, resets state |
| Enter (all resolved) | Applies paste |
| Context strip | Shows dots for nearby notes on same track |

---

## Self-Review Notes

- **Float precision:** All time values in all components go through `formatTime()` or `formatOffset()`. Raw floats are never rendered as strings.
- **`resolveAndAdvance` snapshot timing:** The `findIndex` runs against the pre-update `resolutions` snapshot. This is correct: the current conflict's slot is still `undefined` in the snapshot, but we start searching at `i > activeIndex` so we skip it.
- **`CONFIRM_REPLACE_ALL` removal:** The new per-conflict modal makes bulk-replace redundant. It is fully removed.
- **`resolutions` init change:** `handleValidate` now starts with `{}` (all unresolved) instead of seeding all as `KEEP_EXISTING`. This forces the user to resolve each conflict explicitly, which is required for the apply button gate.
- **409 merge logic:** Only `REPLACE_WITH_PATTERN` resolutions are preserved — `KEEP_EXISTING` resolutions are dropped because new/changed conflicts should default to unresolved, not silently keep.
- **`patternName` prop:** `PatternPastePreview` has no `patternName` field. The name comes from `pasteTarget.name` (a `NotePattern`) and is passed as a prop.
