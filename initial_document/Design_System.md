# AMA-MIDI — Design System
### Playful Professional · Music-First · Amanotes Identity

---

## Core Design Principle

> Make it feel like a music game production workspace, not a MIDI engineering tool.

Light by default. Rounded. Color carries meaning. Language is human. Complexity hides until needed.

---

## 1. Color System

### CSS Variables (put in globals.css)

```css
:root {
  /* Brand */
  --color-primary:        #6C63FF;  /* vibrant purple — main actions */
  --color-primary-light:  #EEF0FF;  /* purple tint — hover bg, selected state */
  --color-primary-dark:   #4B44CC;  /* pressed state */

  /* Layer colors — each layer has a meaning */
  --color-midi:           #3B82F6;  /* blue — MIDI / audio layer */
  --color-midi-bg:        #EFF6FF;
  --color-beatmap:        #06B6D4;  /* cyan — beat map layer */
  --color-beatmap-bg:     #ECFEFF;
  --color-gameplay:       #8B5CF6;  /* purple — gameplay notes / triggers */
  --color-gameplay-bg:    #F5F3FF;
  --color-difficulty:     #EC4899;  /* pink — difficulty layers */
  --color-difficulty-bg:  #FDF2F8;
  --color-events:         #F59E0B;  /* amber — game event triggers */
  --color-events-bg:      #FFFBEB;

  /* Semantic */
  --color-success:        #10B981;
  --color-success-bg:     #ECFDF5;
  --color-warning:        #F59E0B;
  --color-warning-bg:     #FFFBEB;
  --color-error:          #EF4444;
  --color-error-bg:       #FEF2F2;
  --color-info:           #3B82F6;
  --color-info-bg:        #EFF6FF;

  /* Neutrals */
  --color-bg:             #F8F7FF;  /* soft lavender-white page background */
  --color-surface:        #FFFFFF;  /* card / panel surface */
  --color-surface-raised: #FFFFFF;  /* elevated cards */
  --color-border:         #E8E6F0;  /* subtle border */
  --color-border-strong:  #C4BFD8;  /* emphasized border */

  /* Text */
  --color-text-primary:   #1A1635;  /* near-black with purple tint */
  --color-text-secondary: #6B6585;  /* muted */
  --color-text-tertiary:  #A09BB5;  /* hints, placeholders */
  --color-text-on-primary:#FFFFFF;

  /* Editor (dark surface for timeline) */
  --color-editor-bg:      #13111E;  /* deep dark purple-black */
  --color-editor-surface: #1E1B2E;  /* panel inside editor */
  --color-editor-border:  #2D2847;  /* subtle grid lines */
  --color-editor-text:    #E2DEFF;  /* light lavender text */
  --color-editor-muted:   #6B6585;  /* muted in editor */
  --color-grid-line:      rgba(255,255,255,0.06);   /* subtle grid */
  --color-grid-line-bold: rgba(255,255,255,0.12);   /* every 10s marker */

  /* Radius */
  --radius-sm:   6px;
  --radius-md:   10px;
  --radius-lg:   16px;
  --radius-xl:   24px;
  --radius-full: 9999px; /* pills, avatars */

  /* Shadow */
  --shadow-sm:   0 1px 3px rgba(108,99,255,0.08), 0 1px 2px rgba(0,0,0,0.04);
  --shadow-md:   0 4px 16px rgba(108,99,255,0.12), 0 2px 4px rgba(0,0,0,0.06);
  --shadow-lg:   0 8px 32px rgba(108,99,255,0.16), 0 4px 8px rgba(0,0,0,0.08);

  /* Typography */
  --font-sans: 'Inter', 'DM Sans', system-ui, sans-serif;
  --font-mono: 'JetBrains Mono', 'Fira Code', monospace;

  /* Transitions */
  --transition-fast:   150ms ease;
  --transition-normal: 250ms ease;
}
```

### How to use layer colors in code

