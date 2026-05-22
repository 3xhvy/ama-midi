# AMA-MIDI Frontend Architecture Rebuild — Design Spec

**Date:** 2026-05-22
**Status:** Approved
**Approach:** Parallel Track — Component Library + Layout Shell + Page Rebuild

---

## 1. Goals

- Rebuild the entire frontend with a **component-driven architecture** using reusable, variant-driven primitives
- Match **Design.md** pixel-for-pixel (note circles, track headers, playhead, tooltips, etc.)
- Support **dark/light theme sync** across the entire UI (editor included)
- Build **responsive** layouts that collapse gracefully across desktop/tablet/mobile
- Follow React best practices for scaling: unidirectional data flow, single-responsibility components, proper separation of concerns

---

## 2. Architecture Layers

```
┌─────────────────────────────────────────────────────────────────┐
│  PAGES (thin wrappers — compose layouts + features)             │
│  LoginPage · SongListPage · EditorPage · AuthCallbackPage       │
├─────────────────────────────────────────────────────────────────┤
│  LAYOUTS (structural shells — handle zones + responsive)        │
│  AppShell · EditorShell (TopBar + Left + Center + Right + Bot)  │
├─────────────────────────────────────────────────────────────────┤
│  FEATURES (domain components — use primitives + hooks)          │
│  PianoRoll · SongCard · NotePopup · HistoryPanel ·              │
│  ValidationPanel · PresenceBar · AiSuggestions · NoteCircle     │
├─────────────────────────────────────────────────────────────────┤
│  COMPONENTS/UI (reusable primitives — zero domain logic)        │
│  Button · Badge · Avatar · AvatarStack · Input · Textarea ·    │
│  Modal · Tabs · Tooltip · ColorPicker · ToggleGroup ·           │
│  Skeleton · IconButton · StatusBadge                            │
├─────────────────────────────────────────────────────────────────┤
│  LIB (utilities + hooks + stores + API)                         │
│  utils.ts · auth.store · editor.store · theme.store ·           │
│  apiClient · useNotes · useSongs · useSocket · useCanEdit       │
└─────────────────────────────────────────────────────────────────┘
```

**Import rule:** Each layer only imports from layers below it. Never upward.

| Allowed | Forbidden |
|---------|-----------|
| Page → Layout, Feature, UI | UI → Feature |
| Feature → UI, Lib | Layout → Feature |
| Layout → UI | Lib → anything above |
| UI → Lib (cn helper only) | Feature → Feature (use store/events) |

---

## 3. File Structure

```
src/
├── components/
│   ├── ui/                    ← Radix + Tailwind primitives
│   │   ├── Button.tsx
│   │   ├── Badge.tsx
│   │   ├── Avatar.tsx
│   │   ├── AvatarStack.tsx
│   │   ├── Input.tsx
│   │   ├── Textarea.tsx
│   │   ├── Modal.tsx
│   │   ├── Tabs.tsx
│   │   ├── Tooltip.tsx
│   │   ├── ToggleGroup.tsx
│   │   ├── ColorPicker.tsx
│   │   ├── Skeleton.tsx
│   │   ├── IconButton.tsx
│   │   ├── StatusBadge.tsx
│   │   └── index.ts           ← barrel export
│   └── layout/
│       ├── AppShell.tsx
│       ├── EditorShell.tsx
│       ├── TopBar.tsx
│       ├── LeftPanel.tsx
│       ├── RightPanel.tsx
│       ├── BottomBar.tsx
│       └── index.ts
├── features/
│   ├── auth/         (api.ts, useMe.ts)
│   ├── songs/        (useSongs.ts, SongCard.tsx, SongGrid.tsx)
│   ├── editor/
│   │   ├── components/
│   │   │   ├── PianoRoll.tsx
│   │   │   ├── NoteCircle.tsx      ← replaces NoteBlock
│   │   │   ├── GhostCircle.tsx     ← new
│   │   │   ├── NoteTooltip.tsx     ← new (floating card)
│   │   │   ├── NotePopup.tsx
│   │   │   ├── TrackHeader.tsx     ← new
│   │   │   ├── TimeAxis.tsx        ← new
│   │   │   ├── Playhead.tsx        ← new
│   │   │   ├── AiSuggestions.tsx
│   │   │   └── GridLines.tsx
│   │   └── engine/
│   │       ├── coordinate-mapper.ts
│   │       └── viewport-calculator.ts
│   ├── collaboration/ (useSocket.ts, PresenceBar.tsx)
│   ├── history/       (HistoryPanel.tsx)
│   └── validation/    (ValidationPanel.tsx)
├── hooks/
│   ├── useCanEdit.ts
│   ├── useKeyboardShortcuts.ts
│   └── useMediaQuery.ts
├── store/
│   ├── auth.store.ts
│   ├── editor.store.ts
│   └── theme.store.ts          ← new
├── lib/
│   ├── utils.ts               ← cn(), getInitials(), timeAgo(), formatTime()
│   └── constants.ts           ← breakpoints, panel widths
├── pages/
│   ├── LoginPage.tsx
│   ├── SongListPage.tsx
│   ├── EditorPage.tsx
│   └── AuthCallbackPage.tsx
└── styles/
    └── globals.css
```

