# Phase 1 — Editor UX Redesign

**Date:** 2026-05-22
**Scope:** Pure frontend. No DB migrations. No new API endpoints.
**Goal:** Fix broken UX, centralize controls, make the editor feel like a game development tool.

---

## Problems Being Solved

| Problem | Fix |
|---|---|
| Track panel has LAYER_COLORS that conflict with note colors | Remove track colors entirely |
| AI Suggest button tiny and buried in grid | Move to toolbar as primary button |
| Zoom + view mode scattered | Centralize into one toolbar center zone |
| History shows only bottom 1/3 of right panel | History tab takes full panel height |
| No dark/light mode toggle | Add to toolbar right zone |
| Time axis overlaps / hidden | Fixed 40px left column always visible |
| Editor cannot scroll vertically | Fix flex/overflow CSS on PianoRoll container |
| Google avatar not shown on song list | Sync via existing `useMe()` hook |
| Right panel not playhead-reactive | Add live context strip at top of panel |

---

## Toolbar — 3-Zone Layout

```
┌─────────────────────────────────────────────────────────────────────────┐
│ [← Songs | Song Name▾]   [⏮ ▶ ⏭  00:04.2s  1x 2x 4x  C Dev QA]   [✨ Suggest  [HH][AB]  ☀  ?] │
└─────────────────────────────────────────────────────────────────────────┘
```

### Left Zone
- Back arrow → `/` (song list)
- Song name — inline editable (click to edit, blur to save via `PATCH /songs/:id`)

### Center Zone
- **Playback controls:** ⏮ (jump to 0s) · ▶/⏸ (play/pause) · ⏭ (jump to end)
- **Time display:** `00:04.2s` — live, updates every 100ms while playing
- **Zoom group:** `1x` `2x` `4x` — replaces current bottom-left zoom buttons
- **View mode group:** `Composer` `Developer` `QA` — same as current, moved here

### Right Zone
- **✨ Suggest** — `Button` variant=primary, size=sm. Disabled if notes < 5 or viewMode ≠ 'composer'. Replaces current ghost button inside grid.
- **Presence avatars** — `AvatarStack`, max 4, tooltip shows name
- **Theme toggle** — sun/moon `IconButton`, calls `useThemeStore().setMode()`
- **Shortcut legend** — `?` `IconButton`

### Removed from toolbar
- Undo button → Cmd+Z only (keyboard). Still works, just no button clutter.
- "Viewing only" badge → replaced by toolbar right zone showing role chip

---

## Visual Playback

Play button drives `playheadTime` in `useEditorStore()`.

```
State: isPlaying: boolean  (new store field)
       playheadTime: number  (existing store field)

On ▶ press:
  - set isPlaying = true
  - start requestAnimationFrame loop
  - each frame: playheadTime += deltaSeconds
  - stop when playheadTime >= TIME_MAX (300)

On ⏸ press:
  - set isPlaying = false
  - cancel rAF loop

On ⏮:
  - set playheadTime = 0

On grid click while playing:
  - jump playhead to clicked time position
```

`Playhead` component (already exists) renders at `playheadTime` position.
PianoRoll auto-scrolls to follow playhead when playing.

---

## Track Panel — Simplified

Remove `LAYER_COLORS` from:
- `apps/web/src/features/editor/components/TrackHeader.tsx`
- `apps/web/src/pages/EditorPage.tsx` (left panel track list)

Track panel left sidebar becomes:

```
TRACKS
──────────────
T1  ████████░  [M]
T2  ██░░░░░░░  [M]
T3  ███████░░  [M]
...
T8  █░░░░░░░░  [M]
──────────────
Patterns ▾
```

- Track label (T1–T8)
- Density bar: proportional to note count on that track (computed from `notes` array)
- `[M]` mute toggle — click to mute, alt+click to solo
- No track color dot
- Note color is the only color system in the app

---

## Right Panel — Playhead-Reactive

Panel structure:

```
┌─────────────────────────────────────────┐
│ LIVE CONTEXT  (always visible, ~64px)   │
│  ⏱ 00:04.2s                            │
│  T2@4.0s  T3@4.2s  T6@4.5s            │
│  NPS: 2.1  ████░░░░                    │
├─────────────────────────────────────────┤
│ [TRACKS] [VALIDATION] [HISTORY]         │
├─────────────────────────────────────────┤
│  (full height tab content)              │
└─────────────────────────────────────────┘
```

