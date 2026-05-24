# Session Presence Center + Transport Footer — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Center session presence in the editor toolbar with a clickable user dropdown; move transport controls to the footer center.

**Architecture:** Extract `TransportBar` from `Toolbar`; replace `PresenceBar` with `SessionPresenceMenu` (avatar stack trigger + fixed dropdown). Pure frontend — `presenceList` already includes `title`/`department` from WebSocket.

**Tech Stack:** React 18, Vite, Tailwind CSS, Zustand (`useEditorStore`), TanStack Query, `@radix-ui/react-icons`, existing `Avatar`/`Badge` UI components

**Spec:** `docs/superpowers/specs/2026-05-24-session-presence-center-design.md`

---

## File Map

| File | Action |
|------|--------|
| `apps/web/src/features/collaboration/sort-presence-users.ts` | **Create** — sort helper |
| `apps/web/tests/session-presence-sort.test.ts` | **Create** — unit tests |
| `apps/web/src/features/collaboration/SessionPresenceMenu.tsx` | **Create** — presence trigger + dropdown |
| `apps/web/src/features/collaboration/PresenceBar.tsx` | **Delete** |
| `apps/web/src/features/editor/components/TransportBar.tsx` | **Create** — play/time/BPM |
| `apps/web/src/features/editor/components/Toolbar.tsx` | **Modify** — center presence, remove transport |
| `apps/web/src/pages/EditorPage.tsx` | **Modify** — footer three-zone layout + `TransportBar` |

---

## Task 1: Sort helper for presence dropdown

**Files:**
- Create: `apps/web/src/features/collaboration/sort-presence-users.ts`
- Create: `apps/web/tests/session-presence-sort.test.ts`

- [ ] **Step 1: Write the failing test**

Create `apps/web/tests/session-presence-sort.test.ts`:

```ts
import assert from 'node:assert/strict'
import test from 'node:test'
import { sortPresenceUsers } from '../src/features/collaboration/sort-presence-users.ts'

const users = [
  { id: 'b', name: 'Bob', title: 'Composer', department: 'Audio' },
  { id: 'a', name: 'Alice', title: 'QA', department: 'QA' },
  { id: 'c', name: 'Carol', title: null, department: null },
]

test('sortPresenceUsers puts current user first', () => {
  const sorted = sortPresenceUsers(users, 'b')
  assert.equal(sorted[0].id, 'b')
})

test('sortPresenceUsers sorts others alphabetically by name', () => {
  const sorted = sortPresenceUsers(users, 'b')
  assert.deepEqual(sorted.map((u) => u.id), ['b', 'a', 'c'])
})

test('sortPresenceUsers returns empty array unchanged', () => {
  assert.deepEqual(sortPresenceUsers([], 'x'), [])
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test apps/web/tests/session-presence-sort.test.ts`  
Expected: FAIL — module `sort-presence-users.ts` not found

- [ ] **Step 3: Write minimal implementation**

Create `apps/web/src/features/collaboration/sort-presence-users.ts`:

```ts
export interface SortablePresenceUser {
  id: string
  name: string
}

export function sortPresenceUsers<T extends SortablePresenceUser>(
  users: T[],
  currentUserId: string,
): T[] {
  return [...users].sort((a, b) => {
    if (a.id === currentUserId) return -1
    if (b.id === currentUserId) return 1
    return a.name.localeCompare(b.name)
  })
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test apps/web/tests/session-presence-sort.test.ts`  
Expected: PASS (3 tests)

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/features/collaboration/sort-presence-users.ts apps/web/tests/session-presence-sort.test.ts
git commit -m "feat(web): add sortPresenceUsers helper for session dropdown"
```

---

## Task 2: SessionPresenceMenu component

**Files:**
- Create: `apps/web/src/features/collaboration/SessionPresenceMenu.tsx`
- Delete: `apps/web/src/features/collaboration/PresenceBar.tsx`

- [ ] **Step 1: Create `SessionPresenceMenu.tsx`**

```tsx
import { ChevronDownIcon } from '@radix-ui/react-icons'
import { useEffect, useRef, useState } from 'react'
import { getColorFromName } from '@ama-midi/shared'
import { Avatar, Badge } from '../../components/ui'
import { cn } from '../../lib/utils'
import type { PresenceUser } from './useSocket'
import { sortPresenceUsers } from './sort-presence-users'

