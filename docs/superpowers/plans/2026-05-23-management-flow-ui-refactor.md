# Management Flow UI Refactor Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Refactor the dashboard, project directory, and project workspace into a dense professional management surface, with shared enum metadata as the foundation.

**Architecture:** Ship the shared enum registry first so statuses, filters, labels, and badges read from one source of truth. Then add a management-aware `AppShell`, followed by isolated UI refactors for dashboard, project directory, and project workspace. Editor UI and editor components are not modified by this plan.

**Tech Stack:** React 18, React Router 7, TanStack Query, Tailwind CSS, TypeScript, NestJS DTO validation, Prisma schema drift test, Node test runner for web unit tests, Jest for API unit tests.

---

## Scope Guard

This plan implements the current contents of:

`docs/superpowers/specs/2026-05-23-management-flow-ui-refactor-design.md`

The spec file currently has uncommitted edits. Execute this plan from the current spec contents, not from commit `954bb1b`.

Editor guard:

- Do not edit `apps/web/src/pages/EditorPage.tsx`.
- Do not edit `apps/web/src/components/layout/EditorShell.tsx`.
- Do not edit `apps/web/src/features/editor/**`, except only if a compile error from the enum migration requires replacing a status label expression with `SongStatusEnum.label(...)`. If that happens, keep the visual output identical.

## File Structure

### Shared enum foundation

| File | Responsibility |
|---|---|
| `packages/shared/src/enums.ts` | Central enum metadata, labels, colors, variants, and key order. |
| `packages/shared/src/types.ts` | Export union types from enum key arrays. |
| `packages/shared/src/constants.ts` | Keep option aliases for compatibility; remove duplicated song labels. |
| `packages/shared/src/colors.ts` | Rename sync status colors so they are not confused with song workflow status. |
| `packages/shared/src/index.ts` | Export enum registry. |
| `apps/web/tests/shared-enums.test.ts` | Assert enum key order for shared UI/API contracts. |
| `apps/api/src/modules/prisma/__tests__/shared-enum-drift.spec.ts` | Assert Prisma schema enums match shared enum keys. |

### Enum consumers

| File | Responsibility |
|---|---|
| `apps/web/src/components/ui/Badge.tsx` | Add an `info` badge variant so enum variants map cleanly. |
| `apps/web/src/components/ui/StatusBadge.tsx` | Read sync status colors from `SYNC_STATUS_COLORS`. |
| `apps/web/src/components/ui/SongStatusBadge.tsx` | Read label and badge variant from `SongStatusEnum`. |
| `apps/web/src/features/songs/song-table-filters.ts` | Keep pure song filtering; use enum label in validation text where needed. |
| `apps/web/src/features/songs/useSongWorkflow.ts` | Use enum labels in success toast text. |
| `apps/web/src/features/songs/SongTable.tsx` | Use enum entries for filters and labels. |
| `apps/api/src/modules/**/dto/*.ts` | Use shared enum key arrays in `@IsIn(...)`. |

### Management UI

| File | Responsibility |
|---|---|
| `apps/web/src/components/layout/AppShell.tsx` | Management shell nav, active states, variant support, wider default content width. |
| `apps/web/src/features/dashboard/DashboardPage.tsx` | Summary strip and two-column operational dashboard. |
| `apps/web/src/features/dashboard/DashboardSongList.tsx` | Dense management song rows. |
| `apps/web/src/features/projects/project-directory-filters.ts` | Pure project search/status filtering. |
| `apps/web/tests/project-directory-filters.test.ts` | Unit tests for project directory filtering. |
| `apps/web/src/features/projects/ProjectDashboardPage.tsx` | Project directory header, controls, empty state, create modal. |
| `apps/web/src/features/projects/ProjectListSection.tsx` | Compact project list/cards, loading and empty states. |
| `apps/web/src/features/projects/ProjectCard.tsx` | Project row-card metadata and status display. |
| `apps/web/src/features/projects/ProjectPage.tsx` | Production workspace header and tab container. |
| `apps/web/src/features/songs/SongTable.tsx` | Dense song table, enum-driven filters, distinct empty states. |

---

## Task 0: Preflight And Baseline

**Files:**
- Read only: current worktree

- [ ] **Step 1: Inspect the worktree**

Run:

```bash
git status --short
```

Expected: existing unrelated user edits may be present. Do not revert them.

- [ ] **Step 2: Confirm the edited spec is the source**

Run:

```bash
git diff -- docs/superpowers/specs/2026-05-23-management-flow-ui-refactor-design.md
```

Expected: shows the enum-foundation additions. Use those requirements for implementation.

- [ ] **Step 3: Record current AppShell callers**

Run:

```bash
rg -n "<AppShell|AppShell\\(" apps/web/src
```

Expected current callers include:

```txt
apps/web/src/pages/SongListPage.tsx
apps/web/src/components/layout/AppShell.tsx
apps/web/src/pages/LoginPage.tsx
apps/web/src/features/dashboard/DashboardPage.tsx
apps/web/src/features/projects/ProjectDashboardPage.tsx
apps/web/src/features/projects/ProjectPage.tsx
```

- [ ] **Step 4: Verify editor does not use AppShell**

Run:

```bash
rg -n "AppShell" apps/web/src/pages/EditorPage.tsx apps/web/src/components/layout/EditorShell.tsx
```

Expected: no matches. This confirms the AppShell refactor cannot directly restyle the editor route.

---

## Task 1: Shared Enum Registry

**Files:**
- Create: `packages/shared/src/enums.ts`
- Create: `apps/web/tests/shared-enums.test.ts`
- Modify: `packages/shared/src/types.ts`
- Modify: `packages/shared/src/constants.ts`
- Modify: `packages/shared/src/index.ts`

- [ ] **Step 1: Write the enum order test**

Create `apps/web/tests/shared-enums.test.ts`:

```ts
import assert from 'node:assert/strict'
import { test } from 'node:test'
import {
  NoteEventTypeEnum,
  NoteTypeEnum,
  ProjectPermissionEnum,
  ProjectStatusEnum,
  SongCategoryEnum,
  SongDifficultyEnum,
  SongScopeEnum,
  SongStatusEnum,
  UserRoleEnum,
} from '../../../packages/shared/src/enums.ts'

test('shared enums expose stable key order', () => {
  assert.deepEqual(UserRoleEnum.keys, ['ADMIN', 'COMPOSER', 'VIEWER'])
  assert.deepEqual(NoteEventTypeEnum.keys, ['NOTE_CREATED', 'NOTE_UPDATED', 'NOTE_DELETED'])
  assert.deepEqual(NoteTypeEnum.keys, ['TAP', 'HOLD', 'SWIPE'])
  assert.deepEqual(ProjectStatusEnum.keys, ['ACTIVE', 'PAUSED', 'ARCHIVED'])
  assert.deepEqual(ProjectPermissionEnum.keys, ['READ', 'EDIT', 'ADMIN'])
  assert.deepEqual(SongScopeEnum.keys, ['ALL_SONGS', 'SELECTED_SONGS', 'NO_SONGS'])
  assert.deepEqual(SongStatusEnum.keys, ['DRAFT', 'IN_REVIEW', 'NEEDS_FIX', 'APPROVED', 'PUBLISHED', 'ARCHIVED'])
  assert.deepEqual(SongCategoryEnum.keys, [
    'MAIN_CAMPAIGN',
    'EVENT',
    'TUTORIAL',
    'LIVE_OPS',
    'PROTOTYPE',
    'QA_TEST',
    'TEMPLATE',
    'REFERENCE',
  ])
  assert.deepEqual(SongDifficultyEnum.keys, ['EASY', 'NORMAL', 'HARD', 'EXPERT', 'MASTER'])
})

test('shared enum helpers return labels and variants', () => {
  assert.equal(SongStatusEnum.label('IN_REVIEW'), 'In Review')
  assert.equal(SongStatusEnum.variant('NEEDS_FIX'), 'error')
  assert.equal(ProjectStatusEnum.label('PAUSED'), 'Paused')
  assert.equal(SongDifficultyEnum.label('MASTER'), 'Master')
})
```

- [ ] **Step 2: Run the failing test**

Run:

```bash
node --test apps/web/tests/shared-enums.test.ts
```

Expected: FAIL because `packages/shared/src/enums.ts` does not exist.

- [ ] **Step 3: Create `enums.ts`**

Create `packages/shared/src/enums.ts`:

```ts
export type EnumVariant = 'muted' | 'warning' | 'error' | 'success' | 'info'

export interface EnumMeta<K extends string = string> {
  key: K
  labelKey: string
  labelFallback: string
  color: string
  bg: string
  variant: EnumVariant
}

export function defineEnum<const T extends readonly EnumMeta[]>(entries: T) {
  const byKey = Object.fromEntries(entries.map((entry) => [entry.key, entry])) as {
    [K in T[number]['key']]: Extract<T[number], { key: K }>
  }

  return {
    entries,
    keys: entries.map((entry) => entry.key) as ReadonlyArray<T[number]['key']>,
    byKey,
    label: (key: T[number]['key']) => byKey[key].labelFallback,
    color: (key: T[number]['key']) => byKey[key].color,
    bg: (key: T[number]['key']) => byKey[key].bg,
    variant: (key: T[number]['key']) => byKey[key].variant,
  }
}

export const UserRoleEnum = defineEnum([
  { key: 'ADMIN', labelKey: 'user.role.admin', labelFallback: 'Admin', color: '#4B44CC', bg: '#EEF0FF', variant: 'info' },
  { key: 'COMPOSER', labelKey: 'user.role.composer', labelFallback: 'Composer', color: '#6C63FF', bg: '#EEF0FF', variant: 'info' },
  { key: 'VIEWER', labelKey: 'user.role.viewer', labelFallback: 'Viewer', color: '#6B7280', bg: '#F3F4F6', variant: 'muted' },
] as const)
export type UserRole = typeof UserRoleEnum.keys[number]

export const NoteEventTypeEnum = defineEnum([
  { key: 'NOTE_CREATED', labelKey: 'note.event.created', labelFallback: 'Note Created', color: '#10B981', bg: '#ECFDF5', variant: 'success' },
  { key: 'NOTE_UPDATED', labelKey: 'note.event.updated', labelFallback: 'Note Updated', color: '#3B82F6', bg: '#EFF6FF', variant: 'info' },
  { key: 'NOTE_DELETED', labelKey: 'note.event.deleted', labelFallback: 'Note Deleted', color: '#EF4444', bg: '#FEF2F2', variant: 'error' },
] as const)
export type NoteEventType = typeof NoteEventTypeEnum.keys[number]

export const NoteTypeEnum = defineEnum([
  { key: 'TAP', labelKey: 'note.type.tap', labelFallback: 'Tap', color: '#6C63FF', bg: '#EEF0FF', variant: 'info' },
  { key: 'HOLD', labelKey: 'note.type.hold', labelFallback: 'Hold', color: '#10B981', bg: '#ECFDF5', variant: 'success' },
  { key: 'SWIPE', labelKey: 'note.type.swipe', labelFallback: 'Swipe', color: '#F59E0B', bg: '#FFFBEB', variant: 'warning' },
] as const)
export type NoteType = typeof NoteTypeEnum.keys[number]

export const ProjectStatusEnum = defineEnum([
  { key: 'ACTIVE', labelKey: 'project.status.active', labelFallback: 'Active', color: '#10B981', bg: '#ECFDF5', variant: 'success' },
  { key: 'PAUSED', labelKey: 'project.status.paused', labelFallback: 'Paused', color: '#F59E0B', bg: '#FFFBEB', variant: 'warning' },
  { key: 'ARCHIVED', labelKey: 'project.status.archived', labelFallback: 'Archived', color: '#6B7280', bg: '#F3F4F6', variant: 'muted' },
] as const)
export type ProjectStatus = typeof ProjectStatusEnum.keys[number]

export const ProjectPermissionEnum = defineEnum([
  { key: 'READ', labelKey: 'project.permission.read', labelFallback: 'Read', color: '#6B7280', bg: '#F3F4F6', variant: 'muted' },
  { key: 'EDIT', labelKey: 'project.permission.edit', labelFallback: 'Edit', color: '#3B82F6', bg: '#EFF6FF', variant: 'info' },
  { key: 'ADMIN', labelKey: 'project.permission.admin', labelFallback: 'Admin', color: '#6C63FF', bg: '#EEF0FF', variant: 'info' },
] as const)
export type ProjectPermission = typeof ProjectPermissionEnum.keys[number]

export const SongScopeEnum = defineEnum([
  { key: 'ALL_SONGS', labelKey: 'song.scope.allSongs', labelFallback: 'All Songs', color: '#10B981', bg: '#ECFDF5', variant: 'success' },
  { key: 'SELECTED_SONGS', labelKey: 'song.scope.selectedSongs', labelFallback: 'Selected Songs', color: '#3B82F6', bg: '#EFF6FF', variant: 'info' },
  { key: 'NO_SONGS', labelKey: 'song.scope.noSongs', labelFallback: 'No Songs', color: '#6B7280', bg: '#F3F4F6', variant: 'muted' },
] as const)
export type SongScope = typeof SongScopeEnum.keys[number]

export const SongStatusEnum = defineEnum([
  { key: 'DRAFT', labelKey: 'song.status.draft', labelFallback: 'Draft', color: '#6B6585', bg: '#F3F0F9', variant: 'muted' },
  { key: 'IN_REVIEW', labelKey: 'song.status.inReview', labelFallback: 'In Review', color: '#F59E0B', bg: '#FFFBEB', variant: 'warning' },
  { key: 'NEEDS_FIX', labelKey: 'song.status.needsFix', labelFallback: 'Needs Fix', color: '#EF4444', bg: '#FEF2F2', variant: 'error' },
  { key: 'APPROVED', labelKey: 'song.status.approved', labelFallback: 'Approved', color: '#10B981', bg: '#ECFDF5', variant: 'success' },
  { key: 'PUBLISHED', labelKey: 'song.status.published', labelFallback: 'Published', color: '#059669', bg: '#D1FAE5', variant: 'success' },
  { key: 'ARCHIVED', labelKey: 'song.status.archived', labelFallback: 'Archived', color: '#6B7280', bg: '#F3F4F6', variant: 'muted' },
] as const)
export type SongStatus = typeof SongStatusEnum.keys[number]

export const SongCategoryEnum = defineEnum([
  { key: 'MAIN_CAMPAIGN', labelKey: 'song.category.mainCampaign', labelFallback: 'Main Campaign', color: '#6C63FF', bg: '#EEF0FF', variant: 'info' },
  { key: 'EVENT', labelKey: 'song.category.event', labelFallback: 'Event', color: '#EC4899', bg: '#FDF2F8', variant: 'info' },
  { key: 'TUTORIAL', labelKey: 'song.category.tutorial', labelFallback: 'Tutorial', color: '#10B981', bg: '#ECFDF5', variant: 'success' },
  { key: 'LIVE_OPS', labelKey: 'song.category.liveOps', labelFallback: 'Live Ops', color: '#3B82F6', bg: '#EFF6FF', variant: 'info' },
  { key: 'PROTOTYPE', labelKey: 'song.category.prototype', labelFallback: 'Prototype', color: '#F59E0B', bg: '#FFFBEB', variant: 'warning' },
  { key: 'QA_TEST', labelKey: 'song.category.qaTest', labelFallback: 'QA Test', color: '#EF4444', bg: '#FEF2F2', variant: 'error' },
  { key: 'TEMPLATE', labelKey: 'song.category.template', labelFallback: 'Template', color: '#8B5CF6', bg: '#F5F3FF', variant: 'info' },
  { key: 'REFERENCE', labelKey: 'song.category.reference', labelFallback: 'Reference', color: '#6B7280', bg: '#F3F4F6', variant: 'muted' },
] as const)
export type SongCategory = typeof SongCategoryEnum.keys[number]

export const SongDifficultyEnum = defineEnum([
  { key: 'EASY', labelKey: 'song.difficulty.easy', labelFallback: 'Easy', color: '#10B981', bg: '#ECFDF5', variant: 'success' },
  { key: 'NORMAL', labelKey: 'song.difficulty.normal', labelFallback: 'Normal', color: '#3B82F6', bg: '#EFF6FF', variant: 'info' },
  { key: 'HARD', labelKey: 'song.difficulty.hard', labelFallback: 'Hard', color: '#F59E0B', bg: '#FFFBEB', variant: 'warning' },
  { key: 'EXPERT', labelKey: 'song.difficulty.expert', labelFallback: 'Expert', color: '#EF4444', bg: '#FEF2F2', variant: 'error' },
  { key: 'MASTER', labelKey: 'song.difficulty.master', labelFallback: 'Master', color: '#8B5CF6', bg: '#F5F3FF', variant: 'info' },
] as const)
export type SongDifficulty = typeof SongDifficultyEnum.keys[number]
```

