# Difficulty Help Modal Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a `DifficultyHelpModal` component that explains the difficulty scoring system, triggered from the Analysis Board header and the editor `AnalysisSummaryPanel`.

**Architecture:** Single new static component using the existing Radix-backed `Modal` primitive. Two trigger points each manage their own `open` boolean via `useState`. No new routes, no store, no API calls.

**Tech Stack:** React 18, TypeScript, Tailwind CSS, Radix UI (via existing `Modal` wrapper in `apps/web/src/components/ui/Modal.tsx`)

**Spec:** `docs/superpowers/specs/2026-05-25-difficulty-help-modal-design.md`

---

## File Map

| Path | Action | Responsibility |
|------|--------|---------------|
| `apps/web/src/features/analysis/DifficultyHelpModal.tsx` | **Create** | Modal component — all static content, 4 accordion sections |
| `apps/web/src/features/analysis/AnalysisBoardPage.tsx` | **Modify** | Add `?` icon button + `useState` + render `<DifficultyHelpModal>` |
| `apps/web/src/features/editor/components/AnalysisSummaryPanel.tsx` | **Modify** | Add `?` text link + `useState` + render `<DifficultyHelpModal>` |

---

## Task 1: Create `DifficultyHelpModal` component

**Files:**
- Create: `apps/web/src/features/analysis/DifficultyHelpModal.tsx`

### Background

The existing `Modal` primitive lives at `apps/web/src/components/ui/Modal.tsx`. It wraps Radix `@radix-ui/react-dialog` and exposes:

```tsx
Modal.Root        // controlled via open + onOpenChange props
Modal.Content     // portal + overlay + positioned box, accepts className
Modal.Header      // title row with optional onClose button
Modal.Body        // padded content wrapper, accepts className
```

`Modal.Root` accepts `open: boolean` and `onOpenChange: (open: boolean) => void`.

The accordion state is a single `useState<string | null>` — only one section open at a time. Clicking an open section closes it; clicking a closed section opens it (replacing whichever was open).

- [ ] **Step 1: Create the file with all imports and the accordion helper**

Create `apps/web/src/features/analysis/DifficultyHelpModal.tsx`:

```tsx
import { useState } from 'react'
import { Modal } from '../../components/ui'

interface Props {
  open: boolean
  onClose: () => void
}

function Accordion({
  id,
  title,
  openId,
  onToggle,
  children,
}: {
  id: string
  title: string
  openId: string | null
  onToggle: (id: string) => void
  children: React.ReactNode
}) {
  const isOpen = openId === id
  return (
    <div className="border-b border-shell-border last:border-0">
      <button
        type="button"
        onClick={() => onToggle(id)}
        className="flex w-full items-center justify-between px-0 py-3 text-left text-sm font-medium text-shell-text hover:text-primary"
      >
        {title}
        <span className="ml-2 text-shell-muted">{isOpen ? '▲' : '▼'}</span>
      </button>
      {isOpen && <div className="pb-4 text-xs text-shell-muted">{children}</div>}
    </div>
  )
}
```

- [ ] **Step 2: Add the tier table sub-component**

Append to the same file (before the default export):

```tsx
function TierTable() {
  const rows = [
    { tier: 'Easy',   range: '0 – 2.9',   color: 'text-green-400' },
    { tier: 'Normal', range: '3 – 6.9',   color: 'text-blue-400'  },
    { tier: 'Hard',   range: '7 – 11.9',  color: 'text-orange-400'},
    { tier: 'Expert', range: '12 – 17.9', color: 'text-red-400'   },
    { tier: 'Master', range: '18+',       color: 'text-purple-400'},
  ]
  return (
    <table className="mt-2 w-full text-left">
      <thead>
        <tr className="text-[10px] uppercase tracking-wide text-shell-muted">
          <th className="pb-1 pr-4">Tier</th>
          <th className="pb-1">Score range</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((r) => (
          <tr key={r.tier}>
            <td className={`py-0.5 pr-4 font-semibold ${r.color}`}>{r.tier}</td>
            <td className="py-0.5 font-mono">{r.range}</td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}
```

- [ ] **Step 3: Add the factors table sub-component**

Append to the same file:

```tsx
function FactorsTable() {
  const rows = [
    { factor: 'Density',             measures: 'Notes per second',                        lower: 'Space notes apart, reduce bursts' },
    { factor: 'Speed',               measures: 'Scroll speed multiplier',                 lower: 'Lower speed in chart settings' },
    { factor: 'Lane jumps',          measures: 'Avg lane distance between consecutive notes', lower: 'Keep adjacent notes on nearby lanes' },
    { factor: 'Syncopation',         measures: 'Notes placed off the main beat grid',     lower: 'Snap more notes to beats' },
    { factor: 'Hold notes',          measures: 'Long holds + overlap with taps during holds', lower: 'Shorten holds, reduce overlap' },
    { factor: 'Simultaneous',        measures: 'Ratio of double/triple note groups',      lower: 'Stagger notes slightly' },
    { factor: 'Pattern complexity',  measures: 'Entropy of lane transitions',             lower: 'Repeat familiar lane patterns' },
    { factor: 'Repetition',          measures: 'How much chart repeats (higher = easier)', lower: 'Vary patterns to reduce repetition' },
  ]
  return (
    <table className="mt-2 w-full text-left">
      <thead>
        <tr className="text-[10px] uppercase tracking-wide text-shell-muted">
          <th className="pb-1 pr-3 w-1/4">Factor</th>
          <th className="pb-1 pr-3 w-2/5">Measures</th>
          <th className="pb-1">How to lower</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((r) => (
          <tr key={r.factor} className="align-top">
            <td className="py-0.5 pr-3 font-medium text-shell-text">{r.factor}</td>
            <td className="py-0.5 pr-3">{r.measures}</td>
            <td className="py-0.5">{r.lower}</td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}
```

- [ ] **Step 4: Add the warnings table sub-component**

Append to the same file:

```tsx
function WarningsHelp() {
  const rows = [
    { code: 'DIFFICULTY_SPIKE',       sev: 'ERROR/WARN', meaning: 'One segment is >3× (ERROR) or >2× (WARN) the average score', fix: 'Even out note density across the chart' },
    { code: 'HIGH_DENSITY',           sev: 'ERROR/WARN', meaning: 'Notes-per-second exceeds tier limit',                         fix: 'Remove notes from dense bursts' },
    { code: 'EXCESSIVE_OFFBEAT',      sev: 'WARN',       meaning: 'Too many off-beat notes for this tier',                       fix: 'Snap notes closer to the beat grid' },
    { code: 'TOO_MANY_DOUBLES',       sev: 'WARN',       meaning: 'Too many 2-note simultaneous groups in a 10s window',         fix: 'Stagger or remove doubles' },
    { code: 'TOO_MANY_TRIPLES',       sev: 'ERROR/WARN', meaning: 'Triple+ notes — not allowed on Easy/Normal; limit 2/min elsewhere', fix: 'Remove triples on Easy/Normal; reduce frequency on others' },
    { code: 'SPEED_TIER_MISMATCH',    sev: 'WARN',       meaning: 'Speed multiplier differs >0.3× from suggested for this tier', fix: 'Adjust speed in chart settings' },
    { code: 'EMPTY_SECTION',          sev: 'INFO',       meaning: 'A 5s segment inside content range has zero notes',            fix: 'Fill the gap or trim the song' },
    { code: 'HOLD_OVERLAP_STRESS',    sev: 'WARN',       meaning: 'A hold overlaps 2+ taps on other lanes simultaneously',      fix: 'Shorten hold or remove overlapping taps' },
    { code: 'EXCESSIVE_LANE_JUMP',    sev: 'WARN',       meaning: 'Three consecutive lane jumps of ≥5 lanes',                   fix: 'Move consecutive notes closer together' },
    { code: 'CHART_TOO_EASY_FOR_TIER',sev: 'INFO',       meaning: 'Chart name implies Hard+ but computed difficulty is Easy',   fix: 'Add more notes or rename the chart' },
  ]
  const sevColor: Record<string, string> = {
    'ERROR/WARN': 'text-orange-400',
    'ERROR':      'text-red-400',
    'WARN':       'text-yellow-400',
    'INFO':       'text-blue-400',
  }
  return (
    <div className="mt-2 space-y-3">
      <p className="text-[11px] text-shell-text font-medium">Review status meanings:</p>
      <ul className="mb-3 space-y-0.5">
        <li><span className="font-semibold text-success">Ready</span> — no warnings</li>
        <li><span className="font-semibold text-warning">Needs review</span> — one or more WARN or INFO warnings</li>
        <li><span className="font-semibold text-error">Blocked</span> — at least one ERROR; chart cannot be approved</li>
      </ul>
      <table className="w-full text-left">
        <thead>
          <tr className="text-[10px] uppercase tracking-wide text-shell-muted">
            <th className="pb-1 pr-3 w-1/4">Code</th>
            <th className="pb-1 pr-3 w-1/6">Severity</th>
            <th className="pb-1 pr-3">Meaning</th>
            <th className="pb-1">Fix</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.code} className="align-top border-t border-shell-border/50">
              <td className="py-1 pr-3 font-mono text-[10px] text-shell-text">{r.code}</td>
              <td className={`py-1 pr-3 font-semibold ${sevColor[r.sev] ?? ''}`}>{r.sev}</td>
              <td className="py-1 pr-3">{r.meaning}</td>
              <td className="py-1">{r.fix}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
```