interface Props {
  users: PresenceUser[]
  currentUserId: string
}

const DROPDOWN_ID = 'session-presence-dropdown'

function getInitials(name: string) {
  return name.split(' ').map((w) => w[0]).join('').toUpperCase().slice(0, 2)
}

function formatSubtitle(user: PresenceUser) {
  const parts = [user.title, user.department].filter(Boolean)
  return parts.length ? parts.join(' · ') : null
}

export function SessionPresenceMenu({ users, currentUserId }: Props) {
  const [open, setOpen] = useState(false)
  const [dropPos, setDropPos] = useState({ top: 0, left: 0 })
  const btnRef = useRef<HTMLButtonElement>(null)

  const sorted = sortPresenceUsers(users, currentUserId)
  const visible = users.slice(0, 5)
  const overflow = users.length - visible.length
  const countLabel = users.length === 1 ? '1 person in this session' : `${users.length} people in this session`

  function openDropdown() {
    const rect = btnRef.current?.getBoundingClientRect()
    if (rect) {
      setDropPos({ top: rect.bottom + 6, left: rect.left + rect.width / 2 })
    }
    setOpen(true)
  }

  useEffect(() => {
    if (!open) return

    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false)
    }
    function onPointerDown(e: MouseEvent) {
      const target = e.target as Node
      if (
        !btnRef.current?.contains(target)
        && !document.getElementById(DROPDOWN_ID)?.contains(target)
      ) {
        setOpen(false)
      }
    }

    document.addEventListener('keydown', onKeyDown)
    document.addEventListener('mousedown', onPointerDown)
    return () => {
      document.removeEventListener('keydown', onKeyDown)
      document.removeEventListener('mousedown', onPointerDown)
    }
  }, [open])

  return (
    <>
      <button
        ref={btnRef}
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open}
        title={countLabel}
        onClick={() => (open ? setOpen(false) : openDropdown())}
        className={cn(
          'group flex shrink-0 items-center gap-1 rounded-full px-1 py-0.5',
          'transition-colors hover:bg-white/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30',
          open && 'bg-white/5',
        )}
      >
        <div className="flex items-center">
          {visible.map((user, i) => (
            <div
              key={user.id}
              className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-medium text-white border-2 border-shell-surface overflow-hidden"
              style={{
                backgroundColor: getColorFromName(user.id),
                marginLeft: i > 0 ? '-8px' : '0',
                zIndex: visible.length - i,
                position: 'relative',
              }}
            >
              {user.avatarUrl ? (
                <img src={user.avatarUrl} alt="" className="w-full h-full rounded-full object-cover" />
              ) : (
                getInitials(user.name)
              )}
            </div>
          ))}
          {overflow > 0 && (
            <div
              className="w-8 h-8 rounded-full bg-shell-surface border border-shell-border flex items-center justify-center text-xs text-shell-muted"
              style={{ marginLeft: '-8px', position: 'relative', zIndex: 0 }}
            >
              +{overflow}
            </div>
          )}
        </div>
        <ChevronDownIcon
          className={cn(
            'h-3 w-3 shrink-0 text-[var(--toolbar-muted)] opacity-60 transition-transform group-hover:opacity-90',
            open && 'rotate-180 opacity-90',
          )}
          aria-hidden
        />
      </button>

      {open && (
        <div
          id={DROPDOWN_ID}
          role="listbox"
          aria-label="People in this session"
          style={{
            position: 'fixed',
            top: dropPos.top,
            left: dropPos.left,
            transform: 'translateX(-50%)',
            zIndex: 9999,
          }}
          className="w-72 overflow-hidden rounded-xl border border-shell-border bg-shell-surface shadow-lg ring-1 ring-black/5 dark:ring-white/5"
        >
          <div className="border-b border-shell-border px-3 py-2">
            <p className="text-xs font-semibold text-shell-text">In this session</p>
            <p className="text-[10px] text-shell-muted">{countLabel}</p>
          </div>
          <ul className="max-h-64 overflow-y-auto py-1">
            {sorted.map((user) => {
              const isYou = user.id === currentUserId
              const subtitle = formatSubtitle(user)
              return (
                <li
                  key={user.id}
                  role="option"
                  aria-selected={isYou}
                  className={cn(
                    'mx-1 flex items-center gap-3 rounded-lg px-2.5 py-2',
                    isYou && 'bg-primary/10 ring-1 ring-primary/20',
                  )}
                >
                  <Avatar src={user.avatarUrl} name={user.name} size="sm" />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5">
                      <span className="truncate text-xs font-medium text-shell-text">{user.name}</span>
                      {isYou && (
                        <Badge variant="info" size="sm" className="shrink-0">
                          You
                        </Badge>
                      )}
                    </div>
                    {subtitle && (
                      <p className="mt-0.5 truncate text-[10px] leading-snug text-shell-muted">{subtitle}</p>
                    )}
                  </div>
                </li>
              )
            })}
          </ul>
        </div>
      )}
    </>
  )
}
```

- [ ] **Step 2: Delete `PresenceBar.tsx`**

```bash
rm apps/web/src/features/collaboration/PresenceBar.tsx
```

- [ ] **Step 3: Verify no remaining imports of PresenceBar**

Run: `rg "PresenceBar" apps/web/src`  
Expected: no matches (Toolbar updated in Task 4)

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/features/collaboration/SessionPresenceMenu.tsx
git rm apps/web/src/features/collaboration/PresenceBar.tsx
git commit -m "feat(web): add SessionPresenceMenu with user dropdown"
```

