# Onboarding & Product Tour — Design Spec

**Date:** 2026-05-24  
**Status:** Approved

---

## Goal

New users (first Google login) see:
1. A welcome screen communicating core value
2. A profile setup form (name, title, department)
3. A guided tour — dashboard orientation first, then editor deep-dive when they open a song

---

## Architecture

```
App.tsx
  └── <OnboardingGate>          reads auth store
        ├── <OnboardingModal>   2-step stepper (welcome → profile)
        └── <TourOverlay>       dashboard tour steps
```

**Trigger conditions (from auth store):**

| `profileComplete` | `tourComplete` | Result |
|---|---|---|
| false | any | Show `OnboardingModal` |
| true | false | Show dashboard `TourOverlay` |
| true | true | Nothing — user fully onboarded |

---

## User Flow

```
OAuth callback
  → GET /auth/me
  → navigate('/')          ← always, no more /profile-setup redirect
  → OnboardingGate mounts

if !profileComplete:
  OnboardingModal step 0 (Welcome)
    → "Get started →"
  OnboardingModal step 1 (Profile form)
    → PATCH /users/me { name, title, department, profileComplete: true }
    → setAuth(updatedUser)
    → modal unmounts

OnboardingGate sees profileComplete=true, tourComplete=false:
  → dashboard TourOverlay (4 steps)
  → on complete: PATCH /users/me { tourComplete: true }

User opens a song:
  → useSongTour fires (3 steps, localStorage guard)
  → useAppTour fires after useSongTour completes (7 editor steps)
```

---

## Components

### `OnboardingGate` (new)
**File:** `features/onboarding/OnboardingGate.tsx`

- Reads `user` from `useAuthStore`
- If `!user` or `!token`: renders nothing (auth guards handle redirect)
- If `!user.profileComplete`: renders `<OnboardingModal onComplete={...} />`
- If `user.profileComplete && !user.tourComplete`: renders dashboard `<TourOverlay>`
- `onTourComplete`: calls `PATCH /users/me { tourComplete: true }`, then `setAuth`

Placed in `App.tsx` inside `<QueryClientProvider>` but outside `<Routes>` so it overlays all pages.

### `OnboardingModal` (new)
**File:** `features/onboarding/OnboardingModal.tsx`

Full-screen overlay (`fixed inset-0 z-50`), centered card (`max-w-lg`), progress dots at bottom.

**Step 0 — Welcome**
- AMA-MIDI logo + tagline: *"The collaborative MIDI editor for game audio teams"*
- 3 value prop cards:
  - 🎹 **Piano Roll** — 8 tracks × 300s of musical timeline, fast note placement
  - 👥 **Real-time Collaboration** — live cursors, instant sync across all team members
  - ✨ **AI Suggestions** — generate full charts or fill track gaps with AI
- CTA: "Get started →" (no skip — force value exposure on step 0)

**Step 1 — Profile**
- Fields: Display Name (optional), Title (required), Department (required, select)
- Same validation as current `ProfileSetupPage`
- On submit: `PATCH /users/me { name, title, department, profileComplete: true }`
- On success: calls `onComplete()` prop → gate unmounts modal, starts dashboard tour
- Error: inline below form
- Skip allowed: submits with empty name, but title+department still required

Props:
```ts
interface OnboardingModalProps {
  onComplete: () => void
}
```

### `useDashboardTour` (new)
**File:** `features/onboarding/useDashboardTour.ts`

4 steps targeting dashboard elements:

| target | message |
|---|---|
| `dashboard-header` | Welcome to AMA-MIDI. This is your dashboard — your starting point for all projects and songs. |
| `nav-projects` | Browse all projects here. Each project holds multiple songs and tracks collaborators. |
| `quick-create-song` | Create a new song in seconds. Pick a project, set a title, and start composing. |
| `song-card` | Each card is a song. Open it to enter the piano roll editor. |

Returns: `{ steps, active, start, complete, skip }`

