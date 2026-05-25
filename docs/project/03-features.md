# Feature Hierarchy

← [README](../../README.md) · [← Actors & Use Cases](./02-actors-and-use-cases.md) · [Design Thinking →](./04-design-thinking.md)

---

Features are organized by priority tier and delivery phase. Each tier reflects a deliberate scope decision — what ships first, what completes the collaboration story, and what transforms AMA-MIDI from a generic note editor into a production workspace for rhythm-game teams.

Source plans: [`2026-05-22-master-implementation-plan.md`](../superpowers/plans/2026-05-22-master-implementation-plan.md), Phase 2–3 specs in [`docs/superpowers/specs/`](../superpowers/specs/), post-MVP design specs dated 2026-05-23/24, and [`2026-05-25-tap-to-rhythm-design.md`](../superpowers/specs/2026-05-25-tap-to-rhythm-design.md).

---

## Conflict Resolution (Cross-Cutting)

AMA-MIDI never merges two notes into one slot — the DB constraint rejects duplicates atomically. What varies is **how the user resolves** a conflict when their intent collides with existing data.

| Layer | Trigger | UX |
|---|---|---|
| **Instant rejection** | Real-time note create hits an occupied slot (409) | Ghost removed + toast: *"This position was just taken — try a nearby spot"* |
| **Resolve conflicts (batch)** | Pattern paste, Copy/Move to, Repeat/Stamp, undo restore, tap session apply, or AI chart merge hits occupied slots | Full-screen `ConflictReviewModal` — git-style, one conflict at a time. Per slot: **Keep Existing** or **Replace With Incoming**. Apply blocked until all resolved. |
| **Live negotiation (future)** | Two composers competing for the same slot during active editing | Side-by-side comparison + suggested nearby positions. Beyond toast-only rejection. |

The batch resolver is shared infrastructure: preview API classifies slots as `creatable` vs `conflicts`, the modal collects per-slot resolutions, apply re-validates (409 if a collaborator moved a note mid-review). Same component, same keyboard shortcuts (K / R), same diff cards — regardless of whether incoming notes came from a saved pattern, a selection copy, a repeat stamp, an undo, or an AI-generated chart.

*Spec:* [`2026-05-23-paste-conflict-ui-design.md`](../superpowers/specs/2026-05-23-paste-conflict-ui-design.md), [`2026-05-24-ai-chart-context-design.md`](../superpowers/specs/2026-05-24-ai-chart-context-design.md)

---

## P0 — Foundation (Core Editor Works)

Without these, the product does not exist. Everything else builds on this layer.

| Feature | Why This Tier |
|---|---|
| **Google OAuth + JWT auth** | No anonymous edits on shared data. SSO means IT controls access. |
| **Song CRUD** | Container for everything. No songs = nothing to edit. |
| **Piano roll grid** | 8 tracks × 0–300s vertical timeline. The product's visual identity. |
| **Note CRUD** | Create, read, update, delete. The core action loop. |
| **Fast Mode (default create)** | Click grid → note appears instantly. Composers stay in flow state. |
| **Popup Mode (metadata create/edit)** | Full title, description, color, track, time when precision matters. |
| **DB-level duplicate prevention** | `UNIQUE (song_id, track, time) WHERE deleted_at IS NULL` — atomic, race-safe. Not application-level. |
| **Optimistic UI** | Ghost note on click, rollback on 409. Without this the editor feels laggy. |
| **Conflict toast** | Human-readable message when position is taken. Integrity visible to the user. |
| **Role-based access control** | Admin / Composer / Viewer enforced at API guards and UI level. |
| **Editor engine layer** | Pure TypeScript coordinate math (`xToTrack`, `yToTime`, viewport windows). Testable, zoom-safe. |
| **5-zone app shell** | TopBar, LeftPanel, Timeline, RightPanel, BottomBar. Stable layout before features land. |

---

## P1 — Collaboration & Integrity (Multi-User Is Complete)

P0 makes a solo editor. P1 makes a shared workspace where multiple people can trust the data.