---

## 4. Component API Design

### 4.1 Shared Contract

Every UI component:
1. Accepts `className` for override/extension
2. Forwards ref via `React.forwardRef`
3. Spreads remaining HTML props (`...rest`)
4. Uses `cn()` helper (clsx + tailwind-merge) for conditional class merging
5. Uses design tokens exclusively (never hardcoded hex)

### 4.2 Button

```typescript
interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger'
  size?: 'sm' | 'md' | 'lg'
  rounded?: boolean        // pill shape (rounded-full)
  loading?: boolean
  icon?: React.ReactNode   // left icon slot
}
```

Design.md mapping:
- `▶ Preview` → `variant="primary" rounded`
- `✓ Save` → `variant="secondary" rounded`
- `Undo` → `variant="ghost" size="sm"`
- `Delete` → `variant="danger"`
- `+ New Song` → `variant="primary" rounded icon={<PlusIcon />}`

### 4.3 Badge / StatusBadge

```typescript
interface BadgeProps {
  variant?: 'default' | 'success' | 'warning' | 'error' | 'muted'
  size?: 'sm' | 'md'
  icon?: React.ReactNode
  children: React.ReactNode
}

interface StatusBadgeProps {
  status: 'synced' | 'needsReview' | 'outdated' | 'draft'
  // Auto-maps to STATUS_COLORS from packages/shared
  // Auto-renders correct icon (✓, ⚠, ✕, ○)
}
```

### 4.4 Avatar / AvatarStack

```typescript
interface AvatarProps {
  src?: string
  name: string               // fallback → color-coded initials
  size?: 'xs' | 'sm' | 'md' | 'lg'  // 24/32/40/48px
  showOnline?: boolean       // green dot bottom-right
}

interface AvatarStackProps {
  users: { id: string; name: string; avatarUrl?: string }[]
  max?: number              // default 5
  size?: 'sm' | 'md'       // default 'md'
}
```

### 4.5 Modal (Radix Dialog)

Compound component pattern:
```typescript
Modal.Root        // wraps Radix Dialog.Root
Modal.Trigger     // opens modal
Modal.Content     // centered card, 400px, rounded-xl, shadow-lg
Modal.Header      // title + close button
Modal.Body        // content area
Modal.Footer      // action buttons row

// Backdrop: rgba(26,22,53,0.6) per Design.md
// Escape closes, focus trapped, body scroll locked
```

### 4.6 Tabs (Radix Tabs)

```typescript
Tabs.Root         // wraps Radix Tabs.Root
Tabs.List         // horizontal tab bar with bottom border
Tabs.Trigger      // tab button (active = primary underline)
Tabs.Content      // panel content

// Used in: RightPanel (Details/Validation/History)
// Tab key switches tabs per Design.md shortcuts
```

### 4.7 ToggleGroup (Radix ToggleGroup)

