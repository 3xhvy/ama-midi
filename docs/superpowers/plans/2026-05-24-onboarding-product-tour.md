# Onboarding & Product Tour Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a first-login onboarding gate that enforces welcome + profile setup, runs a dashboard tour once, and keeps editor tours independent via localStorage.

**Architecture:** Keep onboarding decisions centralized in a small gate mounted at app root. Persist durable onboarding milestones (`profileComplete`, `tourComplete`) in the user record, while editor walkthrough state remains client-local (`ama-song-tour-seen`, `ama-editor-tour-seen`). Reuse existing `TourOverlay` for both dashboard and editor flows, and add `data-tour` anchors where needed.

**Tech Stack:** React 18, TypeScript, Zustand auth store, TanStack Query, existing API client, Node test runner (`node --import tsx --test`).

---

I'm using the writing-plans skill to create the implementation plan.

## File Structure

- Create: `apps/web/src/features/onboarding/OnboardingGate.tsx`
- Create: `apps/web/src/features/onboarding/OnboardingModal.tsx`
- Create: `apps/web/src/features/onboarding/useDashboardTour.ts`
- Create: `apps/web/src/features/onboarding/editor-tour-storage.ts`
- Create: `apps/web/tests/onboarding-tour-storage.test.ts`
- Modify: `apps/web/src/App.tsx`
- Modify: `apps/web/src/pages/AuthCallbackPage.tsx`
- Modify: `apps/web/src/pages/EditorPage.tsx`
- Modify: `apps/web/src/features/onboarding/useAppTour.ts`
- Modify: `apps/web/src/features/dashboard/DashboardPage.tsx`
- Modify: `apps/web/src/components/layout/AppShell.tsx`
- Modify: `apps/web/src/features/songs/SongCard.tsx`
- Modify: `apps/web/src/features/songs/QuickCreateSongButton.tsx`

### Task 1: Add Editor Tour Local Storage Abstraction (TDD)

**Files:**
- Create: `apps/web/src/features/onboarding/editor-tour-storage.ts`
- Test: `apps/web/tests/onboarding-tour-storage.test.ts`

- [ ] **Step 1: Write the failing test for editor tour keys**

```ts
import assert from 'node:assert/strict'
import { test } from 'node:test'
import {
  EDITOR_TOUR_STORAGE_KEY,
  SONG_TOUR_STORAGE_KEY,
  hasSeenEditorTour,
  markEditorTourSeen,
} from '../src/features/onboarding/editor-tour-storage.ts'

test('editor tour uses a dedicated storage key', () => {
  assert.equal(EDITOR_TOUR_STORAGE_KEY, 'ama-editor-tour-seen')
  assert.equal(SONG_TOUR_STORAGE_KEY, 'ama-song-tour-seen')
})

test('markEditorTourSeen persists and hasSeenEditorTour reads it', () => {
  const store = new Map<string, string>()
  const storage = {
    getItem: (key: string) => store.get(key) ?? null,
    setItem: (key: string, value: string) => void store.set(key, value),
  }

  assert.equal(hasSeenEditorTour(storage as Storage), false)
  markEditorTourSeen(storage as Storage)
  assert.equal(hasSeenEditorTour(storage as Storage), true)
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --import tsx --test apps/web/tests/onboarding-tour-storage.test.ts`
Expected: FAIL with module-not-found for `editor-tour-storage.ts`

- [ ] **Step 3: Write minimal implementation**

```ts
export const SONG_TOUR_STORAGE_KEY = 'ama-song-tour-seen'
export const EDITOR_TOUR_STORAGE_KEY = 'ama-editor-tour-seen'

export function hasSeenEditorTour(storage: Pick<Storage, 'getItem'>): boolean {
  return storage.getItem(EDITOR_TOUR_STORAGE_KEY) === 'true'
}

export function markEditorTourSeen(storage: Pick<Storage, 'setItem'>): void {
  storage.setItem(EDITOR_TOUR_STORAGE_KEY, 'true')
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node --import tsx --test apps/web/tests/onboarding-tour-storage.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/features/onboarding/editor-tour-storage.ts apps/web/tests/onboarding-tour-storage.test.ts
git commit -m "test(onboarding): add editor tour storage helpers"
```

### Task 2: Switch `useAppTour` from DB completion to local editor-tour completion (TDD)