- [ ] **Step 4: Update `types.ts` enum type exports**

At the top of `packages/shared/src/types.ts`, replace the literal union type declarations with:

```ts
import type {
  NoteEventType,
  NoteType,
  ProjectPermission,
  ProjectStatus,
  SongCategory,
  SongDifficulty,
  SongScope,
  SongStatus,
  UserRole,
} from './enums'

export type {
  NoteEventType,
  NoteType,
  ProjectPermission,
  ProjectStatus,
  SongCategory,
  SongDifficulty,
  SongScope,
  SongStatus,
  UserRole,
} from './enums'
```

Keep the rest of the interfaces unchanged.

- [ ] **Step 5: Update compatibility constants**

Replace the enum option declarations and remove `SONG_STATUS_LABELS` from `packages/shared/src/constants.ts`:

```ts
import {
  ProjectPermissionEnum,
  ProjectStatusEnum,
  SongCategoryEnum,
  SongDifficultyEnum,
  SongScopeEnum,
  SongStatusEnum,
} from './enums'

export const TRACK_MIN = 1
export const TRACK_MAX = 8
export const TIME_MIN = 0
export const TIME_MAX = 300
export const SNAP_RESOLUTION = 0.1

export const HOLD_DURATION_MIN = 0.1
export const HOLD_DURATION_MAX = 30
export const HOLD_DRAG_THRESHOLD_PX = 4

export const PROJECT_STATUS_OPTIONS = ProjectStatusEnum.keys
export const PROJECT_PERMISSION_OPTIONS = ProjectPermissionEnum.keys
export const SONG_SCOPE_OPTIONS = SongScopeEnum.keys
export const SONG_STATUS_OPTIONS = SongStatusEnum.keys
export const SONG_CATEGORY_OPTIONS = SongCategoryEnum.keys
export const SONG_DIFFICULTY_OPTIONS = SongDifficultyEnum.keys
export const SUPPORTED_TIME_SIGNATURES = ['4/4', '3/4', '6/8'] as const

export const SECTION_PRESETS = [
  { label: 'Intro', color: '#10B981' },
  { label: 'Verse', color: '#6C63FF' },
  { label: 'Chorus', color: '#F59E0B' },
  { label: 'Bridge', color: '#EC4899' },
  { label: 'Drop', color: '#EF4444' },
  { label: 'Outro', color: '#6B7280' },
] as const
```

- [ ] **Step 6: Export enums from the shared package**

Update `packages/shared/src/index.ts`:

```ts
export * from './enums'
export * from './types'
export * from './colors'
export * from './constants'
export * from './events'
export * from './song-status-workflow'
export * from './chart-edit-access'
```