```typescript
interface ToggleGroupProps {
  variant?: 'default' | 'editor'   // light bg vs dark bg
  items: { value: string; label: string }[]
  value: string
  onValueChange: (value: string) => void
}

// Used for: View mode (Composer/Developer/QA), Zoom (1x/2x/4x)
// Active item: bg-primary text-white
```

### 4.8 Other Primitives

| Component | Key Props | Notes |
|-----------|-----------|-------|
| Input | `size`, `error`, `icon` | Consistent with design tokens |
| Textarea | `rows`, `resize` | Same styling as Input |
| Tooltip | `content`, `side` | Radix Tooltip, accessible |
| Skeleton | `width`, `height`, `rounded` | Loading placeholders |
| ColorPicker | `colors[]`, `value`, `onChange` | 8 preset circles per Design.md |
| IconButton | `icon`, `size`, `variant`, `tooltip` | Square button with icon |

---

## 5. PianoRoll Corrections (Design.md Compliance)

### 5.1 Note Shape — Circle, Not Rectangle

| Property | Current (Wrong) | Correct (Design.md) |
|----------|----------------|---------------------|
| Shape | 20px-tall rectangle, full track width | 16px diameter filled circle |
| Position | left-aligned block | centered at (track, time) coordinate |
| Label | Title text inside rect | No text on circle; title in tooltip |
| Selected | Tailwind ring on rect | White 2px ring on circle |

### 5.2 New Editor Components

**NoteCircle** (replaces NoteBlock):
```typescript
interface NoteCircleProps {
  note: Note
  gridWidth: number
  pxPerSecond: number
  isSelected?: boolean
  viewMode?: 'composer' | 'developer' | 'qa'
  qaFlags?: { nearBoundary: boolean; hasCloseNeighbor: boolean }
  onClick: (note: Note, e: React.MouseEvent) => void
}
// 16px circle, positioned at center of track column
// Animation: note-appear on mount (scale 0.5→1, 150ms spring)
```

**GhostCircle** (snap preview):
```typescript
interface GhostCircleProps {
  track: number
  time: number
  gridWidth: number
  pxPerSecond: number
}
// 16px circle, border-2 border-white/50 bg-white/20, pointer-events-none
```

**NoteTooltip** (floating hover card):
```typescript
interface NoteTooltipProps {
  note: Note
  position: { x: number; y: number }
}
// White bg, shadow-md, rounded-lg
// Shows: title, track + time, creator avatar + name
// Wraps Radix Tooltip with custom content (not browser title attr)
```

**TrackHeader** (column header):
```typescript
interface TrackHeaderProps {
  track: number          // 1-8
  layerColor: string     // from LAYER_COLORS
  isMuted: boolean
  isSolo: boolean
  onToggleMute: () => void
  onToggleSolo: () => void
}
// 40px height, dark surface
// Shows: "Track N" + color dot + mute icon + solo icon
```

**TimeAxis** (left-edge time column):
```typescript
interface TimeAxisProps {
  pxPerSecond: number
  scrollTop: number
  height: number
}
// Fixed position left column (40px wide)
// Labels: 0s, 10s, 20s... in muted text
// Scrolls in sync with grid
```

**Playhead**:
```typescript
interface PlayheadProps {
  time: number           // current time in seconds
  pxPerSecond: number
  scrollTop: number
}
// 2px horizontal line in #6C63FF
// Small triangle indicator on left edge
// CSS transition 100ms linear for smooth movement
```

### 5.3 Corrected PianoRoll Layout

```
┌──────────────────────────────────────────────────────────────┐
│ TRACK HEADERS (40px, one per column)                         │
│ [● Track 1 🔇 S] [● Track 2 🔇 S] ... [● Track 8 🔇 S]    │
├────┬─────────────────────────────────────────────────────────┤
│TIME│ SCROLLABLE GRID                                         │
│AXIS│                                                         │
│    │    ●         ●                   ●    (note circles)    │
│ 0s │         ●              ●                                │
│    │                   ●         ●         ●                 │
│    │─────────────────────────────────────── (1s grid line)   │
│10s │                                                         │
│    │ ════════════════════════════════▶ PLAYHEAD (2px purple)  │
│    │◀ triangle                                               │
│    │                                                         │
│    │    ◐  (ghost circle at snap position)                   │
└────┴─────────────────────────────────────────────────────────┘
```

