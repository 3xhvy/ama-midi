# Onboarding & Product Tour Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** First-login onboarding (welcome + profile) plus a unified **Take a Tour** journey: **Project → Song → User → Editor** (~23 steps), cross-route with panel/tab preparation.

**Architecture:** `OnboardingGate` handles profile modal only. `ProductTourOrchestrator` owns one step list, navigates between routes, runs `prepare()` (open panels, switch tabs), and persists `tourComplete` + `ama-product-tour-seen`. Replaces `useDashboardTour`, `useSongTour`, and `useAppTour`.

**Spec:** `docs/superpowers/specs/2026-05-24-onboarding-design.md`

**Tech Stack:** React 18, TypeScript, Zustand (auth + editor stores), TanStack Query, React Router, Node test runner.

---

## Codebase Audit (2026-05-24)


| Item                                    | Status                                                                 |
| --------------------------------------- | ---------------------------------------------------------------------- |
| `TourOverlay.tsx`                       | Exists — needs `prepare`, phase label, settle delay                    |
| `useSongTour` / `useAppTour`            | Exists — **replace** with `useProductTour`                             |
| Partial `data-tour` anchors             | piano-roll, ai-suggest, history-tab, shortcut-help, ai-improve-pattern |
| `OnboardingGate`, modal, orchestrator   | **Missing**                                                            |
| Cross-route tour                        | **Missing** — required for Project → Song → Editor flow                |
| Auth callback `/profile-setup` redirect | Still active — remove in Task 5                                        |


---

## File Structure

**Create**

- `apps/web/src/features/onboarding/product-tour-storage.ts`
- `apps/web/src/features/onboarding/product-tour-steps.ts`
- `apps/web/src/features/onboarding/tour-context.ts`
- `apps/web/src/features/onboarding/useProductTour.ts`
- `apps/web/src/features/onboarding/ProductTourOrchestrator.tsx`
- `apps/web/src/features/onboarding/OnboardingGate.tsx`
- `apps/web/src/features/onboarding/OnboardingModal.tsx`
- `apps/web/tests/product-tour-storage.test.ts`

**Modify**

- `apps/web/src/features/onboarding/TourOverlay.tsx`
- `apps/web/src/App.tsx`
- `apps/web/src/pages/AuthCallbackPage.tsx`
- `apps/web/src/pages/EditorPage.tsx` — remove old tour hooks
- `apps/web/src/components/layout/AppShell.tsx`
- `apps/web/src/features/dashboard/DashboardPage.tsx`
- `apps/web/src/features/projects/ProjectDashboardPage.tsx`
- `apps/web/src/features/projects/ProjectCard.tsx`
- `apps/web/src/features/projects/ProjectPage.tsx`
- `apps/web/src/features/songs/SongTable.tsx`
- `apps/web/src/features/songs/QuickCreateSongButton.tsx`
- `apps/web/src/features/editor/components/TrackHeader.tsx` (or Tracks section wrapper)
- `apps/web/src/features/editor/components/TransportBar.tsx`
- `apps/web/src/features/charts/ChartSwitcher.tsx`
- `apps/web/src/features/editor/components/BottomBarStats.tsx`
- `apps/web/src/features/collaboration/SessionPresenceMenu.tsx`
- `apps/web/src/pages/EditorPage.tsx` (`ToolsTab` anchors)

**Delete after migration**

- `useDashboardTour.ts`, `useSongTour.ts`, `useAppTour.ts` (if created as stubs)

---

### Task 1: Product Tour Storage (TDD)

**Files:** `product-tour-storage.ts`, `product-tour-storage.test.ts`

- **Step 1:** Failing test for `PRODUCT_TOUR_STORAGE_KEY = 'ama-product-tour-seen'`, `hasSeenProductTour`, `markProductTourSeen`, `completeProductTour(undefined)` no-op
- **Step 2:** Run `node --import tsx --test apps/web/tests/product-tour-storage.test.ts` → FAIL
- **Step 3:** Minimal implementation
- **Step 4:** Run test → PASS
- **Step 5:** Commit

---

### Task 2: Extend TourOverlay + TourStep

**Files:** `TourOverlay.tsx`, `product-tour-steps.ts` (types only initially)

- **Step 1:** Extend `TourStep` with optional `phase`, `route`, `prepare`
- **Step 2:** `TourOverlay` accepts `onStepEnter(step)` async — caller resolves rect after prepare + 300ms
- **Step 3:** Show phase label in tooltip: `{phase} · {step}/{phaseTotal}`
- **Step 4:** `pnpm --dir apps/web build` → PASS
- **Step 5:** Commit

---

### Task 3: Define PRODUCT_TOUR_STEPS (23 steps)

**Files:** `product-tour-steps.ts`, `tour-context.ts`

- **Step 1:** Export full step array per spec (phases: project×4, song×3, user×2, editor×13)
- **Step 2:** `resolveTourContext()` — from `useDashboard` recent songs or first project + first song
- **Step 3:** Each step with `route` uses `(ctx) => \`/projects/${ctx.projectId}/...`
- **Step 4:** Editor steps `prepare` calls `setLeftCollapsed(false)`, `setRightPanelTab('tools'|'validation'|'history')`
- **Step 5:** Commit

Example editor steps (subset):