- [ ] **Step 5: Add the tier limits table sub-component**

Append to the same file:

```tsx
function TierLimitsTable() {
  const rows = [
    { tier: 'Easy',   npsWarn: 2.5, npsErr: 3.5,  offbeat: '20%', doubles: 0, speed: '1.0×' },
    { tier: 'Normal', npsWarn: 4.0, npsErr: 5.5,  offbeat: '35%', doubles: 1, speed: '1.2×' },
    { tier: 'Hard',   npsWarn: 6.0, npsErr: 7.5,  offbeat: '50%', doubles: 3, speed: '1.5×' },
    { tier: 'Expert', npsWarn: 8.0, npsErr: 10.0, offbeat: '65%', doubles: 5, speed: '1.8×' },
    { tier: 'Master', npsWarn: 10.0,npsErr: 12.0, offbeat: '80%', doubles: 8, speed: '2.0×' },
  ]
  return (
    <table className="mt-2 w-full text-left">
      <thead>
        <tr className="text-[10px] uppercase tracking-wide text-shell-muted">
          <th className="pb-1 pr-3">Tier</th>
          <th className="pb-1 pr-3">NPS warn</th>
          <th className="pb-1 pr-3">NPS error</th>
          <th className="pb-1 pr-3">Max offbeat</th>
          <th className="pb-1 pr-3">Max doubles/10s</th>
          <th className="pb-1">Suggested speed</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((r) => (
          <tr key={r.tier} className="border-t border-shell-border/50">
            <td className="py-0.5 pr-3 font-medium text-shell-text">{r.tier}</td>
            <td className="py-0.5 pr-3 font-mono">{r.npsWarn}</td>
            <td className="py-0.5 pr-3 font-mono">{r.npsErr}</td>
            <td className="py-0.5 pr-3">{r.offbeat}</td>
            <td className="py-0.5 pr-3">{r.doubles}</td>
            <td className="py-0.5">{r.speed}</td>
          </tr>
        ))}
      </tbody>
      <tfoot>
        <tr>
          <td colSpan={6} className="pt-2 text-[10px] text-shell-muted">
            NPS = notes per second averaged over a 5s segment. Doubles = simultaneous 2-note groups. Triples forbidden on Easy/Normal.
          </td>
        </tr>
      </tfoot>
    </table>
  )
}
```

- [ ] **Step 6: Add the main `DifficultyHelpModal` export**

Append to the same file:

```tsx
export function DifficultyHelpModal({ open, onClose }: Props) {
  const [openSection, setOpenSection] = useState<string | null>(null)

  function toggle(id: string) {
    setOpenSection((prev) => (prev === id ? null : id))
  }

  return (
    <Modal.Root open={open} onOpenChange={(o) => { if (!o) onClose() }}>
      <Modal.Content className="max-w-2xl max-h-[85vh] flex flex-col">
        <Modal.Header onClose={onClose}>How Difficulty Works</Modal.Header>
        <Modal.Body className="overflow-y-auto flex-1">
          {/* Overview */}
          <p className="mb-4 text-sm text-shell-muted leading-relaxed">
            Difficulty is computed automatically from your chart's notes. Every 5 seconds is scored; the note-count-weighted average sets the tier.{' '}
            <span className="font-medium text-shell-text">Average load</span> = overall difficulty.{' '}
            <span className="font-medium text-shell-text">Peak score</span> = the hardest 5-second window.
          </p>

          {/* Accordions */}
          <Accordion id="tiers" title="How Tiers Are Scored" openId={openSection} onToggle={toggle}>
            <p className="mb-2">Segment score formula:</p>
            <code className="block rounded bg-shell-surface px-3 py-2 text-[11px] text-shell-text leading-relaxed">
              NPS×2.0 + LaneJump×1.5 + OffBeat×3.0 + HoldRatio×2.0<br />
              + SimRatio×3.0 + Complexity×2.5 + Speed×2.0 + Surprise×1.5
            </code>
            <TierTable />
          </Accordion>

          <Accordion id="factors" title="The 8 Factors (0–1 scale each)" openId={openSection} onToggle={toggle}>
            <p className="mb-1">Each factor is normalized 0–1 and weighted as shown in the formula above.</p>
            <FactorsTable />
          </Accordion>

          <Accordion id="warnings" title="Warning Codes" openId={openSection} onToggle={toggle}>
            <WarningsHelp />
          </Accordion>

          <Accordion id="limits" title="Tier Limits" openId={openSection} onToggle={toggle}>
            <TierLimitsTable />
          </Accordion>
        </Modal.Body>
      </Modal.Content>
    </Modal.Root>
  )
}
```

- [ ] **Step 7: Verify TypeScript compiles**

```bash
cd apps/web && npx tsc --noEmit 2>&1 | grep DifficultyHelpModal
```

Expected: no output (no errors).

- [ ] **Step 8: Commit**

```bash
git add apps/web/src/features/analysis/DifficultyHelpModal.tsx
git commit -m "feat(analysis): add DifficultyHelpModal component"
```

---

## Task 2: Wire trigger into `AnalysisBoardPage`

**Files:**
- Modify: `apps/web/src/features/analysis/AnalysisBoardPage.tsx`

### Background

The header block (around line 67–95) renders the difficulty badge and speed in a `flex items-center gap-2` div. We add a `?` icon button next to it and manage `open` state with `useState`.

Current badge row (lines 78–85):
```tsx
{chart && (
  <>
    <Badge size="sm" variant={SongDifficultyEnum.variant(chart.computedDifficulty)}>
      {SongDifficultyEnum.label(chart.computedDifficulty)}
    </Badge>
    <span className="text-sm text-shell-muted">{chart.speedMultiplier.toFixed(1)}×</span>
  </>
)}
```

- [ ] **Step 1: Add import and state**

In `AnalysisBoardPage.tsx`, add at the top of the imports block:

```tsx
import { useState } from 'react'
import { DifficultyHelpModal } from './DifficultyHelpModal'
```

Add inside the component function body (after existing `const` declarations):

```tsx
const [helpOpen, setHelpOpen] = useState(false)
```

- [ ] **Step 2: Replace the badge block to include the `?` button**

Find this exact block:

```tsx
{chart && (
  <>
    <Badge size="sm" variant={SongDifficultyEnum.variant(chart.computedDifficulty)}>
      {SongDifficultyEnum.label(chart.computedDifficulty)}
    </Badge>
    <span className="text-sm text-shell-muted">{chart.speedMultiplier.toFixed(1)}×</span>
  </>
)}
```

Replace with:

```tsx
{chart && (
  <>
    <Badge size="sm" variant={SongDifficultyEnum.variant(chart.computedDifficulty)}>
      {SongDifficultyEnum.label(chart.computedDifficulty)}
    </Badge>
    <span className="text-sm text-shell-muted">{chart.speedMultiplier.toFixed(1)}×</span>
    <button
      type="button"
      onClick={() => setHelpOpen(true)}
      className="rounded-full px-1.5 py-0.5 text-[11px] text-shell-muted hover:text-primary hover:bg-shell-bg"
      title="How difficulty works"
    >
      ?
    </button>
  </>
)}
```