- [ ] **Step 7: Run tests and type-check**

Run:

```bash
node --test apps/web/tests/shared-enums.test.ts
pnpm --filter @ama-midi/shared build
```

Expected: both pass.

- [ ] **Step 8: Commit**

Run:

```bash
git add packages/shared/src/enums.ts packages/shared/src/types.ts packages/shared/src/constants.ts packages/shared/src/index.ts apps/web/tests/shared-enums.test.ts
git commit -m "feat(shared): centralize enum metadata"
```

---

## Task 2: Sync Status Rename And Song Status Badge

**Files:**
- Modify: `packages/shared/src/colors.ts`
- Modify: `apps/web/src/components/ui/Badge.tsx`
- Modify: `apps/web/src/components/ui/StatusBadge.tsx`
- Modify: `apps/web/src/components/ui/SongStatusBadge.tsx`
- Modify: `packages/shared/src/song-status-workflow.ts`
- Modify: `apps/web/src/features/songs/useSongWorkflow.ts`

- [ ] **Step 1: Rename sync status colors**

In `packages/shared/src/colors.ts`, rename `STATUS_COLORS`:

```ts
export const SYNC_STATUS_COLORS = {
  synced: { color: '#10B981', bg: '#ECFDF5', label: 'Synced' },
  needsReview: { color: '#F59E0B', bg: '#FFFBEB', label: 'Needs Review' },
  outdated: { color: '#EF4444', bg: '#FEF2F2', label: 'Outdated' },
  draft: { color: '#6B6585', bg: '#F3F0F9', label: 'Draft' },
} as const
```

- [ ] **Step 2: Add an info badge variant**

In `apps/web/src/components/ui/Badge.tsx`, update the variant map:

```ts
const variants = {
  default: 'bg-shell-bg text-shell-text border border-shell-border',
  success: 'bg-green-50 text-green-700 dark:bg-green-500/10 dark:text-green-400',
  warning: 'bg-amber-50 text-amber-700 dark:bg-amber-500/10 dark:text-amber-400',
  error: 'bg-red-50 text-red-700 dark:bg-red-500/10 dark:text-red-400',
  info: 'bg-blue-50 text-blue-700 dark:bg-blue-500/10 dark:text-blue-300',
  muted: 'bg-shell-bg text-shell-muted',
} as const
```

- [ ] **Step 3: Update sync `StatusBadge`**

Replace `apps/web/src/components/ui/StatusBadge.tsx` with:

```tsx
import { SYNC_STATUS_COLORS } from '@ama-midi/shared'
import { Badge } from './Badge'

type Status = keyof typeof SYNC_STATUS_COLORS

const icons: Record<Status, string> = {
  synced: '✓',
  needsReview: '!',
  outdated: '×',
  draft: '○',
}

const badgeVariants: Record<Status, 'success' | 'warning' | 'error' | 'muted'> = {
  synced: 'success',
  needsReview: 'warning',
  outdated: 'error',
  draft: 'muted',
}

export function StatusBadge({ status, className }: { status: Status; className?: string }) {
  return (
    <Badge variant={badgeVariants[status]} size="sm" icon={<span>{icons[status]}</span>} className={className}>
      {SYNC_STATUS_COLORS[status].label}
    </Badge>
  )
}
```

- [ ] **Step 4: Update song workflow `SongStatusBadge`**

Replace `apps/web/src/components/ui/SongStatusBadge.tsx` with:

```tsx
import { SongStatusEnum, type SongStatus } from '@ama-midi/shared'
import { Badge } from './Badge'

export function SongStatusBadge({ status, className }: { status: SongStatus; className?: string }) {
  return (
    <Badge variant={SongStatusEnum.variant(status)} size="sm" className={className}>
      {SongStatusEnum.label(status)}
    </Badge>
  )
}
```

- [ ] **Step 5: Remove status string formatting from workflow helpers**

In `packages/shared/src/song-status-workflow.ts`, import `SongStatusEnum` and replace fallback label formatting:

```ts
import { SongStatusEnum, type ProjectPermission, type SongStatus, type UserRole } from './enums'
```

Use this return expression in `songStatusActionLabel`:

```ts
return SONG_STATUS_ACTION_LABELS[`${from}→${to}`] ?? `Move to ${SongStatusEnum.label(to)}`
```

- [ ] **Step 6: Update status toast labels**

In `apps/web/src/features/songs/useSongWorkflow.ts`, import `SongStatusEnum` and replace the success toast:

```ts
toast.success(`Status updated to ${SongStatusEnum.label(song.status)}`)
```

- [ ] **Step 7: Verify label duplication was removed**

Run:

```bash
rg -n "SONG_STATUS_LABELS|STATUS_COLORS|Record<SongStatus|replace\\(/_/g, ' '" packages apps
```

Expected: no matches for `SONG_STATUS_LABELS`, `STATUS_COLORS`, or `Record<SongStatus`. Some `replace(/_/g, ' ')` matches may remain outside status labels; inspect each and replace song-category or difficulty labels with enum labels in later tasks.

- [ ] **Step 8: Build and commit**

Run:

```bash
pnpm --filter @ama-midi/shared build
pnpm --filter @ama-midi/web build
git add packages/shared/src/colors.ts packages/shared/src/song-status-workflow.ts apps/web/src/components/ui/Badge.tsx apps/web/src/components/ui/StatusBadge.tsx apps/web/src/components/ui/SongStatusBadge.tsx apps/web/src/features/songs/useSongWorkflow.ts
git commit -m "refactor(web): source status badges from shared enums"
```

---

## Task 3: API DTO Enum Validation And Prisma Drift Test

**Files:**
- Create: `apps/api/src/modules/prisma/__tests__/shared-enum-drift.spec.ts`
- Modify: `apps/api/src/modules/projects/dto/update-project.dto.ts`
- Modify: `apps/api/src/modules/songs/dto/create-project-song.dto.ts`
- Modify: `apps/api/src/modules/project-members/dto/add-project-member.dto.ts`
- Modify: `apps/api/src/modules/project-members/dto/update-project-member.dto.ts`

- [ ] **Step 1: Add the Prisma drift test**

Create `apps/api/src/modules/prisma/__tests__/shared-enum-drift.spec.ts`:

```ts
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import {
  NoteEventTypeEnum,
  NoteTypeEnum,
  ProjectPermissionEnum,
  ProjectStatusEnum,
  SongCategoryEnum,
  SongDifficultyEnum,
  SongScopeEnum,
  SongStatusEnum,
  UserRoleEnum,
} from '@ama-midi/shared'

function prismaEnumKeys(schema: string, enumName: string): string[] {
  const match = schema.match(new RegExp(`enum ${enumName} \\\\{([\\\\s\\\\S]*?)\\\\}`))
  if (!match) throw new Error(`Missing Prisma enum ${enumName}`)

  return match[1]
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith('//'))
    .map((line) => line.split(/\s+/)[0])
}

describe('shared enum drift', () => {
  const schema = readFileSync(join(process.cwd(), 'prisma/schema.prisma'), 'utf8')

  it.each([
    ['UserRole', UserRoleEnum.keys],
    ['NoteEventType', NoteEventTypeEnum.keys],
    ['NoteType', NoteTypeEnum.keys],
    ['ProjectStatus', ProjectStatusEnum.keys],
    ['ProjectPermission', ProjectPermissionEnum.keys],
    ['SongScope', SongScopeEnum.keys],
    ['SongStatus', SongStatusEnum.keys],
    ['SongCategory', SongCategoryEnum.keys],
    ['SongDifficulty', SongDifficultyEnum.keys],
  ] as const)('%s matches the shared enum registry', (enumName, expectedKeys) => {
    expect(prismaEnumKeys(schema, enumName)).toEqual([...expectedKeys])
  })
})
```

- [ ] **Step 2: Run the new drift test**

Run:

```bash
cd apps/api && pnpm test -- shared-enum-drift.spec.ts
```

Expected: PASS.

- [ ] **Step 3: Update project DTO validation**

In `apps/api/src/modules/projects/dto/update-project.dto.ts`, import `ProjectStatusEnum` and replace the hardcoded array:

```ts
import { ProjectStatusEnum } from '@ama-midi/shared'
```

```ts
@IsIn([...ProjectStatusEnum.keys])
```

- [ ] **Step 4: Update project song DTO validation**

In `apps/api/src/modules/songs/dto/create-project-song.dto.ts`, import `SongCategoryEnum` and `SongDifficultyEnum`:

```ts
import { SongCategoryEnum, SongDifficultyEnum } from '@ama-midi/shared'
```

Replace the hardcoded category and difficulty validators:

```ts
@IsIn([...SongCategoryEnum.keys])
category!: string

@IsIn([...SongDifficultyEnum.keys])
difficulty!: string
```

Leave time signatures and start type hardcoded because they are not part of the enum registry in this spec.

- [ ] **Step 5: Update project member DTO validation**

In both `apps/api/src/modules/project-members/dto/add-project-member.dto.ts` and `apps/api/src/modules/project-members/dto/update-project-member.dto.ts`, import:

```ts
import { ProjectPermissionEnum, SongScopeEnum } from '@ama-midi/shared'
```

Replace validators:

```ts
@IsIn([...ProjectPermissionEnum.keys])
```

```ts
@IsIn([...SongScopeEnum.keys])
```

- [ ] **Step 6: Run API tests**

Run:

```bash
cd apps/api && pnpm test -- shared-enum-drift.spec.ts
```

Expected: PASS.

- [ ] **Step 7: Build and commit**

Run:

```bash
pnpm --filter @ama-midi/api build
git add apps/api/src/modules/prisma/__tests__/shared-enum-drift.spec.ts apps/api/src/modules/projects/dto/update-project.dto.ts apps/api/src/modules/songs/dto/create-project-song.dto.ts apps/api/src/modules/project-members/dto/add-project-member.dto.ts apps/api/src/modules/project-members/dto/update-project-member.dto.ts
git commit -m "test(api): guard prisma enum drift"
```

---

## Task 4: AppShell Management Variant

**Files:**
- Modify: `apps/web/src/components/layout/AppShell.tsx`
- Modify: `apps/web/src/pages/LoginPage.tsx`
- Modify: `apps/web/src/pages/SongListPage.tsx`
- Modify: `apps/web/src/features/dashboard/DashboardPage.tsx`
- Modify: `apps/web/src/features/projects/ProjectDashboardPage.tsx`
- Modify: `apps/web/src/features/projects/ProjectPage.tsx`

- [ ] **Step 1: Update `AppShellProps`**

In `apps/web/src/components/layout/AppShell.tsx`, import `NavLink` and update the prop interface:

```ts
import { NavLink, useNavigate } from 'react-router-dom'
```

```ts
export interface AppShellProps {
  children: React.ReactNode
  variant?: 'management' | 'editor' | 'auth'
  maxWidth?: number | string
  showHeader?: boolean
  className?: string
}
```

- [ ] **Step 2: Add shell defaults**

Inside `AppShell`, replace the function signature with:

```ts
export function AppShell({
  children,
  variant = 'management',
  maxWidth,
  showHeader = true,
  className,
}: AppShellProps) {
```

Add these values near the state declarations:

```ts
const resolvedMaxWidth = maxWidth ?? (variant === 'management' ? 1280 : variant === 'auth' ? 480 : '100%')
const mainMaxWidth = typeof resolvedMaxWidth === 'number' ? `${resolvedMaxWidth}px` : resolvedMaxWidth
```

- [ ] **Step 3: Add primary management navigation**

In the header, immediately after the brand block, add:

```tsx
{variant === 'management' && (
  <nav className="ml-8 hidden items-center gap-1 md:flex" aria-label="Primary navigation">
    {[
      { to: '/', label: 'Dashboard', end: true },
      { to: '/projects', label: 'Projects', end: false },
    ].map((item) => (
      <NavLink
        key={item.to}
        to={item.to}
        end={item.end}
        className={({ isActive }) =>
          cn(
            'rounded-md px-3 py-1.5 text-sm font-medium transition-colors',
            isActive
              ? 'bg-primary/10 text-primary'
              : 'text-shell-muted hover:bg-shell-bg hover:text-shell-text',
          )
        }
      >
        {item.label}
      </NavLink>
    ))}
  </nav>
)}
```

- [ ] **Step 4: Use the resolved width**

Replace the current `<main>` style with:

```tsx
<main className="mx-auto px-4 py-6 sm:px-6 lg:px-8" style={{ maxWidth: mainMaxWidth }}>
  {children}
</main>
```

Keep `showHeader={false}` behavior intact for auth.

- [ ] **Step 5: Set explicit variants on callers**

Update callers:

```tsx
<AppShell variant="management">
```

Use this in:

- `apps/web/src/pages/SongListPage.tsx`
- `apps/web/src/features/dashboard/DashboardPage.tsx`
- `apps/web/src/features/projects/ProjectDashboardPage.tsx`
- `apps/web/src/features/projects/ProjectPage.tsx`

