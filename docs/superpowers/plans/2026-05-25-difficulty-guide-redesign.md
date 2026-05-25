# Difficulty Guide Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Redesign the difficulty help modal into a game-style Difficulty Guide with tier cards, review badges, quick fix cards, grouped warnings, and collapsed advanced limits.

**Architecture:** Keep the feature inside the existing reusable `DifficultyHelpModal` component and preserve its `open`/`onClose` API. Replace dense table-first content with static content arrays rendered by local helper components; add focused React tests that verify the visible structure and disclosure behavior.

**Tech Stack:** React 18, TypeScript, Vite, Tailwind utility classes, Radix Dialog via existing `Modal`, Vitest, Testing Library.

---

## Files

- Modify: `apps/web/src/features/analysis/DifficultyHelpModal.tsx`
  - Rename modal title.
  - Replace the current accordion/table-heavy body with tier cards, review badges, fix-tip cards, grouped warning rows, and a collapsed advanced section.
  - Keep the same exported component and props.
- Create: `apps/web/src/features/analysis/DifficultyHelpModal.test.tsx`
  - Verify the modal opens as "Difficulty Guide".
  - Verify tier cards and fix-tip cards are present.
  - Verify warning groups show human-readable fixes and compact code labels.
  - Verify advanced limits start collapsed and expand on click.

---

## Task 1: Add Characterization Tests For The New Guide Structure

**Files:**
- Create: `apps/web/src/features/analysis/DifficultyHelpModal.test.tsx`

- [ ] **Step 1: Create the failing test file**

Add this file:

```tsx
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { DifficultyHelpModal } from './DifficultyHelpModal'

function renderModal() {
  return render(<DifficultyHelpModal open onClose={vi.fn()} />)
}

describe('DifficultyHelpModal', () => {
  it('opens as a difficulty guide with tier cards', () => {
    renderModal()

    expect(screen.getByRole('heading', { name: 'Difficulty Guide' })).toBeInTheDocument()
    expect(screen.getByText(/Learn what each tier means/i)).toBeInTheDocument()

    expect(screen.getByText('Easy')).toBeInTheDocument()
    expect(screen.getByText('0-2.9')).toBeInTheDocument()
    expect(screen.getByText('Light taps, no doubles, simple rhythm')).toBeInTheDocument()

    expect(screen.getByText('Master')).toBeInTheDocument()
    expect(screen.getByText('18+')).toBeInTheDocument()
    expect(screen.getByText('Peak density, wide jumps, advanced patterns')).toBeInTheDocument()
  })

  it('shows review badges and quick fix cards', () => {
    renderModal()

    expect(screen.getByText('Ready')).toBeInTheDocument()
    expect(screen.getByText('No warnings')).toBeInTheDocument()
    expect(screen.getByText('Needs Review')).toBeInTheDocument()
    expect(screen.getByText('WARN or INFO items exist')).toBeInTheDocument()
    expect(screen.getByText('Blocked')).toBeInTheDocument()
    expect(screen.getByText('Cannot be approved until ERROR items are fixed')).toBeInTheDocument()

    expect(screen.getByText('Fix Your Score')).toBeInTheDocument()
    expect(screen.getByText('Density')).toBeInTheDocument()
    expect(screen.getByText('Spread bursts across more time')).toBeInTheDocument()
    expect(screen.getByText('Doubles/triples')).toBeInTheDocument()
    expect(screen.getByText('Stagger or remove stacked notes')).toBeInTheDocument()
  })

  it('groups warning codes by review outcome with readable fixes', () => {
    renderModal()

    expect(screen.getByRole('heading', { name: 'Blocking' })).toBeInTheDocument()
    expect(screen.getByText('Even out the hardest section')).toBeInTheDocument()
    expect(screen.getByText('DIFFICULTY_SPIKE')).toBeInTheDocument()

    expect(screen.getByRole('heading', { name: 'Needs Review' })).toBeInTheDocument()
    expect(screen.getByText('Snap notes closer to the beat grid')).toBeInTheDocument()
    expect(screen.getByText('EXCESSIVE_OFFBEAT')).toBeInTheDocument()

    expect(screen.getByRole('heading', { name: 'Info' })).toBeInTheDocument()
    expect(screen.getByText('Fill the gap or trim the song')).toBeInTheDocument()
    expect(screen.getByText('EMPTY_SECTION')).toBeInTheDocument()
  })

  it('keeps exact tier limits collapsed until requested', async () => {
    const user = userEvent.setup()
    renderModal()

    expect(screen.queryByText('NPS warn')).not.toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: /Advanced Limits/i }))

    expect(screen.getByText('NPS warn')).toBeInTheDocument()
    expect(screen.getByText('Max doubles/10s')).toBeInTheDocument()
    expect(screen.getByText('Triples are not allowed on Easy/Normal.')).toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Run the focused test and verify it fails**

Run:

```bash
pnpm --dir apps/web test -- DifficultyHelpModal.test.tsx
```

Expected: FAIL because the current modal title is "How Difficulty Works", the new guide card text does not exist, and the advanced limits behavior differs.

- [ ] **Step 3: Commit the failing tests**

```bash
git add apps/web/src/features/analysis/DifficultyHelpModal.test.tsx
git commit -m "test: cover difficulty guide redesign"
```

---

## Task 2: Replace The Dense Help Content With Guide Cards

**Files:**
- Modify: `apps/web/src/features/analysis/DifficultyHelpModal.tsx`

- [ ] **Step 1: Replace the component implementation**

Replace the full contents of `apps/web/src/features/analysis/DifficultyHelpModal.tsx` with:

```tsx
import { useState } from 'react'
import { Modal } from '../../components/ui'

