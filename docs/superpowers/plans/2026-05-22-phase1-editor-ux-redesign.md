# Phase 1 — Editor UX Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix broken editor UX — vertical scroll, toolbar centralization, track panel cleanup, playhead-reactive panel, dark/light toggle, AI button prominence, Google avatar sync.

**Architecture:** Pure frontend changes + 1 minor API extension. No DB migrations. All changes isolated to `apps/web` and `apps/api/src/modules/songs`. New `Toolbar` and `LiveContextStrip` components extracted from `EditorPage`.

**Tech Stack:** React 18, Zustand, TanStack Query, requestAnimationFrame for playback loop.

**Spec:** `docs/superpowers/specs/2026-05-22-phase1-editor-ux-redesign.md`

---

## File Map

| Action | File | Purpose |
|---|---|---|
| Modify | `apps/web/src/store/editor.store.ts` | Add `isPlaying`, `setPlaying` |
| Create | `apps/web/src/features/editor/hooks/usePlayback.ts` | rAF playback loop |
| Create | `apps/web/src/features/editor/components/Toolbar.tsx` | 3-zone toolbar |
| Create | `apps/web/src/features/editor/components/LiveContextStrip.tsx` | Playhead-reactive panel header |
| Modify | `apps/web/src/features/editor/components/TrackHeader.tsx` | Remove LAYER_COLORS, add density bar |
| Modify | `apps/web/src/features/editor/components/PianoRoll.tsx` | Fix scroll, add TimeAxis, remove ghost suggest button |
| Modify | `apps/web/src/pages/EditorPage.tsx` | Compose via Toolbar + new panel layout |
| Modify | `apps/api/src/modules/songs/songs.service.ts` | Include avatarUrl in creator select |
| Modify | `packages/shared/src/types.ts` | Add `creatorAvatarUrl` to Song |
| Modify | `apps/web/src/App.tsx` | Initialize ThemeStore on mount |

---

## Task 1: Fix Vertical Scroll (1-line fix)

**Files:**
- Modify: `apps/web/src/pages/EditorPage.tsx`

- [ ] **Step 1: Find the piano roll wrapper div**

In `EditorPage.tsx`, find the div wrapping `<PianoRoll>`:
```tsx
{/* PianoRoll */}
<div className="flex-1 overflow-hidden">
  <PianoRoll ...
```

- [ ] **Step 2: Add `min-h-0`**

```tsx
<div className="flex-1 overflow-hidden min-h-0">
  <PianoRoll ...
```

`min-h-0` forces the flex child to respect parent bounds so `overflow-y: auto` inside PianoRoll activates.

- [ ] **Step 3: Verify**

Run `pnpm dev`. Open any song. Confirm the piano roll scrolls vertically all the way to 300s.

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/pages/EditorPage.tsx
git commit -m "fix: piano roll vertical scroll (add min-h-0 to flex wrapper)"
```

---

## Task 2: Extend Editor Store

**Files:**
- Modify: `apps/web/src/store/editor.store.ts`

- [ ] **Step 1: Read current store**

The current store has: `viewMode`, `zoom`, `pxPerSecond`, `editorMode`, `selectedNoteId`, `rightPanelTab`, `leftCollapsed`, `rightCollapsed`, `playheadTime`.

- [ ] **Step 2: Add `isPlaying` field**

```typescript
// In EditorStore interface — add:
isPlaying: boolean
setPlaying: (playing: boolean) => void

// In create() defaults — add:
isPlaying: false,
setPlaying: (isPlaying) => set({ isPlaying }),
```

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/store/editor.store.ts
git commit -m "feat: add isPlaying to editor store"
```

---

## Task 3: Build Playback Hook

**Files:**
- Create: `apps/web/src/features/editor/hooks/usePlayback.ts`

- [ ] **Step 1: Create the file**

