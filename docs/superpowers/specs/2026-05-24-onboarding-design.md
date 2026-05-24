# Onboarding & Product Tour — Design Spec

**Date:** 2026-05-24  
**Status:** Approved (updated — routed first-login onboarding + unified Take a Tour journey)

---

## Goal

New users (first Google login) see a dedicated, routed onboarding journey:
1. **Welcome page** — core product promise with a 3D musical timeline visual
2. **Feature highlight page** — editor, collaboration, validation, AI, and analysis value
3. **Notes page** — tap notes, hold notes, tracks, and density explained visually
4. **Profile completion page** — name, title, department
5. **You are set up page** — asks whether to start **Take a Tour** or go to dashboard

**Take a Tour** remains one guided journey through the full product:

```
Project → Song → User (collaboration) → Editor (tracks, tools, validation, AI, difficulty, …)
```

First-login onboarding handles the five-page setup journey. **Take a Tour** is the single product walkthrough — launched from the final setup page or re-launchable from the app chrome.

---

## Two Experiences

| Experience | When | What |
|---|---|---|
| **Routed onboarding** | `!profileComplete` | Welcome → Features → Notes → Profile → Ready |
| **Take a Tour** | User clicks "Take a tour" after setup, or later from app chrome | Full product tour |

`OnboardingGate` redirects incomplete users into `/onboarding/welcome`. It does **not** run a separate dashboard mini-tour.

---

## Architecture

```
App.tsx
  └── <OnboardingGate>              redirects !profileComplete users into onboarding
  └── /onboarding/:step             routed first-login onboarding pages
  └── <ProductTourOrchestrator>     cross-route tour state + TourOverlay
        └── reads tourContext       first project/song from dashboard API
        └── navigates between routes before each step
        └── calls prepare()         open panels, switch tabs
```

**Trigger conditions:**

| `profileComplete` | `tourComplete` | Result |
|---|---|---|
| false | any | Redirect to `/onboarding/welcome` |
| true | false | Show `/onboarding/ready` once, asking whether to take the tour |
| true | true | Nothing — user fully onboarded; "Take a tour" still available from menu |

**Persistence:**

| Milestone | Storage |
|---|---|
| Profile complete | DB `profileComplete` |
| Product tour complete | DB `tourComplete` + localStorage `ama-product-tour-seen` |
| Re-launch tour | Clears only session flag; DB `tourComplete` unchanged (optional reset not in v1) |

---

## User Flow

```
OAuth callback → GET /auth/me → navigate('/')

if !profileComplete:
  /onboarding/welcome
    → /onboarding/features
    → /onboarding/notes
    → /onboarding/profile
    → PATCH profileComplete
    → /onboarding/ready

On /onboarding/ready:
  Primary CTA: ProductTourOrchestrator.start({ force: true })
  Secondary CTA: navigate('/')

User clicks "Take a tour" anytime:
  ProductTourOrchestrator.start({ force: true })
```

---

## Routed First-login Onboarding

Routes:

| Route | Page | CTA |
|---|---|---|
| `/onboarding/welcome` | Welcome to AMA-MIDI | Continue |
| `/onboarding/features` | Feature highlights | Continue |
| `/onboarding/notes` | Notes and tracks | Continue |
| `/onboarding/profile` | Complete your profile | Save & continue |
| `/onboarding/ready` | You are set up | Take a tour / Go to dashboard |

The onboarding shell is full-screen and page-like, not a modal. It uses a left content rail, a right 3D canvas visual, progress dots, and Back/Continue navigation. The route is the source of truth for the current step so refresh and browser back work naturally.

### 3D Visualization

Use a lightweight local `<canvas>` renderer rather than adding Three.js in v1. The login page already uses a custom animated canvas, and the onboarding visuals can reuse that pattern without increasing bundle size.

Visual scenes:

| Page | 3D visual |
|---|---|
| Welcome | Perspective timeline with floating note blocks and playhead |
| Features | Orbiting feature nodes around a central AMA-MIDI mark |
| Notes | Eight-lane note grid with tap notes, hold trails, and density glow |
| Profile | Calm identity card / team presence constellation |
| Ready | Launch tunnel from setup into product tour |

The canvas is decorative and `aria-hidden`; all required information is present in text. Respect `prefers-reduced-motion` by rendering a static frame.

---

## Take a Tour — Phases & Steps

Orchestrator resolves **tour context** before starting:
- `projectId` — first active project from dashboard or `/projects`
- `songId` — first recent song in that project, or first song in project list
- If no project/song exists, phases 1–8 use centered fallback copy; phase 4 (editor) waits until user has a song or tour ends early with "Create a project first" CTA

### Phase 1 — Project (4 steps)

| # | target | page | message |
|---|---|---|---|
| 1 | `nav-projects` | `/` or any | **Projects** — every song belongs to a project. Open Projects to browse workspaces. |
| 2 | `my-projects` | `/` | **Dashboard projects** — your active projects appear here. Pick one to see its songs. |
| 3 | `projects-header` | `/projects` | **Project directory** — search, filter, and create production workspaces. |
| 4 | `project-card` | `/projects` | **Open a project** — each card is a workspace with songs, members, and settings. |

### Phase 2 — Song (3 steps)

| # | target | page | message |
|---|---|---|---|
| 5 | `project-header` | `/projects/:id` | **Project home** — song count, status, and quick actions for this workspace. |
| 6 | `song-table-row` | `/projects/:id` | **Song list** — each row is a chartable song. Click to open the piano roll editor. |
| 7 | `quick-create-song` | `/projects/:id` | **Quick Create** — spin up an untitled song instantly, or use **New Song** for the full wizard. |

### Phase 3 — User / collaboration (2 steps)

| # | target | page | prepare |
|---|---|---|---|
| 8 | `project-members-tab` | `/projects/:id` | Switch to Members tab |
| 9 | `session-presence` | editor | Navigate to song; highlight live session avatars |

| 8 message | Invite composers and QA with permissions and song scope. Control who can edit which charts. |
| 9 message | See who is in the song right now. Cursors and edits sync live across the team. |

### Phase 4 — Editor (13 steps)

| # | target | prepare | message |
|---|---|---|---|
| 10 | `piano-roll` | Left + right panels open | **Piano roll** — 8 tracks × 300 seconds. Click to place notes; drag for holds. |
| 11 | `track-list` | Left panel open | **Tracks** — eight lanes, each with a fixed color (T1–T8). Mute a track to focus. Activity bars show note density. |
| 12 | `transport-bar` | — | **Transport** — play, pause, scrub. Click the BPM badge to change tempo. |
| 13 | `chart-difficulty` | — | **Charts & difficulty** — one song can have multiple charts. Badge shows computed tier (Easy → Master) and speed multiplier. |
| 14 | `song-difficulty-stats` | Left panel, scroll to Song Stats | **Live difficulty** — Notes, combo, peak NPS, and tier update as you compose. |
| 15 | `tools-tab` | Right panel → tools tab | **Tools panel** — zoom, snap, create mode, view modes, and selection tools. |
| 16 | `zoom` | tools tab | **Zoom** — 1× to 8× timeline magnification for detail work. |
| 17 | `fast-mode` | tools tab | **Create mode** — Fast places notes on click; Popup opens the full note editor. |
| 18 | `view-mode` | tools tab | **View modes** — Composer, Dev, QA, and Preview for different workflows. |
| 19 | `validation-tab` | Right panel → validation tab | **Validation** — errors and warnings (density spikes, speed mismatch, QA rules). Click an issue to jump to it. |
| 20 | `history-tab` | Right panel → history tab | **History** — every edit is logged. Undo any action; changes sync to collaborators. |
| 21 | `ai-suggest` | Close AI modal if open | **AI Assistant** — Generate chart, Scale difficulty, Fill track, or Improve pattern on a selection. |
| 22 | `difficulty-heatmap` | tools tab | **Difficulty heatmap** — color overlay on the grid showing hard sections at a glance. |
| 23 | `shortcut-help` | — | **Shortcuts** — press **?** anytime for the full keyboard reference. |

