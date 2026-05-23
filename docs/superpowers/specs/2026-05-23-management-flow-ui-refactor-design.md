# Management Flow UI Refactor Design

**Date:** 2026-05-23
**Goal:** Refactor dashboard, project directory, and project workspace into a coherent, dense, professional management surface. Land a centralized enum/status system as the foundation so every status badge, filter, and color reads from one table.
**Scope:** Frontend management UI + shared enum layer. Editor UI, editor routes, and API schema changes are out of scope.

## Audience

Internal team workspace. Composers, producers, QA, developers. Pre-production. Desktop-first.

## Decisions

| Topic | Decision |
|---|---|
| Visual direction | Dense professional SaaS. Compact, operational, table-first. |
| Route model | Keep existing routes and canonical project → song → editor flow. |
| Editor impact | Zero. Editor route renders pixel-identical pre/post refactor. |
| Behavior impact | Presentation only. No new product behavior except enum cleanup. |
| Foundation work | Centralize enums (`SongStatus`, `ProjectStatus`, `SongCategory`, `SongDifficulty`, `ProjectPermission`, `SongScope`, `UserRole`, `NoteType`, `NoteEventType`) into `packages/shared/src/enums.ts` before UI touches them. |
| i18n | Reserve `labelKey` per enum entry now. Wire later. |
| Rollout | Direct to `main`. No feature flag. Internal users only. |
| Mobile | Defer. Define one breakpoint at 768px where two-column grid stacks. No further mobile polish. |
| AppShell variants | Add `variant?: 'management' \| 'editor' \| 'auth'`, default `'management'`. Editor passes `'editor'`. |

## Current State

- App shell has branding and account controls but no primary management navigation.
- Dashboard sections stack equally; urgent work does not stand out.
- Project pages use plain headings + tabs, no production context in header.
- Project cards and song rows usable but visually light for production workflow.
- Empty/loading states minimal, do not guide next action.
- Enum logic duplicated: `SONG_STATUS_LABELS` in `constants.ts`, variant map in `SongStatusBadge.tsx`, ad-hoc maps in 8+ components, no labels for category/difficulty at all.
- Uncommitted nav edits exist on `EditorBreadcrumb.tsx`, `NavDropdown.tsx`, `ProjectSwitcher.tsx`. Plan: commit those first as a standalone PR, then start this refactor from clean base.

## Target Flow

Navigation flow stable:

```txt
Dashboard -> Project Directory -> Project Workspace -> Song Editor
Dashboard -> Recent / Assigned / Review Song -> Song Editor
```

- Dashboard: "What needs attention across projects?"
- Project directory: "Which workspace should I enter?"
- Project workspace: "What is happening inside this project?"
- Editor: focused chart editing — untouched.

## Phase 0 — Centralize Enums (Foundation, ships first)

Separate PR. Blocks all UI work.

`packages/shared/src/enums.ts`:

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
  const byKey = Object.fromEntries(entries.map((e) => [e.key, e])) as {
    [K in T[number]['key']]: Extract<T[number], { key: K }>
  }
  return {
    entries,
    keys: entries.map((e) => e.key) as ReadonlyArray<T[number]['key']>,
    byKey,
    label:   (k: T[number]['key']) => byKey[k].labelFallback,
    color:   (k: T[number]['key']) => byKey[k].color,
    bg:      (k: T[number]['key']) => byKey[k].bg,
    variant: (k: T[number]['key']) => byKey[k].variant,
  }
}