interface Props {
  open: boolean
  onClose: () => void
}

const tierCards = [
  {
    tier: 'Easy',
    score: '0-2.9',
    speed: '1.0x',
    feel: 'Light taps, no doubles, simple rhythm',
    color: 'border-green-400/30 bg-green-400/[0.08] text-green-300',
  },
  {
    tier: 'Normal',
    score: '3-6.9',
    speed: '1.2x',
    feel: 'Steady rhythm, small jumps, light syncopation',
    color: 'border-blue-400/30 bg-blue-400/[0.08] text-blue-300',
  },
  {
    tier: 'Hard',
    score: '7-11.9',
    speed: '1.5x',
    feel: 'Faster patterns, more jumps, controlled doubles',
    color: 'border-orange-400/30 bg-orange-400/[0.08] text-orange-300',
  },
  {
    tier: 'Expert',
    score: '12-17.9',
    speed: '1.8x',
    feel: 'Dense bursts, off-beat pressure, harder holds',
    color: 'border-red-400/30 bg-red-400/[0.08] text-red-300',
  },
  {
    tier: 'Master',
    score: '18+',
    speed: '2.0x',
    feel: 'Peak density, wide jumps, advanced patterns',
    color: 'border-purple-400/30 bg-purple-400/[0.08] text-purple-300',
  },
]

const reviewBadges = [
  {
    title: 'Ready',
    detail: 'No warnings',
    className: 'border-green-400/30 bg-green-400/[0.08] text-green-300',
  },
  {
    title: 'Needs Review',
    detail: 'WARN or INFO items exist',
    className: 'border-yellow-400/30 bg-yellow-400/[0.08] text-yellow-200',
  },
  {
    title: 'Blocked',
    detail: 'Cannot be approved until ERROR items are fixed',
    className: 'border-red-400/30 bg-red-400/[0.08] text-red-300',
  },
]

const fixTips = [
  { factor: 'Density', trigger: 'Too many notes close together', fix: 'Spread bursts across more time' },
  { factor: 'Lane jumps', trigger: 'Consecutive notes move far across lanes', fix: 'Keep runs on nearby lanes' },
  { factor: 'Off-beat rhythm', trigger: 'Notes drift from the main grid', fix: 'Snap more notes to beats' },
  { factor: 'Holds', trigger: 'Holds overlap too many taps', fix: 'Shorten holds or clear nearby taps' },
  { factor: 'Doubles/triples', trigger: 'Too many simultaneous notes', fix: 'Stagger or remove stacked notes' },
  { factor: 'Speed', trigger: 'Scroll speed is above the tier target', fix: 'Lower speed in chart settings' },
  { factor: 'Pattern complexity', trigger: 'Lane order changes too unpredictably', fix: 'Reuse readable patterns' },
  { factor: 'Repetition', trigger: 'Too little repetition makes memory harder', fix: 'Repeat anchor patterns in sections' },
]