---

## 6. Theme System

### 6.1 Strategy: Semantic Tokens That Flip

Two namespaces of CSS variables that both switch via `.dark` class on `<html>`:

```css
:root {
  /* Shell tokens (panels, topbar, bottombar) */
  --shell-bg: #F8F7FF;
  --shell-surface: #FFFFFF;
  --shell-border: #E8E6F0;
  --shell-text: #1A1635;
  --shell-muted: #6B6585;

  /* Canvas tokens (editor grid area) */
  --canvas-bg: #F0EEF8;
  --canvas-surface: #E8E6F0;
  --canvas-border: #D4D0E4;
  --canvas-text: #1A1635;
  --canvas-grid: rgba(0,0,0,0.06);
  --canvas-grid-bold: rgba(0,0,0,0.12);
}

.dark {
  --shell-bg: #13111E;
  --shell-surface: #1E1B2E;
  --shell-border: #2D2847;
  --shell-text: #E2DEFF;
  --shell-muted: #6B6585;

  --canvas-bg: #0F0D1A;
  --canvas-surface: #1A1729;
  --canvas-border: #2D2847;
  --canvas-text: #E2DEFF;
  --canvas-grid: rgba(255,255,255,0.06);
  --canvas-grid-bold: rgba(255,255,255,0.12);
}
```

**Brand colors are theme-independent** (always contrast against either background):
- `--color-primary: #6C63FF`
- Note preset colors: `#6C63FF #3B82F6 #10B981 #F59E0B #EF4444 #EC4899 #06B6D4 #8B5CF6`
- Layer colors: same as current
- Semantic: `--color-success`, `--color-warning`, `--color-error`

### 6.2 Theme Store

```typescript
interface ThemeStore {
  mode: 'light' | 'dark' | 'system'
  resolved: 'light' | 'dark'   // computed from mode + prefers-color-scheme
  setMode: (mode: 'light' | 'dark' | 'system') => void
}
// Persisted to localStorage ('ama-theme')
// Applies/removes .dark class on document.documentElement
// Listens to matchMedia('(prefers-color-scheme: dark)') when mode='system'
```

### 6.3 Tailwind Config Update

Replace current hardcoded color values with CSS variable references so all components automatically respect the theme:

```javascript
colors: {
  shell: {
    bg: 'var(--shell-bg)',
    surface: 'var(--shell-surface)',
    border: 'var(--shell-border)',
    text: 'var(--shell-text)',
    muted: 'var(--shell-muted)',
  },
  canvas: {
    bg: 'var(--canvas-bg)',
    surface: 'var(--canvas-surface)',
    border: 'var(--canvas-border)',
    text: 'var(--canvas-text)',
  },
  // Brand colors stay static
  primary: { DEFAULT: '#6C63FF', light: '#EEF0FF', dark: '#4B44CC' },
  success: '#10B981',
  warning: '#F59E0B',
  error: '#EF4444',
}
```

---

## 7. Responsive Design

### 7.1 Breakpoints

| Breakpoint | Width | Layout |
|-----------|-------|--------|
| Desktop | ≥1280px | Full 5-zone: Left 240px + Center flex-1 + Right 280px |
| Tablet | 768–1279px | Left collapses to icon-rail (48px) or hidden. Right becomes slide-over overlay (280px) |
| Mobile | <768px | Single column canvas. Panels = full-screen bottom sheets. TopBar minimal |

### 7.2 Panel Behavior per Breakpoint

**Desktop (≥1280px):**
- All panels visible by default
- Collapsible via button or keyboard shortcut
- Smooth slide animation (250ms)

**Tablet (768–1279px):**
- LeftPanel: collapsed to 48px icon column (track dots only), expandable on click
- RightPanel: hidden by default, slides in as overlay on demand (z-40)
- TopBar: center action buttons collapse to overflow `...` menu
- BottomBar: stays visible

