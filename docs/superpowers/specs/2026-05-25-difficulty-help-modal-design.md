# Difficulty Help Modal — Design Spec

**Date:** 2026-05-25  
**Status:** Approved  
**Audience:** Composers and QA reviewers

---

## Problem

The Analysis Board and editor panel expose difficulty scores, factor bars, and warning codes with no in-product explanation. Users cannot understand what "Average load 8.3" means, why `DIFFICULTY_SPIKE` blocks publish, or how to lower a factor score.

---

## Solution

A single reusable `DifficultyHelpModal` component triggered from two points:

1. `?` icon button next to the difficulty badge in the Analysis Board header
2. `?` text link in the editor `AnalysisSummaryPanel`

The modal uses layered disclosure: a short always-visible overview, then four collapsible accordion sections for progressive depth.

---

## Architecture

### New file

```
apps/web/src/features/analysis/DifficultyHelpModal.tsx
```

### Modified files

| File | Change |
|------|--------|
| `apps/web/src/features/analysis/AnalysisBoardPage.tsx` | Add `?` button in header + `useState(false)` + `<DifficultyHelpModal>` |
| `apps/web/src/features/editor/components/AnalysisSummaryPanel.tsx` | Add `?` link + `useState(false)` + `<DifficultyHelpModal>` |

### Component API

```tsx
interface DifficultyHelpModalProps {
  open: boolean
  onClose: () => void
}
```

No props for content — all content is static. No data fetching, no store, no new routes.

### Accordion state

Single `useState<string | null>` — one section open at a time, default all closed.

### UI primitives

Use existing `Dialog` from `apps/web/src/components/ui/` if it exists. Fallback: fixed overlay with focus trap.

---

## Content

### Overview (always visible)

> "Difficulty is computed automatically from your chart's notes. Every 5 seconds is scored; the weighted average sets the tier. Peak shows the hardest moment."

---

### Accordion 1 — How Tiers Are Scored

**Score formula** (per 5-second segment):

```
score = NPS×2.0 + LaneJump×1.5 + OffBeat×3.0 + HoldRatio×2.0
      + SimRatio×3.0 + Complexity×2.5 + Speed×2.0 + Surprise×1.5
```

`Average load` = note-count-weighted average of all segment scores.  
`Peak score` = single highest segment score (worst 5-second window).

**Tier thresholds:**

| Tier   | Score range | Color  |
|--------|-------------|--------|
| Easy   | 0 – 2.9     | Green  |
| Normal | 3 – 6.9     | Blue   |
| Hard   | 7 – 11.9    | Amber  |
| Expert | 12 – 17.9   | Red    |
| Master | 18+         | Purple |

---

### Accordion 2 — The 8 Factors

All factors are normalized 0–1. Each contributes to the segment score with its weight above.

| Factor | What it measures | How to lower it |
|--------|-----------------|-----------------|
| Density | Notes per second | Space notes apart, reduce bursts |
| Speed | Scroll speed multiplier | Lower speed in chart settings |
| Lane jumps | Avg lane distance between consecutive notes | Keep adjacent notes on nearby lanes |
| Syncopation | Notes placed off the main beat grid | Snap more notes to beats |
| Hold notes | Long holds + overlap with taps during holds | Shorten holds, reduce overlap |
| Simultaneous | Ratio of double/triple note groups | Stagger notes slightly |
| Pattern complexity | Shannon entropy of lane transitions | Repeat familiar lane patterns in sections |
| Repetition | How much the chart repeats (higher = easier to memorize) | Vary patterns to reduce repetition |

---

### Accordion 3 — Warning Codes

| Code | Severity | Meaning | How to fix |
|------|----------|---------|-----------|
| `DIFFICULTY_SPIKE` | ERROR / WARN | One segment is >3× (ERROR) or >2× (WARN) the average score | Even out note density across the chart |
| `HIGH_DENSITY` | ERROR / WARN | Notes-per-second exceeds tier limit | Remove notes from dense bursts |
| `EXCESSIVE_OFFBEAT` | WARN | Too many off-beat notes for this tier | Snap notes closer to the beat grid |
| `TOO_MANY_DOUBLES` | WARN | Too many 2-note simultaneous groups in a 10s window | Stagger or remove doubles |
| `TOO_MANY_TRIPLES` | ERROR (Easy/Normal) / WARN | 3+ notes at the same time | Not allowed on Easy/Normal; limit to 2/min on other tiers |
| `SPEED_TIER_MISMATCH` | WARN | Speed multiplier differs >0.3× from the suggested value for this tier | Adjust speed in chart settings |
| `EMPTY_SECTION` | INFO | A 5s segment inside the content range has zero notes | Fill the gap or trim the song |
| `HOLD_OVERLAP_STRESS` | WARN | A hold note overlaps 2+ taps on other lanes simultaneously | Shorten the hold or remove overlapping taps |
| `EXCESSIVE_LANE_JUMP` | WARN | Three consecutive lane jumps of ≥5 lanes | Move consecutive notes closer together |
| `CHART_TOO_EASY_FOR_TIER` | INFO | Chart name implies Hard+ but computed difficulty is Easy | Add more notes or rename the chart |

**Review status meaning:**
- **Ready** — no warnings
- **Needs review** — one or more WARN or INFO warnings
- **Blocked** — at least one ERROR; chart cannot be approved for publish

---

### Accordion 4 — Tier Limits

| Tier   | NPS warn | NPS error | Max offbeat | Max doubles/10s | Suggested speed |
|--------|----------|-----------|-------------|-----------------|-----------------|
| Easy   | 2.5      | 3.5       | 20%         | 0               | 1.0×            |
| Normal | 4.0      | 5.5       | 35%         | 1               | 1.2×            |
| Hard   | 6.0      | 7.5       | 50%         | 3               | 1.5×            |
| Expert | 8.0      | 10.0      | 65%         | 5               | 1.8×            |
| Master | 10.0     | 12.0      | 80%         | 8               | 2.0×            |

NPS = notes per second (averaged over a 5s segment).  
Doubles = simultaneous 2-note groups. Triples are not allowed on Easy/Normal.

---

## Out of Scope

- Contextual per-factor tooltips on the factor bars (follow-up)
- Inline warning-row help links (follow-up)
- Localization / i18n
- Animated accordion transitions (use CSS only, no animation library)

---

## Success Criteria

1. Modal opens from both trigger points without page navigation
2. All 4 accordion sections are present and correct
3. Content matches live system values (thresholds from `TIER_LIMITS`, formula from `computeSegmentScore`)
4. Modal is accessible: focus trapped, closeable with Escape, scroll lock on body
5. No new routes, no new store, no API calls