| Feature | Why This Tier |
|---|---|
| **Real-time note sync** | WebSocket broadcast via Socket.io + Redis adapter. Multi-user without this is a shared spreadsheet. |
| **User presence (session avatars)** | Who is in the same song right now. Collaboration feels real, not invisible. |
| **Change history (ledger)** | Event-sourced `note_events` table. Every mutation with before/after state. |
| **Undo via compensating event** | Revert last action without mutating history — append a compensating event. |
| **Snap-to-grid (0.1s resolution)** | Prevents perceptually-identical-but-different positions. |
| **Viewport zoom (1x / 2x / 4x)** | Essential for detailed editing in a 300-second timeline. |
| **10,000-note rendering** | DOM virtualization via `@tanstack/virtual`. ~80 active DOM nodes regardless of total count. |
| **Chunked API fetch** | Load only the visible time window; prefetch adjacent. Server-side complement to virtualization. |
| **Rate limiting** | 30 note creates per minute per user. Protects data from scripting errors, not just abuse. |
| **CSRF + security hardening** | Helmet, throttling, validation pipe. Required for cookie-based auth in enterprise context. |
| **Role-based view modes** | Composer / Developer / QA lenses on the same data. One product, four presentations. |
| **VIEWER read-only mode** | Reviewers see everything; mutation controls hidden. |
| **Validation rule engine** | Backend `ValidationModule` with boundary, gap, density, empty-track rules. QA view consumes it. |
| **Song version snapshots** | Named point-in-time saves with restore. Review checkpoints without git-style branching. |
| **Test suite + concurrent conflict test** | Duplicate-position race verified with `Promise.all`, not sequential. |

---

## Phase 2 — Identity, Cursors & Onboarding

Turn anonymous avatars into a team. Guide new users without blocking composers.

| Feature | Why This Phase |
|---|---|
| **Profile setup flow** | Title + department on first login. Presence becomes meaningful ("Sound Designer", not "User 3"). |
| **Google avatar sync** | Consistent avatar on every login. |
| **Live cursor presence on grid** | Figma-style labeled dots at ~30fps. See where collaborators are working. |
| **Routed first-login onboarding** | Welcome → Features → Notes → Profile → Ready. Dedicated pages, not modal overload. |
| **Take a Tour (product walkthrough)** | Cross-route guided journey: Project → Song → Collaboration → Editor tools. Re-launchable from app chrome. |
| **Login page redesign** | Product-first entry point before the dashboard. |

*Spec:* [`2026-05-22-phase2-user-identity-cursors-onboarding.md`](../superpowers/specs/2026-05-22-phase2-user-identity-cursors-onboarding.md), [`2026-05-24-onboarding-design.md`](../superpowers/specs/2026-05-24-onboarding-design.md)

---

## Phase 3 — Rhythm Game Editor

Transform AMA-MIDI from a generic sequencer into a purpose-built rhythm-game level editor. Three waves, each independently mergeable.

### Wave 1 — Foundation

| Feature | Why This Wave |
|---|---|
| **BPM + time signature** | Per-song tempo. Beat grid overlays second grid. Bar.beat labels on time axis. |
| **Beat / half-beat snap modes** | Snap mode switch: `0.1s` \| `beat` \| `halfBeat`. Musical placement, not just temporal. |
| **Note types: TAP / HOLD / SWIPE** | Gameplay semantics on every note. HOLD = drag-to-duration; SWIPE = directional marker. |
| **Beat grid rendering** | Measure lines bold, beat lines subtle. Computed in engine, not hardcoded in React. |

### Wave 2 — Composition Tools

| Feature | Why This Wave |
|---|---|
| **Multi-select** | Shift+click, Cmd+A. Bulk operations on note groups. |
| **Pattern library** | Save selection as reusable pattern. Paste at playhead. Per-user + per-song scope. |
| **Tap to rhythm** | Real-time loop recording via home-row keys (`A S D F · J K L ;`). Setup modal for loop range; draft → apply to chart or save as pattern. Uses shared conflict resolver. |
| **Section markers** | Intro / Verse / Chorus labels on timeline. Real-time sync via `section.*` WebSocket events. |
| **Section jump list** | Navigate structure without scrolling. Live context strip shows current section. |
| **Resolve conflicts (pattern paste)** | First consumer of `ConflictReviewModal`. Preview → step through conflicts → apply only when all slots resolved. |
| **Resolve conflicts (tap apply)** | Tap session end → `buildTapPlacementPreview` → same modal when draft notes collide with chart. |

*Detail:* [F07 — Tap to Rhythm](./features/F07-tap-to-rhythm.md)

### Wave 3 — Game-feel

| Feature | Why This Wave |
|---|---|
| **Game Preview mode** | Visual-only playhead traversal. No keyboard input, no scoring — communicates timing in demos. |
| **Difficulty heatmap overlay** | NPS bands color-coded green / yellow / red. Toggle on toolbar. |
| **Combo + difficulty stats** | Max combo streak and Easy/Normal/Hard/Expert rating in footer. Client-computed. |