const warningGroups = [
  {
    title: 'Blocking',
    tone: 'border-red-400/25 bg-red-400/[0.06]',
    items: [
      { code: 'DIFFICULTY_SPIKE', fix: 'Even out the hardest section', detail: 'A segment is more than 3x the chart average.' },
      { code: 'HIGH_DENSITY', fix: 'Remove notes from dense bursts', detail: 'Notes-per-second exceeds the error limit.' },
      { code: 'TOO_MANY_TRIPLES', fix: 'Remove triples on Easy/Normal', detail: 'Three or more simultaneous notes block lower tiers.' },
    ],
  },
  {
    title: 'Needs Review',
    tone: 'border-yellow-400/25 bg-yellow-400/[0.06]',
    items: [
      { code: 'DIFFICULTY_SPIKE', fix: 'Smooth sudden difficulty jumps', detail: 'A segment is more than 2x the chart average.' },
      { code: 'HIGH_DENSITY', fix: 'Thin out the busiest moments', detail: 'Notes-per-second exceeds the warning limit.' },
      { code: 'EXCESSIVE_OFFBEAT', fix: 'Snap notes closer to the beat grid', detail: 'Too many notes land away from the main beat.' },
      { code: 'TOO_MANY_DOUBLES', fix: 'Stagger or remove doubles', detail: 'Too many two-note groups appear in a short window.' },
      { code: 'TOO_MANY_TRIPLES', fix: 'Reduce triple frequency', detail: 'Harder tiers allow only limited triple-note moments.' },
      { code: 'SPEED_TIER_MISMATCH', fix: 'Adjust speed in chart settings', detail: 'Scroll speed is far from the suggested tier speed.' },
      { code: 'HOLD_OVERLAP_STRESS', fix: 'Shorten holds or clear nearby taps', detail: 'A hold overlaps multiple taps on other lanes.' },
      { code: 'EXCESSIVE_LANE_JUMP', fix: 'Move consecutive notes closer together', detail: 'Several notes jump across five or more lanes.' },
    ],
  },
  {
    title: 'Info',
    tone: 'border-blue-400/25 bg-blue-400/[0.06]',
    items: [
      { code: 'EMPTY_SECTION', fix: 'Fill the gap or trim the song', detail: 'A five-second segment inside the song has no notes.' },
      { code: 'CHART_TOO_EASY_FOR_TIER', fix: 'Add notes or rename the chart', detail: 'The chart name implies a harder tier than the computed result.' },
    ],
  },
]

const tierLimits = [
  { tier: 'Easy', npsWarn: 2.5, npsErr: 3.5, offbeat: '20%', doubles: 0, speed: '1.0x' },
  { tier: 'Normal', npsWarn: 4.0, npsErr: 5.5, offbeat: '35%', doubles: 1, speed: '1.2x' },
  { tier: 'Hard', npsWarn: 6.0, npsErr: 7.5, offbeat: '50%', doubles: 3, speed: '1.5x' },
  { tier: 'Expert', npsWarn: 8.0, npsErr: 10.0, offbeat: '65%', doubles: 5, speed: '1.8x' },
  { tier: 'Master', npsWarn: 10.0, npsErr: 12.0, offbeat: '80%', doubles: 8, speed: '2.0x' },
]

function TierCard({ tier, score, speed, feel, color }: (typeof tierCards)[number]) {
  return (
    <div className={`rounded-lg border p-3 ${color}`}>
      <div className="flex items-start justify-between gap-2">
        <span className="text-sm font-semibold text-shell-text">{tier}</span>
        <span className="rounded border border-current/30 px-1.5 py-0.5 text-[10px] font-semibold">
          {speed}
        </span>
      </div>
      <p className="mt-2 font-mono text-lg font-semibold">{score}</p>
      <p className="mt-1 text-[11px] leading-snug text-shell-muted">{feel}</p>
    </div>
  )
}

function ReviewBadge({ title, detail, className }: (typeof reviewBadges)[number]) {
  return (
    <div className={`rounded-lg border px-3 py-2 ${className}`}>
      <p className="text-xs font-semibold text-shell-text">{title}</p>
      <p className="mt-0.5 text-[11px] leading-snug text-shell-muted">{detail}</p>
    </div>
  )
}

function FixTipCard({ factor, trigger, fix }: (typeof fixTips)[number]) {
  return (
    <div className="rounded-lg border border-shell-border bg-shell-surface/70 p-3">
      <p className="text-xs font-semibold text-shell-text">{factor}</p>
      <p className="mt-1 text-[11px] leading-snug text-shell-muted">{trigger}</p>
      <p className="mt-2 rounded-md bg-shell-bg/70 px-2 py-1.5 text-[11px] font-medium leading-snug text-shell-text">
        {fix}
      </p>
    </div>
  )
}