Update login:

```tsx
<AppShell variant="auth" showHeader={false} maxWidth={480} className="flex min-h-screen items-center justify-center">
```

- [ ] **Step 6: Verify editor isolation**

Run:

```bash
rg -n "AppShell" apps/web/src/pages/EditorPage.tsx apps/web/src/components/layout/EditorShell.tsx
pnpm --filter @ama-midi/web build
```

Expected: no `AppShell` matches in editor files; build passes.

- [ ] **Step 7: Commit**

Run:

```bash
git add apps/web/src/components/layout/AppShell.tsx apps/web/src/pages/LoginPage.tsx apps/web/src/pages/SongListPage.tsx apps/web/src/features/dashboard/DashboardPage.tsx apps/web/src/features/projects/ProjectDashboardPage.tsx apps/web/src/features/projects/ProjectPage.tsx
git commit -m "feat(web): add management app shell navigation"
```

---

## Task 5: Dashboard Management Layout

**Files:**
- Modify: `apps/web/src/features/dashboard/DashboardPage.tsx`
- Modify: `apps/web/src/features/dashboard/DashboardSongList.tsx`

- [ ] **Step 1: Refactor dense song rows**

Replace `DashboardSongList` rendering with this compact structure:

```tsx
import { useNavigate } from 'react-router-dom'
import type { DashboardSongRow } from '@ama-midi/shared'
import { SongStatusEnum } from '@ama-midi/shared'
import { SongStatusBadge } from '../../components/ui'
import { songEditorPath } from '../navigation/song-editor-path'
import { timeAgo } from '../../lib/utils'

export function DashboardSongList({ songs, emptyLabel }: { songs: DashboardSongRow[]; emptyLabel: string }) {
  const navigate = useNavigate()

  if (!songs.length) {
    return (
      <div className="rounded-md border border-dashed border-shell-border bg-shell-surface px-3 py-3 text-sm text-shell-muted">
        {emptyLabel}
      </div>
    )
  }

  return (
    <ul className="overflow-hidden rounded-md border border-shell-border bg-shell-surface">
      {songs.map((song) => (
        <li key={song.id} className="border-b border-shell-border last:border-b-0">
          <button
            type="button"
            onClick={() => navigate(songEditorPath(song.projectId, song.id))}
            className="grid min-h-12 w-full grid-cols-[minmax(0,1fr)_auto_auto] items-center gap-3 px-3 py-2 text-left transition-colors hover:bg-shell-bg"
          >
            <div className="min-w-0">
              <p className="truncate text-sm font-medium text-shell-text">{song.name}</p>
              <p className="truncate text-xs text-shell-muted">{song.projectName}</p>
            </div>
            <SongStatusBadge status={song.status} className="hidden sm:inline-flex" />
            <span className="shrink-0 text-xs text-shell-muted" title={SongStatusEnum.label(song.status)}>
              {timeAgo(song.updatedAt)}
            </span>
          </button>
        </li>
      ))}
    </ul>
  )
}
```

- [ ] **Step 2: Refactor the dashboard page**

In `apps/web/src/features/dashboard/DashboardPage.tsx`, compute counts:

```ts
const recentSongs = data?.recentSongs ?? []
const assignedToMe = data?.assignedToMe ?? []
const needsReview = data?.needsReview ?? []
const activeProjects = projects.filter((project) => project.status === 'ACTIVE')
```

Use this layout:

```tsx
<AppShell variant="management">
  <header className="mb-5 flex flex-col gap-1">
    <p className="text-xs font-medium uppercase tracking-wide text-shell-muted">Management</p>
    <h1 className="text-2xl font-semibold text-shell-text">Dashboard</h1>
    <p className="text-sm text-shell-muted">Cross-project production work, reviews, and recent activity.</p>
  </header>

  <section className="mb-5 grid gap-2 md:grid-cols-4" aria-label="Production summary">
    {[
      { label: 'Needs review', value: needsReview.length },
      { label: 'Assigned to me', value: assignedToMe.length },
      { label: 'Recent songs', value: recentSongs.length },
      { label: 'Active projects', value: activeProjects.length },
    ].map((item) => (
      <div key={item.label} className="rounded-md border border-shell-border bg-shell-surface px-3 py-2">
        <p className="text-xs text-shell-muted">{item.label}</p>
        <p className="mt-0.5 text-lg font-semibold text-shell-text">{item.value}</p>
      </div>
    ))}
  </section>

  <div className="grid gap-5 lg:grid-cols-[minmax(0,2fr)_minmax(320px,1fr)]">
    <div className="space-y-5">
      <section>
        <h2 className="mb-2 text-sm font-semibold text-shell-text">Needs Review</h2>
        <DashboardSongList songs={needsReview} emptyLabel={isLoading ? 'Loading review queue...' : 'No songs need review.'} />
      </section>

      <section>
        <h2 className="mb-2 text-sm font-semibold text-shell-text">Assigned to Me</h2>
        <DashboardSongList songs={assignedToMe} emptyLabel={isLoading ? 'Loading assignments...' : 'No assigned songs.'} />
      </section>

      <section>
        <h2 className="mb-2 text-sm font-semibold text-shell-text">Recent Songs</h2>
        <DashboardSongList songs={recentSongs} emptyLabel={isLoading ? 'Loading recent songs...' : 'No recent songs yet.'} />
      </section>
    </div>

    <section>
      <div className="mb-2 flex items-center justify-between">
        <h2 className="text-sm font-semibold text-shell-text">My Projects</h2>
        <Button size="sm" variant="secondary" onClick={() => navigate('/projects')}>
          View all
        </Button>
      </div>
      <ProjectListSection projects={projects.slice(0, 6)} isLoading={projectsLoading} compact />
    </section>
  </div>
</AppShell>
```

- [ ] **Step 3: Build and commit**

Run:

```bash
pnpm --filter @ama-midi/web build
git add apps/web/src/features/dashboard/DashboardPage.tsx apps/web/src/features/dashboard/DashboardSongList.tsx
git commit -m "refactor(web): densify management dashboard"
```

---

## Task 6: Project Directory Filters And Cards

**Files:**
- Create: `apps/web/src/features/projects/project-directory-filters.ts`
- Create: `apps/web/tests/project-directory-filters.test.ts`
- Modify: `apps/web/src/features/projects/ProjectDashboardPage.tsx`
- Modify: `apps/web/src/features/projects/ProjectListSection.tsx`
- Modify: `apps/web/src/features/projects/ProjectCard.tsx`

- [ ] **Step 1: Write project directory filter tests**