*Spec:* [`2026-05-22-phase3-music-game-features-design.md`](../superpowers/specs/2026-05-22-phase3-music-game-features-design.md), [`2026-05-23-paste-conflict-ui-design.md`](../superpowers/specs/2026-05-23-paste-conflict-ui-design.md), [`2026-05-25-tap-to-rhythm-design.md`](../superpowers/specs/2026-05-25-tap-to-rhythm-design.md)

---

## Phase 4 — Production Workspace

The project layer wraps songs in game-company production workflow. Composers reach the editor in ≤2 clicks; producers see health at a glance.

| Feature | Why This Phase |
|---|---|
| **Projects as production workspaces** | Songs belong to exactly one project. Members, assignment, and workflow live here. |
| **Project membership + song scope** | Permission + scope chosen when adding a member. `All songs now and future` is dynamic. |
| **Song status workflow** | Draft → In Review → Approved → Published (+ Needs Fix). Producer and QA gates. |
| **Dashboard** | Recent songs, assigned work, "Needs My Review" shortcuts. Urgent work surfaces first. |
| **Project directory + workspace** | Directory → project overview → song table → editor. Dense, table-first management UI. |
| **Create Song wizard** | Blank / template / import starts. Quick-create shortcut for composers who want zero friction. |
| **Project workspace tabs** | Songs, Members, Settings within a project. Operational context without entering the editor. |
| **Centralized enum system** | Single `enums.ts` for status, category, difficulty, note type. One source for badges, filters, colors. |
| **Multi-chart songs** | `SongChart` model — one song, multiple difficulty/speed variants. Notes scoped to `chartId`. |

*Spec:* [`2026-05-23-project-song-management-full-flow-design.md`](../superpowers/specs/2026-05-23-project-song-management-full-flow-design.md), [`2026-05-23-management-flow-ui-refactor-design.md`](../superpowers/specs/2026-05-23-management-flow-ui-refactor-design.md)

---

## Phase 5 — Composition Productivity

Power tools for composers who repeat motifs, relocate sections, and undo batch operations as single actions.

| Feature | Why This Phase |
|---|---|
| **Editor commands + multi-level undo** | One user action = one undo unit. Paste, copy, repeat each write one `editor_commands` row. Undo restore opens resolve-conflicts flow when slots changed since delete. |
| **Copy to / Move to** | Duplicate or relocate multi-selection by time shift, track shift, or anchor. |
| **Resolve conflicts (copy / move / repeat)** | Copy to, Move to, and Repeat/Stamp all preview placements first; occupied slots route through the same `ConflictReviewModal`. |
| **Repeat / Stamp notes** | N copies at fixed interval (1 beat, 1 measure, selection length). Deterministic, not AI. |
| **Tap session → pattern** | End tap recording with **Save as pattern**; paste later from Patterns panel at any playhead. |
| **HOLD default-create UX** | Drag-down to set duration in fast mode. Reduces TAP/HOLD mode switching. |
| **Editor focus improvements** | Track identity, selection clarity, calmer grid, sidebar hierarchy. Less visual noise during composition. |
| **Backing track + chart audio playback** | Reference audio URL per song. Playhead-synced note synth for hearing the chart against music. |

*Spec:* [`2026-05-24-editor-commands-undo-stack.md`](../superpowers/specs/2026-05-24-editor-commands-undo-stack.md), [`2026-05-24-note-copy-to-design.md`](../superpowers/specs/2026-05-24-note-copy-to-design.md), [`2026-05-24-repeat-stamp-design.md`](../superpowers/specs/2026-05-24-repeat-stamp-design.md)

---

## Phase 6 — AI & Difficulty Analysis

AI assists composition; analysis quantifies difficulty for level designers and QA.