**Total: 23 steps** (phase labels shown in tooltip subtitle: "Project · 2/4", etc.)

---

## TourStep Schema (extend)

```ts
export interface TourStep {
  target:   string
  message:  string
  phase?:   'project' | 'song' | 'user' | 'editor'
  side?:    'top' | 'bottom' | 'left' | 'right'
  route?:   string | ((ctx: TourContext) => string)  // navigate before step
  prepare?: (ctx: TourContext) => void | Promise<void> // tabs, panels, scroll
}

interface TourContext {
  projectId?: string
  songId?: string
  navigate: (path: string) => void
  editorStore: EditorStoreApi  // setLeftCollapsed, setRightPanelTab, etc.
}
```

`TourOverlay` waits for `prepare` + route navigation + 300ms layout settle before resolving `[data-tour]` rect.

---

## Components

### `OnboardingGate`
- Redirects authenticated users with `!profileComplete` to `/onboarding/welcome`
- Lets onboarding routes render without redirect loops
- Allows completed users to replay onboarding from the account menu

### `OnboardingFlowPage`
**File:** `features/onboarding/OnboardingFlowPage.tsx`

- Reads `:step` from the route
- Renders step copy, progress, Back/Continue controls, and profile form
- On profile save: `PATCH /users/me { name, title, department, profileComplete: true }`, updates auth store, navigates to `/onboarding/ready`
- On ready page: **Take a tour** calls `requestProductTour({ force: true })` then navigates to `/`; **Go to dashboard** navigates to `/`

### `OnboardingVisualCanvas`
**File:** `features/onboarding/OnboardingVisualCanvas.tsx`

- Lightweight animated canvas for the five onboarding scenes
- Decorative only, with reduced-motion static rendering
- No external 3D dependency in v1

### `ProductTourOrchestrator` (new)
**File:** `features/onboarding/ProductTourOrchestrator.tsx`

- Fetches tour context (`useDashboard` or cached recent navigation)
- Owns `TourOverlay` with full `PRODUCT_TOUR_STEPS`
- On complete: `PATCH /users/me { tourComplete: true }`, `localStorage ama-product-tour-seen`
- Exposes `start({ force?: boolean })` via context or Zustand slice

### `useProductTour` (new — replaces `useDashboardTour`, `useSongTour`, `useAppTour`)
**File:** `features/onboarding/useProductTour.ts`

- Exports `PRODUCT_TOUR_STEPS` constant
- `{ active, start, complete, skip, stepIndex }`
- `shouldAutoStart`: `profileComplete && !tourComplete && !hasSeenProductTour(localStorage)`

### Deprecate
- `useDashboardTour.ts` — merged into product tour phase 1
- `useSongTour.ts` — merged into product tour phase 2–4 transition
- `useAppTour.ts` — merged into product tour phase 4

---

## `data-tour` Attributes

### Management / project / song

| Attribute | Component |
|---|---|
| `nav-projects` | `AppShell` Projects nav link |
| `my-projects` | `DashboardPage` My Projects section |
| `projects-header` | `ProjectDashboardPage` heading |
| `project-card` | First `ProjectCard` in list |
| `project-header` | `ProjectPage` title area |
| `song-table-row` | First row in `SongTable` |
| `quick-create-song` | `QuickCreateSongButton` |
| `project-members-tab` | `ProjectPage` Members tab trigger |

### Editor

