# Project Workspace Tabs Design

**Date:** 2026-05-24  
**Goal:** Restyle Songs / Members / Settings tabs on the project workspace to inline text tabs (Linear/Notion style) with a short active underline under the label only.

## Scope

- **In:** `ProjectPage` tab bar only (`Songs`, `Members`, `Settings`)
- **Out:** Editor side-panel tabs, tab counts/badges, animation beyond color/underline transition

## Decision

**Approach A1 — Classic inline underline**

- Left-aligned tab row, natural label width (no equal-width columns)
- Shared hairline under the row (`border-shell-border`)
- Active tab: semibold, primary text, 2px primary underline as wide as the label
- Inactive: muted; hover → full text color

## Visual Spec

| Element | Inactive | Active | Hover |
|---|---|---|---|
| Label | `text-shell-muted`, `text-sm`, medium | `text-primary`, semibold | `text-shell-text` |
| Indicator | none | `border-b-2 border-primary`, label width | — |
| Layout | inline row, `gap-6`, `-mb-px` overlap on hairline | — | — |

## Copy

- Title Case in source: `Songs`, `Members`, `Settings` (no CSS `capitalize` on management variant)

## Component Design

Add `variant="management"` to shared `Tabs.List` (and propagate to triggers via context):

- **`default` / `editor`:** unchanged — `flex-1`, lowercase + capitalize, full-width underline cell
- **`management`:** inline row, no `flex-1`, management styles above

`ProjectPage` passes `variant="management"` on `Tabs.List` only.

## Regression

- Editor `Tabs.List` / `Tabs.Trigger` without variant → identical to today
- Light + dark mode readable

## Acceptance

- [ ] Tabs left-aligned, not stretched across full width
- [ ] Active underline matches label width only
- [ ] Editor tabs unchanged