**Files:**
- Modify: `apps/web/src/features/onboarding/useAppTour.ts`
- Modify: `apps/web/src/features/onboarding/editor-tour-storage.ts`
- Test: `apps/web/tests/onboarding-tour-storage.test.ts`

- [ ] **Step 1: Add failing test for safe browser-less behavior**

```ts
import { completeEditorTour } from '../src/features/onboarding/editor-tour-storage.ts'

test('completeEditorTour is no-op without window', () => {
  assert.doesNotThrow(() => completeEditorTour(undefined))
})
```

- [ ] **Step 2: Run targeted test to confirm failure**

Run: `node --import tsx --test apps/web/tests/onboarding-tour-storage.test.ts`
Expected: FAIL because `completeEditorTour` does not exist yet

- [ ] **Step 3: Implement storage-based completion + hook update**

```ts
// editor-tour-storage.ts
export function completeEditorTour(win: Window | undefined): void {
  if (!win) return
  markEditorTourSeen(win.localStorage)
}

// useAppTour.ts (key changes)
const EDITOR_TOUR_STEPS: TourStep[] = [/* existing 7 steps */]

const complete = useCallback(() => {
  setActive(false)
  completeEditorTour(typeof window === 'undefined' ? undefined : window)
}, [])

const shouldAutoStart = !!(
  user?.profileComplete &&
  typeof window !== 'undefined' &&
  !hasSeenEditorTour(window.localStorage)
)
```

- [ ] **Step 4: Run tests + typecheck for changed hook**

Run: `node --import tsx --test apps/web/tests/onboarding-tour-storage.test.ts`
Expected: PASS

Run: `pnpm --dir apps/web build`
Expected: build succeeds with no TypeScript errors

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/features/onboarding/useAppTour.ts apps/web/src/features/onboarding/editor-tour-storage.ts apps/web/tests/onboarding-tour-storage.test.ts
git commit -m "feat(onboarding): decouple editor tour from user tourComplete flag"
```

### Task 3: Build Dashboard Tour Hook + Onboarding Gate

**Files:**
- Create: `apps/web/src/features/onboarding/useDashboardTour.ts`
- Create: `apps/web/src/features/onboarding/OnboardingGate.tsx`

- [ ] **Step 1: Add dashboard tour step configuration**

```ts
import type { TourStep } from './TourOverlay'

export const DASHBOARD_TOUR_STEPS: TourStep[] = [
  {
    target: 'dashboard-header',
    message: 'Welcome to AMA-MIDI. This is your dashboard — your starting point for all projects and songs.',
  },
  {
    target: 'nav-projects',
    message: 'Browse all projects here. Each project holds multiple songs and tracks collaborators.',
  },
  {
    target: 'quick-create-song',
    message: 'Create a new song in seconds. Pick a project, set a title, and start composing.',
  },
  {
    target: 'song-card',
    message: 'Each card is a song. Open it to enter the piano roll editor.',
  },
]
```

- [ ] **Step 2: Add minimal hook wrapper for overlay state**

```ts
export function useDashboardTour() {
  const [active, setActive] = useState(false)
  const start = useCallback(() => setActive(true), [])
  const complete = useCallback(() => setActive(false), [])
  const skip = useCallback(() => setActive(false), [])
  return { steps: DASHBOARD_TOUR_STEPS, active, start, complete, skip }
}
```

- [ ] **Step 3: Implement onboarding gate rendering logic**

```tsx
if (!user || !token) return null

if (!user.profileComplete) {
  return <OnboardingModal onComplete={() => setModalDone(true)} />
}

if (user.profileComplete && !user.tourComplete) {
  return <TourOverlay steps={dashboardTour.steps} onComplete={handleTourComplete} onSkip={handleTourComplete} />
}

return null
```

- [ ] **Step 4: Persist dashboard completion in DB only from gate**

```ts
const updated = await apiClient(token)<AuthUser>('/users/me', {
  method: 'PATCH',
  body: JSON.stringify({ tourComplete: true }),
})
setAuth(updated, token)
```

Run: `pnpm --dir apps/web build`
Expected: build succeeds; new gate compiles

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/features/onboarding/useDashboardTour.ts apps/web/src/features/onboarding/OnboardingGate.tsx
git commit -m "feat(onboarding): add gate and dashboard tour flow"
```

### Task 4: Add Onboarding Modal (Welcome + Profile Form)

**Files:**
- Create: `apps/web/src/features/onboarding/OnboardingModal.tsx`
- Modify: `apps/web/src/features/onboarding/OnboardingGate.tsx`