- [ ] **Step 3: Render the modal**

At the bottom of the return statement, just before the closing `</AppShell>` tag, add:

```tsx
<DifficultyHelpModal open={helpOpen} onClose={() => setHelpOpen(false)} />
```

- [ ] **Step 4: Verify TypeScript compiles**

```bash
cd apps/web && npx tsc --noEmit 2>&1 | grep AnalysisBoardPage
```

Expected: no output.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/features/analysis/AnalysisBoardPage.tsx
git commit -m "feat(analysis): add difficulty help trigger to Analysis Board header"
```

---

## Task 3: Wire trigger into `AnalysisSummaryPanel`

**Files:**
- Modify: `apps/web/src/features/editor/components/AnalysisSummaryPanel.tsx`

### Background

The panel already imports `Link` from react-router-dom and ends with an "Open Analysis Board →" link (lines 107–113). We add a small `?` link below that, and manage `open` state locally.

Current closing block:
```tsx
<Link
  data-tour="open-analysis-board"
  to={`/projects/${projectId}/songs/${songId}/charts/${chartId}/analysis`}
  className="block text-center text-[11px] text-primary hover:underline"
>
  Open Analysis Board →
</Link>
```

- [ ] **Step 1: Add import and state**

At the top of `AnalysisSummaryPanel.tsx`, add to the existing imports:

```tsx
import { useState } from 'react'
import { DifficultyHelpModal } from '../../analysis/DifficultyHelpModal'
```

Add inside the component function body (after existing `const` declarations):

```tsx
const [helpOpen, setHelpOpen] = useState(false)
```

- [ ] **Step 2: Add the `?` trigger link below the Analysis Board link**

Find:

```tsx
<Link
  data-tour="open-analysis-board"
  to={`/projects/${projectId}/songs/${songId}/charts/${chartId}/analysis`}
  className="block text-center text-[11px] text-primary hover:underline"
>
  Open Analysis Board →
</Link>
```

Replace with:

```tsx
<div className="flex items-center justify-between">
  <Link
    data-tour="open-analysis-board"
    to={`/projects/${projectId}/songs/${songId}/charts/${chartId}/analysis`}
    className="text-[11px] text-primary hover:underline"
  >
    Open Analysis Board →
  </Link>
  <button
    type="button"
    onClick={() => setHelpOpen(true)}
    className="text-[11px] text-shell-muted hover:text-primary"
    title="How difficulty works"
  >
    How does this work?
  </button>
</div>
```

- [ ] **Step 3: Render the modal**

Just before the closing `</div>` of the outer wrapper (the last `</div>` in the return), add:

```tsx
<DifficultyHelpModal open={helpOpen} onClose={() => setHelpOpen(false)} />
```

- [ ] **Step 4: Verify TypeScript compiles**

```bash
cd apps/web && npx tsc --noEmit 2>&1 | grep AnalysisSummaryPanel
```

Expected: no output.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/features/editor/components/AnalysisSummaryPanel.tsx
git commit -m "feat(editor): add difficulty help trigger to AnalysisSummaryPanel"
```

---

## Task 4: Manual smoke test

No automated tests are appropriate here — the component is static UI with no logic beyond accordion toggling.

- [ ] **Step 1: Start dev server**

```bash
pnpm dev
```

Navigate to `http://localhost:3000`. Log in if needed.

- [ ] **Step 2: Test Analysis Board trigger**

Open any chart's Analysis Board (`/projects/:id/songs/:id/charts/:id/analysis`).

Check:
- `?` button appears next to difficulty badge in the header
- Clicking it opens the modal
- Modal has header "How Difficulty Works"
- Pressing Escape closes the modal
- Clicking `×` closes the modal
- All 4 accordions are present and collapsed by default
- Clicking each opens it; clicking again closes it
- Only one accordion can be open at a time

- [ ] **Step 3: Test editor panel trigger**

Open any song in the editor. Find the `AnalysisSummaryPanel` in the sidebar.

Check:
- "How does this work?" link appears below "Open Analysis Board →"
- Clicking it opens the same modal
- Same Escape / × behavior

- [ ] **Step 4: Final commit**

```bash
git add .
git commit -m "feat(analysis): difficulty help modal — complete"
```