| Feature | Why This Phase |
|---|---|
| **AI note suggester (ghost overlay)** | 3–5 suggested next notes. Accept/dismiss per suggestion. Original MVP AI feature. |
| **AI Assistant modal** | Unified entry: Generate chart, Scale difficulty, Fill track, Improve pattern. Wizard-style picker + SSE progress tree. |
| **Generate chart** | Full chart from natural-language description. Preview bar before apply. Merge mode opens resolve-conflicts when AI notes land on occupied slots. |
| **Scale difficulty** | Easier/harder replacement chart with tier target. Preview before replace. |
| **Improve pattern (Extend / Refine)** | Multi-select deep-link. Extend continues motif; Refine adjusts selected notes in place. |
| **Global chart context for AI** | Sections, density segments, chart totals sent to model — not just a narrow playhead window. |
| **Difficulty analysis engine** | Shared `analyzeChart()` in `packages/shared`. Multi-factor scoring, tier derivation, segment warnings. |
| **Analysis Board** | Dedicated page for level designers. Per-chart breakdown, publish gate on ERROR severity. |
| **Live editor analysis panel** | Debounced client compute + server persistence on note mutation. |

*Spec:* [`2026-05-24-ai-assistant-modal-design.md`](../superpowers/specs/2026-05-24-ai-assistant-modal-design.md), [`2026-05-24-ai-chart-context-design.md`](../superpowers/specs/2026-05-24-ai-chart-context-design.md), [`2026-05-24-difficulty-analysis-design.md`](../superpowers/specs/2026-05-24-difficulty-analysis-design.md)

---

## Phase 7 — Collaboration Polish

Make multi-user sessions feel intentional, not accidental.

| Feature | Why This Phase |
|---|---|
| **Session presence center** | Centered toolbar presence menu with name, title, department dropdown. Transport moves to footer. |
| **Collaborator activity batching** | Group rapid note events into readable activity notices instead of flooding the UI. |
| **Realtime cursor fix** | Correct overlay positioning outside virtualized note list. Cursors track scroll/zoom accurately. |
| **Resolve conflicts (live create)** | Rich real-time negotiation when two composers hit the same slot: side-by-side diff + suggested nearby positions. Extends the instant-rejection layer, not the batch modal. |

*Spec:* [`2026-05-24-session-presence-center-design.md`](../superpowers/specs/2026-05-24-session-presence-center-design.md), [`2026-05-24-collaborator-activity-batching-design.md`](../superpowers/specs/2026-05-24-collaborator-activity-batching-design.md)

---

## P2 — Deferred (Real Value, Not Yet Prioritized)

These were identified early as valuable but deliberately cut from the initial build window. Each has a clear implementation path.

| Feature | Why Deferred |
|---|---|
| **Timeline comments** | Review comments pinned to (time, track). Real workflow need; adds non-trivial data model. |
| **Approval workflow (formal)** | Composer submits → Product Owner approves with audit trail. Partially addressed by song status in Phase 4. |
| **Export to game engine format** | JSON manifest for Unity/game engine import. Closes the production loop; next step after analysis board. |
| **MIDI file import/export** | Binary format parsing. Correct feature after chart export stabilizes. |
| **Mobile editing** | Complex touch interaction on a grid tool. Desktop-first is the right call for composers. |
| **Waveform rendering** | Requires audio analysis pipeline beyond reference-track playback. |

---

## Explicitly Out of Scope

Documented as deliberate non-decisions, not forgotten features:

- **Git-style branching** — wrong mental model for live collaborative editing. Everyone is always on `main`. See [Design Thinking](./04-design-thinking.md#event-sourcing-vs-git-branching).
- **Multi-tenancy** — single Amanotes organization implied. No tenant isolation layer.
- **Cross-project song sharing** — reuse via import/copy into a new project-owned song, not shared ownership.
- **Scoring / gameplay simulation in preview** — Game Preview is visual-only. No hit detection, no score calculation.
- **Keyboard-input playtesting** — players don't play charts inside the editor. Tap to rhythm records composer input for chart authoring; it is not gameplay simulation or scoring.
- **LLM-driven repeat/stamp** — repeat is deterministic interval math, not generative AI.

---

## Delivery Map (Quick Reference)

| Phase | Primary audience | Blocks without it |
|---|---|---|
| P0 | Composer (solo) | Nothing works |
| P1 | All four actors (shared session) | Collaboration is incomplete |
| Phase 2 | New team members | Anonymous, unguided experience |
| Phase 3 | Composer + Level Designer | Generic sequencer, not a game editor |
| Phase 4 | Producer + Admin | No production workflow |
| Phase 5 | Composer (power user) | Slow repetitive charting; batch ops have no resolve-conflicts path |
| Phase 6 | Composer + QA + Level Designer | No AI assist, no difficulty quantification |
| Phase 7 | All collaborators | Presence feels passive; live create conflicts stay toast-only |

---

*→ Next: [Design Thinking](./04-design-thinking.md)*