```typescript
// packages/shared/src/colors.ts
export const LAYER_COLORS = {
  midi:       { primary: '#3B82F6', bg: '#EFF6FF', label: 'MIDI' },
  beatmap:    { primary: '#06B6D4', bg: '#ECFEFF', label: 'Beat Map' },
  gameplay:   { primary: '#8B5CF6', bg: '#F5F3FF', label: 'Gameplay' },
  difficulty: { primary: '#EC4899', bg: '#FDF2F8', label: 'Difficulty' },
  events:     { primary: '#F59E0B', bg: '#FFFBEB', label: 'Events' },
} as const

export const NOTE_PRESET_COLORS = [
  '#6C63FF', // purple (default)
  '#3B82F6', // blue
  '#10B981', // green
  '#F59E0B', // amber
  '#EF4444', // red
  '#EC4899', // pink
  '#06B6D4', // cyan
  '#8B5CF6', // violet
]

export const STATUS_COLORS = {
  synced:       { color: '#10B981', bg: '#ECFDF5', icon: '✓', label: 'Synced' },
  needsReview:  { color: '#F59E0B', bg: '#FFFBEB', icon: '⚠', label: 'Needs Review' },
  outdated:     { color: '#EF4444', bg: '#FEF2F2', icon: '✕', label: 'Outdated' },
  draft:        { color: '#6B6585', bg: '#F3F0F9', icon: '○', label: 'Draft' },
  approved:     { color: '#10B981', bg: '#ECFDF5', icon: '✓', label: 'Approved' },
}
```

---

## 2. Typography Scale

```css
/* Put in globals.css */

.text-page-title {
  font-size: 28px;
  font-weight: 700;
  line-height: 1.2;
  color: var(--color-text-primary);
  letter-spacing: -0.02em;
}

.text-section-title {
  font-size: 20px;
  font-weight: 600;
  line-height: 1.3;
  color: var(--color-text-primary);
}

.text-card-title {
  font-size: 15px;
  font-weight: 600;
  color: var(--color-text-primary);
}

.text-body {
  font-size: 14px;
  font-weight: 400;
  line-height: 1.6;
  color: var(--color-text-primary);
}

.text-label {
  font-size: 12px;
  font-weight: 500;
  color: var(--color-text-secondary);
  text-transform: uppercase;
  letter-spacing: 0.04em;
}

.text-meta {
  font-size: 12px;
  font-weight: 400;
  color: var(--color-text-tertiary);
}

.text-mono {
  font-family: var(--font-mono);
  font-size: 12px;
  color: var(--color-text-secondary);
}
```

### Language rules — always apply these

| Instead of this | Write this |
|---|---|
| `MIDI_EVENT_TRIGGER_VALIDATION_PAYLOAD_ERROR` | `Trigger target is missing` |
| `Quantization mismatch at 00:01:13.233` | `This note is slightly off beat` |
| `EVENT_SYNC_ERROR_CODE_409` | `This trigger is no longer connected to a game action` |
| `No data found` | `No notes yet — click the grid to place your first note` |
| `Connection missing` | `This song is not connected to a game level yet` |
| `Conflict detected` | `Someone edited this section too — choose which change to keep` |
| `404` | `We couldn't find that song` |
| `Rate limit exceeded` | `You're placing notes too fast — slow down a little` |

---

## 3. Component Specifications

Give these specs to AI when generating each component.

### 3.1 App Layout

```
┌─────────────────────────────────────────────────────────┐
│ TopBar (64px)                                           │
│ Song name · Version chip · [▶ Preview] [✓ Save] [↑ Export] │
│ ─────────────────────────── Presence avatars           │
├──────────────┬──────────────────────────┬───────────────┤
│ LeftPanel    │ Timeline Editor           │ RightPanel    │
│ (240px)      │ (flex 1)                  │ (280px)       │
│              │                           │               │
│ Layer toggle │ Piano Roll Grid           │ Note details  │
│ Connections  │ (dark editor surface)     │ Comments      │
│ Users        │                           │ Validation    │
│              │                           │               │
├──────────────┴──────────────────────────┴───────────────┤
│ BottomBar (48px)                                        │
│ ▶ 00:42.5 / 03:00  ──────●──────  Zoom 1x 2x 4x  ⚠ 3 │
└─────────────────────────────────────────────────────────┘
```