---

## Task 3: Extract TransportBar

**Files:**
- Create: `apps/web/src/features/editor/components/TransportBar.tsx`

- [ ] **Step 1: Create `TransportBar.tsx`**

Move transport + BPM logic from `Toolbar.tsx`:

```tsx
import {
  PauseIcon,
  PlayIcon,
  TrackNextIcon,
  TrackPreviousIcon,
} from '@radix-ui/react-icons'
import { useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import type { Song } from '@ama-midi/shared'
import { useEditorStore } from '../../../store/editor.store'
import { useAuthStore } from '../../../store/auth.store'
import { formatTime } from '../../../lib/utils'
import { apiClient } from '../../auth/api'

interface TransportBarProps {
  songId: string
  bpm: number
  canEdit: boolean
}

export function TransportBar({ songId, bpm, canEdit }: TransportBarProps) {
  const { isPlaying, setPlaying, playheadTime, setPlayheadTime } = useEditorStore()
  const token = useAuthStore((s) => s.token)
  const queryClient = useQueryClient()

  const [editingBpm, setEditingBpm] = useState(false)
  const [bpmDraft, setBpmDraft] = useState(String(bpm))

  async function saveBpm() {
    setEditingBpm(false)
    const next = Math.max(40, Math.min(300, Number(bpmDraft) || 120))
    if (next === bpm) return
    await apiClient(token)<Song>(`/songs/${songId}`, {
      method: 'PATCH',
      body: JSON.stringify({ bpm: next }),
    })
    queryClient.invalidateQueries({ queryKey: ['song', songId] })
  }

  return (
    <div className="flex shrink-0 items-center gap-1.5">
      <button
        type="button"
        onClick={() => { setPlayheadTime(0); setPlaying(false) }}
        title="Jump to start"
        aria-label="Jump to start"
        className="editor-toolbar-transport-btn"
      >
        <TrackPreviousIcon />
      </button>

      <button
        type="button"
        onClick={() => setPlaying(!isPlaying)}
        title={isPlaying ? 'Pause' : 'Play'}
        aria-label={isPlaying ? 'Pause' : 'Play'}
        className="editor-toolbar-play"
      >
        {isPlaying ? <PauseIcon /> : <PlayIcon />}
      </button>

      <button
        type="button"
        onClick={() => { setPlayheadTime(300); setPlaying(false) }}
        title="Jump to end"
        aria-label="Jump to end"
        className="editor-toolbar-transport-btn"
      >
        <TrackNextIcon />
      </button>

      <span className="editor-toolbar-time mx-1">
        {formatTime(playheadTime)}
      </span>

      {editingBpm && canEdit ? (
        <input
          autoFocus
          type="number"
          min={40}
          max={300}
          value={bpmDraft}
          onChange={(e) => setBpmDraft(e.target.value)}
          onBlur={saveBpm}
          onKeyDown={(e) => e.key === 'Enter' && (e.target as HTMLInputElement).blur()}
          className="h-7 w-14 rounded-md border border-white/12 bg-white/5 px-2 text-center font-mono text-xs text-[var(--toolbar-text)] outline-none focus:border-primary/50 focus:ring-2 focus:ring-primary/25"
        />
      ) : (
        <button
          type="button"
          className="editor-toolbar-bpm"
          onClick={() => {
            if (!canEdit) return
            setBpmDraft(String(bpm))
            setEditingBpm(true)
          }}
          title={canEdit ? 'Click to edit BPM' : `BPM: ${bpm}`}
          disabled={!canEdit}
        >
          <span className="opacity-60">♩</span>
          {bpm}
        </button>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/web/src/features/editor/components/TransportBar.tsx
git commit -m "feat(web): extract TransportBar from toolbar"
```