### `useAppTour` (modify)
**File:** `features/onboarding/useAppTour.ts`

Rename internal steps to `EDITOR_TOUR_STEPS` for clarity. No logic change.  
`shouldAutoStart` stays: `profileComplete && !tourComplete` — but this is now only consumed by the editor chain, not `OnboardingGate` (gate uses `useDashboardTour` instead).

Update: `tourComplete` is set after **dashboard** tour completes (in `OnboardingGate`). Editor tour (`useSongTour` + `useAppTour`) uses its own localStorage guard (`ama-song-tour-seen`) — independent of `tourComplete`.

### `useSongTour` + `useAppTour` chain (EditorPage)
**File:** `pages/EditorPage.tsx`

```ts
const songTour = useSongTour()    // existing — 3 steps, localStorage guard
const appTour  = useAppTour()     // existing — 7 editor steps

// After songTour completes, auto-start appTour if not seen
// useSongTour.complete() sets localStorage 'ama-song-tour-seen'
// useAppTour checks user.profileComplete && !user.tourComplete
// → but tourComplete is now set by dashboard tour, not editor tour
// Fix: editor tour uses its own localStorage key 'ama-editor-tour-seen'
```

**Adjust `useAppTour`:** replace `tourComplete` DB flag with localStorage key `ama-editor-tour-seen`. Remove `PATCH /users/me { tourComplete: true }` from editor tour — `tourComplete` is only for dashboard tour.

---

## `data-tour` Attributes Needed

**Dashboard (new):**
- `data-tour="dashboard-header"` — dashboard page heading
- `data-tour="nav-projects"` — Projects nav link in `AppShell`
- `data-tour="quick-create-song"` — `QuickCreateSongButton`
- `data-tour="song-card"` — first `SongCard` (add to SongCard root element)

**Editor (verify existing):**
- `data-tour="piano-roll"` — PianoRoll root
- `data-tour="fast-mode"` — fast mode toggle
- `data-tour="ai-suggest"` — AI menu button
- `data-tour="ai-continue-pattern"` — continue pattern button
- `data-tour="view-mode"` — view mode toggle group
- `data-tour="history-tab"` — history tab button
- `data-tour="shortcut-help"` — shortcut legend button

---

## Error Handling

| Scenario | Behavior |
|---|---|
| Profile PATCH fails | Inline error in form, user retries |
| Dashboard tour PATCH fails | Swallow silently (non-critical) |
| `data-tour` element not in DOM | `TourOverlay` shows tooltip at viewport center (existing behavior) |
| User refreshes mid-onboarding | `OnboardingGate` re-reads auth store — modal re-shows if `!profileComplete` |

---

## Files Changed

| Action | File |
|---|---|
| NEW | `features/onboarding/OnboardingGate.tsx` |
| NEW | `features/onboarding/OnboardingModal.tsx` |
| NEW | `features/onboarding/useDashboardTour.ts` |
| MOD | `features/onboarding/useAppTour.ts` — switch from DB flag to localStorage |
| MOD | `App.tsx` — add `<OnboardingGate>` |
| MOD | `pages/AuthCallbackPage.tsx` — remove `/profile-setup` redirect |
| MOD | `pages/EditorPage.tsx` — chain `useSongTour` → `useAppTour` |
| MOD | `features/dashboard/DashboardPage.tsx` — add `data-tour` attrs |
| MOD | `components/layout/AppShell.tsx` — add `data-tour="nav-projects"` |
| MOD | `features/songs/SongCard.tsx` — add `data-tour="song-card"` |
| MOD | `features/songs/QuickCreateSongButton.tsx` — add `data-tour="quick-create-song"` |
| KEEP | `pages/ProfileSetupPage.tsx` — keep as fallback, no longer primary path |

---

## Out of Scope

- Analytics / tracking of onboarding completion rate
- Re-triggering tour from settings/profile menu
- Mobile-specific tour layout
- Onboarding for invited collaborators (non-first-login users)