Create `apps/web/tests/project-directory-filters.test.ts`:

```ts
import assert from 'node:assert/strict'
import { test } from 'node:test'
import type { Project } from '@ama-midi/shared'
import { filterProjects, type ProjectDirectoryStatusFilter } from '../src/features/projects/project-directory-filters.ts'

const projects = [
  { id: 'p1', name: 'Neon Rush', description: 'Main campaign charts', status: 'ACTIVE', songCount: 12, memberCount: 4, updatedAt: '2026-05-23T08:00:00Z' },
  { id: 'p2', name: 'Event Pack', description: 'Seasonal work', status: 'PAUSED', songCount: 3, memberCount: 2, updatedAt: '2026-05-22T08:00:00Z' },
  { id: 'p3', name: 'Archive Test', description: null, status: 'ARCHIVED', songCount: 1, memberCount: 1, updatedAt: '2026-05-21T08:00:00Z' },
] as Project[]

test('filterProjects matches name and description case-insensitively', () => {
  assert.deepEqual(filterProjects(projects, { query: 'campaign', status: 'ALL' }).map((project) => project.id), ['p1'])
  assert.deepEqual(filterProjects(projects, { query: 'event', status: 'ALL' }).map((project) => project.id), ['p2'])
})

test('filterProjects filters by project status', () => {
  const status: ProjectDirectoryStatusFilter = 'PAUSED'
  assert.deepEqual(filterProjects(projects, { query: '', status }).map((project) => project.id), ['p2'])
})

test('filterProjects combines query and status filters', () => {
  assert.deepEqual(filterProjects(projects, { query: 'test', status: 'ACTIVE' }).map((project) => project.id), [])
})
```

- [ ] **Step 2: Run the failing test**

Run:

```bash
node --test apps/web/tests/project-directory-filters.test.ts
```

Expected: FAIL because `project-directory-filters.ts` does not exist.

- [ ] **Step 3: Create project filter helper**

Create `apps/web/src/features/projects/project-directory-filters.ts`:

```ts
import type { Project, ProjectStatus } from '@ama-midi/shared'

export type ProjectDirectoryStatusFilter = 'ALL' | ProjectStatus

export function filterProjects(
  projects: Project[],
  input: { query: string; status: ProjectDirectoryStatusFilter },
): Project[] {
  const query = input.query.trim().toLowerCase()

  return projects.filter((project) => {
    const description = project.description ?? ''
    const matchesQuery =
      !query ||
      project.name.toLowerCase().includes(query) ||
      description.toLowerCase().includes(query)
    const matchesStatus = input.status === 'ALL' || project.status === input.status
    return matchesQuery && matchesStatus
  })
}
```

- [ ] **Step 4: Run filter tests**

Run:

```bash
node --test apps/web/tests/project-directory-filters.test.ts
```

Expected: PASS.

- [ ] **Step 5: Update `ProjectCard`**

Replace `apps/web/src/features/projects/ProjectCard.tsx` with:

```tsx
import { useNavigate } from 'react-router-dom'
import { ProjectStatusEnum, type Project } from '@ama-midi/shared'
import { Badge } from '../../components/ui'
import { timeAgo } from '../../lib/utils'

export function ProjectCard({ project }: { project: Project }) {
  const navigate = useNavigate()

  return (
    <button
      type="button"
      onClick={() => navigate(`/projects/${project.id}`)}
      className="w-full rounded-md border border-shell-border bg-shell-surface px-4 py-3 text-left transition-colors hover:bg-shell-bg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="truncate text-sm font-semibold text-shell-text">{project.name}</h3>
          {project.description && (
            <p className="mt-1 line-clamp-2 text-xs leading-5 text-shell-muted">{project.description}</p>
          )}
        </div>
        <Badge variant={ProjectStatusEnum.variant(project.status)} size="sm">
          {ProjectStatusEnum.label(project.status)}
        </Badge>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-shell-muted">
        <span>{project.songCount} songs</span>
        <span>{project.memberCount} members</span>
        <span>Updated {timeAgo(project.updatedAt)}</span>
      </div>
    </button>
  )
}
```

- [ ] **Step 6: Update `ProjectListSection`**

Change `ProjectListSection` props to include `onCreateProject`:

```ts
export function ProjectListSection({
  projects,
  isLoading,
  compact = false,
  onCreateProject,
}: {
  projects: Project[]
  isLoading: boolean
  compact?: boolean
  onCreateProject?: () => void
}) {
```

Use this empty state:

```tsx
if (!projects.length) {
  return (
    <div className="rounded-md border border-dashed border-shell-border bg-shell-surface p-5">
      <h2 className="text-sm font-semibold text-shell-text">No projects yet</h2>
      <p className="mt-1 text-sm text-shell-muted">Projects contain songs and members. Create one to start.</p>
      {onCreateProject && (
        <Button size="sm" className="mt-4" onClick={onCreateProject}>
          New Project
        </Button>
      )}
    </div>
  )
}
```

Import `Button` from `../../components/ui`.

- [ ] **Step 7: Update the project directory page**

In `ProjectDashboardPage`, add state:

```ts
const [query, setQuery] = useState('')
const [status, setStatus] = useState<ProjectDirectoryStatusFilter>('ALL')
const filteredProjects = filterProjects(projects, { query, status })
```

Use this controls row:

```tsx
<div className="mb-4 flex flex-wrap items-center gap-2">
  <Input
    value={query}
    onChange={(event) => setQuery(event.target.value)}
    placeholder="Search projects..."
    className="max-w-sm"
  />
  <select
    value={status}
    onChange={(event) => setStatus(event.target.value as ProjectDirectoryStatusFilter)}
    className="rounded-md border border-shell-border bg-shell-surface px-3 py-2 text-sm text-shell-text focus:outline-none focus:ring-2 focus:ring-primary/30"
  >
    <option value="ALL">All statuses</option>
    {ProjectStatusEnum.entries.map((entry) => (
      <option key={entry.key} value={entry.key}>
        {entry.labelFallback}
      </option>
    ))}
  </select>
</div>
```

Pass filtered projects:

```tsx
<ProjectListSection projects={filteredProjects} isLoading={isLoading} onCreateProject={() => setOpen(true)} />
```

- [ ] **Step 8: Run tests, build, and commit**

Run:

```bash
node --test apps/web/tests/project-directory-filters.test.ts
pnpm --filter @ama-midi/web build
git add apps/web/src/features/projects/project-directory-filters.ts apps/web/tests/project-directory-filters.test.ts apps/web/src/features/projects/ProjectDashboardPage.tsx apps/web/src/features/projects/ProjectListSection.tsx apps/web/src/features/projects/ProjectCard.tsx
git commit -m "refactor(web): add dense project directory"
```

