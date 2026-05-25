# Note Placement Validation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ensure every create/apply path rejects notes that overlap an active HOLD or pending incoming note on the same track.

**Architecture:** Keep span math in `packages/shared/src/note-overlap.ts` and put API placement orchestration in `apps/api/src/modules/notes/note-slot-preview.ts`. AI, tap-to-rhythm, paste, copy/move/repeat, and single-note creation should all classify and apply notes through the same overlap rule, with a final transaction-time check before create.

**Tech Stack:** NestJS, Prisma transaction clients, Jest, shared TypeScript overlap helpers.

---

### Task 1: Cover AI Apply Overlap Gaps

**Files:**
- Modify: `apps/api/src/modules/ai/__tests__/chart-apply-preview.spec.ts`

- [ ] **Step 1: Write failing tests**

Add tests showing AI simple merge skips a TAP inside an existing HOLD, and AI merge-with-resolutions rejects a replacement batch whose final notes overlap a different remaining HOLD.

- [ ] **Step 2: Run tests and verify RED**

Run: `pnpm --dir apps/api test -- chart-apply-preview.spec.ts --runInBand`

Expected: the new tests fail because AI simple merge checks only `track:time`, and merge-with-resolutions creates without a final span-overlap guard.

### Task 2: Centralize Final Create Validation

**Files:**
- Modify: `apps/api/src/modules/notes/note-slot-preview.ts`
- Modify: `apps/api/src/modules/ai/ai-chart.service.ts`

- [ ] **Step 1: Add final-create helper**

Add an exported helper that accepts final incoming slots, active existing slots, and deleted IDs, then throws `ConflictException({ error: 'POSITION_TAKEN' })` when any final create overlaps active existing notes or earlier pending creates.

- [ ] **Step 2: Use helper in AI apply**

Replace AI simple merge’s `slotKey` set with `findOverlapping`/final-create validation. In merge-with-resolutions, build one final `notesToCreate` list from creatable slots plus replaced conflicts, delete resolved notes, reload active notes for affected tracks, and validate all final creates before inserting.

- [ ] **Step 3: Run focused tests and verify GREEN**

Run: `pnpm --dir apps/api test -- chart-apply-preview.spec.ts note-slot-preview.spec.ts note-overlap.spec.ts --runInBand`

Expected: all focused tests pass.