export const SongStatusEnum = defineEnum([
  { key: 'DRAFT',     labelKey: 'song.status.draft',     labelFallback: 'Draft',      color: '#6B6585', bg: '#F3F0F9', variant: 'muted'   },
  { key: 'IN_REVIEW', labelKey: 'song.status.inReview',  labelFallback: 'In Review',  color: '#F59E0B', bg: '#FFFBEB', variant: 'warning' },
  { key: 'NEEDS_FIX', labelKey: 'song.status.needsFix',  labelFallback: 'Needs Fix',  color: '#EF4444', bg: '#FEF2F2', variant: 'error'   },
  { key: 'APPROVED',  labelKey: 'song.status.approved',  labelFallback: 'Approved',   color: '#10B981', bg: '#ECFDF5', variant: 'success' },
  { key: 'PUBLISHED', labelKey: 'song.status.published', labelFallback: 'Published',  color: '#059669', bg: '#D1FAE5', variant: 'success' },
  { key: 'ARCHIVED',  labelKey: 'song.status.archived',  labelFallback: 'Archived',   color: '#6B7280', bg: '#F3F4F6', variant: 'muted'   },
] as const)
export type SongStatus = typeof SongStatusEnum.keys[number]
```

Repeat for `ProjectStatusEnum`, `ProjectPermissionEnum`, `SongScopeEnum`, `SongCategoryEnum`, `SongDifficultyEnum`, `UserRoleEnum`, `NoteTypeEnum`, `NoteEventTypeEnum`.

Migration steps (Phase 0 only):

1. Add `enums.ts`. Export from `index.ts`.
2. `types.ts`: replace each union literal with `export type X = typeof XEnum.keys[number]`. Existing imports continue working.
3. `song-status-workflow.ts`: import `SongStatus` from enums.
4. Delete `SONG_STATUS_LABELS` from `constants.ts`. Keep `*_OPTIONS` aliases for one release.
5. Rename `STATUS_COLORS` → `SYNC_STATUS_COLORS` (it is sync state, not song state). Update `StatusBadge.tsx`.
6. Replace `SongStatusBadge.tsx` variants map with `SongStatusEnum.variant(status)`.
7. Sweep ad-hoc maps: `SongTable.tsx`, `SongStatusMenu.tsx`, `song-table-filters.ts`, `useSongWorkflow.ts`, `DashboardSongList.tsx`, `EditorBreadcrumb.tsx`, `Toolbar.tsx`, `SongSwitcher.tsx`.
8. Inline category/difficulty title-casing → `*Enum.label(k)`.
9. API DTOs: replace hardcoded `IsIn([...])` arrays with `IsIn([...XEnum.keys])`.
10. Prisma ↔ shared drift test in `apps/api`. Regex-parse `schema.prisma`, assert each `enum X { ... }` equals `XEnum.keys`.
11. Unit test per enum asserts key order.

Acceptance (Phase 0):

- [ ] `grep -rn "Record<SongStatus" apps/web/src` returns zero
- [ ] `SONG_STATUS_LABELS` deleted
- [ ] `STATUS_COLORS` renamed
- [ ] Prisma drift test passes
- [ ] Web + API type-check + tests pass

## Phase 1 — AppShell

`apps/web/src/components/layout/AppShell.tsx`.

Prop API:

```ts
interface AppShellProps {
  variant?: 'management' | 'editor' | 'auth'  // default 'management'
  maxWidth?: number                            // override; default depends on variant
  hideHeader?: boolean                         // unchanged
  children: ReactNode
}
```

Variant behavior:

| Variant | Header nav | Default maxWidth |
|---|---|---|
| `management` | Brand + `Dashboard` / `Projects` links + active state + theme + account | 1280px |
| `editor` | Brand + theme + account only | full width |
| `auth` | Brand only | 480px |

Audit every current `<AppShell>` caller. Set explicit `variant` on each:

- `EditorPage.tsx` → `editor`
- `App.tsx` / dashboard route → `management`
- `ProjectDashboardPage.tsx` → `management`
- `ProjectPage.tsx` → `management`
- Login page → `auth`

Acceptance (Phase 1):

- [ ] Editor route screenshot matches baseline pixel-for-pixel
- [ ] Management routes show new nav with active state
- [ ] Auth route unchanged

## Phase 2 — Dashboard

`apps/web/src/features/dashboard/`

Layout:

```txt
+-------------------------------------------------------------+
| Page header                                                 |
|   Title: Dashboard                                          |
|   Subtitle: Cross-project production work + activity        |
+-------------------------------------------------------------+
| Summary strip (≤ 64px tall)                                 |
|   [Needs review N] [Assigned N] [Recent N] [Active proj N]  |
+-------------------------------------------------------------+
| Main grid (collapses to single column < 768px)              |
|   Left col (2/3 width):     | Right col (1/3 width):        |
|     Needs Review            |   My Projects                 |
|     Assigned to Me          |                               |
|     Recent Songs            |                               |
+-------------------------------------------------------------+
```

Rules:

- `Needs Review` first — most team-actionable queue.
- Compact section headers with counts.
- Song rows: dense list — song name, project, status badge, updated time. ≤ 48px tall.
- Status badges use `SongStatusEnum.variant()` + `SongStatusEnum.label()`.
- Inline empty states per queue ("No songs need review").
- `View all projects` link on project panel.

Data:

- `useDashboard()` for `recentSongs`, `assignedToMe`, `needsReview`.
- `useProjects()` for projects.
- No new API requirements.

Acceptance (Phase 2):

- [ ] Summary strip ≤ 64px
- [ ] Song row ≤ 48px
- [ ] Grid stacks at < 768px
- [ ] All status pills source from `SongStatusEnum`

## Phase 3 — Project Directory

`apps/web/src/features/projects/ProjectDashboardPage.tsx`

Header:

```txt
< Dashboard
Projects
Workspaces for songs, members, and production status      [+ New Project]
```

Controls row:

```txt
[Search projects...]  [Status: All ▾]
```

- Status filter uses `ProjectStatusEnum.entries`.
- Search/filter run locally against `useProjects()` result. `// Revisit if project count > 200.`

List:

```txt
+----------------------------------------------------------+
| Project Name                              [Status badge] |
| Description (muted, optional)                            |
| 12 songs · 4 members · Updated 2h ago                    |
+----------------------------------------------------------+
```

Empty state:

```txt
No projects yet
Projects contain songs and members. Create one to start.
[+ New Project]
```

Acceptance (Phase 3):