---

## Task 7: Project Workspace And Song Table Polish

**Files:**
- Modify: `apps/web/src/features/projects/ProjectPage.tsx`
- Modify: `apps/web/src/features/songs/SongTable.tsx`
- Modify: `apps/web/src/features/songs/song-table-filters.ts`
- Modify: `apps/web/tests/song-table-filters.test.ts`

- [ ] **Step 1: Extend song table filter tests**

Append to `apps/web/tests/song-table-filters.test.ts`:

```ts
test('filterProjectSongs returns empty when query and status hide all rows', () => {
  const result = filterProjectSongs(songs, { query: 'gamma', status: 'APPROVED' })
  assert.equal(result.length, 0)
})
```

- [ ] **Step 2: Keep validation hints centralized**

In `song-table-filters.ts`, keep existing `validationHint` behavior. Do not add UI logic to the filter helper.

- [ ] **Step 3: Update project workspace header**

In `apps/web/src/features/projects/ProjectPage.tsx`, import `ProjectStatusEnum`, `Badge`, and `timeAgo`:

```ts
import { ProjectStatusEnum } from '@ama-midi/shared'
import { Badge, Button, Tabs } from '../../components/ui'
import { timeAgo } from '../../lib/utils'
```

Replace the header block with:

```tsx
<div className="mb-5 flex flex-col gap-4 border-b border-shell-border pb-4 md:flex-row md:items-end md:justify-between">
  <div className="min-w-0">
    <BackNavLink to="/projects" label="Projects" className="mb-2" />
    <div className="flex flex-wrap items-center gap-2">
      <h1 className="truncate text-2xl font-semibold text-shell-text">{project?.name ?? 'Project'}</h1>
      {project && (
        <Badge variant={ProjectStatusEnum.variant(project.status)} size="sm">
          {ProjectStatusEnum.label(project.status)}
        </Badge>
      )}
    </div>
    <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-shell-muted">
      <span>{songs.length} songs</span>
      {project && <span>{project.memberCount} members</span>}
      {project && <span>Updated {timeAgo(project.updatedAt)}</span>}
    </div>
  </div>
  <Button size="sm" rounded onClick={() => setWizardOpen(true)}>
    + New Song
  </Button>
</div>
```

- [ ] **Step 4: Update song table filters and labels**

In `apps/web/src/features/songs/SongTable.tsx`, replace `SONG_STATUS_OPTIONS` import with:

```ts
import { SongStatusEnum } from '@ama-midi/shared'
```

Replace status filter options:

```tsx
{SongStatusEnum.entries.map((entry) => (
  <option key={entry.key} value={entry.key}>
    {entry.labelFallback}
  </option>
))}
```

Add a clear-filters function:

```ts
function clearFilters() {
  setQuery('')
  setStatus('ALL')
}
```

Replace the empty table cell content:

```tsx
<td colSpan={7} className="px-3 py-8 text-center text-shell-muted">
  {query || status !== 'ALL' ? (
    <div className="flex flex-col items-center gap-2">
      <span>No songs match. Clear filters?</span>
      <Button size="sm" variant="secondary" onClick={clearFilters}>
        Clear filters
      </Button>
    </div>
  ) : (
    'No songs yet.'
  )}
</td>
```

Tighten row density by using `py-2` or smaller for all table cells and keep each row at or below 44px in the browser.

- [ ] **Step 5: Run tests and build**

Run:

```bash
node --test apps/web/tests/song-table-filters.test.ts
pnpm --filter @ama-midi/web build
```

Expected: both pass.

- [ ] **Step 6: Commit**

Run:

```bash
git add apps/web/src/features/projects/ProjectPage.tsx apps/web/src/features/songs/SongTable.tsx apps/web/src/features/songs/song-table-filters.ts apps/web/tests/song-table-filters.test.ts
git commit -m "refactor(web): polish project workspace management"
```

---

## Task 8: Final Acceptance Sweep

**Files:**
- Read only unless verification exposes a compile error from earlier tasks

- [ ] **Step 1: Run grep acceptance checks**

Run:

```bash
rg -n "SONG_STATUS_LABELS|STATUS_COLORS|Record<SongStatus" apps packages
```

Expected: no matches.

- [ ] **Step 2: Run all focused tests**

Run:

```bash
node --test apps/web/tests/shared-enums.test.ts
node --test apps/web/tests/project-directory-filters.test.ts
node --test apps/web/tests/song-table-filters.test.ts
cd apps/api && pnpm test -- shared-enum-drift.spec.ts
```

Expected: all pass.

- [ ] **Step 3: Run package builds**

Run:

```bash
pnpm --filter @ama-midi/shared build
pnpm --filter @ama-midi/api build
pnpm --filter @ama-midi/web build
```

Expected: all pass.

- [ ] **Step 4: Manual UI verification**

Run the web app:

```bash
pnpm --filter @ama-midi/web dev
```

Verify:

```txt
/                    Dashboard shows management nav, summary strip, two-column grid at desktop width.
/projects            Project directory has search, status filter, compact project cards, and create action.
/projects/:projectId Project header shows status badge, song/member metadata, tabs, dense song table.
```

Resize to `768px` and verify dashboard and project directory stack without text overlap.

- [ ] **Step 5: Editor regression check**

Open an editor route and verify:

```txt
Editor top bar, piano roll, side panels, and interactions are visually unchanged.
Adding a note still works when the song is editable.
Saving and realtime socket behavior are unchanged.
```

Do not edit editor files to adjust management-page styling.

- [ ] **Step 6: Final commit if verification fixes were required**

If Step 1-5 required any small compile or styling fixes, commit them:

```bash
git add <changed-files>
git commit -m "fix(web): complete management flow verification"
```

If no fixes were required, do not create an empty commit.

---

## Self-Review Notes

- Spec coverage: Phase 0 is covered by Tasks 1-3; Phase 1 by Task 4; Phase 2 by Task 5; Phase 3 by Task 6; Phase 4 by Task 7; regression checks by Task 8.
- Scope: editor UI is excluded. The only allowed editor-adjacent changes are compile-only enum label replacements, with no visual change.
- Type consistency: status/project filters use `ProjectStatusEnum`, `SongStatusEnum`, `ProjectDirectoryStatusFilter`, and `SongTableStatusFilter` consistently.
- Test coverage: enum order, Prisma drift, project directory filter, and existing song table filter behavior are covered.