| Attribute | Component | Notes |
|---|---|---|
| `piano-roll` | `EditorPage` | Exists |
| `track-list` | First `TrackHeader` or Tracks section wrapper | **Add** |
| `transport-bar` | `TransportBar` | **Add** |
| `chart-difficulty` | `ChartSwitcher` trigger (badge visible) | **Add** |
| `song-difficulty-stats` | `BottomBarStats` wrapper in left panel | **Add** |
| `tools-tab` | Right panel tools tab trigger | **Add** |
| `zoom` | Zoom `ToolRow` in `ToolsTab` | **Add** |
| `fast-mode` | Create mode `ToolRow` | **Add** |
| `view-mode` | View `ToolRow` | **Add** |
| `validation-tab` | Validation tab trigger | **Add** |
| `history-tab` | History tab trigger | Exists |
| `ai-suggest` | `AiAssistantTrigger` | Exists |
| `difficulty-heatmap` | Heatmap toggle in `ToolsTab` | **Add** |
| `session-presence` | `SessionPresenceMenu` trigger | **Add** |
| `shortcut-help` | Toolbar `?` | Exists |

---

## Take a Tour Entry Points

| Location | Behavior |
|---|---|
| `AppShell` account menu | "Restart onboarding" → `/onboarding/welcome` |
| Final onboarding page | "Take a tour" → `productTour.start({ force: true })` |
| `AppShell` account menu or header | "Take a tour" → `productTour.start({ force: true })` |
| Skip during tour | Marks `tourComplete` + localStorage (user opted out) |

---

## Error Handling

| Scenario | Behavior |
|---|---|
| Profile PATCH fails | Inline error on the profile onboarding page |
| User opens unknown onboarding step | Redirect to `/onboarding/welcome` |
| Completed user opens onboarding intro/profile route | Allow replay; profile page can update existing profile details |
| Tour PATCH fails | Swallow; set localStorage only |
| No project/song for context | Phases 1–2 use centered tooltips; skip navigation steps; end editor phase with create-project hint |
| `data-tour` missing | Centered tooltip (existing fallback) |
| Mid-tour refresh | Resume from step 0 if `!tourComplete`; persist `ama-product-tour-step` optionally (v2) |

---

## Files Changed

| Action | File |
|---|---|
| NEW | `features/onboarding/ProductTourOrchestrator.tsx` |
| NEW | `features/onboarding/useProductTour.ts` |
| NEW | `features/onboarding/product-tour-steps.ts` |
| NEW | `features/onboarding/tour-context.ts` |
| NEW | `features/onboarding/editor-tour-storage.ts` → rename `product-tour-storage.ts` |
| MOD | `features/onboarding/TourOverlay.tsx` — `prepare`, phase label, settle delay |
| MOD | `features/onboarding/OnboardingGate.tsx` |
| NEW | `features/onboarding/OnboardingFlowPage.tsx` |
| NEW | `features/onboarding/OnboardingVisualCanvas.tsx` |
| MOD | `App.tsx` — add `/onboarding/:step` route |
| MOD | `pages/AuthCallbackPage.tsx` |
| MOD | `components/layout/AppShell.tsx` — nav anchors + "Take a tour" menu item |
| MOD | `features/dashboard/DashboardPage.tsx` |
| MOD | `features/projects/ProjectDashboardPage.tsx` |
| MOD | `features/projects/ProjectCard.tsx` |
| MOD | `features/projects/ProjectPage.tsx` |
| MOD | `features/songs/SongTable.tsx` |
| MOD | `features/songs/QuickCreateSongButton.tsx` |
| MOD | `pages/EditorPage.tsx` — remove old song/app tour wiring |
| MOD | Editor components — anchors per table above |
| DELETE | `useDashboardTour.ts`, `useSongTour.ts`, `useAppTour.ts` (after migration) |

---

## Out of Scope

- Analytics / completion rate tracking
- Mid-tour step persistence across refresh (v2)
- Mobile-specific tour layout
- Separate onboarding for invited collaborators
- Dashboard stat cards as dedicated steps