- [ ] **Step 1: Build modal shell and two-step state machine**

```tsx
const [step, setStep] = useState<0 | 1>(0)

return (
  <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4">
    <div className="w-full max-w-lg rounded-2xl border border-shell-border bg-shell-surface p-6 shadow-xl">
      {step === 0 ? <WelcomeStep onNext={() => setStep(1)} /> : <ProfileStep onComplete={onComplete} />}
      <div className="mt-6 flex justify-center gap-2">
        <span className={step === 0 ? 'h-2 w-2 rounded-full bg-primary' : 'h-2 w-2 rounded-full bg-shell-border'} />
        <span className={step === 1 ? 'h-2 w-2 rounded-full bg-primary' : 'h-2 w-2 rounded-full bg-shell-border'} />
      </div>
    </div>
  </div>
)
```

- [ ] **Step 2: Implement welcome content and forced first CTA**

```tsx
<Button variant="primary" onClick={() => setStep(1)}>
  Get started →
</Button>
```

Include tagline and 3 value cards exactly from spec.

- [ ] **Step 3: Implement profile submit with required fields**

```ts
if (!title.trim()) { setError('Title is required'); return }
if (!department) { setError('Department is required'); return }

const updated = await apiClient(token)<AuthUser>('/users/me', {
  method: 'PATCH',
  body: JSON.stringify({
    name: name.trim() || undefined,
    title: title.trim(),
    department,
    profileComplete: true,
  }),
})
setAuth(updated, token)
onComplete()
```

- [ ] **Step 4: Wire modal usage from gate**

Run: `pnpm --dir apps/web build`
Expected: build succeeds and modal typechecks with `OnboardingModalProps`

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/features/onboarding/OnboardingModal.tsx apps/web/src/features/onboarding/OnboardingGate.tsx
git commit -m "feat(onboarding): add two-step onboarding modal"
```

### Task 5: Route + App Wiring Changes

**Files:**
- Modify: `apps/web/src/App.tsx`
- Modify: `apps/web/src/pages/AuthCallbackPage.tsx`

- [ ] **Step 1: Make auth callback always land on `/` after `/auth/me`**

```ts
apiClient(token)<AuthUser>('/auth/me')
  .then((user) => {
    setAuth(user, token)
    navigate('/', { replace: true })
  })
```

- [ ] **Step 2: Mount onboarding gate globally**

```tsx
<QueryClientProvider client={queryClient}>
  <BrowserRouter>
    <OnboardingGate />
    <Routes>{/* existing routes */}</Routes>
    <Toaster ... />
  </BrowserRouter>
</QueryClientProvider>
```

- [ ] **Step 3: Keep `/profile-setup` route as fallback**

No behavior change needed; keep route registration intact.

- [ ] **Step 4: Run full web build after route wiring**

Run: `pnpm --dir apps/web build`
Expected: build succeeds

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/App.tsx apps/web/src/pages/AuthCallbackPage.tsx
git commit -m "feat(auth): route first-login users through onboarding gate"
```

### Task 6: Add Dashboard `data-tour` Anchors

**Files:**
- Modify: `apps/web/src/features/dashboard/DashboardPage.tsx`
- Modify: `apps/web/src/components/layout/AppShell.tsx`
- Modify: `apps/web/src/features/songs/QuickCreateSongButton.tsx`
- Modify: `apps/web/src/features/songs/SongCard.tsx`

- [ ] **Step 1: Mark dashboard header anchor**

```tsx
<header data-tour="dashboard-header" className="relative mb-5 ...">
```

- [ ] **Step 2: Mark projects nav anchor in shell**

```tsx
<NavLink data-tour={item.to === '/projects' ? 'nav-projects' : undefined} ...>
```

- [ ] **Step 3: Mark quick-create and song-card anchors**

```tsx
<Button data-tour="quick-create-song" ...>Quick Create</Button>

<div data-tour="song-card" ...>
```

Use one `song-card` anchor on first visible card if duplicate targeting causes unstable highlight.

- [ ] **Step 4: Verify editor tour anchors still exist**