**TopBar prompt:**
"Build a TopBar component with:
- Left: song name (editable inline on click), version chip (e.g. 'v4' with gray bg, rounded-full)
- Center: [▶ Preview] primary button, [✓ Save] secondary button, [↑ Export] secondary button
- Right: presence avatars (circular, 32px, overlapping -8px, max 5 + badge), view mode switcher (Composer / Developer / QA chips), [? Help] icon button
- Height 64px, background var(--color-surface), border-bottom var(--color-border), subtle shadow-sm
- All buttons rounded-full or rounded-lg, icon + label"

**LeftPanel prompt:**
"Build a LeftPanel component with:
- Header: 'Layers' title + [+ Add] small icon button
- Layer list: each layer is a row with toggle checkbox, color dot (using LAYER_COLORS), layer name, status chip (Synced/Needs Review/Outdated)
- Layer rows are draggable to reorder
- Separator, then: 'Connected Files' section with file chips showing health status icon
- Separator, then: active user list with avatar + name + what they are editing ('editing Chorus')
- Width 240px, background var(--color-surface), border-right var(--color-border)"

**RightPanel prompt:**
"Build a collapsible RightPanel with three tabs: Details, Comments, Validation.
- Details tab: shows selected note properties (track, time, title, color swatch, description)
- Comments tab: threaded comments with avatar, name, timestamp, message, reply button
- Validation tab: summary row (✓ X passed / ⚠ Y warnings / ✕ Z errors), then list of issues — each clickable to jump to timeline position
- Width 280px, background var(--color-surface), border-left var(--color-border)"

**BottomBar prompt:**
"Build a BottomBar with:
- Left: playhead time display 'MM:SS.s / 05:00' in monospace font
- Center: scrubber/progress bar showing current position
- Right: zoom buttons '1x 2x 4x' as toggle group, validation badge '⚠ 3 warnings' in amber
- Height 48px, background var(--color-surface), border-top var(--color-border)"

---

### 3.2 Piano Roll Grid (editor — dark surface)

**Prompt:**
"Build the PianoRoll component on a dark editor surface (var(--color-editor-bg)):
- 8 track columns with equal width, labeled Track 1–8 in header
- Track header: 40px tall, dark surface, track number + color indicator, mute/solo icons
- Vertical time axis: time labels on left (0s, 10s, 20s...) in var(--color-editor-muted)
- Grid lines: thin horizontal lines at every 1s in var(--color-grid-line), bolder at every 10s in var(--color-grid-line-bold)
- Notes: colored circles 16px diameter, filled with note.color, white ring if selected
- Playhead: 2px horizontal line in var(--color-primary) with a small triangle indicator on left
- Snap indicator: when hovering, show ghost circle at snap position before clicking
- On note hover: show tooltip card (white bg, shadow-md, rounded-lg) with title, time, creator avatar + name"

---

### 3.3 Layer Chip / Tag

```tsx
// LayerChip.tsx
interface LayerChipProps {
  layer: keyof typeof LAYER_COLORS
  active?: boolean
  onClick?: () => void
}

// Style: pill shape (rounded-full), colored dot + label
// Active: colored bg (layer.bg), colored text (layer.primary)
// Inactive: gray bg, gray text
```

**Prompt:**
"Build a LayerChip component that is a pill-shaped tag. When active: background is the layer's bg color, text is the layer's primary color, left dot is the primary color. When inactive: gray-100 background, gray-500 text. Has a small ✕ button on the right to toggle off. Size: 12px text, 6px vertical padding, 12px horizontal padding, rounded-full."

---

### 3.4 Status Badge

```
✅ Synced          → green bg, green text, check icon
⚠  Needs Review   → amber bg, amber text, warning icon
✕  Outdated       → red bg, red text, x icon
○  Draft          → gray bg, gray text, circle icon
🔒 Locked         → blue bg, blue text, lock icon
```

**Prompt:**
"Build a StatusBadge component that accepts a status prop ('synced' | 'needsReview' | 'outdated' | 'draft' | 'locked'). Each status has a distinct icon, background color, and text color. Shape: rounded-full, 11px text, 4px vertical padding, 10px horizontal padding. Use the STATUS_COLORS map."

---

### 3.5 User Presence Avatar