### Live Context Strip
- Updates every 100ms (throttled, tied to `playheadTime`)
- **Time:** current playhead seconds formatted as `MM:SS.s`
- **Near cursor notes:** notes within ±1s of playhead, shown as `T{track}@{time}s` chips, max 5
- **NPS bar:** notes-per-second in current 2s window, color-coded (green/yellow/red)

### TRACKS tab (full height)
- T1–T8 rows with density bars + mute toggles
- Active track (nearest note to playhead) row highlighted with `bg-primary/10`

### VALIDATION tab
- Existing `ValidationPanel` component, full height

### HISTORY tab
- Existing `HistoryPanel` component, **full panel height** (not bottom fragment)
- Events with timestamp ≤ playheadTime pulse with green dot ("just passed")

---

## Time Axis — Always Visible

Fixed 40px column left of the grid (inside `PianoRoll`, before the scrollable area).

```
┌──────────────────────────────────────┐
│ TimeAxis(40px) │  Grid (flex-1)      │
│                │                     │
│ 0s             │  ─────── (bold)     │
│                │  ─────── (thin)     │
│ 1s             │  ─────── (thin)     │
│                │  ─────── (thin)     │
│ ...            │                     │
└──────────────────────────────────────┘
```

`TimeAxis` component (already created in frontend architecture plan) placed as a non-scrolling sibling to the scroll container. Labels every 1s, bold every 10s.

---

## Vertical Scroll Fix

**Root cause:** `EditorPage` wraps `PianoRoll` in a `div` without explicit height. The flex container doesn't propagate height into PianoRoll's scroll container.

**Fix:**
```tsx
// EditorPage — piano roll zone:
<div className="flex-1 overflow-hidden min-h-0">
  <PianoRoll ... />
</div>
```

`min-h-0` forces flex children to respect parent bounds and allows overflow-y to activate. This is a 1-line fix.

---

## Google Avatar Sync — Song List

`AppShell` already renders `Avatar` with `user.avatarUrl` from `useAuthStore`.

Song list page issue: `SongCard` doesn't show the logged-in user's avatar for their own songs. Fix: `SongCard` already has `creatorName` — add `creatorAvatarUrl` to `Song` type returned by API.

**API change:** `SongsService.findAll()` already includes `creator: { select: { name: true } }` — extend to `{ name: true, avatarUrl: true }`. Return `creatorAvatarUrl` in response.

---

## Dark / Light Mode Toggle

`useThemeStore` already exists (created in frontend architecture plan). The toggle:

```tsx
// In toolbar right zone:
const { resolved, setMode } = useThemeStore()
<IconButton onClick={() => setMode(resolved === 'dark' ? 'light' : 'dark')} tooltip="Toggle theme">
  {resolved === 'dark' ? '☀' : '🌙'}
</IconButton>
```

`App.tsx` must call `useThemeStore.getState()` on mount to trigger `applyTheme()` rehydration.

---

## Components Affected

| File | Change |
|---|---|
| `EditorPage.tsx` | Full rewrite using new toolbar layout |
| `PianoRoll.tsx` | Add TimeAxis, fix scroll container, remove ghost button |
| `EditorShell.tsx` | Wire leftCollapsed/rightCollapsed from store |
| `TrackHeader.tsx` | Remove LAYER_COLORS, add density bar |
| `AiSuggestions.tsx` | Remove inline Suggest button (now in toolbar) |
| `store/editor.store.ts` | Add `isPlaying: boolean`, `setPlaying()` |
| `SongsService` | Extend creator select to include avatarUrl |
| `shared/types.ts` | Add `creatorAvatarUrl?: string` to Song type |

---

## Acceptance Criteria

- [ ] Toolbar renders 3 zones with correct components in each
- [ ] Play button animates playhead downward at real-time speed
- [ ] Pause stops playhead, ⏮ resets to 0
- [ ] Zoom buttons in center zone, zoom works
- [ ] View mode switcher in center zone
- [ ] ✨ Suggest button in right zone, disabled when notes < 5
- [ ] Theme toggle flips dark/light, persists on refresh
- [ ] Track panel shows T1–T8 with density bars, no color dots
- [ ] Mute/solo still works
- [ ] Right panel Live Context strip updates as playhead moves
- [ ] History tab takes full panel height
- [ ] Time axis visible left of grid, labels every 1s
- [ ] Editor scrolls vertically through full 300s
- [ ] Song list SongCard shows creator avatarUrl from API
- [ ] No LAYER_COLORS references remain in track panel
