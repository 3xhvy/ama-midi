# Routed Onboarding Pages Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the first-login onboarding modal with separate routed pages: Welcome, Feature highlights, Notes, Profile, and You are set up.

**Architecture:** Add a route-driven onboarding shell at `/onboarding/:step`, backed by a small pure step model and a decorative canvas visual component. `OnboardingGate` redirects incomplete authenticated users into onboarding instead of rendering a modal; the existing `ProductTourOrchestrator` remains the guided product tour and is launched from the final ready page.

**Tech Stack:** React 18, TypeScript, React Router, Zustand auth store, existing UI components, lightweight HTML canvas.

---

## File Structure

- Create `apps/web/src/features/onboarding/onboarding-flow.ts`: pure step order, route helpers, and typed step ids.
- Create `apps/web/tests/onboarding-flow.test.ts`: verifies step order, navigation helpers, and route parsing before UI code.
- Create `apps/web/src/features/onboarding/OnboardingVisualCanvas.tsx`: decorative animated canvas for the five visual scenes.
- Create `apps/web/src/features/onboarding/OnboardingFlowPage.tsx`: routed full-screen onboarding page and profile form.
- Modify `apps/web/src/features/onboarding/OnboardingGate.tsx`: redirect `!profileComplete` users to `/onboarding/welcome`.
- Modify `apps/web/src/App.tsx`: add `/onboarding/:step` route.
- Keep `OnboardingModal.tsx` untouched unless build shows it is unused enough to remove safely.

## Tasks

### Task 1: Step Model Test First

- [ ] Add `apps/web/tests/onboarding-flow.test.ts` with tests for `ONBOARDING_STEP_IDS`, `getNextOnboardingStep`, `getPreviousOnboardingStep`, and `parseOnboardingStep`.
- [ ] Run `node --import tsx --test apps/web/tests/onboarding-flow.test.ts` and confirm it fails because `onboarding-flow.ts` does not exist.
- [ ] Add `apps/web/src/features/onboarding/onboarding-flow.ts` with the minimal pure helpers.
- [ ] Run the test again and confirm it passes.

### Task 2: Routed Page UI

- [ ] Add `OnboardingVisualCanvas.tsx` with a local canvas renderer for `welcome`, `features`, `notes`, `profile`, and `ready` scenes.
- [ ] Add `OnboardingFlowPage.tsx` that reads `:step`, renders the correct page, and patches `/users/me` on profile completion.
- [ ] On the ready page, wire **Take a tour** to `requestProductTour({ force: true })` and `navigate('/')`; wire **Go to dashboard** to `navigate('/')`.

### Task 3: Routing and Gate

- [ ] Add `<Route path="/onboarding/:step" element={<RequireAuth><OnboardingFlowPage /></RequireAuth>} />` in `App.tsx`.
- [ ] Change `OnboardingGate` to use `useLocation` and `useNavigate`; redirect authenticated incomplete users to `/onboarding/welcome` unless already on `/onboarding`.
- [ ] Avoid auto-starting the product tour after profile save; the ready page asks explicitly.

### Task 4: Verification

- [ ] Run `node --import tsx --test apps/web/tests/onboarding-flow.test.ts`.
- [ ] Run `pnpm --dir apps/web build`.
- [ ] Inspect `git diff -- apps/web/src/features/onboarding apps/web/src/App.tsx docs/superpowers/specs/2026-05-24-onboarding-design.md docs/superpowers/plans/2026-05-24-routed-onboarding-pages.md apps/web/tests/onboarding-flow.test.ts`.