**Mobile (<768px):**
- LeftPanel: hidden, accessible via hamburger menu → full-screen sheet from left
- RightPanel: hidden, accessible via tap → full-screen sheet from right
- TopBar: song name + hamburger + minimal actions
- BottomBar: sticky, zoom + time display only
- Canvas fills remaining viewport height

### 7.3 EditorShell Props (Updated)

```typescript
interface EditorShellProps {
  topBar: React.ReactNode
  leftPanel: React.ReactNode
  rightPanel: React.ReactNode
  bottomBar: React.ReactNode
  children: React.ReactNode        // canvas zone
  leftCollapsed?: boolean
  rightCollapsed?: boolean
  onLeftToggle?: () => void
  onRightToggle?: () => void
}
// Responsive behavior is INTERNAL to EditorShell
// Uses useMediaQuery() to auto-collapse at breakpoints
// Panels transition to overlays/sheets below tablet breakpoint
```

### 7.4 useMediaQuery Hook

```typescript
function useMediaQuery(query: string): boolean
// Returns true/false reactively
// Used by EditorShell internally
// Also available for feature components that need responsive behavior
```

---

## 8. State Architecture

### 8.1 Store Shape (Zustand)

**auth.store.ts** — unchanged:
```typescript
{ user, token, setAuth, clearAuth }
```

**editor.store.ts** — extended:
```typescript
interface EditorStore {
  viewMode: 'composer' | 'developer' | 'qa'
  zoom: 1 | 2 | 4
  pxPerSecond: number
  editorMode: 'fast' | 'popup'
  selectedNoteId: string | null
  rightPanelTab: 'details' | 'validation' | 'history'
  leftCollapsed: boolean
  rightCollapsed: boolean
  // Actions
  setViewMode: (mode) => void
  setZoom: (zoom) => void
  setEditorMode: (mode) => void
  selectNote: (id: string | null) => void
  setRightPanelTab: (tab) => void
  toggleLeftPanel: () => void
  toggleRightPanel: () => void
}
```

**theme.store.ts** — new:
```typescript
interface ThemeStore {
  mode: 'light' | 'dark' | 'system'
  resolved: 'light' | 'dark'
  setMode: (mode) => void
}
```

### 8.2 Data Flow

```
TanStack Query (server state)     Zustand (client state)
┌─────────────────────────┐       ┌───────────────────────┐
│ useNotes(songId)        │       │ editor.store          │
│ useSongs()              │       │ auth.store            │
│ useValidation(songId)   │       │ theme.store           │
│ useHistory(songId)      │       │                       │
└──────────┬──────────────┘       └──────────┬────────────┘
           │                                  │
           ▼                                  ▼
    ┌──────────────────────────────────────────────┐
    │  Feature Components (read both)              │
    │  PianoRoll, SongCard, ValidationPanel, etc.  │
    └──────────────────────────────────────────────┘
           │
           ▼
    ┌──────────────────────────────────────────────┐
    │  UI Primitives (receive via props only)      │
    │  Button, Avatar, Badge — no store access     │
    └──────────────────────────────────────────────┘
```

**Rule:** UI primitives NEVER access stores directly. They receive everything via props. Only feature components and pages access stores/queries.

### 8.3 WebSocket Integration

`useSocket(songId)` remains the same — it updates TanStack Query cache directly on events (`note-created`, `note-updated`, `note-deleted`, `presence-list`). No store involvement for real-time sync.

---

## 9. Dependencies to Add

```json
{
  "@radix-ui/react-dialog": "latest",
  "@radix-ui/react-tabs": "latest",
  "@radix-ui/react-tooltip": "latest",
  "@radix-ui/react-toggle-group": "latest",
  "clsx": "latest",
  "tailwind-merge": "latest"
}
```

Utility helper (`lib/utils.ts`):
```typescript
import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'
export function cn(...inputs: ClassValue[]) { return twMerge(clsx(inputs)) }
```

---

## 10. Migration Strategy

The rebuild is **non-breaking** — existing hooks, stores, and API layer stay intact. Only the presentation layer changes.