---

## Task 4: Rewire Toolbar layout

**Files:**
- Modify: `apps/web/src/features/editor/components/Toolbar.tsx`

- [ ] **Step 1: Update imports — remove transport icons/state, swap PresenceBar for SessionPresenceMenu**

Replace imports at top of `Toolbar.tsx`:

```tsx
import { MoonIcon, SunIcon } from '@radix-ui/react-icons'
import { useEditorStore } from '../../../store/editor.store'
import { useThemeStore } from '../../../store/theme.store'
import { Avatar } from '../../../components/ui'
import type { SongStatus } from '@ama-midi/shared'
import { useAuthStore } from '../../../store/auth.store'
import { EditorBreadcrumb } from '../../navigation/EditorBreadcrumb'
import { ChartSwitcher } from '../../charts/ChartSwitcher'
import { AiAssistantTrigger } from './ai-assistant/AiAssistantTrigger'
import { SessionPresenceMenu } from '../../collaboration/SessionPresenceMenu'
import type { SongChart } from '@ama-midi/shared'
```

Remove unused imports: `PauseIcon`, `PlayIcon`, `TrackNextIcon`, `TrackPreviousIcon`, `useState`, `useQueryClient`, `apiClient`, `formatTime`, `Song`.

- [ ] **Step 2: Remove BPM state and `saveBpm` from Toolbar body**

Delete lines 76-98 (editor store playhead usage, bpm state, saveBpm). Toolbar no longer needs `useEditorStore` at all — remove that import and hook call too.

- [ ] **Step 3: Replace toolbar JSX layout**

Replace the inner `flex h-12` row content with three zones:

```tsx
<div className="flex h-12 w-full items-center gap-3">
  {/* LEFT — breadcrumb trail */}
  <div className="flex min-w-0 flex-1 items-center overflow-hidden">
    <EditorBreadcrumb
      projectId={projectId}
      projectName={projectName}
      songId={songId}
      songName={songName}
      songStatus={songStatus}
    />
    <ChartSwitcher
      songId={songId}
      charts={charts}
      activeChartId={activeChartId}
    />
  </div>

  {/* CENTER — session presence */}
  <div className="flex flex-1 shrink-0 justify-center">
    {user && (
      <SessionPresenceMenu
        users={presenceList}
        currentUserId={user.id}
      />
    )}
  </div>

  {/* RIGHT — actions */}
  <div className="flex shrink-0 items-center gap-0.5">
    {canEdit && activeChartId && <AiAssistantTrigger />}
    {/* ... keep theme, shortcuts, panel toggles, connection dot, avatar — remove PresenceBar line ... */}
  </div>
</div>
```

Remove `<PresenceBar users={presenceList} />` from the right cluster (line 222).

Remove the entire CENTER transport block (lines 120-179).

- [ ] **Step 4: Remove unused `bpm` from destructuring if Toolbar no longer uses it**

`bpm` prop can stay on `ToolbarProps` for now (EditorPage still passes it) or be removed from interface + call site in Task 5. Prefer removing from `ToolbarProps` and `EditorPage` Toolbar call in Task 5 to avoid dead props.