```typescript
import { useEffect, useRef } from 'react'
import { useEditorStore } from '../../../store/editor.store'
import { TIME_MAX } from '@ama-midi/shared'

export function usePlayback() {
  const { isPlaying, playheadTime, setPlayheadTime, setPlaying } = useEditorStore()
  const rafRef       = useRef<number | null>(null)
  const lastTimeRef  = useRef<number | null>(null)

  useEffect(() => {
    if (!isPlaying) {
      if (rafRef.current !== null) {
        cancelAnimationFrame(rafRef.current)
        rafRef.current = null
        lastTimeRef.current = null
      }
      return
    }

    function tick(timestamp: number) {
      if (lastTimeRef.current === null) {
        lastTimeRef.current = timestamp
      }
      const delta = (timestamp - lastTimeRef.current) / 1000
      lastTimeRef.current = timestamp

      const next = useEditorStore.getState().playheadTime + delta
      if (next >= TIME_MAX) {
        setPlayheadTime(TIME_MAX)
        setPlaying(false)
        return
      }
      setPlayheadTime(Math.round(next * 10) / 10)
      rafRef.current = requestAnimationFrame(tick)
    }

    rafRef.current = requestAnimationFrame(tick)

    return () => {
      if (rafRef.current !== null) {
        cancelAnimationFrame(rafRef.current)
        rafRef.current = null
        lastTimeRef.current = null
      }
    }
  }, [isPlaying, setPlayheadTime, setPlaying])
}
```

- [ ] **Step 2: Write unit test**

Create `apps/web/src/features/editor/hooks/__tests__/usePlayback.test.ts`:

```typescript
import { renderHook, act } from '@testing-library/react'
import { useEditorStore } from '../../../../store/editor.store'
import { usePlayback } from '../usePlayback'

beforeEach(() => {
  useEditorStore.setState({ isPlaying: false, playheadTime: 0 })
  jest.useFakeTimers()
})

afterEach(() => {
  jest.useRealTimers()
})

it('does not advance playhead when not playing', () => {
  renderHook(() => usePlayback())
  jest.advanceTimersByTime(1000)
  expect(useEditorStore.getState().playheadTime).toBe(0)
})

it('stops at TIME_MAX (300)', () => {
  useEditorStore.setState({ playheadTime: 299.9 })
  useEditorStore.getState().setPlaying(true)
  renderHook(() => usePlayback())
  act(() => { jest.advanceTimersByTime(200) })
  expect(useEditorStore.getState().isPlaying).toBe(false)
  expect(useEditorStore.getState().playheadTime).toBe(300)
})
```

- [ ] **Step 3: Run test**

```bash
cd apps/web && pnpm test --testPathPattern=usePlayback
```

Expected: tests pass.

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/features/editor/hooks/
git commit -m "feat: usePlayback hook with rAF loop"
```

---

## Task 4: Build Toolbar Component

**Files:**
- Create: `apps/web/src/features/editor/components/Toolbar.tsx`

- [ ] **Step 1: Create file**

```typescript
import { useEditorStore } from '../../../store/editor.store'
import { useThemeStore }  from '../../../store/theme.store'
import { Button, IconButton, ToggleGroup } from '../../../components/ui'
import { AvatarStack } from '../../../components/ui'
import { useCanEdit }  from '../../../hooks/useCanEdit'
import { useNotes }    from '../../notes/useNotes'
import { formatTime }  from '../../../lib/utils'

const VIEW_MODES = [
  { value: 'composer',  label: 'Composer' },
  { value: 'developer', label: 'Dev' },
  { value: 'qa',        label: 'QA' },
]

const ZOOM_MODES = [
  { value: '1', label: '1x' },
  { value: '2', label: '2x' },
  { value: '4', label: '4x' },
]

interface ToolbarProps {
  songId:        string
  songName:      string
  presenceList:  { id: string; name: string; avatarUrl?: string }[]
  onSuggest:     () => void
  onUndo:        () => void
  onShowShortcuts: () => void
  onBack:        () => void
}