**Phase 1:** Build `components/ui/` primitives + `lib/utils.ts` + `theme.store`
**Phase 2:** Build `components/layout/` (EditorShell, AppShell)
**Phase 3:** Build new editor components (NoteCircle, GhostCircle, TrackHeader, TimeAxis, Playhead, NoteTooltip)
**Phase 4:** Rebuild pages to compose from new components
**Phase 5:** Update `globals.css` and `tailwind.config.js` for theme variables
**Phase 6:** Remove old files (NoteBlock.tsx, inline duplicated code)

At no point does the app stop working — each phase can be verified independently.

---

## 11. Design.md Compliance Checklist

| Design.md Requirement | Component | Status |
|----------------------|-----------|--------|
| Notes = 16px circles | NoteCircle | New |
| Ghost = circle at snap position | GhostCircle | New |
| Track headers: name + dot + mute + solo | TrackHeader | New |
| Time labels: left-edge column | TimeAxis | New |
| Playhead: 2px purple + triangle | Playhead | New |
| Hover tooltip: floating card (title/time/creator) | NoteTooltip | New |
| Selected note: white 2px ring on circle | NoteCircle isSelected | New |
| AI ghost notes: dashed border + pulse animation | AiSuggestions (updated) | Update |
| 5-zone layout: 64px/240px/flex/280px/48px | EditorShell | New |
| Light app shell, max-width 1100px | AppShell | New |
| SongCard: track-density dots + status badge + hover | SongCard (updated) | Update |
| StatusBadge pills (synced/needsReview/outdated/draft) | StatusBadge | New |
| Presence avatars: overlapping circles + online dot | AvatarStack | New |
| NotePopup: centered modal, 400px, 5 fields | NotePopup (updated) | Update |
| View mode toggle: chip group | ToggleGroup | New |
| Zoom toggle: 1x/2x/4x | ToggleGroup | New |
| Animations: note-appear, ghost-pulse, slide-in-right | globals.css | Keep |
| Color tokens from Design.md | Theme variables | Update |
| Human-friendly language in all empty states/errors | All components | Enforce |

---

## 12. Animations (from Design.md, unchanged)

```css
note-appear:    scale(0.5→1) + opacity(0→1), 150ms, cubic-bezier(0.34,1.56,0.64,1)
note-disappear: scale(1→0.3) + opacity(1→0), 150ms ease-out
ghost-pulse:    scale(0.95→1.05) + opacity(0.7→1), 1.5s ease-in-out infinite
slide-in-right: translateX(100%→0) + opacity(0→1), 250ms ease
toast-up:       translateY(8px→0) + opacity(0→1), 200ms ease
playhead:       transform directly, CSS transition 100ms linear
```

---

## 13. Empty States (from Design.md)

| Screen | Message | CTA |
|--------|---------|-----|
| Song list, no songs | "No songs yet — create your first one" | + New Song |
| Editor, 0 notes | "Click anywhere on the grid to place your first note" | — |
| History panel, no events | "No changes yet — edits will appear here" | — |
| Validation, no issues | "Everything looks good ✓" | — |
| AI suggestions, <5 notes | "Place at least 5 notes to get AI suggestions" | — |
| Details tab, no selection | "Select a note to view details" | — |

---

## 14. Keyboard Shortcuts (Design.md)

| Key | Action | Component Owner |
|-----|--------|----------------|
| E | Open edit popup for selected note | useKeyboardShortcuts |
| Delete/Backspace | Delete selected note | useKeyboardShortcuts |
| Cmd/Ctrl+Z | Undo last action | useKeyboardShortcuts |
| J | Jump to next validation issue (QA view) | useKeyboardShortcuts |
| Escape | Close any open modal or panel | Modal, EditorShell |
| 1/2/4 | Switch zoom level | useKeyboardShortcuts |
| Tab | Switch between right panel tabs | Radix Tabs (built-in) |
| ? | Toggle shortcut legend | useKeyboardShortcuts |

All keyboard logic centralized in `useKeyboardShortcuts` hook, registered once in EditorPage.
