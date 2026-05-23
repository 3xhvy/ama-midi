# Project Workspace Tabs Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Inline management-style tabs on `ProjectPage` without changing editor tabs.

**Architecture:** Add a `management` variant to `Tabs.List` / `Tabs.Trigger` via React context from List. `ProjectPage` opts in; editor keeps default variant.

**Tech Stack:** React, Radix Tabs, Tailwind CSS

---

## Task 1: Tabs management variant

**Files:**
- Modify: `apps/web/src/components/ui/Tabs.tsx`
- Modify: `apps/web/src/features/projects/ProjectPage.tsx`

- [ ] **Step 1:** Add `TabsVariantContext` and `variant` prop on `Tabs.List` (`default` | `management` | `editor`)
- [ ] **Step 2:** `management` List: `flex gap-6 border-b border-shell-border` (no equal stretch)
- [ ] **Step 3:** `management` Trigger: `shrink-0 px-0 pb-2.5 -mb-px text-sm`, active `text-primary font-semibold border-b-2 border-primary`, no `capitalize`
- [ ] **Step 4:** `ProjectPage`: `Tabs.List variant="management"`, labels `Songs` / `Members` / `Settings`
- [ ] **Step 5:** `pnpm --filter @ama-midi/web build`

Expected: build passes; editor tabs unchanged.