**Prompt:**
"Build a PresenceAvatar component:
- Circle 32px, shows user's avatarUrl or initials (first + last initial) if no photo
- Background color generated from user's name hash (deterministic, from LAYER_COLORS primaries)
- Tooltip on hover: user name + what they are currently editing ('Editing: Chorus / Hard Mode')
- Active indicator: 8px green dot at bottom-right corner
- PresenceStack component: shows up to 5 avatars overlapping by -8px, then '+N' pill if more"

---

### 3.6 Validation Panel Item

**Prompt:**
"Build a ValidationItem component:
- Icon: ✓ (green), ⚠ (amber), or ✕ (red) based on severity
- Message in human language (14px body)
- Sub-text with location ('at Track 3, 01:12') in 12px muted text
- 'Jump to' link button on the right that calls onJumpTo(time) prop
- Hover: subtle bg highlight
- Clicking the entire row also calls onJumpTo
- Stack these in ValidationPanel with a summary header"

---

### 3.7 Note Popup (create/edit form)

**Prompt:**
"Build a NotePopup modal for creating or editing a note:
- Title (required text input)
- Description (optional textarea, 3 rows)
- Color picker: 8 circular swatches from NOTE_PRESET_COLORS, selected swatch has white ring + scale-110
- Track (1–8 number buttons in a row, selected one highlighted in primary color)
- Time (number input with 0.1 step, 0–300 range, shows formatted as '42.5s')
- Footer: [Cancel] secondary button, [Place Note] or [Save Changes] primary button
- Modal: centered, white bg, rounded-xl, shadow-lg, 400px wide
- Backdrop: rgba(26,22,53,0.6) — dark purple tint matching brand"

---

### 3.8 AI Suggestion Ghost Note

**Prompt:**
"Style AI-suggested ghost notes differently from real notes:
- Same circle position on grid
- Border: 2px dashed var(--color-primary)
- Fill: var(--color-primary) at 20% opacity
- Animated: subtle pulse (scale 0.95 → 1.05, 1.5s loop) to show it is suggested, not confirmed
- On hover: show two action buttons overlaid — [✓ Accept] in green pill, [✕ Dismiss] in gray pill
- A 'AI Suggestions' label chip appears in the toolbar when suggestions are active"

---

### 3.9 History Panel Event Row

**Prompt:**
"Build a HistoryEventRow component:
- Left: user avatar (24px)
- Center: action text in human language (14px), time ago in muted 12px
- Icon indicating event type: + for created (green), ✎ for updated (blue), − for deleted (red)
- Subtle hover highlight
- 'Undo' small link button appears on hover for the most recent event by current user
- Stack these in HistoryPanel which slides in from right, 320px wide, dark header with 'Change History' title"

---

### 3.10 Song List Card

**Prompt:**
"Build a SongCard component for the song list page:
- White card, rounded-xl, shadow-sm, hover: shadow-md with subtle lift (translateY -2px)
- Top: song name (15px semibold), version chip, status badge
- Middle: mini visual — a row of 8 colored dots representing track activity (dot size proportional to note count on that track)
- Bottom: creator avatar + name, '3 collaborators' with avatar stack, last modified timestamp
- Actions on hover: [Open Editor] primary button, [···] menu button"

---

## 4. View Mode Specifications

### Composer View (default)
- All 8 tracks visible
- Fast mode enabled
- All note properties visible on hover
- Playhead and zoom controls active
- AI suggester available
- History panel accessible

### Developer View
- Notes show ID on hover (monospace, 10px)
- Exact timestamps shown (not just rounded)
- Layer connections panel expanded
- Export status visible in right panel
- Read-only mode toggle available

### QA View
- Warning highlights active by default
- Notes within 0.5s of boundary (0–300s) marked orange
- Notes within 0.3s of each other on same track marked yellow
- Empty time ranges (gaps > 10s) marked with dashed outline
- Validation panel always open on right
- "Jump to next issue" keyboard shortcut (J key)

---

## 5. Empty States

Use these exact strings in your empty state components.

| Screen | Empty state message | CTA button |
|---|---|---|
| Song list, no songs | "No songs yet — create your first one" | + New Song |
| Editor, no notes | "Click anywhere on the grid to place your first note" | — |
| History panel, no events | "No changes yet — edits will appear here" | — |
| Validation panel, no issues | "Everything looks good ✓" | — |
| AI suggestions, < 5 notes | "Place at least 5 notes to get AI suggestions" | — |
| Left panel, no layers | "No layers connected yet" | + Connect layer |

