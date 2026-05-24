# Design: Session Presence Center + Transport Footer

**Date:** 2026-05-24  
**Scope:** Editor toolbar/footer layout — center session presence with user dropdown; move transport to footer  
**Status:** Approved

---

## Problem Summary

When multiple users join the same editor session, collaborators are shown as a passive avatar stack on the **right** of the toolbar. The stack is not interactive and does not surface user identity beyond a name tooltip. Title and department are already available on the WebSocket presence payload but unused in the UI.

The toolbar **center** is occupied by transport controls (play/pause, time, BPM), leaving no room for session presence to be a first-class, centered element. The editor **footer** is underused — it only shows live NPS, selection count, and validation status.

---

## Goals

1. Move session presence from the toolbar right cluster to the **center** of the toolbar.
2. Make presence **clickable** — opens a dropdown listing every user in the session with avatar, name, title, and department (when present).
3. Highlight the **current user** with a “You” badge and row styling.
4. Move **transport controls** from the toolbar center to the **footer center**, reusing existing footer space.
5. Keep the **personal avatar** on the toolbar right as a separate account anchor (no change to account menu scope in this feature).

---

## Non-Goals

- Account menu actions (profile, sign out) on the presence dropdown — rows are display-only.
- Search/filter in the presence dropdown — session sizes are small.
- Backend or WebSocket protocol changes — `title` and `department` are already on `PresenceUser`.
- Changes to collaborator cursors, activity notices, or connection indicator behavior.

---

## Layout

### Toolbar (top) — after

| Zone | Content |
|------|---------|
| **Left** | `EditorBreadcrumb` + `ChartSwitcher` (unchanged) |
| **Center** | `SessionPresenceMenu` — avatar stack trigger + dropdown |
| **Right** | AI trigger, theme, shortcuts, panel toggles, connection dot, personal avatar (unchanged) |

Transport is **removed** from the toolbar. The center zone uses `flex-1 justify-center` so presence sits visually centered between left and right clusters.

### Footer (bottom) — after

Three zones in the existing 48px (`BOTTOMBAR_HEIGHT`) footer:

```
[ NPS · bar · selection ]     |◀  ▶  ▶|  0:00  ♩120     [ ✓ Valid / errors ]
         LEFT                        CENTER                    RIGHT
```

| Zone | Content |
|------|---------|
| **Left** | Live NPS, NPS bar, selection count (unchanged from `EditorPage` bottomBar) |
| **Center** | `TransportBar` — jump start, play/pause, jump end, playhead time, editable BPM |
| **Right** | Validation summary (unchanged) |

Footer uses `flex items-center w-full` with center zone `flex-1 justify-center` and right zone `ml-auto`.

---

## Components

### 1. `SessionPresenceMenu` (evolve `PresenceBar`)

**Location:** `apps/web/src/features/collaboration/SessionPresenceMenu.tsx`  
Rename/refactor from `PresenceBar.tsx` — same feature folder, single responsibility.

**Props:**

```ts
interface SessionPresenceMenuProps {
  users: PresenceUser[]
  currentUserId: string
}
```

**Trigger (avatar stack):**

- Entire stack is one `<button>` with `aria-haspopup="listbox"`, `aria-expanded`, and a tooltip like “3 people in this session”.
- Reuse existing overlapping avatar styling (max 5 visible + `+N` overflow badge).
- Add a small chevron or hover ring so the control reads as clickable.
- Opens dropdown even when only one user is present (solo editing).

**Dropdown panel:**

- Fixed position below trigger (same click-outside + `Escape` pattern as `NavDropdown` / `AppShell` account menu).
- Header: “In this session” + user count.
- Scrollable list (`max-h-64`) when needed.
- Each row:
  - Avatar (sm) via shared `Avatar` component or existing initials fallback
  - **Name** (primary, truncated)
  - **Title · department** (secondary muted line; omit line if both absent)
  - **“You” badge** on current user row
- Current user row: `bg-primary/10 ring-1 ring-primary/20` highlight.
- Rows are **not** clickable actions — display only.
- Sort order: current user first, then others alphabetically by name.

**Positioning:**

- Use `getBoundingClientRect()` on trigger + `position: fixed` panel (matches `NavDropdown`).
- Close on outside click and `Escape`.

### 2. `TransportBar` (extract from `Toolbar`)

**Location:** `apps/web/src/features/editor/components/TransportBar.tsx`

Extract the transport block currently in `Toolbar.tsx`:

- Jump to start (`TrackPreviousIcon`)
- Play/pause toggle
- Jump to end (`TrackNextIcon`)
- Playhead time (`formatTime(playheadTime)`)
- BPM display/edit (inline number input on click, PATCH `/songs/:id` on blur — same logic as today)

**State dependencies:**

- `useEditorStore`: `isPlaying`, `setPlaying`, `playheadTime`, `setPlayheadTime`
- Props: `songId`, `bpm`, `canEdit` (BPM edit only when `canEdit`; read-only display otherwise)

Reuse existing CSS classes: `editor-toolbar-transport-btn`, `editor-toolbar-play`, `editor-toolbar-time`, `editor-toolbar-bpm`.

### 3. `Toolbar` changes

**Remove:**

- Transport controls (moved to `TransportBar`)
- `PresenceBar` from right cluster

**Add:**

- `SessionPresenceMenu` in center zone with `currentUserId={user.id}`

**Keep:**

- Right-side personal avatar (static, no dropdown in this feature)
- All existing left/right toolbar actions

### 4. `EditorPage` changes

Compose footer:

```tsx
const bottomBar = (
  <>
    {/* left: existing NPS, bar, selection */}
    <TransportBar songId={songId!} bpm={song?.bpm ?? 120} canEdit={canEdit} />
    {/* right: existing validation — ml-auto wrapper */}
  </>
)
```

Ensure footer layout uses full width flex so center transport is truly centered.

---

## Data Flow

```
useSocket(songId) → presenceList: PresenceUser[]
useAuthStore → user.id (currentUserId)

EditorPage → Toolbar(presenceList, ...)
EditorPage → bottomBar → TransportBar + stats

Toolbar → SessionPresenceMenu(users=presenceList, currentUserId=user.id)
```

`PresenceUser` (already defined in `useSocket.ts`):

```ts
interface PresenceUser {
  id: string
  name: string
  avatarUrl?: string
  email?: string
  title?: string | null
  department?: string | null
}
```

No API or gateway changes required.

---

## Edge Cases

| Case | Behavior |
|------|----------|
| Solo editor | Stack shows one avatar; dropdown lists one row with “You” badge |
| 6+ users | Stack shows 5 + `+N`; dropdown lists **all** users |
| Missing title/department | Secondary line omitted; name only |
| Reconnecting | Presence stack and dropdown use latest `presenceList`; connection dot unchanged on toolbar right |
| Narrow viewport | Toolbar center presence stays `shrink-0`; breadcrumb truncates on left |
| Read-only user | Transport play/time works; BPM shows read-only (no edit affordance) |

---

## Testing

### Manual

1. Open editor alone — presence centered, dropdown shows “You” row with title/department.
2. Two browsers same song — both avatars in stack; dropdown lists both; each sees own “You” badge.
3. 6+ users (or mock long list) — stack overflow badge; dropdown scrolls full list.
4. Transport in footer — play/pause, jump, time display, BPM edit still work.
5. Footer left/right unchanged — NPS and validation still visible.
6. Click outside / Escape closes dropdown.

### Automated (optional, YAGNI unless quick)

- Unit test for sort helper: current user first, then alphabetical.
- No E2E required for this UI-only change unless existing editor E2E covers toolbar.

---

## Files Touched

| File | Action |
|------|--------|
| `apps/web/src/features/collaboration/PresenceBar.tsx` | Replace with `SessionPresenceMenu.tsx` (or rename in place) |
| `apps/web/src/features/editor/components/TransportBar.tsx` | **Create** |
| `apps/web/src/features/editor/components/Toolbar.tsx` | Remove transport + right presence; add center presence |
| `apps/web/src/pages/EditorPage.tsx` | Add `TransportBar` to `bottomBar`; wire `currentUserId` if needed at page level |
| `apps/web/src/styles/globals.css` | Only if footer transport needs minor spacing tokens (prefer reusing toolbar transport classes) |

---

## Approach Chosen

**Evolve `PresenceBar` in place → `SessionPresenceMenu`** plus extract `TransportBar`. Rejected alternatives:

- **New wrapper only:** unnecessary indirection for a focused change.
- **`NavDropdown` avatar variant:** built for searchable nav lists, poor fit for identity rows.

---

## Success Criteria

- [ ] Session presence is visually centered in the toolbar.
- [ ] Clicking the avatar stack opens a dropdown with all session users.
- [ ] Each dropdown row shows avatar, name, and title · department when available.
- [ ] Current user is highlighted with a “You” badge.
- [ ] Transport controls work from the footer center.
- [ ] Personal avatar remains on the toolbar right.
- [ ] No backend changes.