Run: `rg -n 'data-tour="(piano-roll|fast-mode|ai-suggest|ai-continue-pattern|view-mode|history-tab|shortcut-help)"' apps/web/src`
Expected: all seven editor anchors found

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/features/dashboard/DashboardPage.tsx apps/web/src/components/layout/AppShell.tsx apps/web/src/features/songs/QuickCreateSongButton.tsx apps/web/src/features/songs/SongCard.tsx
git commit -m "feat(onboarding): add dashboard tour anchors"
```

### Task 7: Chain Song Tour then Editor Tour in `EditorPage`

**Files:**
- Modify: `apps/web/src/pages/EditorPage.tsx`
- Modify: `apps/web/src/features/onboarding/useAppTour.ts`

- [ ] **Step 1: Instantiate both tours in editor page**

```ts
const songTour = useSongTour()
const appTour = useAppTour()
```

- [ ] **Step 2: Start editor tour when song tour completes**

```ts
const handleSongTourComplete = useCallback(() => {
  songTour.complete()
  if (appTour.shouldAutoStart) appTour.start()
}, [songTour, appTour])
```

- [ ] **Step 3: Render overlays with deterministic ordering**

```tsx
{songTour.active && (
  <TourOverlay steps={songTour.steps} onComplete={handleSongTourComplete} onSkip={handleSongTourComplete} />
)}
{!songTour.active && appTour.active && (
  <TourOverlay steps={appTour.steps} onComplete={appTour.complete} onSkip={appTour.skip} />
)}
```

- [ ] **Step 4: Initialize editor tour auto-start when song tour already seen**

```ts
useEffect(() => {
  if (!songTour.active && appTour.shouldAutoStart) appTour.start()
}, [songTour.active, appTour.shouldAutoStart, appTour.start])
```

Run: `pnpm --dir apps/web build`
Expected: build succeeds

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/pages/EditorPage.tsx apps/web/src/features/onboarding/useAppTour.ts
git commit -m "feat(editor): chain song and editor tours with independent persistence"
```

### Task 8: Regression Verification + Manual QA Checklist

**Files:**
- Modify: `docs/superpowers/specs/2026-05-24-onboarding-design.md` (optional status note)

- [ ] **Step 1: Run automated checks used by this feature**

Run: `node --import tsx --test apps/web/tests/onboarding-tour-storage.test.ts`
Expected: PASS

Run: `node --import tsx --test apps/web/tests/song-editor-path.test.ts apps/web/tests/recent-navigation.test.ts`
Expected: PASS

Run: `pnpm --dir apps/web build`
Expected: PASS

- [ ] **Step 2: Manual flow test - first login path**

1. Clear local auth + tour storage keys.
2. Sign in with Google test account with `profileComplete=false`.
3. Confirm welcome step shows before profile form.
4. Submit title + department (name optional).
5. Confirm dashboard tour appears after save.

- [ ] **Step 3: Manual flow test - tour completion persistence**

1. Finish dashboard tour.
2. Refresh dashboard.
3. Confirm dashboard tour no longer appears.
4. Open a song, complete song tour and editor tour.
5. Refresh editor and confirm neither tour reappears.

- [ ] **Step 4: Manual flow test - failure behavior**

1. Simulate profile PATCH failure and confirm inline error.
2. Simulate dashboard tour PATCH failure and confirm app remains usable without blocking UI.
3. Remove one `data-tour` target temporarily and confirm overlay centers fallback tooltip.

- [ ] **Step 5: Commit verification notes**

```bash
git add docs/superpowers/specs/2026-05-24-onboarding-design.md
git commit -m "docs(onboarding): add verification notes for onboarding rollout"
```

## Spec Coverage Check

- Welcome-first modal + forced first CTA: covered in Task 4.
- Profile form with required title/department, optional name, PATCH to `/users/me`: covered in Task 4.
- No `/profile-setup` redirect in callback: covered in Task 5.
- Root-level gate outside routes: covered in Task 5.
- Dashboard tour and `tourComplete` PATCH: covered in Task 3.
- Editor chain `useSongTour` then `useAppTour`: covered in Task 7.
- `useAppTour` DB decoupling to localStorage: covered in Task 2.
- Required dashboard anchors: covered in Task 6.
- Error handling expectations: covered in Tasks 3, 4, 8.

## Placeholder Scan

- No `TODO`, `TBD`, or “implement later” placeholders.
- Every task includes exact paths, code snippets, commands, and expected outcomes.

## Type/Name Consistency Check

- `tourComplete` remains DB-backed milestone for dashboard only.
- `ama-song-tour-seen` and `ama-editor-tour-seen` are distinct local keys.
- `OnboardingModal` contract is `onComplete: () => void` consistently across tasks.