- [ ] **Step 5: Typecheck**

Run: `cd apps/web && pnpm exec tsc -b --pretty false`  
Expected: no errors

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/features/editor/components/Toolbar.tsx
git commit -m "feat(web): center session presence in toolbar, remove transport"
```

---

## Task 5: Footer layout + TransportBar in EditorPage

**Files:**
- Modify: `apps/web/src/pages/EditorPage.tsx`

- [ ] **Step 1: Import TransportBar**

Add to imports:

```tsx
import { TransportBar } from '../features/editor/components/TransportBar'
```

- [ ] **Step 2: Replace `bottomBar` with three-zone layout**

Replace the existing `bottomBar` const (~lines 484-511) with:

```tsx
const bottomBar = (
  <div className="flex w-full items-center gap-3">
    <div className="flex shrink-0 items-center gap-2">
      <span className="text-xs font-mono" style={{ color: npsColor }}>
        {liveNps} NPS
      </span>
      <div className="w-24 h-1 rounded-full bg-shell-border">
        <div
          className="h-full rounded-full transition-all duration-100"
          style={{ width: `${Math.min(100, (liveNps / 10) * 100)}%`, backgroundColor: npsColor }}
        />
      </div>
      {selectedNoteIds.size > 0 && (
        <span className="text-xs text-shell-muted">
          <span className="text-shell-text font-medium">{selectedNoteIds.size}</span> selected
        </span>
      )}
    </div>

    <div className="flex flex-1 justify-center">
      <TransportBar
        songId={songId!}
        bpm={song?.bpm ?? 120}
        canEdit={canEdit}
      />
    </div>

    <div className="ml-auto shrink-0">
      {!validationData ? null : errCount === 0 && warnCount === 0 ? (
        <span className="text-xs text-green-500">✓ Valid</span>
      ) : (
        <span className="flex items-center gap-2 text-xs">
          {errCount > 0 && <span className="bottombar-errors">{errCount} err</span>}
          {warnCount > 0 && <span className="bottombar-warnings">{warnCount} warn</span>}
        </span>
      )}
    </div>
  </div>
)
```

- [ ] **Step 3: Remove unused `bpm` prop from `<Toolbar>` if removed in Task 4**

In the `topBar` JSX, remove `bpm={song?.bpm ?? 120}` from `<Toolbar ... />` and drop `bpm` from `ToolbarProps` if not already done.

- [ ] **Step 4: Typecheck + build**

Run:
```bash
cd apps/web && pnpm exec tsc -b --pretty false
cd apps/web && pnpm build
```
Expected: success

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/pages/EditorPage.tsx apps/web/src/features/editor/components/Toolbar.tsx
git commit -m "feat(web): move transport controls to editor footer"
```

---

## Task 6: Verification

**Files:** (none — manual + automated checks)

- [ ] **Step 1: Run unit tests**

```bash
node --test apps/web/tests/session-presence-sort.test.ts
```
Expected: PASS

- [ ] **Step 2: Lint**

```bash
pnpm lint
```
Expected: no new errors in touched files

- [ ] **Step 3: Manual smoke test**

1. `pnpm dev` — open any song editor
2. Toolbar center shows avatar stack with chevron; no transport in toolbar
3. Click stack → dropdown with your name, title · department, “You” badge
4. Footer center shows play/pause, time, BPM
5. BPM edit works when `canEdit`; read-only when not
6. Footer left shows NPS; footer right shows validation
7. Personal avatar still on toolbar right
8. Escape / click outside closes dropdown

- [ ] **Step 4: Final commit if any fixups needed**

```bash
git add -A
git commit -m "fix(web): session presence center polish"
```

---

## Spec Coverage Checklist

| Spec requirement | Task |
|------------------|------|
| Presence centered in toolbar | Task 4 |
| Clickable dropdown with all users | Task 2 |
| Avatar, name, title · department rows | Task 2 |
| “You” badge + row highlight | Task 2 |
| Transport in footer center | Task 3, 5 |
| Personal avatar on toolbar right | Task 4 (unchanged) |
| Sort: you first, then alphabetical | Task 1 |
| Read-only BPM when !canEdit | Task 3 |
| No backend changes | N/A |