- [ ] Search + filter work without re-fetch
- [ ] Empty state shows action
- [ ] Card uses `ProjectStatusEnum` for badge

## Phase 4 — Project Workspace

`apps/web/src/features/projects/ProjectPage.tsx`

Header:

```txt
< Projects
Project Name                          [Status]  [+ New Song]
12 songs · 4 members · Updated 2h ago
```

Tabs: `Songs | Members | Settings`

Songs tab — `SongTable.tsx`:

- Keep search + status filter. Both source from enums.
- Columns: Song · Status · Composer · QA · Last Edited · Validation · Actions.
- `Open Editor` action unchanged.
- Row density tighter (≤ 44px).
- Filter chips use `SongStatusEnum.entries`.
- Empty state when filter active: "No songs match. Clear filters?"

Members tab: layout polish only. Behavior unchanged.

Settings tab: placeholder styled consistently. No new behavior.

Acceptance (Phase 4):

- [ ] Song row ≤ 44px
- [ ] Filter chips driven by enum, not literals
- [ ] Empty + filtered-empty states distinct

## Styling Direction

- Compact spacing. Clear hierarchy. No hero sections.
- Border radius ≤ 8px on new management cards/panels.
- Neutral surfaces. Brand purple as accent only — active links, primary actions.
- Light + dark theme readable.
- Tokens — reuse `globals.css` variables. New tokens only if no existing one fits.

## Loading / Error / Empty

Loading:

- Inline skeletons per panel. No full-page spinner on management pages.

Empty:

- Dashboard queues: inline message + nothing else.
- Directory: explain + offer `New Project`.
- Workspace songs: distinguish "no songs yet" from "filter hid all songs".

Errors:

- No new error handling. Existing hooks expose errors → render near affected section, never full-page.

## Regression Guards

Before Phase 1 lands:

- Playwright screenshot of `/editor/:songId` at 1440×900. Diff post-refactor.
- Snapshot list of all current `<AppShell>` callers with their props.
- Editor smoke: open editor, add note, save. Confirm header chrome unchanged.

After each phase:

- `pnpm --filter web build` — type + bundle.
- `pnpm --filter web test` — unit suite.
- Manual check: light + dark, 1440px + 768px.

## Testing

- Unit: project directory filter helper (pure function — easy to test).
- Unit: each `*Enum.keys` matches expected order (Phase 0).
- Integration: Prisma ↔ shared drift test (Phase 0).
- Existing dashboard + song-table tests must continue passing.
- Manual: `/`, `/projects` (0/1/many), `/projects/:id` (empty + populated), 1440px + 768px, light + dark, confirm `/editor/:id` unchanged.

## Sequencing

```txt
Pre: Commit in-flight nav edits as standalone PR. Land on main.

PR 1 — Phase 0 (Enums)        [blocks all below]
PR 2 — Phase 1 (AppShell)     [blocks Phase 2-4]
PR 3 — Phase 2 (Dashboard)    ┐
PR 4 — Phase 3 (Directory)    ├ parallelizable after Phase 1
PR 5 — Phase 4 (Workspace)    ┘
```

Phases 2-4 can be split across developers once Phase 1 ships.

## Risks

| Risk | Mitigation |
|---|---|
| AppShell change breaks editor chrome | Playwright screenshot diff before Phase 1 merges |
| Enum migration causes color drift in existing badges | Expected — same source of truth fixes inconsistency. Document in PR with before/after. |
| Prisma vs shared enum drift | Drift test in Phase 0 (regex parse + assert) |
| Local project filter doesn't scale | Document 200-project ceiling. Server search = separate ticket. |
| Two-column dashboard breaks on tablet | Single breakpoint at 768px. Stack vertically below. |
| Uncommitted nav work conflicts | Land it as own PR before this refactor starts |

## Opposing Case

Restyle work disguised as architecture — no new behavior, no schema changes. A skeptic says: skip the spec, open a visual PR, iterate in code. Counter: (1) shared enum work has cross-cutting impact and must precede UI changes; (2) AppShell variant prop is a real contract that consumers across the app must adopt — needs design before code; (3) editor regression risk is real (every management page shares `<AppShell>` with the editor). Without phases 0-1 written down, phases 2-4 will diverge across engineers.

## Out Of Scope

- Editor layout, toolbar, breadcrumb, piano roll, panels, editor interactions
- API schema changes
- New role-based dashboard behavior
- Command palette
- Server-side project search or pagination
- Project settings implementation beyond placeholder styling
- i18n runtime (labelKey reserved, translation table not wired)
- Mobile polish beyond single 768px breakpoint
- New enums (only consolidate existing)

## Estimate

| Phase | Effort |
|---|---|
| Pre — commit nav edits | 30min |
| 0 — Enums | 2-3h |
| 1 — AppShell | 1-2h |
| 2 — Dashboard | 3-4h |
| 3 — Directory | 2-3h |
| 4 — Workspace | 2-3h |
| Total | ~12-16h, 5 PRs |