```ts
{ phase: 'editor', target: 'track-list', message: '...', prepare: (ctx) => ctx.editorStore.setLeftCollapsed(false) },
{ phase: 'editor', target: 'zoom', message: '...', prepare: (ctx) => ctx.editorStore.setRightPanelTab('tools') },
{ phase: 'editor', target: 'validation-tab', message: '...', prepare: (ctx) => ctx.editorStore.setRightPanelTab('validation') },
{ phase: 'editor', target: 'ai-suggest', message: 'Generate chart · Scale difficulty · Fill track · Improve pattern…' },
```

---

### Task 4: ProductTourOrchestrator + useProductTour

**Files:** `ProductTourOrchestrator.tsx`, `useProductTour.ts`, `App.tsx`

- **Step 1:** `useProductTour` — `{ active, start, complete, skip, shouldAutoStart }`
- **Step 2:** Orchestrator mounts `TourOverlay`, handles navigation via `useNavigate`, passes editor store actions in context
- **Step 3:** On complete/skip: `completeProductTour`, `PATCH { tourComplete: true }`, `setAuth`
- **Step 4:** Mount in `App.tsx` beside `OnboardingGate`
- **Step 5:** Commit

---

### Task 5: Onboarding Gate + Modal

**Files:** `OnboardingGate.tsx`, `OnboardingModal.tsx`, `AuthCallbackPage.tsx`

- **Step 1:** Modal — welcome (step 0) + profile (step 1) per spec
- **Step 2:** Gate — modal when `!profileComplete`; on complete call `productTour.start()` if `!tourComplete`
- **Step 3:** Auth callback always `navigate('/')` — remove `/profile-setup` redirect
- **Step 4:** Keep `/profile-setup` route as fallback
- **Step 5:** Commit

---

### Task 6: Management & Project `data-tour` Anchors

**Files:** `AppShell`, `DashboardPage`, `ProjectDashboardPage`, `ProjectCard`, `ProjectPage`, `SongTable`, `QuickCreateSongButton`

- **Step 1:** `nav-projects`, `my-projects`
- **Step 2:** `projects-header`, `project-card` (first card only)
- **Step 3:** `project-header`, `song-table-row` (first row), `quick-create-song`
- **Step 4:** `project-members-tab` on Members `Tabs.Trigger`
- **Step 5:** Commit

---

### Task 7: Editor `data-tour` Anchors

**Files:** `EditorPage`, `TrackHeader`, `TransportBar`, `ChartSwitcher`, `BottomBarStats`, `SessionPresenceMenu`, `ToolsTab`

- **Step 1:** `track-list` — wrapper on Tracks section or first `TrackHeader`
- **Step 2:** `transport-bar`, `chart-difficulty`, `session-presence`
- **Step 3:** `song-difficulty-stats` on `BottomBarStats` container
- **Step 4:** `tools-tab`, `zoom`, `fast-mode`, `view-mode`, `validation-tab`, `difficulty-heatmap`
- **Step 5:** Verify grep:

```bash
rg -n 'data-tour="(piano-roll|track-list|transport-bar|chart-difficulty|song-difficulty-stats|tools-tab|zoom|fast-mode|view-mode|validation-tab|history-tab|ai-suggest|difficulty-heatmap|session-presence|shortcut-help)"' apps/web/src
```

- **Step 6:** Remove `useSongTour` wiring from `EditorPage`; delete old tour hooks
- **Step 7:** Commit

---

### Task 8: "Take a tour" Entry Point

**Files:** `AppShell.tsx`

- **Step 1:** Add menu item "Take a tour" → `productTour.start({ force: true })`
- **Step 2:** Manual QA: full 23-step walkthrough with real project/song
- **Step 3:** Commit

---

### Task 9: Regression + Manual QA

- **Step 1:** `node --import tsx --test apps/web/tests/product-tour-storage.test.ts`
- **Step 2:** `pnpm --dir apps/web build`
- **Step 3:** First login → welcome → profile → auto tour starts at `nav-projects`
- **Step 4:** Confirm tour navigates project page → opens song → members tab → editor with panels/tabs switching
- **Step 5:** Confirm steps cover: tracks/colors, history, validation errors, tools, zoom, AI, chart difficulty, heatmap
- **Step 6:** Refresh mid-tour — tour restarts if `!tourComplete` (document behavior)
- **Step 7:** Commit verification notes to spec if needed

---

## Spec Coverage Check

- Unified Project → Song → User → Editor journey: Tasks 3, 4, 6, 7
- Track + track colors: step 11 `track-list`
- History: step 20
- Errors / validation: step 19
- Tools + zoom: steps 15–18
- AI features: step 21 (all four flows in copy)
- Game difficulty: steps 13–14 + 22 heatmap
- Cross-route orchestration: Tasks 2, 4
- Onboarding modal separate from tour: Task 5
- `tourComplete` DB + localStorage: Tasks 1, 4

## Type/Name Consistency

- Single storage key: `ama-product-tour-seen`
- Single step export: `PRODUCT_TOUR_STEPS` in `product-tour-steps.ts`
- Phase enum: `'project' | 'song' | 'user' | 'editor'`
- No `useDashboardTour` / `useSongTour` / `useAppTour` in final codebase