---

## 6. Animation Specs

Keep animations subtle. This is a work tool that feels alive, not a game itself.

```css
/* Note placement — quick pop in */
@keyframes note-appear {
  from { transform: scale(0.5); opacity: 0; }
  to   { transform: scale(1);   opacity: 1; }
}
.note-circle { animation: note-appear 150ms cubic-bezier(0.34, 1.56, 0.64, 1); }

/* Note deletion — quick fade out */
@keyframes note-disappear {
  from { transform: scale(1);   opacity: 1; }
  to   { transform: scale(0.3); opacity: 0; }
}

/* AI ghost pulse */
@keyframes ghost-pulse {
  0%, 100% { transform: scale(0.95); opacity: 0.7; }
  50%       { transform: scale(1.05); opacity: 1;   }
}
.note-ghost { animation: ghost-pulse 1.5s ease-in-out infinite; }

/* Panel slide in from right */
@keyframes slide-in-right {
  from { transform: translateX(100%); opacity: 0; }
  to   { transform: translateX(0);    opacity: 1; }
}

/* Toast slide up */
@keyframes toast-up {
  from { transform: translateY(8px); opacity: 0; }
  to   { transform: translateY(0);   opacity: 1; }
}

/* Playhead movement — no animation, use CSS transform directly for performance */
.playhead { transition: transform 100ms linear; }
```

---

## 7. Tailwind Config

```javascript
// tailwind.config.js
module.exports = {
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        primary:    { DEFAULT: '#6C63FF', light: '#EEF0FF', dark: '#4B44CC' },
        midi:       { DEFAULT: '#3B82F6', bg: '#EFF6FF' },
        beatmap:    { DEFAULT: '#06B6D4', bg: '#ECFEFF' },
        gameplay:   { DEFAULT: '#8B5CF6', bg: '#F5F3FF' },
        difficulty: { DEFAULT: '#EC4899', bg: '#FDF2F8' },
        events:     { DEFAULT: '#F59E0B', bg: '#FFFBEB' },
        editor: {
          bg:      '#13111E',
          surface: '#1E1B2E',
          border:  '#2D2847',
          text:    '#E2DEFF',
        },
        app: {
          bg:      '#F8F7FF',
          surface: '#FFFFFF',
          border:  '#E8E6F0',
        }
      },
      borderRadius: {
        xl:  '16px',
        '2xl': '24px',
      },
      fontFamily: {
        sans: ['Inter', 'DM Sans', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'Fira Code', 'monospace'],
      },
      boxShadow: {
        brand: '0 4px 16px rgba(108,99,255,0.12), 0 2px 4px rgba(0,0,0,0.06)',
      }
    }
  }
}
```

---

## 8. AI Prompt Template for UI Components

Use this template when asking AI to build any component:

```
Build a [ComponentName] React component with TypeScript for AMA-MIDI, 
a music game production workspace for Amanotes.

Design identity: playful professional, music-first, light mode by default,
editor area is dark (--color-editor-bg: #13111E).

Design rules:
- Border radius: 10–16px for cards, rounded-full for pills and avatars
- Colors: use CSS variables from globals.css (--color-primary: #6C63FF)
- Typography: Inter font, 14px body, 12px metadata, 20px section titles
- Shadows: subtle brand-tinted shadows (rgba(108,99,255,0.12))
- Language: always human-friendly, never raw technical strings
- Animations: 150ms for micro-interactions, 250ms for panel transitions
- Empty states: friendly, action-oriented messages

Component spec:
[paste the specific component spec from this document]
```

---

## 9. Fonts to Install

```bash
# In apps/web/index.html
<link rel="preconnect" href="https://fonts.googleapis.com">
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500&display=swap" rel="stylesheet">
```

Or install locally:
```bash
npm install @fontsource/inter @fontsource/jetbrains-mono
```

```typescript
// main.tsx
import '@fontsource/inter/400.css'
import '@fontsource/inter/500.css'
import '@fontsource/inter/600.css'
import '@fontsource/inter/700.css'
import '@fontsource/jetbrains-mono/400.css'
```