export function Toolbar({
  songId, songName, presenceList,
  onSuggest, onUndo, onShowShortcuts, onBack,
}: ToolbarProps) {
  const {
    viewMode, setViewMode,
    zoom, setZoom,
    isPlaying, setPlaying,
    playheadTime, setPlayheadTime,
  } = useEditorStore()

  const { resolved: theme, setMode: setTheme } = useThemeStore()
  const canEdit = useCanEdit()
  const { data: notes = [] } = useNotes(songId)

  return (
    <div className="flex items-center w-full gap-3 h-12 px-4">

      {/* LEFT */}
      <div className="flex items-center gap-3 min-w-0">
        <button
          onClick={onBack}
          className="text-shell-muted hover:text-shell-text text-sm transition-colors shrink-0"
        >
          ← Songs
        </button>
        <span className="text-shell-text font-medium text-sm truncate max-w-[160px]">
          {songName}
        </span>
      </div>

      {/* CENTER */}
      <div className="flex items-center gap-3 flex-1 justify-center">
        {/* Playback */}
        <div className="flex items-center gap-1">
          <IconButton
            size="sm"
            onClick={() => { setPlayheadTime(0); setPlaying(false) }}
            tooltip="Jump to start"
          >⏮</IconButton>

          <IconButton
            size="sm"
            onClick={() => setPlaying(!isPlaying)}
            tooltip={isPlaying ? 'Pause' : 'Play'}
            className="text-primary"
          >
            {isPlaying ? '⏸' : '▶'}
          </IconButton>

          <IconButton
            size="sm"
            onClick={() => { setPlayheadTime(300); setPlaying(false) }}
            tooltip="Jump to end"
          >⏭</IconButton>
        </div>

        {/* Time display */}
        <span className="text-xs font-mono text-shell-muted w-16 tabular-nums">
          {formatTime(playheadTime)}
        </span>

        {/* Zoom */}
        <ToggleGroup
          items={ZOOM_MODES}
          value={String(zoom)}
          onValueChange={(v) => setZoom(Number(v) as 1 | 2 | 4)}
          variant="canvas"
        />

        {/* View mode */}
        <ToggleGroup
          items={VIEW_MODES}
          value={viewMode}
          onValueChange={(v) => setViewMode(v as typeof viewMode)}
          variant="canvas"
        />
      </div>

      {/* RIGHT */}
      <div className="flex items-center gap-2 shrink-0">
        {canEdit && (
          <Button
            variant="primary"
            size="sm"
            rounded
            disabled={notes.length < 5}
            onClick={onSuggest}
          >
            ✨ Suggest
          </Button>
        )}

        <AvatarStack users={presenceList} max={4} size="xs" />

        <IconButton
          size="sm"
          tooltip={theme === 'dark' ? 'Light mode' : 'Dark mode'}
          onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
        >
          {theme === 'dark' ? '☀' : '🌙'}
        </IconButton>

        <IconButton size="sm" tooltip="Keyboard shortcuts" onClick={onShowShortcuts}>
          ?
        </IconButton>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/web/src/features/editor/components/Toolbar.tsx
git commit -m "feat: Toolbar component — 3-zone layout with playback, zoom, view mode, suggest"
```

---

## Task 5: Simplify Track Panel

**Files:**
- Modify: `apps/web/src/features/editor/components/TrackHeader.tsx`
- Modify: `apps/web/src/pages/EditorPage.tsx` (left panel section)

- [ ] **Step 1: Rewrite TrackHeader**

```typescript
import { cn } from '../../../lib/utils'

export interface TrackHeaderProps {
  track:        number
  isMuted:      boolean
  noteCount:    number
  maxCount:     number
  onToggleMute: () => void
}

export function TrackHeader({ track, isMuted, noteCount, maxCount, onToggleMute }: TrackHeaderProps) {
  const density = maxCount > 0 ? noteCount / maxCount : 0

  return (
    <div
      className={cn(
        'flex items-center gap-2 px-3 py-1.5 cursor-pointer transition-opacity hover:bg-editor-border/30 select-none',
        isMuted && 'opacity-30',
      )}
      onClick={onToggleMute}
      title={isMuted ? `Track ${track} (muted — click to unmute)` : `Track ${track} — click to mute`}
    >
      <span className="text-xs text-editor-text w-4 shrink-0">T{track}</span>

      {/* Density bar */}
      <div className="flex-1 h-1.5 rounded-full bg-editor-border overflow-hidden">
        <div
          className="h-full rounded-full bg-primary/60 transition-all"
          style={{ width: `${density * 100}%` }}
        />
      </div>

      <span className="text-[9px] text-editor-muted w-3 text-right shrink-0">
        {isMuted ? 'M' : ''}
      </span>
    </div>
  )
}
```

- [ ] **Step 2: Update left panel in EditorPage**

Find the left panel track list section. Replace track map with:

```tsx
{Array.from({ length: 8 }, (_, i) => i + 1).map((track) => {
  const noteCount = (notes ?? []).filter(n => n.track === track).length
  const maxCount  = Math.max(1, ...Array.from({ length: 8 }, (_, i) =>
    (notes ?? []).filter(n => n.track === i + 1).length
  ))
  return (
    <TrackHeader
      key={track}
      track={track}
      isMuted={mutedTracks.has(track)}
      noteCount={noteCount}
      maxCount={maxCount}
      onToggleMute={() => toggleMute(track, false)}
    />
  )
})}
```

Note: `notes` comes from `useNotes(songId)` — add this query to EditorPage if not already present.

- [ ] **Step 3: Remove LAYER_COLORS import**

Search for `LAYER_COLORS` in TrackHeader and EditorPage. Remove all references.

```bash
grep -r "LAYER_COLORS" apps/web/src/
```

Expected: 0 results after cleanup.

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/features/editor/components/TrackHeader.tsx apps/web/src/pages/EditorPage.tsx
git commit -m "feat: simplify track panel — remove LAYER_COLORS, add density bars"
```

---

## Task 6: Live Context Strip

**Files:**
- Create: `apps/web/src/features/editor/components/LiveContextStrip.tsx`

- [ ] **Step 1: Create file**

```typescript
import { useMemo } from 'react'
import { formatTime } from '../../../lib/utils'
import type { Note } from '@ama-midi/shared'

interface Props {
  playheadTime: number
  notes:        Note[]
}

function computeNps(notes: Note[], time: number, windowSeconds = 2): number {
  const half  = windowSeconds / 2
  const count = notes.filter(n => n.time >= time - half && n.time <= time + half).length
  return Math.round((count / windowSeconds) * 10) / 10
}

function npsColor(nps: number): string {
  if (nps < 3) return '#10B981'
  if (nps < 6) return '#F59E0B'
  return '#EF4444'
}

export function LiveContextStrip({ playheadTime, notes }: Props) {
  const nearNotes = useMemo(
    () => notes
      .filter(n => Math.abs(n.time - playheadTime) <= 1)
      .sort((a, b) => Math.abs(a.time - playheadTime) - Math.abs(b.time - playheadTime))
      .slice(0, 5),
    [notes, playheadTime],
  )

  const nps   = useMemo(() => computeNps(notes, playheadTime), [notes, playheadTime])
  const color = npsColor(nps)

  return (
    <div className="shrink-0 px-3 py-2 border-b border-shell-border bg-shell-surface/50">
      {/* Time */}
      <div className="flex items-center justify-between mb-1">
        <span className="text-xs font-mono text-shell-text">⏱ {formatTime(playheadTime)}</span>
        <span className="text-[10px] font-mono" style={{ color }}>
          {nps} NPS
        </span>
      </div>

      {/* NPS bar */}
      <div className="w-full h-1 rounded-full bg-shell-border mb-2">
        <div
          className="h-full rounded-full transition-all"
          style={{ width: `${Math.min(100, (nps / 10) * 100)}%`, backgroundColor: color }}
        />
      </div>

      {/* Near notes */}
      {nearNotes.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {nearNotes.map((n) => (
            <span
              key={n.id}
              className="text-[9px] px-1 rounded font-mono text-white"
              style={{ backgroundColor: n.color + 'CC' }}
            >
              T{n.track}@{n.time}s
            </span>
          ))}
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Write unit test**

Create `apps/web/src/features/editor/components/__tests__/LiveContextStrip.test.ts`:

```typescript
import { computeNps } from '../LiveContextStrip'  // export the function for testing

// Or test inline:
function computeNps(notes: any[], time: number, window = 2): number {
  const half  = window / 2
  const count = notes.filter(n => n.time >= time - half && n.time <= time + half).length
  return Math.round((count / window) * 10) / 10
}

it('returns 0 NPS when no notes near cursor', () => {
  const notes = [{ time: 100 }, { time: 200 }]
  expect(computeNps(notes, 0)).toBe(0)
})

it('computes NPS correctly within window', () => {
  const notes = [{ time: 4.0 }, { time: 4.5 }, { time: 5.0 }, { time: 5.5 }]
  expect(computeNps(notes, 5, 2)).toBe(2) // 4 notes in 2s = 2 NPS
})
```

Run: `cd apps/web && pnpm test --testPathPattern=LiveContextStrip`

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/features/editor/components/LiveContextStrip.tsx
git commit -m "feat: LiveContextStrip — playhead-reactive time, NPS, near-notes"
```

---

## Task 7: History Panel Full Height

**Files:**
- Modify: `apps/web/src/pages/EditorPage.tsx`

- [ ] **Step 1: Find the right panel tab structure**

Current structure has history rendered as a bottom fragment. Find the right panel section in EditorPage. It likely looks like:

```tsx
<div className="w-64 border-l ...">
  <div className="flex border-b ...">  {/* tabs */}
  {rightTab === 'details' && <div>...</div>}
  {rightTab === 'validation' && <ValidationPanel />}
  {rightTab === 'history' && (
    <div className="...h-1/3...">  {/* THIS IS THE BUG */}
      <HistoryPanel />
    </div>
  )}
</div>
```

- [ ] **Step 2: Add LiveContextStrip and fix height**

Restructure the right panel:

```tsx
<div className="w-64 border-l border-shell-border bg-shell-surface flex flex-col shrink-0">

  {/* Live context — always visible */}
  <LiveContextStrip playheadTime={playheadTime} notes={notes ?? []} />

  {/* Tabs */}
  <div className="flex border-b border-shell-border shrink-0">
    {(['tracks', 'validation', 'history'] as const).map((tab) => (
      <button
        key={tab}
        onClick={() => setRightTab(tab)}
        className={`flex-1 py-2 text-xs capitalize transition-colors ${
          rightTab === tab
            ? 'text-shell-text border-b-2 border-primary'
            : 'text-shell-muted hover:text-shell-text'
        }`}
      >
        {tab}
      </button>
    ))}
  </div>

  {/* Tab content — full remaining height */}
  <div className="flex-1 overflow-hidden flex flex-col min-h-0">
    {rightTab === 'tracks' && <TrackListPanel songId={songId!} mutedTracks={mutedTracks} onToggle={toggleMute} />}
    {rightTab === 'validation' && <ValidationPanel songId={songId!} />}
    {rightTab === 'history' && <HistoryPanel songId={songId!} />}
  </div>
</div>
```

Note: `RightTab` type changes from `'details' | 'validation' | 'history'` to `'tracks' | 'validation' | 'history'`.

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/pages/EditorPage.tsx
git commit -m "feat: right panel — LiveContextStrip always visible, History full height"
```

---

## Task 8: Dark/Light Mode Toggle

**Files:**
- Modify: `apps/web/src/App.tsx`
- Toolbar already has the toggle button (Task 4)

- [ ] **Step 1: Initialize ThemeStore in App.tsx**

```tsx
import { useThemeStore } from './store/theme.store'

export default function App() {
  // Initialize theme on mount (triggers applyTheme from persisted state)
  useThemeStore.getState()

  return (
    <QueryClientProvider client={queryClient}>
      {/* ...existing... */}
    </QueryClientProvider>
  )
}
```

- [ ] **Step 2: Verify**

Run `pnpm dev`. Click the sun/moon button in toolbar. Confirm `<html>` gets/loses `.dark` class. Shell panels flip light/dark.

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/App.tsx
git commit -m "feat: initialize ThemeStore on app mount for dark/light toggle"
```

---

## Task 9: Google Avatar Sync in API

**Files:**
- Modify: `packages/shared/src/types.ts`
- Modify: `apps/api/src/modules/songs/songs.service.ts`

- [ ] **Step 1: Add creatorAvatarUrl to Song type**

In `packages/shared/src/types.ts`:

```typescript
export interface Song {
  id:              string
  name:            string
  createdBy:       string
  creatorName:     string
  creatorAvatarUrl?: string   // ADD THIS
  noteCount:       number
  createdAt:       string
  updatedAt:       string
}
```

- [ ] **Step 2: Extend SongsService creator select**

In `apps/api/src/modules/songs/songs.service.ts`, find all `creator: { select: { name: true } }` and extend:

```typescript
creator: { select: { name: true, avatarUrl: true } },
```

Then in each map function, add to returned object:

```typescript
creatorAvatarUrl: s.creator.avatarUrl ?? undefined,
```

- [ ] **Step 3: Update SongCard to use avatarUrl**

In `apps/web/src/features/songs/SongCard.tsx`, import `Avatar` and add to bottom:

```tsx
import { Avatar } from '../../components/ui'

// In SongCard, inside the card — replace plain text creator name:
<div className="flex items-center gap-1.5 mt-3">
  <Avatar name={song.creatorName} src={song.creatorAvatarUrl} size="xs" />
  <span className="text-xs text-shell-muted truncate">{song.creatorName}</span>
  <span className="text-xs text-shell-muted ml-auto">{timeAgo(song.updatedAt)}</span>
</div>
```

- [ ] **Step 4: Commit**

```bash
git add packages/shared/src/types.ts apps/api/src/modules/songs/songs.service.ts apps/web/src/features/songs/SongCard.tsx
git commit -m "feat: sync creator avatarUrl in song list API + SongCard"
```

---

## Task 10: Wire EditorPage with Toolbar + Playback

**Files:**
- Modify: `apps/web/src/pages/EditorPage.tsx`
- Modify: `apps/web/src/features/editor/components/AiSuggestions.tsx`

- [ ] **Step 1: Remove inline suggest button from AiSuggestions**

In `AiSuggestions.tsx`, find and remove the internal suggest trigger button if it has one. The suggest action now comes from `Toolbar` via `onSuggest` prop.

- [ ] **Step 2: Add usePlayback to EditorPage**

```tsx
import { usePlayback }   from '../features/editor/hooks/usePlayback'
import { Toolbar }       from '../features/editor/components/Toolbar'
import { LiveContextStrip } from '../features/editor/components/LiveContextStrip'

export function EditorPage() {
  // ... existing state ...
  const { playheadTime } = useEditorStore()

  // Start playback hook (handles rAF loop)
  usePlayback()

  // Remove old inline keyboard handler for zoom/undo — those stay in useKeyboardShortcuts
  // Keep undo.mutate() accessible for onUndo callback

  return (
    <EditorShell
      topBar={
        <Toolbar
          songId={songId!}
          songName={song?.name ?? '...'}
          presenceList={presenceList}
          onSuggest={() => { /* trigger AI suggestions */ }}
          onUndo={() => undo.mutate()}
          onShowShortcuts={() => setShowShortcuts(true)}
          onBack={() => navigate('/')}
        />
      }
      leftPanel={/* track list with TrackHeader components */}
      rightPanel={/* LiveContextStrip + tabs */}
      bottomBar={/* time + zoom + validation badge */}
      leftCollapsed={leftCollapsed}
      rightCollapsed={rightCollapsed}
      onLeftToggle={toggleLeftPanel}
      onRightToggle={toggleRightPanel}
    >
      <PianoRoll
        songId={songId!}
        canEdit={canEdit}
        mutedTracks={mutedTracks}
        onNoteSelected={setSelectedNote}
      />
    </EditorShell>
  )
}
```

- [ ] **Step 3: Remove duplicate zoom/view-mode controls**

Remove any bottom-bar zoom buttons and the inline view mode switcher that existed before the Toolbar.

- [ ] **Step 4: Move AI suggest trigger to PianoRoll ref**

In PianoRoll, expose a `triggerSuggest()` via `useImperativeHandle` or a Zustand action. Toolbar's `onSuggest` calls it.

Simplest approach — add `triggerAiSuggest: (() => void) | null` to EditorStore:

```typescript
// editor.store.ts — add:
triggerAiSuggest: (() => void) | null
setTriggerAiSuggest: (fn: (() => void) | null) => void

// defaults:
triggerAiSuggest: null,
setTriggerAiSuggest: (fn) => set({ triggerAiSuggest: fn }),
```

In `AiSuggestions.tsx`, register the trigger on mount:

```typescript
const { setTriggerAiSuggest } = useEditorStore()

useEffect(() => {
  setTriggerAiSuggest(() => handleSuggest)
  return () => setTriggerAiSuggest(null)
}, [])
```

Toolbar's `onSuggest`:
```typescript
onSuggest={() => useEditorStore.getState().triggerAiSuggest?.()}
```

- [ ] **Step 5: Verify end-to-end**

- Toolbar renders with all 3 zones
- Play → playhead moves, time display updates
- Pause → stops
- ⏮ → jumps to 0
- ✨ Suggest disabled when < 5 notes, enabled otherwise
- Theme toggle works
- Track panel shows density bars, no color dots

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/pages/EditorPage.tsx apps/web/src/features/editor/components/AiSuggestions.tsx apps/web/src/store/editor.store.ts
git commit -m "feat: wire EditorPage with Toolbar, usePlayback, and new panel layout"
```

---

## Task 11: Final Cleanup + Verification

- [ ] **Step 1: Remove orphaned LAYER_COLORS usages**

```bash
grep -rn "LAYER_COLORS" apps/web/src/
```

Remove any remaining references.

- [ ] **Step 2: Verify build**

```bash
cd apps/web && pnpm build
```

Expected: zero TypeScript errors.

- [ ] **Step 3: Manual checklist**

- [ ] Piano roll scrolls vertically to 300s
- [ ] Toolbar: 3 zones visible
- [ ] Play button moves playhead, time updates
- [ ] ✨ Suggest in toolbar (right zone), not inside grid
- [ ] Track panel: T1–T8, density bars, no color dots
- [ ] Mute still works
- [ ] History tab takes full right panel height
- [ ] Live context strip shows time + NPS + near notes
- [ ] Dark/light toggle flips theme
- [ ] Song cards show creator avatar
- [ ] No console errors

- [ ] **Step 4: Final commit**

```bash
git add -A
git commit -m "chore: Phase 1 UX redesign complete — cleanup and verification"
```