function WarningGroup({ title, tone, items }: (typeof warningGroups)[number]) {
  return (
    <section className={`rounded-lg border p-3 ${tone}`}>
      <h3 className="text-xs font-semibold text-shell-text">{title}</h3>
      <div className="mt-2 space-y-2">
        {items.map((item) => (
          <div key={`${title}-${item.code}-${item.fix}`} className="rounded-md bg-shell-bg/55 px-2.5 py-2">
            <div className="flex flex-wrap items-center gap-2">
              <p className="text-[11px] font-semibold text-shell-text">{item.fix}</p>
              <span className="rounded border border-shell-border bg-shell-surface px-1.5 py-0.5 font-mono text-[9px] text-shell-muted">
                {item.code}
              </span>
            </div>
            <p className="mt-1 text-[10px] leading-snug text-shell-muted">{item.detail}</p>
          </div>
        ))}
      </div>
    </section>
  )
}

function AdvancedLimits() {
  const [open, setOpen] = useState(false)

  return (
    <section className="border-t border-shell-border pt-3">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        className="flex w-full items-center justify-between rounded-md px-0 py-2 text-left text-sm font-semibold text-shell-text hover:text-primary"
        aria-expanded={open}
      >
        Advanced Limits
        <span className="ml-2 text-shell-muted">{open ? '▲' : '▼'}</span>
      </button>
      {open && (
        <div className="mt-2 overflow-x-auto">
          <table className="w-full min-w-[560px] text-left text-xs text-shell-muted">
            <thead>
              <tr className="text-[10px] uppercase text-shell-muted">
                <th className="pb-1 pr-3">Tier</th>
                <th className="pb-1 pr-3">NPS warn</th>
                <th className="pb-1 pr-3">NPS error</th>
                <th className="pb-1 pr-3">Max offbeat</th>
                <th className="pb-1 pr-3">Max doubles/10s</th>
                <th className="pb-1">Suggested speed</th>
              </tr>
            </thead>
            <tbody>
              {tierLimits.map((row) => (
                <tr key={row.tier} className="border-t border-shell-border/50">
                  <td className="py-1 pr-3 font-semibold text-shell-text">{row.tier}</td>
                  <td className="py-1 pr-3 font-mono">{row.npsWarn}</td>
                  <td className="py-1 pr-3 font-mono">{row.npsErr}</td>
                  <td className="py-1 pr-3">{row.offbeat}</td>
                  <td className="py-1 pr-3">{row.doubles}</td>
                  <td className="py-1">{row.speed}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="mt-2 text-[10px] leading-snug text-shell-muted">
            NPS = notes per second averaged over a 5s segment. Doubles = simultaneous 2-note groups.
            Triples are not allowed on Easy/Normal.
          </p>
        </div>
      )}
    </section>
  )
}

export function DifficultyHelpModal({ open, onClose }: Props) {
  return (
    <Modal.Root open={open} onOpenChange={(nextOpen) => { if (!nextOpen) onClose() }}>
      <Modal.Content className="max-h-[85vh] max-w-3xl flex flex-col">
        <Modal.Header onClose={onClose}>Difficulty Guide</Modal.Header>
        <Modal.Body className="flex-1 overflow-y-auto">
          <div className="space-y-5">
            <p className="text-sm leading-relaxed text-shell-muted">
              Learn what each tier means, why a chart gets reviewed, and the fastest ways to lower difficulty.
            </p>

            <section>
              <div className="mb-2 flex items-center justify-between gap-3">
                <h2 className="text-sm font-semibold text-shell-text">Tier Ladder</h2>
                <span className="text-[11px] text-shell-muted">Score is averaged from 5s segments</span>
              </div>
              <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-5">
                {tierCards.map((tier) => (
                  <TierCard key={tier.tier} {...tier} />
                ))}
              </div>
            </section>

            <section>
              <h2 className="mb-2 text-sm font-semibold text-shell-text">Review Status</h2>
              <div className="grid gap-2 sm:grid-cols-3">
                {reviewBadges.map((badge) => (
                  <ReviewBadge key={badge.title} {...badge} />
                ))}
              </div>
            </section>

            <section>
              <h2 className="mb-2 text-sm font-semibold text-shell-text">Fix Your Score</h2>
              <div className="grid gap-2 sm:grid-cols-2">
                {fixTips.map((tip) => (
                  <FixTipCard key={tip.factor} {...tip} />
                ))}
              </div>
            </section>

            <section>
              <h2 className="mb-2 text-sm font-semibold text-shell-text">Warning Codes</h2>
              <div className="grid gap-2 lg:grid-cols-3">
                {warningGroups.map((group) => (
                  <WarningGroup key={group.title} {...group} />
                ))}
              </div>
            </section>

            <AdvancedLimits />
          </div>
        </Modal.Body>
      </Modal.Content>
    </Modal.Root>
  )
}
```

- [ ] **Step 2: Run the focused test and verify it passes**

Run:

```bash
pnpm --dir apps/web test -- DifficultyHelpModal.test.tsx
```

Expected: PASS for all `DifficultyHelpModal` tests.

- [ ] **Step 3: Commit the modal redesign**

```bash
git add apps/web/src/features/analysis/DifficultyHelpModal.tsx apps/web/src/features/analysis/DifficultyHelpModal.test.tsx
git commit -m "feat: redesign difficulty guide modal"
```

---

## Task 3: Run Broader Verification And Adjust If Needed

**Files:**
- Modify only if verification finds a real issue:
  - `apps/web/src/features/analysis/DifficultyHelpModal.tsx`
  - `apps/web/src/features/analysis/DifficultyHelpModal.test.tsx`

- [ ] **Step 1: Run all web tests**

Run:

```bash
pnpm --dir apps/web test
```

Expected: PASS.

- [ ] **Step 2: Run the web build**

Run:

```bash
pnpm --dir apps/web build
```

Expected: PASS. The TypeScript build should accept the static tuple-derived prop types in helper components.

- [ ] **Step 3: If TypeScript rejects tuple-derived component prop types, replace them with explicit types**

If the build fails around `(typeof tierCards)[number]`, add these types near the top of `DifficultyHelpModal.tsx` and update helper signatures:

```tsx
interface TierCardData {
  tier: string
  score: string
  speed: string
  feel: string
  color: string
}

interface ReviewBadgeData {
  title: string
  detail: string
  className: string
}

interface FixTipData {
  factor: string
  trigger: string
  fix: string
}

interface WarningItem {
  code: string
  fix: string
  detail: string
}

interface WarningGroupData {
  title: string
  tone: string
  items: WarningItem[]
}
```

Then change:

```tsx
function TierCard({ tier, score, speed, feel, color }: TierCardData) {
```

```tsx
function ReviewBadge({ title, detail, className }: ReviewBadgeData) {
```

```tsx
function FixTipCard({ factor, trigger, fix }: FixTipData) {
```

```tsx
function WarningGroup({ title, tone, items }: WarningGroupData) {
```

And type the arrays:

```tsx
const tierCards: TierCardData[] = [
```

```tsx
const reviewBadges: ReviewBadgeData[] = [
```

```tsx
const fixTips: FixTipData[] = [
```

```tsx
const warningGroups: WarningGroupData[] = [
```

- [ ] **Step 4: Re-run verification after any adjustment**

Run:

```bash
pnpm --dir apps/web test
pnpm --dir apps/web build
```

Expected: both PASS.

- [ ] **Step 5: Commit verification fixes if Step 3 changed files**

Only run this commit if Step 3 required edits:

```bash
git add apps/web/src/features/analysis/DifficultyHelpModal.tsx apps/web/src/features/analysis/DifficultyHelpModal.test.tsx
git commit -m "fix: stabilize difficulty guide types"
```

---

## Task 4: Final Manual Review

**Files:**
- Read:
  - `apps/web/src/features/analysis/DifficultyHelpModal.tsx`
  - `apps/web/src/features/analysis/DifficultyHelpModal.test.tsx`

- [ ] **Step 1: Inspect the final diff**

Run:

```bash
git diff --stat HEAD~2..HEAD
git diff HEAD~2..HEAD -- apps/web/src/features/analysis/DifficultyHelpModal.tsx apps/web/src/features/analysis/DifficultyHelpModal.test.tsx
```

Expected: The diff only changes the modal and its tests. It should not modify difficulty calculation logic, validation rules, routes, or API code.

- [ ] **Step 2: Confirm spec coverage manually**

Check these seven points in the final code:

```text
1. Modal title is Difficulty Guide.
2. Tier cards replace the tier table in the first visible section.
3. Fix-tip cards replace the factor table.
4. Warning codes are grouped by Blocking, Needs Review, and Info.
5. Advanced Limits is collapsed by default and contains exact threshold values.
6. DifficultyHelpModal still accepts only open and onClose props.
7. No difficulty calculation or validation logic changed.
```

- [ ] **Step 3: Commit nothing if the review is clean**

If Step 1 and Step 2 are clean, do not create an empty commit. Report verification results and the commit hashes from Tasks 1-3.

---

## Self-Review Notes

- Spec coverage: Tier cards, review badges, fix-tip cards, warning groups, advanced limits, unchanged API, responsive modal layout, and no backend/store/routing changes are covered by Tasks 1-4.
- Placeholder scan: No unresolved placeholder markers or unspecified "add tests later" steps remain.
- Type consistency: Helper component props are derived from static arrays in Task 2, with explicit fallback types documented in Task 3 if the build rejects the inferred forms.
