# Left Panel Shimmer Skeleton Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Show a shimmer skeleton in the editor left panel while notes are loading.

**Architecture:** Destructure `isLoading` from `useNotes`, add a `LeftPanelSkeleton` function component at the bottom of `EditorPage.tsx`, conditionally render it in the `leftPanel` variable when `isLoading` is true. No new files needed — `Skeleton` already exists in `components/ui`.

**Tech Stack:** React, TanStack Query, Tailwind CSS, existing `Skeleton` component (`animate-pulse bg-shell-border`)

---

### Task 1: Destructure `isLoading` from `useNotes`

**Files:**
- Modify: `apps/web/src/pages/EditorPage.tsx:129`

- [ ] **Step 1: Update useNotes destructure**

Find line 129:
```tsx
const { data: allNotes = [] } = useNotes(chartId)
```
Replace with:
```tsx
const { data: allNotes = [], isLoading: notesLoading } = useNotes(chartId)
```

- [ ] **Step 2: Verify TypeScript still compiles**

```bash
cd apps/web && npx tsc --noEmit 2>&1 | head -20
```
Expected: no errors

---

### Task 2: Add `LeftPanelSkeleton` component

**Files:**
- Modify: `apps/web/src/pages/EditorPage.tsx` (bottom of file, before closing)

- [ ] **Step 1: Add Skeleton to imports**

Find the existing UI import line (around line 40):
```tsx
import { Button, Tabs, ToggleGroup } from '../components/ui'
```
Replace with:
```tsx
import { Button, Skeleton, Tabs, ToggleGroup } from '../components/ui'
```

- [ ] **Step 2: Add LeftPanelSkeleton function at bottom of file**

Add after the `ToolRow` function (after line ~910):
```tsx
function LeftPanelSkeleton() {
  return (
    <>
      <div className="py-1">
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="flex items-center gap-2 px-3 py-1.5">
            <Skeleton width={8} height={8} rounded="full" />
            <Skeleton width={16} height={10} />
            <Skeleton className="flex-1" height={4} />
          </div>
        ))}
      </div>
      <div className="px-3 py-2 space-y-1.5 border-t border-shell-border">
        <Skeleton height={10} width={60} />
        <Skeleton height={24} className="w-full" />
        <Skeleton height={24} className="w-full" />
      </div>
      <div className="px-3 py-3 border-t border-shell-border space-y-2">
        <Skeleton height={10} width={80} />
        <Skeleton height={10} className="w-full" />
        <Skeleton height={10} className="w-3/4" />
      </div>
    </>
  )
}
```

- [ ] **Step 3: Verify TypeScript still compiles**

```bash
cd apps/web && npx tsc --noEmit 2>&1 | head -20
```
Expected: no errors

---

### Task 3: Conditionally render skeleton in leftPanel

**Files:**
- Modify: `apps/web/src/pages/EditorPage.tsx:405-454`

- [ ] **Step 1: Wrap left panel body with notesLoading check**

The `leftPanel` const (around line 405) starts with:
```tsx
const leftPanel = (
  <>
    <div className="px-3 py-2 border-b border-shell-border">
      <PanelSectionHeader title="Tracks" help={tracksPanelHelp} />
    </div>
    <div className="py-1" data-tour="track-list">
```

Replace the entire `leftPanel` const with:
```tsx
const leftPanel = (
  <>
    <div className="px-3 py-2 border-b border-shell-border">
      <PanelSectionHeader title="Tracks" help={tracksPanelHelp} />
    </div>
    {notesLoading ? (
      <LeftPanelSkeleton />
    ) : (
      <>
        <div className="py-1" data-tour="track-list">
          {Array.from({ length: 8 }, (_, i) => i + 1).map((track) => (
            <TrackHeader
              key={track}
              track={track}
              isMuted={mutedTracks.has(track)}
              noteCount={allNotes.filter(n => n.track === track).length}
              density={trackDensities[track] ?? 0}
              isActive={activeTrack === track}
              onToggleMute={() => toggleMute(track, false)}
            />
          ))}
        </div>
        <SectionJumpList songId={songId!} sections={sections} />
        <PatternPanel songId={songId!} chartId={chartId} />
        <div className="border-t border-shell-border">
          <div className="px-3 py-2 border-b border-shell-border">
            <span className="text-xs font-medium text-shell-text uppercase tracking-wide">Song Stats</span>
          </div>
          <BottomBarStats
            notes={allNotes}
            bpm={song?.bpm ?? 120}
            speedMultiplier={activeChart?.speedMultiplier ?? 1}
          />
        </div>
        {chartId && projectId && (
          <div className="border-t border-shell-border">
            <div className="px-3 py-2 border-b border-shell-border">
              <PanelSectionHeader title="Analysis" help={analysisPanelHelp} />
            </div>
            <AnalysisSummaryPanel
              notes={allNotes}
              bpm={song?.bpm ?? 120}
              timeSignature={song?.timeSignature ?? '4/4'}
              speedMultiplier={activeChart?.speedMultiplier ?? 1}
              chartId={chartId}
              projectId={projectId}
              songId={songId!}
              onSeek={(timeMs) => setPlayheadTime(timeMs / 1000)}
              embedded
            />
          </div>
        )}
      </>
    )}
  </>
)
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
cd apps/web && npx tsc --noEmit 2>&1 | head -20
```
Expected: no errors

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/pages/EditorPage.tsx
git commit -m "feat(editor): shimmer skeleton for left panel while notes load"
```
