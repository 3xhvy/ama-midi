# Difficulty Guide Redesign — Design Spec

**Date:** 2026-05-25  
**Status:** Approved for planning  
**Audience:** Composers and QA reviewers

---

## Problem

The current `DifficultyHelpModal` explains the difficulty system with dense tables and code-heavy accordion content. It is accurate, but it reads like documentation. Users need a faster, more game-like guide that helps them understand tiers, warnings, and fixes at a glance.

---

## Solution

Redesign `apps/web/src/features/analysis/DifficultyHelpModal.tsx` into a **Difficulty Guide**. The guide should prioritize visual hierarchy:

1. Big tier cards for Easy, Normal, Hard, Expert, and Master
2. Colored review badges for Ready, Needs Review, and Blocked
3. Short fix-tip cards for the main factors that raise difficulty
4. Compact warning groups where plain-English fixes are more prominent than warning code names
5. A collapsed advanced limits section for exact threshold values

The modal remains a static reusable component with the same public API:

```tsx
interface Props {
  open: boolean
  onClose: () => void
}
```

No routing, store, data fetching, or backend changes are needed.

---

## UX Goals

- Make the first screen understandable without reading formulas.
- Keep exact values available for QA and advanced users.
- Preserve all current content accuracy.
- Reduce table density by converting most rows into cards, badges, and grouped chips.
- Keep the look consistent with the dark editor shell and existing difficulty colors.

---

## Layout

### Header

Rename the modal title from **How Difficulty Works** to **Difficulty Guide**.

Add a short subtitle below the title inside the body:

> Learn what each tier means, why a chart gets reviewed, and the fastest ways to lower difficulty.

### Tier Cards

The first major section is a responsive grid of five cards:

| Tier | Score | Suggested speed | Feel |
|------|-------|-----------------|------|
| Easy | 0-2.9 | 1.0x | Light taps, no doubles, simple rhythm |
| Normal | 3-6.9 | 1.2x | Steady rhythm, small jumps, light syncopation |
| Hard | 7-11.9 | 1.5x | Faster patterns, more jumps, controlled doubles |
| Expert | 12-17.9 | 1.8x | Dense bursts, off-beat pressure, harder holds |
| Master | 18+ | 2.0x | Peak density, wide jumps, advanced patterns |

Each card uses a colored tier badge and a small "score" stat. Cards should feel like game difficulty tiles, not table rows.

### Review Badges

Show three horizontally wrapping status badges:

- **Ready** — no warnings
- **Needs Review** — WARN or INFO items exist
- **Blocked** — at least one ERROR; cannot be approved

The status name should be the strongest visual element. The description should be short and secondary.

### Fix Your Score

Replace the 8-factor table with short fix cards. Each card has:

- Factor name
- What makes it rise
- One direct fix

Cards:

| Factor | Trigger | Quick fix |
|--------|---------|-----------|
| Density | Too many notes close together | Spread bursts across more time |
| Lane jumps | Consecutive notes move far across lanes | Keep runs on nearby lanes |
| Off-beat rhythm | Notes drift from the main grid | Snap more notes to beats |
| Holds | Holds overlap too many taps | Shorten holds or clear nearby taps |
| Doubles/triples | Too many simultaneous notes | Stagger or remove stacked notes |
| Speed | Scroll speed is above the tier target | Lower speed in chart settings |
| Pattern complexity | Lane order changes too unpredictably | Reuse readable patterns |
| Repetition | Too little repetition makes memory harder | Repeat anchor patterns in sections |

### Warning Groups

Replace the full warning table with grouped warning rows:

**Blocking**
- `DIFFICULTY_SPIKE` when a segment is more than 3x the average
- `HIGH_DENSITY` when notes-per-second exceeds the error limit
- `TOO_MANY_TRIPLES` on Easy or Normal

**Needs Review**
- `DIFFICULTY_SPIKE` warning level
- `HIGH_DENSITY` warning level
- `EXCESSIVE_OFFBEAT`
- `TOO_MANY_DOUBLES`
- `TOO_MANY_TRIPLES` on Hard, Expert, or Master
- `SPEED_TIER_MISMATCH`
- `HOLD_OVERLAP_STRESS`
- `EXCESSIVE_LANE_JUMP`

**Info**
- `EMPTY_SECTION`
- `CHART_TOO_EASY_FOR_TIER`

Each row should show the plain-English fix first or at least as the most readable text. The code name stays visible in a smaller monospace pill for QA precision.

### Advanced Limits

Keep the exact tier limit table, but place it inside a collapsed **Advanced Limits** section at the bottom. This section may reuse a table because it is explicitly for precise thresholds.

The table keeps the current values:

| Tier | NPS warn | NPS error | Max offbeat | Max doubles/10s | Suggested speed |
|------|----------|-----------|-------------|-----------------|-----------------|
| Easy | 2.5 | 3.5 | 20% | 0 | 1.0x |
| Normal | 4.0 | 5.5 | 35% | 1 | 1.2x |
| Hard | 6.0 | 7.5 | 50% | 3 | 1.5x |
| Expert | 8.0 | 10.0 | 65% | 5 | 1.8x |
| Master | 10.0 | 12.0 | 80% | 8 | 2.0x |

---

## Component Structure

Keep the implementation local to `DifficultyHelpModal.tsx` unless the file becomes hard to scan. Suggested local helper components:

- `TierCard`
- `ReviewBadge`
- `FixTipCard`
- `WarningGroup`
- `AdvancedLimits`

Use static arrays for content. Avoid new global constants unless the same display data is needed elsewhere.

---

## Styling

- Use the existing shell tokens: `shell-bg`, `shell-surface`, `shell-border`, `shell-text`, `shell-muted`.
- Use tier colors already present in the modal: green, blue, orange/amber, red, purple.
- Cards should use 8px radius or less, matching existing app guidance.
- Avoid nested cards.
- Use responsive grids so the modal works on narrow screens:
  - Tier cards: one column on mobile, two columns on small screens, five compact cards only if width allows.
  - Fix tips: one column on mobile, two columns on wider screens.
  - Warning rows: stacked on mobile.

---

## Accessibility

The modal continues using the existing `Modal` primitive, so focus management and Escape close behavior should remain intact. All collapsed sections must use buttons with clear text labels. Color must not be the only signal for severity; include the words Ready, Needs Review, Blocked, Blocking, Needs Review, and Info.

---

## Out of Scope

- Contextual help based on the currently selected chart
- Per-factor live scores inside the guide
- New animations or sound effects
- Changes to difficulty calculation logic
- Changes to validation severity rules

---

## Success Criteria

1. The modal title is **Difficulty Guide**.
2. The first visible section uses tier cards instead of a tier table.
3. The factor table is replaced with short fix-tip cards.
4. Warning code content is grouped by severity and uses compact badge rows.
5. Exact threshold values remain available in a collapsed advanced section.
6. Existing entry points still open and close the modal.
7. The layout is readable at desktop and mobile modal widths.
