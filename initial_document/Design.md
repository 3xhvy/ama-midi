You are building AMA-MIDI — a real-time collaborative MIDI sequencer for a music game company called Amanotes.
This is an internal production tool used by composers, game developers, product owners, and QA engineers.

---

DESIGN IDENTITY

- Name: AMA-MIDI
- Feel: Playful professional. Music-first. Think Figma meets Ableton — clean, dark editor surface,
  light app shell, color carries meaning.
- NOT a consumer app. NOT a game. A focused work tool that feels alive without being theatrical.
- Primary brand color: #6C63FF (vibrant purple)
- Editor surface: dark (#13111E deep purple-black)
- App shell: light (#F8F7FF soft lavender-white)
- Font: Inter for UI, JetBrains Mono for timestamps and IDs
- Border radius: 10–16px for cards, rounded-full for pills and avatars
- Shadows: subtle, brand-tinted — rgba(108,99,255,0.12)
- Animations: 150ms for micro-interactions, 250ms for panel transitions. Subtle only.

---

COLOR TOKENS (use as CSS variables)

--color-primary: #6C63FF
--color-primary-light: #EEF0FF
--color-primary-dark: #4B44CC
--color-bg: #F8F7FF
--color-surface: #FFFFFF
--color-border: #E8E6F0
--color-text-primary: #1A1635
--color-text-secondary: #6B6585
--color-text-tertiary: #A09BB5
--color-editor-bg: #13111E
--color-editor-surface: #1E1B2E
--color-editor-border: #2D2847
--color-editor-text: #E2DEFF
--color-editor-muted: #6B6585
--color-grid-line: rgba(255,255,255,0.06)
--color-grid-line-bold: rgba(255,255,255,0.12)
--color-success: #10B981
--color-warning: #F59E0B
--color-error: #EF4444

Layer colors (each track type has a persistent color identity):
- MIDI: #3B82F6 (blue)
- Beat Map: #06B6D4 (cyan)
- Gameplay: #8B5CF6 (purple)
- Difficulty: #EC4899 (pink)
- Events: #F59E0B (amber)

Note preset colors (user picks from these 8):
#6C63FF #3B82F6 #10B981 #F59E0B #EF4444 #EC4899 #06B6D4 #8B5CF6

---

LANGUAGE RULES

Always use human-friendly language. Never surface raw technical strings.
- "This position was just taken — try a nearby spot" (not "409 Conflict")
- "Connection lost — reconnecting..." (not "WebSocket disconnected")
- "No notes yet — click the grid to place your first note" (not "No data found")
- "Everything looks good ✓" (not "0 errors")
- "You're placing notes too fast — slow down a little" (not "Rate limit exceeded")
- "We couldn't find that song" (not "404")

---

PAGE 1: SONG LIST PAGE (/songs)

Layout: Light surface. Centered content max-width 1100px.

Header:
- Top left: AMA-MIDI logo (purple) + wordmark
- Top right: user avatar with dropdown (Profile, Sign out), notification bell
- Below header: page title "Your Songs" + "+ New Song" primary button (rounded-full, purple)

Song Grid:
- Responsive grid of SongCards (2–3 columns depending on viewport)
- Each SongCard:
  - White card, rounded-xl, shadow-sm
  - Hover: shadow-md, translateY -2px lift
  - TOP SECTION: Song name (15px semibold, #1A1635) + version chip ("v4", gray pill) + status badge
  - MIDDLE: Mini visual — 8 small dots in a row representing the 8 tracks. Dot diameter proportional
    to note count on that track (min 4px, max 16px). Each dot uses the note preset color most common
    on that track. This gives a visual fingerprint of the song's density.
  - BOTTOM: Creator avatar (24px circle) + name, collaborator avatar stack (+N if >3),
    "last modified X ago" in muted 12px text
  - On hover: [Open Editor] primary button appears, [···] menu button appears top-right

Status badges (pill shape, colored bg + text):
- Synced: green bg, green text, ✓ icon
- Needs Review: amber bg, amber text, ⚠ icon
- Draft: gray bg, gray text, ○ icon
- Outdated: red bg, red text, ✕ icon

Empty state (no songs): Centered illustration area, "No songs yet — create your first one",
"+ New Song" button. Friendly, not sad.

---

PAGE 2: MIDI EDITOR PAGE (/songs/:id)

This is the main product. Full viewport. No scrolling on the outer shell — only the timeline scrolls.

LAYOUT (5 zones):

┌─────────────────────────────────────────────────────┐
│ TOPBAR (64px, light surface, border-bottom)          │
├──────────────┬──────────────────────────┬────────────┤
│ LEFT PANEL   │ PIANO ROLL (EDITOR)      │ RIGHT PANEL│
│ (240px)      │ (flex 1, dark surface)   │ (280px)    │
│              │                          │            │
│              │                          │            │
├──────────────┴──────────────────────────┴────────────┤
│ BOTTOMBAR (48px, light surface, border-top)          │
└─────────────────────────────────────────────────────┘

TOPBAR:
- Left: Song name (inline-editable on click, shows pencil icon on hover) + version chip
- Center: [▶ Preview] primary button, [✓ Save] secondary, [↑ Export] secondary — all rounded-full
- Right:
  - Presence avatars: overlapping circles (32px, -8px gap), up to 5 visible, "+N" pill if more.
    Each avatar has a green active dot (8px) bottom-right. Tooltip on hover: name + "editing Chorus"
  - View mode chips: [Composer] [Developer] [QA] — toggle group, selected chip has purple bg
  - [? Help] icon button

LEFT PANEL (240px, light surface, border-right):
- "Layers" section header + [+ Add] small icon button
- Layer list rows: checkbox toggle | colored dot (layer color) | layer name | status badge
  Rows are draggable to reorder
- Separator
- "Connected Files" section: file chips with health status icon (✓ green, ⚠ amber, ✕ red)
- Separator
- Active users list: avatar + name + current activity ("editing Chorus / Hard Mode") in muted text

PIANO ROLL (dark editor surface #13111E):
- Fixed column header row (40px): 8 equal columns labeled "Track 1" through "Track 8"
  Each header: dark surface, track number, colored dot (layer color), mute icon, solo icon
- Scrollable timeline below (0s at top → 300s at bottom)
- Left edge: time labels (0s, 10s, 20s...) in muted text (#6B6585)
- Grid lines: thin horizontal lines every 1s at rgba(255,255,255,0.06)
              bolder lines every 10s at rgba(255,255,255,0.12)
- Notes: 16px diameter filled circles at precise (track, time) coordinates
  - Color = note.color from preset palette
  - Selected: white 2px ring around the circle
  - On hover: tooltip card (white bg, shadow-md, rounded-lg) shows title, time, creator avatar + name
  - On click: selects note (shows ring, populates right panel details)
- Playhead: 2px horizontal line in #6C63FF with small triangle indicator on left edge
- Snap indicator: when hovering grid, ghost circle at snap position before clicking
- Interaction modes:
  - FAST MODE (default): click anywhere on grid → note appears instantly (optimistic),
    POST to API in background. If 409 conflict: note disappears, toast shown.
    Press E while note selected → edit popup. Press Delete/Backspace → delete note.
  - POPUP MODE (toggle in toolbar): click grid → NotePopup modal opens with pre-filled track+time.
- AI ghost notes (when suggestions are active):
  - Same position as regular notes but: 20% opacity fill, 2px dashed border, pulse animation (scale 0.95→1.05, 1.5s loop)
  - On hover: [✓ Accept] green pill + [✕ Dismiss] gray pill appear
- Virtualization: only notes in the visible scroll viewport are rendered as DOM elements (<100 nodes at any time)

RIGHT PANEL (280px, light surface, border-left, collapsible):
Three tabs: Details | Comments | Validation

Details tab (shown when note selected):
- Note color swatch (24px circle) + title (editable)
- Track number + time display
- Description textarea
- Creator avatar + name + "created X ago"
- [Edit] and [Delete] action buttons

Comments tab:
- Threaded comments list: avatar + name + timestamp + message + [Reply] button
- "Add comment" input at bottom

Validation tab:
- Summary row: "✓ X passed / ⚠ Y warnings / ✕ Z errors"
- List of issues — each row: severity icon | human-language description | "at Track 3, 01:12" muted | [Jump to] link
- Clicking any row scrolls the timeline to that position and selects the note

HISTORY PANEL (slides in from right, 320px, overlays right panel):
- Triggered by history icon in topbar
- Dark header: "Change History" + [✕ close]
- List of events newest first:
  - User avatar (24px) + action in human language + "2 minutes ago"
  - Event type icon: + green (created), ✎ blue (updated), − red (deleted)
  - Hover: "Undo" small link appears on most recent event by current user
- [Undo] button at top applies compensating event

BOTTOMBAR (48px):
- Left: Playhead time "MM:SS.s / 05:00" in JetBrains Mono
- Center: Scrubber progress bar showing current position (clickable)
- Right: Zoom toggle group [1x] [2x] [4x] + validation badge "⚠ 3 warnings" in amber pill

NOTE POPUP MODAL (create / edit):
- Centered, 400px wide, white bg, rounded-xl, shadow-lg
- Backdrop: rgba(26,22,53,0.6) dark purple tint
- Fields:
  - Title (required text input)
  - Description (optional textarea, 3 rows)
  - Color picker: 8 circular swatches from preset palette, selected = white ring + scale-110
  - Track: 8 number buttons in a row (1–8), selected = purple bg
  - Time: number input (0–300, step 0.1), shown as "42.5s"
- Footer: [Cancel] secondary | [Place Note] or [Save Changes] primary — both rounded-full

---

PAGE 3: LOGIN PAGE (/login)

Centered card on #F8F7FF background.
- AMA-MIDI logo + "Sign in to your workspace"
- [Continue with Google] button: white bg, Google icon, border, rounded-full, full width
- Muted footer: "For Amanotes team members only"
No email/password fields. SSO only.

---

VIEW MODES (same data, different lens)

COMPOSER VIEW (default):
- All 8 tracks editable
- Fast mode enabled
- Full note detail on hover
- AI suggester button visible
- History panel accessible

DEVELOPER VIEW:
- Notes show ID on hover (JetBrains Mono, 10px, muted)
- Exact timestamps shown (not rounded)
- Layer connections panel expanded in left panel
- Read-only toggle available in toolbar

QA VIEW:
- Notes within 0.5s of boundaries (0s or 300s) highlighted orange
- Notes within 0.3s of each other on same track highlighted yellow
- Empty gaps > 10s outlined with dashed border
- Validation panel always open on right
- "Jump to next issue" with J key
- Warning count badge always visible in topbar

---

ANIMATIONS

note-appear: scale 0.5→1 + opacity 0→1, 150ms, cubic-bezier(0.34, 1.56, 0.64, 1) [spring bounce]
note-disappear: scale 1→0.3 + opacity 1→0, 150ms ease-out
ghost-pulse: scale 0.95→1.05, opacity 0.7→1, 1.5s ease-in-out infinite
slide-in-right: translateX(100%)→0 + opacity 0→1, 250ms ease
toast-up: translateY(8px)→0 + opacity 0→1, 200ms ease
Playhead: transform directly (no animation), smooth via CSS transition 100ms linear

---

EMPTY STATES

| Screen | Message | CTA |
|---|---|---|
| Song list, no songs | "No songs yet — create your first one" | + New Song |
| Editor, 0 notes | "Click anywhere on the grid to place your first note" | — |
| History panel, no events | "No changes yet — edits will appear here" | — |
| Validation, no issues | "Everything looks good ✓" | — |
| AI suggestions, <5 notes | "Place at least 5 notes to get AI suggestions" | — |

---

TOAST NOTIFICATIONS (bottom-right, slide up, auto-dismiss 4s)

- Conflict: "This position was just taken — try a nearby spot" [amber]
- WebSocket disconnected: "Connection lost — reconnecting..." [gray, persistent]
- Reconnected: "Back online — syncing changes" [green]
- Rate limited: "You're placing notes too fast — slow down a little" [amber]
- Undo success: "Change undone" [gray]
- Note deleted by collaborator: "Minh removed a note at Track 3, 42.5s" [gray, optional]

---

KEYBOARD SHORTCUTS

E          → Open edit popup for selected note
Delete / Backspace → Delete selected note
Cmd/Ctrl+Z → Undo last action
J          → Jump to next validation issue (QA view)
Escape     → Close any open modal or panel
1 / 2 / 4  → Switch zoom level
Tab        → Switch between right panel tabs
