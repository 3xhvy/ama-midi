# Project → Song → Editor Navigation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make project-based routes canonical (`/projects/:projectId/songs/:songId`), upgrade the home dashboard for fast persona-based entry, and add project/song switchers in the editor without turning the editor into a dashboard.

**Architecture:** Add a small dashboard API for cross-project song feeds (recent, assigned, needs review). Keep “last opened” recents in browser localStorage for editor switchers. Canonicalize all editor links to project-scoped paths; legacy `/songs/:songId` becomes a redirect-only route. Defer Cmd+K command palette to a separate plan.

**Tech Stack:** NestJS, Prisma, Jest (API); React 18, React Router 7, TanStack Query, Tailwind, Node test runner (web unit tests).

**Prerequisite worktree:** Run in an isolated worktree created by the brainstorming skill before starting.

**Out of scope (future plan):** Global command palette (`Cmd/Ctrl+K`), batch validation summaries on project song lists, server-side recent-project persistence.

---

## Product Rules (locked)

```txt
/                       → role-aware home dashboard (Recent, Assigned, Needs Review, My Projects)
/projects               → project list only
/projects/:projectId    → project workspace (Songs | Members | Settings)
/projects/:projectId/songs/:songId → editor (canonical)

/songs                  → redirect to /projects
/songs/:songId          → redirect to /projects/:projectId/songs/:songId

Editor toolbar:
  ← Project   ProjectName ▼ / SongName ▼

Song switcher scope = current project only
Project switcher scope = all accessible projects
Assigned to Me = assignedComposerId OR assignedQaId = me (any status)
Needs Review = assignedQaId = me AND status = IN_REVIEW
```

---

## File Structure

### Shared

| File | Responsibility |
|------|----------------|
| `packages/shared/src/types.ts` | `DashboardSongRow`, `DashboardFeed` types |
| `packages/shared/src/constants.ts` | Human-readable song status labels |

### API

| File | Responsibility |
|------|----------------|
| `apps/api/src/modules/dashboard/dashboard.module.ts` | Nest module |
| `apps/api/src/modules/dashboard/dashboard.controller.ts` | `GET /dashboard` |
| `apps/api/src/modules/dashboard/dashboard.service.ts` | Feed queries with access filtering |
| `apps/api/src/modules/dashboard/__tests__/dashboard.service.spec.ts` | Unit tests |
| `apps/api/src/app.module.ts` | Register `DashboardModule` |

### Web — navigation utilities

| File | Responsibility |
|------|----------------|
| `apps/web/src/features/navigation/song-editor-path.ts` | Build canonical editor paths |
| `apps/web/src/features/navigation/recent-navigation.ts` | localStorage read/write for recents |
| `apps/web/src/features/navigation/resolve-project-switch.ts` | Project switcher landing logic |
| `apps/web/tests/song-editor-path.test.ts` | Path helper tests |
| `apps/web/tests/recent-navigation.test.ts` | Recents helper tests |
| `apps/web/tests/resolve-project-switch.test.ts` | Switch landing tests |

### Web — dashboard

| File | Responsibility |
|------|----------------|
| `apps/web/src/features/dashboard/useDashboard.ts` | TanStack Query hook |
| `apps/web/src/features/dashboard/DashboardPage.tsx` | Home dashboard with 4 sections |
| `apps/web/src/features/dashboard/DashboardSongList.tsx` | Reusable song row list |
| `apps/web/src/features/projects/ProjectListSection.tsx` | Extracted project grid from dashboard page |

### Web — editor navigation

| File | Responsibility |
|------|----------------|
| `apps/web/src/components/ui/SongStatusBadge.tsx` | Workflow status pill |
| `apps/web/src/features/navigation/NavDropdown.tsx` | Shared searchable dropdown shell |
| `apps/web/src/features/navigation/ProjectSwitcher.tsx` | Project picker in editor |
| `apps/web/src/features/editor/components/SongSwitcher.tsx` | Project-scoped song picker |
| `apps/web/src/features/navigation/EditorBreadcrumb.tsx` | `← Project` + switchers |
| `apps/web/src/pages/LegacySongEditorRedirect.tsx` | Redirect-only legacy route |
| `apps/web/src/features/editor/components/Toolbar.tsx` | Use `EditorBreadcrumb` |
| `apps/web/src/pages/EditorPage.tsx` | Pass project context; record recents |

### Web — project workspace

| File | Responsibility |
|------|----------------|
| `apps/web/src/features/songs/song-table-filters.ts` | Pure status/search filter |
| `apps/web/tests/song-table-filters.test.ts` | Filter tests |
| `apps/web/src/features/songs/SongTable.tsx` | Columns, filters, canonical links |
| `apps/web/src/features/songs/SongCard.tsx` | Canonical editor links |
| `apps/web/src/features/projects/ProjectDashboardPage.tsx` | Projects-only page at `/projects` |
| `apps/web/src/App.tsx` | Route table |

---

## Task 1: Shared dashboard types

**Files:**
- Modify: `packages/shared/src/types.ts`
- Modify: `packages/shared/src/constants.ts`

- [ ] **Step 1: Add dashboard types to `types.ts`**

Append after the `Song` interface in `packages/shared/src/types.ts`:

```typescript
export interface DashboardSongRow {
  id: string
  projectId: string
  projectName: string
  name: string
  status: SongStatus
  assignedComposerName?: string | null
  assignedQaName?: string | null
  updatedAt: string
}

export interface DashboardFeed {
  recentSongs: DashboardSongRow[]
  assignedToMe: DashboardSongRow[]
  needsReview: DashboardSongRow[]
}
```

- [ ] **Step 2: Add status labels to `constants.ts`**

Append to `packages/shared/src/constants.ts`:

```typescript
export const SONG_STATUS_LABELS: Record<(typeof SONG_STATUS_OPTIONS)[number], string> = {
  DRAFT: 'Draft',
  IN_REVIEW: 'In Review',
  NEEDS_FIX: 'Needs Fix',
  APPROVED: 'Approved',
  PUBLISHED: 'Published',
  ARCHIVED: 'Archived',
}
```

- [ ] **Step 3: Type-check shared package**

Run:

```bash
pnpm --filter @ama-midi/shared build
```

Expected: exits 0.

- [ ] **Step 4: Commit**

```bash
git add packages/shared/src/types.ts packages/shared/src/constants.ts
git commit -m "feat(shared): add dashboard feed types and song status labels"
```

---

## Task 2: Dashboard service (API)

**Files:**
- Create: `apps/api/src/modules/dashboard/dashboard.service.ts`
- Create: `apps/api/src/modules/dashboard/__tests__/dashboard.service.spec.ts`

- [ ] **Step 1: Write the failing test**

Create `apps/api/src/modules/dashboard/__tests__/dashboard.service.spec.ts`:

```typescript
import { DashboardService } from '../dashboard.service'
import { PrismaService } from '../../prisma/prisma.service'
import { ProjectAccessService } from '../../project-access/project-access.service'
import type { AuthUser } from '@ama-midi/shared'

const prisma = {
  song: { findMany: jest.fn() },
}

const access = {
  assertCanViewSong: jest.fn(),
}

const user: AuthUser = {
  id: 'u1',
  email: 'u1@example.com',
  name: 'QA',
  role: 'COMPOSER',
  profileComplete: true,
  tourComplete: true,
}

const songRow = {
  id: 'song1',
  projectId: 'p1',
  name: 'Neon Rush',
  status: 'IN_REVIEW',
  updatedAt: new Date('2026-05-23T10:00:00Z'),
  assignedComposerId: 'u2',
  assignedQaId: 'u1',
  assignedComposer: { name: 'Composer A' },
  assignedQa: { name: 'QA' },
  project: { name: 'Rhythm Game Q2' },
}

describe('DashboardService', () => {
  let service: DashboardService

  beforeEach(() => {
    service = new DashboardService(
      prisma as unknown as PrismaService,
      access as unknown as ProjectAccessService,
    )
    jest.clearAllMocks()
    access.assertCanViewSong.mockResolvedValue(songRow)
  })

  it('returns needsReview songs assigned to current QA user', async () => {
    prisma.song.findMany.mockResolvedValue([songRow])

    const feed = await service.getFeed(user)

    expect(feed.needsReview).toHaveLength(1)
    expect(feed.needsReview[0].projectName).toBe('Rhythm Game Q2')
    expect(feed.needsReview[0].status).toBe('IN_REVIEW')
  })

  it('maps assignedToMe without requiring IN_REVIEW status', async () => {
    prisma.song.findMany
      .mockResolvedValueOnce([]) // recent
      .mockResolvedValueOnce([{ ...songRow, status: 'DRAFT' }]) // assigned

    const feed = await service.getFeed(user)

    expect(feed.assignedToMe).toHaveLength(1)
    expect(feed.assignedToMe[0].status).toBe('DRAFT')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run:

```bash
cd apps/api && pnpm test -- dashboard.service.spec.ts
```

Expected: FAIL — `DashboardService` not found.

- [ ] **Step 3: Implement `dashboard.service.ts`**

Create `apps/api/src/modules/dashboard/dashboard.service.ts`:

```typescript
import { Injectable } from '@nestjs/common'
import { PrismaService } from '../prisma/prisma.service'
import { ProjectAccessService } from '../project-access/project-access.service'
import type { AuthUser, DashboardFeed, DashboardSongRow, SongStatus } from '@ama-midi/shared'

type SongWithRelations = {
  id: string
  projectId: string
  name: string
  status: SongStatus
  updatedAt: Date
  assignedComposer?: { name: string } | null
  assignedQa?: { name: string } | null
  project: { name: string }
}

@Injectable()
export class DashboardService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly access: ProjectAccessService,
  ) {}

  async getFeed(user: AuthUser): Promise<DashboardFeed> {
    const [recentCandidates, assignedCandidates, reviewCandidates] = await Promise.all([
      this.prisma.song.findMany({
        where: {
          archivedAt: null,
          OR: [
            { assignedComposerId: user.id },
            { createdBy: user.id },
            { noteEvents: { some: { actorId: user.id } } },
          ],
        },
        include: this.include(),
        orderBy: { updatedAt: 'desc' },
        take: 30,
      }),
      this.prisma.song.findMany({
        where: {
          archivedAt: null,
          OR: [{ assignedComposerId: user.id }, { assignedQaId: user.id }],
        },
        include: this.include(),
        orderBy: { updatedAt: 'desc' },
        take: 30,
      }),
      this.prisma.song.findMany({
        where: {
          archivedAt: null,
          assignedQaId: user.id,
          status: 'IN_REVIEW',
        },
        include: this.include(),
        orderBy: { updatedAt: 'desc' },
        take: 30,
      }),
    ])

    const recentSongs = await this.filterAccessible(user, recentCandidates, 8)
    const assignedToMe = await this.filterAccessible(user, assignedCandidates, 12)
    const needsReview = await this.filterAccessible(user, reviewCandidates, 12)

    return { recentSongs, assignedToMe, needsReview }
  }

  private include() {
    return {
      project: { select: { name: true } },
      assignedComposer: { select: { name: true } },
      assignedQa: { select: { name: true } },
    }
  }

  private toRow(song: SongWithRelations): DashboardSongRow {
    return {
      id: song.id,
      projectId: song.projectId,
      projectName: song.project.name,
      name: song.name,
      status: song.status,
      assignedComposerName: song.assignedComposer?.name ?? null,
      assignedQaName: song.assignedQa?.name ?? null,
      updatedAt: song.updatedAt.toISOString(),
    }
  }

  private async filterAccessible(
    user: AuthUser,
    songs: SongWithRelations[],
    limit: number,
  ): Promise<DashboardSongRow[]> {
    const rows: DashboardSongRow[] = []
    for (const song of songs) {
      if (rows.length >= limit) break
      try {
        await this.access.assertCanViewSong(song.id, user)
        rows.push(this.toRow(song))
      } catch {
        // skip inaccessible songs
      }
    }
    return rows
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run:

```bash
cd apps/api && pnpm test -- dashboard.service.spec.ts
```

Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/modules/dashboard/dashboard.service.ts apps/api/src/modules/dashboard/__tests__/dashboard.service.spec.ts
git commit -m "feat(api): add dashboard feed service"
```

---

## Task 3: Dashboard controller and module wiring

**Files:**
- Create: `apps/api/src/modules/dashboard/dashboard.controller.ts`
- Create: `apps/api/src/modules/dashboard/dashboard.module.ts`
- Modify: `apps/api/src/app.module.ts`

- [ ] **Step 1: Create controller**

Create `apps/api/src/modules/dashboard/dashboard.controller.ts`:

```typescript
import { Controller, Get, Req, UseGuards } from '@nestjs/common'
import { AuthGuard } from '@nestjs/passport'
import type { Request } from 'express'
import type { AuthUser } from '@ama-midi/shared'
import { DashboardService } from './dashboard.service'

@Controller('dashboard')
@UseGuards(AuthGuard('jwt'))
export class DashboardController {
  constructor(private readonly dashboard: DashboardService) {}

  @Get()
  getFeed(@Req() req: Request) {
    return this.dashboard.getFeed(req.user as AuthUser)
  }
}
```

- [ ] **Step 2: Create module**

Create `apps/api/src/modules/dashboard/dashboard.module.ts`:

```typescript
import { Module } from '@nestjs/common'
import { DashboardController } from './dashboard.controller'
import { DashboardService } from './dashboard.service'
import { ProjectAccessModule } from '../project-access/project-access.module'

@Module({
  imports: [ProjectAccessModule],
  controllers: [DashboardController],
  providers: [DashboardService],
})
export class DashboardModule {}
```

- [ ] **Step 3: Register in `app.module.ts`**

Add import and register `DashboardModule` alongside other feature modules in `apps/api/src/app.module.ts`:

```typescript
import { DashboardModule } from './modules/dashboard/dashboard.module'

@Module({
  imports: [
    // ...existing modules
    DashboardModule,
  ],
})
```

- [ ] **Step 4: Build API**

Run:

```bash
cd apps/api && pnpm build
```

Expected: exits 0.

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/modules/dashboard/dashboard.controller.ts apps/api/src/modules/dashboard/dashboard.module.ts apps/api/src/app.module.ts
git commit -m "feat(api): expose GET /dashboard feed endpoint"
```

---

## Task 4: Navigation path helpers

**Files:**
- Create: `apps/web/src/features/navigation/song-editor-path.ts`
- Create: `apps/web/tests/song-editor-path.test.ts`

- [ ] **Step 1: Write the failing test**

Create `apps/web/tests/song-editor-path.test.ts`:

```typescript
import assert from 'node:assert/strict'
import { test } from 'node:test'
import { songEditorPath, projectPath } from '../src/features/navigation/song-editor-path.ts'

test('songEditorPath builds canonical project-scoped editor URL', () => {
  assert.equal(songEditorPath('p1', 's1'), '/projects/p1/songs/s1')
})

test('projectPath builds project workspace URL', () => {
  assert.equal(projectPath('p1'), '/projects/p1')
})
```

- [ ] **Step 2: Run test to verify it fails**

Run:

```bash
cd apps/web && node --experimental-strip-types --test tests/song-editor-path.test.ts
```

Expected: FAIL — module not found.

- [ ] **Step 3: Implement helpers**

Create `apps/web/src/features/navigation/song-editor-path.ts`:

```typescript
export function projectPath(projectId: string): string {
  return `/projects/${projectId}`
}

export function songEditorPath(projectId: string, songId: string): string {
  return `/projects/${projectId}/songs/${songId}`
}
```

- [ ] **Step 4: Run test to verify it passes**

Run:

```bash
cd apps/web && node --experimental-strip-types --test tests/song-editor-path.test.ts
```

Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/features/navigation/song-editor-path.ts apps/web/tests/song-editor-path.test.ts
git commit -m "feat(web): add canonical navigation path helpers"
```

---

## Task 5: Recent navigation localStorage

**Files:**
- Create: `apps/web/src/features/navigation/recent-navigation.ts`
- Create: `apps/web/src/features/navigation/resolve-project-switch.ts`
- Create: `apps/web/tests/recent-navigation.test.ts`
- Create: `apps/web/tests/resolve-project-switch.test.ts`

- [ ] **Step 1: Write failing tests**

Create `apps/web/tests/recent-navigation.test.ts`:

```typescript
import assert from 'node:assert/strict'
import { test } from 'node:test'
import {
  RECENT_PROJECTS_KEY,
  RECENT_SONGS_KEY,
  getRecentSongForProject,
  recordRecentProject,
  recordRecentSong,
} from '../src/features/navigation/recent-navigation.ts'

test('recordRecentSong stores latest song per project', () => {
  const storage = new Map<string, string>()
  const localStorage = {
    getItem: (k: string) => storage.get(k) ?? null,
    setItem: (k: string, v: string) => { storage.set(k, v) },
  }

  recordRecentSong(localStorage, 'p1', 's1')
  recordRecentSong(localStorage, 'p1', 's2')

  assert.equal(getRecentSongForProject(localStorage, 'p1'), 's2')
  assert.equal(RECENT_SONGS_KEY, 'ama-midi:recent-songs:v1')
})

test('recordRecentProject keeps unique projects most-recent-first', () => {
  const storage = new Map<string, string>()
  const localStorage = {
    getItem: (k: string) => storage.get(k) ?? null,
    setItem: (k: string, v: string) => { storage.set(k, v) },
  }

  recordRecentProject(localStorage, 'p1')
  recordRecentProject(localStorage, 'p2')
  recordRecentProject(localStorage, 'p1')

  const raw = localStorage.getItem(RECENT_PROJECTS_KEY)
  assert.match(raw ?? '', /"p1"/)
  assert.ok(raw?.indexOf('"p1"')! < raw?.indexOf('"p2"')!)
})
```

Create `apps/web/tests/resolve-project-switch.test.ts`:

```typescript
import assert from 'node:assert/strict'
import { test } from 'node:test'
import { resolveProjectSwitchTarget } from '../src/features/navigation/resolve-project-switch.ts'

test('recent song wins when switching projects in editor', () => {
  assert.equal(
    resolveProjectSwitchTarget({ projectId: 'p1', recentSongId: 's9', songCount: 3 }),
    '/projects/p1/songs/s9',
  )
})

test('empty project still lands on project workspace', () => {
  assert.equal(
    resolveProjectSwitchTarget({ projectId: 'p1', recentSongId: null, songCount: 0 }),
    '/projects/p1',
  )
})

test('project with songs but no recent opens project page', () => {
  assert.equal(
    resolveProjectSwitchTarget({ projectId: 'p1', recentSongId: null, songCount: 4 }),
    '/projects/p1',
  )
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run:

```bash
cd apps/web && node --experimental-strip-types --test tests/recent-navigation.test.ts tests/resolve-project-switch.test.ts
```

Expected: FAIL — modules not found.

- [ ] **Step 3: Implement recents helpers**

Create `apps/web/src/features/navigation/recent-navigation.ts`:

```typescript
export const RECENT_SONGS_KEY = 'ama-midi:recent-songs:v1'
export const RECENT_PROJECTS_KEY = 'ama-midi:recent-projects:v1'

type RecentSongsStore = Record<string, { songId: string; openedAt: number }>
type RecentProjectsStore = { projectId: string; openedAt: number }[]

type StorageLike = Pick<Storage, 'getItem' | 'setItem'>

function readJson<T>(storage: StorageLike, key: string, fallback: T): T {
  try {
    const raw = storage.getItem(key)
    if (!raw) return fallback
    return JSON.parse(raw) as T
  } catch {
    return fallback
  }
}

function writeJson(storage: StorageLike, key: string, value: unknown) {
  storage.setItem(key, JSON.stringify(value))
}

export function recordRecentSong(storage: StorageLike, projectId: string, songId: string) {
  const current = readJson<RecentSongsStore>(storage, RECENT_SONGS_KEY, {})
  current[projectId] = { songId, openedAt: Date.now() }
  writeJson(storage, RECENT_SONGS_KEY, current)
}

export function getRecentSongForProject(storage: StorageLike, projectId: string): string | null {
  const current = readJson<RecentSongsStore>(storage, RECENT_SONGS_KEY, {})
  return current[projectId]?.songId ?? null
}

export function recordRecentProject(storage: StorageLike, projectId: string) {
  const current = readJson<RecentProjectsStore>(storage, RECENT_PROJECTS_KEY, [])
  const next = [{ projectId, openedAt: Date.now() }, ...current.filter((p) => p.projectId !== projectId)]
  writeJson(storage, RECENT_PROJECTS_KEY, next.slice(0, 12))
}

export function getRecentProjects(storage: StorageLike): string[] {
  const current = readJson<RecentProjectsStore>(storage, RECENT_PROJECTS_KEY, [])
  return current.map((p) => p.projectId)
}
```

Create `apps/web/src/features/navigation/resolve-project-switch.ts`:

```typescript
import { projectPath, songEditorPath } from './song-editor-path'

export function resolveProjectSwitchTarget(input: {
  projectId: string
  recentSongId: string | null
  songCount: number
}): string {
  if (input.recentSongId) return songEditorPath(input.projectId, input.recentSongId)
  return projectPath(input.projectId)
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run:

```bash
cd apps/web && node --experimental-strip-types --test tests/recent-navigation.test.ts tests/resolve-project-switch.test.ts
```

Expected: PASS (5 tests).

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/features/navigation/recent-navigation.ts apps/web/src/features/navigation/resolve-project-switch.ts apps/web/tests/recent-navigation.test.ts apps/web/tests/resolve-project-switch.test.ts
git commit -m "feat(web): add recent navigation storage and project switch resolver"
```

---

## Task 6: Legacy song editor redirect route

**Files:**
- Create: `apps/web/src/pages/LegacySongEditorRedirect.tsx`
- Modify: `apps/web/src/App.tsx`

- [ ] **Step 1: Create redirect page**

Create `apps/web/src/pages/LegacySongEditorRedirect.tsx`:

```tsx
import { useEffect } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import type { Song } from '@ama-midi/shared'
import { useAuthStore } from '../store/auth.store'
import { apiClient } from '../features/auth/api'
import { songEditorPath } from '../features/navigation/song-editor-path'

export function LegacySongEditorRedirect() {
  const { songId } = useParams<{ songId: string }>()
  const navigate = useNavigate()
  const token = useAuthStore((s) => s.token)

  const { data: song, isError } = useQuery<Song>({
    queryKey: ['song', songId],
    queryFn: () => apiClient(token)<Song>(`/songs/${songId}`),
    enabled: !!token && !!songId,
    retry: false,
  })

  useEffect(() => {
    if (!songId) {
      navigate('/projects', { replace: true })
      return
    }
    if (song?.projectId) {
      navigate(songEditorPath(song.projectId, song.id), { replace: true })
    }
    if (isError) navigate('/projects', { replace: true })
  }, [song, songId, isError, navigate])

  return (
    <div className="min-h-screen bg-shell-bg flex items-center justify-center text-sm text-shell-muted">
      Redirecting…
    </div>
  )
}
```

- [ ] **Step 2: Wire route in `App.tsx`**

In `apps/web/src/App.tsx`, import the redirect page and replace the legacy editor route:

```tsx
import { LegacySongEditorRedirect } from './pages/LegacySongEditorRedirect'

// ...
<Route path="/songs/:songId" element={<RequireAuth><LegacySongEditorRedirect /></RequireAuth>} />
```

Remove direct `EditorPage` binding from `/songs/:songId`.

- [ ] **Step 3: Type-check web**

Run:

```bash
cd apps/web && npx tsc --noEmit
```

Expected: exits 0.

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/pages/LegacySongEditorRedirect.tsx apps/web/src/App.tsx
git commit -m "feat(web): redirect legacy /songs/:songId to canonical editor route"
```

---

## Task 7: Fix remaining legacy editor links

**Files:**
- Modify: `apps/web/src/features/songs/SongCard.tsx`
- Modify: `apps/web/src/features/editor/components/SongSwitcher.tsx` (interim fix before Task 10)

- [ ] **Step 1: Update `SongCard.tsx`**

Replace both `navigate(\`/songs/${song.id}\`)` calls with:

```typescript
import { songEditorPath } from '../navigation/song-editor-path'

// onClick handlers:
navigate(songEditorPath(song.projectId, song.id))
```

- [ ] **Step 2: Update interim `SongSwitcher` navigation**

In `apps/web/src/features/editor/components/SongSwitcher.tsx`, change `go()` to accept projectId:

```typescript
import { songEditorPath } from '../../navigation/song-editor-path'

function go(id: string, projectId: string) {
  setOpen(false)
  setQuery('')
  if (id !== currentSongId) navigate(songEditorPath(projectId, id))
}
```

Pass `song.projectId` from each filtered song row once Task 9 scopes the list.

- [ ] **Step 3: Search for stragglers**

Run:

```bash
rg "navigate\\(`/songs/" apps/web/src
```

Expected: no matches (except comments). Fix any remaining hits the same way.

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/features/songs/SongCard.tsx apps/web/src/features/editor/components/SongSwitcher.tsx
git commit -m "fix(web): use canonical editor paths in song links"
```

---

## Task 8: SongStatusBadge component

**Files:**
- Create: `apps/web/src/components/ui/SongStatusBadge.tsx`
- Modify: `apps/web/src/components/ui/index.ts`

- [ ] **Step 1: Create badge component**

Create `apps/web/src/components/ui/SongStatusBadge.tsx`:

```tsx
import { SONG_STATUS_LABELS } from '@ama-midi/shared'
import type { SongStatus } from '@ama-midi/shared'
import { Badge } from './Badge'

const variants: Record<SongStatus, 'muted' | 'warning' | 'error' | 'success'> = {
  DRAFT: 'muted',
  IN_REVIEW: 'warning',
  NEEDS_FIX: 'error',
  APPROVED: 'success',
  PUBLISHED: 'success',
  ARCHIVED: 'muted',
}

export function SongStatusBadge({ status, className }: { status: SongStatus; className?: string }) {
  return (
    <Badge variant={variants[status]} size="sm" className={className}>
      {SONG_STATUS_LABELS[status]}
    </Badge>
  )
}
```

- [ ] **Step 2: Export from UI barrel**

Add to `apps/web/src/components/ui/index.ts`:

```typescript
export { SongStatusBadge } from './SongStatusBadge'
```

- [ ] **Step 3: Type-check**

Run:

```bash
cd apps/web && npx tsc --noEmit
```

Expected: exits 0.

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/components/ui/SongStatusBadge.tsx apps/web/src/components/ui/index.ts
git commit -m "feat(web): add SongStatusBadge for workflow statuses"
```

---

## Task 9: Project-scoped SongSwitcher

**Files:**
- Modify: `apps/web/src/features/editor/components/SongSwitcher.tsx`

- [ ] **Step 1: Change props and data source**

Replace the component signature and internals:

```tsx
import { useProjectSongs } from '../../songs/useSongs'
import { getRecentSongForProject } from '../../navigation/recent-navigation'
import { songEditorPath } from '../../navigation/song-editor-path'
import { SongStatusBadge } from '../../../components/ui'
import type { Song, SongStatus } from '@ama-midi/shared'

interface Props {
  projectId: string
  currentSongId: string
  currentSongName: string
}

const STATUS_SECTIONS: { label: string; statuses: SongStatus[] }[] = [
  { label: 'Draft', statuses: ['DRAFT', 'NEEDS_FIX'] },
  { label: 'In Review', statuses: ['IN_REVIEW'] },
  { label: 'Approved', statuses: ['APPROVED', 'PUBLISHED'] },
]

export function SongSwitcher({ projectId, currentSongId, currentSongName }: Props) {
  const { data: songs = [] } = useProjectSongs(projectId)
  const recentSongId = getRecentSongForProject(localStorage, projectId)

  const filtered = songs.filter((s) =>
    s.name.toLowerCase().includes(query.toLowerCase()),
  )

  function sectionSongs(statuses: SongStatus[]) {
    return filtered.filter((s) => statuses.includes(s.status))
  }

  function go(song: Song) {
    setOpen(false)
    setQuery('')
    if (song.id !== currentSongId) navigate(songEditorPath(projectId, song.id))
  }

  // Render groups:
  // 1) search input placeholder: `Search songs in ${projectName}…` (pass projectName prop if needed)
  // 2) Recent in this project (recentSongId match)
  // 3) Draft / In Review / Approved sections using sectionSongs()
}
```

Use `projectName` as an optional prop from `EditorPage` (`song.project` name via separate `useProject(projectId)` or include in song query).

- [ ] **Step 2: Manual smoke test**

Run dev server:

```bash
pnpm dev
```

Open `/projects/:projectId/songs/:songId`, open song switcher, confirm listed songs all share the same `projectId`.

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/features/editor/components/SongSwitcher.tsx
git commit -m "feat(web): scope editor song switcher to current project"
```

---

## Task 10: Shared NavDropdown + ProjectSwitcher

**Files:**
- Create: `apps/web/src/features/navigation/NavDropdown.tsx`
- Create: `apps/web/src/features/navigation/ProjectSwitcher.tsx`

- [ ] **Step 1: Create `NavDropdown.tsx`**

Extract the fixed-position dropdown pattern from current `SongSwitcher.tsx` into a reusable component with props:

```tsx
export interface NavDropdownItem {
  id: string
  label: string
  description?: string
  onSelect: () => void
  active?: boolean
}

export interface NavDropdownSection {
  title?: string
  items: NavDropdownItem[]
}

export function NavDropdown(props: {
  triggerLabel: string
  searchPlaceholder: string
  sections: NavDropdownSection[]
  maxWidthClassName?: string
})
```

Keep the same z-index, border, and search filtering behavior as the existing switcher.

- [ ] **Step 2: Create `ProjectSwitcher.tsx`**

```tsx
import { useNavigate } from 'react-router-dom'
import { useProjects } from '../projects/useProjects'
import { getRecentProjects, getRecentSongForProject, recordRecentProject } from './recent-navigation'
import { resolveProjectSwitchTarget } from './resolve-project-switch'
import { NavDropdown } from './NavDropdown'
import { useProjectSongs } from '../songs/useSongs'

export function ProjectSwitcher({
  currentProjectId,
  currentProjectName,
}: {
  currentProjectId: string
  currentProjectName: string
}) {
  const navigate = useNavigate()
  const { data: projects = [] } = useProjects()

  function openProject(projectId: string, songCount: number) {
    recordRecentProject(localStorage, projectId)
    const target = resolveProjectSwitchTarget({
      projectId,
      recentSongId: getRecentSongForProject(localStorage, projectId),
      songCount,
    })
    navigate(target)
  }

  const recentIds = getRecentProjects(localStorage)
  const recentProjects = recentIds
    .map((id) => projects.find((p) => p.id === id))
    .filter(Boolean)

  // Build NavDropdown sections:
  // - Recent projects
  // - My projects (all accessible projects)
}
```

For `songCount`, use `project.songCount` from the `Project` type already returned by `useProjects()`.

- [ ] **Step 3: Type-check**

Run:

```bash
cd apps/web && npx tsc --noEmit
```

Expected: exits 0.

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/features/navigation/NavDropdown.tsx apps/web/src/features/navigation/ProjectSwitcher.tsx
git commit -m "feat(web): add project switcher for editor navigation"
```

---

## Task 11: Editor breadcrumb toolbar

**Files:**
- Create: `apps/web/src/features/navigation/EditorBreadcrumb.tsx`
- Modify: `apps/web/src/features/editor/components/Toolbar.tsx`
- Modify: `apps/web/src/pages/EditorPage.tsx`

- [ ] **Step 1: Create `EditorBreadcrumb.tsx`**

```tsx
import { useNavigate } from 'react-router-dom'
import { ProjectSwitcher } from './ProjectSwitcher'
import { SongSwitcher } from '../editor/components/SongSwitcher'
import { projectPath } from './song-editor-path'

export function EditorBreadcrumb({
  projectId,
  projectName,
  songId,
  songName,
}: {
  projectId: string
  projectName: string
  songId: string
  songName: string
}) {
  const navigate = useNavigate()

  return (
    <div className="flex items-center gap-1.5 min-w-0">
      <button
        onClick={() => navigate(projectPath(projectId))}
        className="text-shell-muted hover:text-shell-text text-sm transition-colors shrink-0"
      >
        ← Project
      </button>
      <ProjectSwitcher currentProjectId={projectId} currentProjectName={projectName} />
      <span className="text-shell-muted text-sm shrink-0">/</span>
      <SongSwitcher
        projectId={projectId}
        currentSongId={songId}
        currentSongName={songName}
      />
    </div>
  )
}
```

- [ ] **Step 2: Update `Toolbar.tsx`**

Add props:

```typescript
interface ToolbarProps {
  projectId: string
  projectName: string
  // ...existing props
}
```

Replace the block containing `← Songs` and `<SongSwitcher … />` with:

```tsx
<EditorBreadcrumb
  projectId={projectId}
  projectName={projectName}
  songId={songId}
  songName={songName}
/>
```

- [ ] **Step 3: Pass project context from `EditorPage.tsx`**

Add project query:

```typescript
import { useProject } from '../features/projects/useProjects'

const { data: project } = useProject(projectId)

<Toolbar
  projectId={projectId!}
  projectName={project?.name ?? 'Project'}
  // ...existing props
/>
```

Guard: if `!projectId`, legacy redirect component handles `/songs/:id`; canonical editor route always has `projectId`.

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/features/navigation/EditorBreadcrumb.tsx apps/web/src/features/editor/components/Toolbar.tsx apps/web/src/pages/EditorPage.tsx
git commit -m "feat(web): replace editor Songs back link with project breadcrumb"
```

---

## Task 12: Record recents when opening editor

**Files:**
- Modify: `apps/web/src/pages/EditorPage.tsx`

- [ ] **Step 1: Record on mount**

In `EditorPage.tsx`:

```typescript
import { recordRecentProject, recordRecentSong } from '../features/navigation/recent-navigation'

useEffect(() => {
  if (!projectId || !songId) return
  recordRecentSong(localStorage, projectId, songId)
  recordRecentProject(localStorage, projectId)
}, [projectId, songId])
```

- [ ] **Step 2: Remove redundant redirect effect if fully handled by legacy route**

Keep the existing `useEffect` redirect when `!projectId && song?.projectId` as a safety net for any internal links missed during migration.

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/pages/EditorPage.tsx
git commit -m "feat(web): persist recent project and song when editor opens"
```

---

## Task 13: Home dashboard page

**Files:**
- Create: `apps/web/src/features/dashboard/useDashboard.ts`
- Create: `apps/web/src/features/dashboard/DashboardSongList.tsx`
- Create: `apps/web/src/features/dashboard/DashboardPage.tsx`
- Create: `apps/web/src/features/projects/ProjectListSection.tsx`
- Modify: `apps/web/src/features/projects/ProjectDashboardPage.tsx`
- Modify: `apps/web/src/App.tsx`

- [ ] **Step 1: Add dashboard hook**

Create `apps/web/src/features/dashboard/useDashboard.ts`:

```typescript
import { useQuery } from '@tanstack/react-query'
import type { DashboardFeed } from '@ama-midi/shared'
import { useAuthStore } from '../../store/auth.store'
import { apiClient } from '../auth/api'

export function useDashboard() {
  const token = useAuthStore((s) => s.token)
  return useQuery<DashboardFeed>({
    queryKey: ['dashboard'],
    queryFn: () => apiClient(token)<DashboardFeed>('/dashboard'),
    enabled: !!token,
  })
}
```

- [ ] **Step 2: Create `DashboardSongList.tsx`**

```tsx
import { useNavigate } from 'react-router-dom'
import type { DashboardSongRow } from '@ama-midi/shared'
import { SongStatusBadge } from '../../components/ui'
import { songEditorPath } from '../navigation/song-editor-path'
import { timeAgo } from '../../lib/utils'

export function DashboardSongList({ songs, emptyLabel }: { songs: DashboardSongRow[]; emptyLabel: string }) {
  const navigate = useNavigate()
  if (!songs.length) return <p className="text-sm text-shell-muted">{emptyLabel}</p>

  return (
    <ul className="divide-y divide-shell-border rounded-lg border border-shell-border bg-shell-surface">
      {songs.map((song) => (
        <li key={song.id}>
          <button
            type="button"
            onClick={() => navigate(songEditorPath(song.projectId, song.id))}
            className="flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-shell-bg"
          >
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium text-shell-text">{song.name}</p>
              <p className="truncate text-xs text-shell-muted">{song.projectName}</p>
            </div>
            <SongStatusBadge status={song.status} />
            <span className="text-xs text-shell-muted shrink-0">{timeAgo(song.updatedAt)}</span>
          </button>
        </li>
      ))}
    </ul>
  )
}
```

- [ ] **Step 3: Extract project list section**

Create `apps/web/src/features/projects/ProjectListSection.tsx` by moving the project grid from `ProjectDashboardPage.tsx` into a reusable component that accepts `projects`, `isLoading`, and `onCreateProject`.

- [ ] **Step 4: Create `DashboardPage.tsx`**

```tsx
export function DashboardPage() {
  const { data, isLoading } = useDashboard()
  const { data: projects = [] } = useProjects()

  return (
    <AppShell>
      <header className="mb-6">
        <p className="text-sm text-shell-muted">Dashboard</p>
        <h1 className="mt-1 text-2xl font-semibold text-shell-text">Jump back into work</h1>
      </header>

      <div className="grid gap-8">
        <section>
          <h2 className="mb-3 text-sm font-semibold text-shell-text">Recent Songs</h2>
          <DashboardSongList songs={data?.recentSongs ?? []} emptyLabel={isLoading ? 'Loading…' : 'No recent songs yet.'} />
        </section>

        <section>
          <h2 className="mb-3 text-sm font-semibold text-shell-text">Needs Review</h2>
          <DashboardSongList songs={data?.needsReview ?? []} emptyLabel="Nothing waiting for your review." />
        </section>

        <section>
          <h2 className="mb-3 text-sm font-semibold text-shell-text">Assigned to Me</h2>
          <DashboardSongList songs={data?.assignedToMe ?? []} emptyLabel="No assigned songs." />
        </section>

        <section>
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-shell-text">My Projects</h2>
            <Button size="sm" variant="secondary" onClick={() => navigate('/projects')}>View all</Button>
          </div>
          <ProjectListSection projects={projects.slice(0, 6)} isLoading={false} compact />
        </section>
      </div>
    </AppShell>
  )
}
```

- [ ] **Step 5: Keep `/projects` as projects-only page**

Leave `ProjectDashboardPage.tsx` as the full project grid with create-project modal.

- [ ] **Step 6: Wire routes in `App.tsx`**

```tsx
import { DashboardPage } from './features/dashboard/DashboardPage'

<Route path="/" element={<RequireAuth><DashboardPage /></RequireAuth>} />
<Route path="/projects" element={<RequireAuth><ProjectDashboardPage /></RequireAuth>} />
```

- [ ] **Step 7: Commit**

```bash
git add apps/web/src/features/dashboard apps/web/src/features/projects/ProjectListSection.tsx apps/web/src/features/projects/ProjectDashboardPage.tsx apps/web/src/App.tsx
git commit -m "feat(web): add persona-aware home dashboard"
```

---

## Task 14: Project songs table filters and columns

**Files:**
- Create: `apps/web/src/features/songs/song-table-filters.ts`
- Create: `apps/web/tests/song-table-filters.test.ts`
- Modify: `apps/web/src/features/songs/SongTable.tsx`

- [ ] **Step 1: Write failing filter tests**

Create `apps/web/tests/song-table-filters.test.ts`:

```typescript
import assert from 'node:assert/strict'
import { test } from 'node:test'
import { filterProjectSongs } from '../src/features/songs/song-table-filters.ts'
import type { Song } from '@ama-midi/shared'

const songs = [
  { id: '1', name: 'Alpha', status: 'DRAFT', projectId: 'p1' },
  { id: '2', name: 'Beta', status: 'APPROVED', projectId: 'p1' },
] as Song[]

test('filterProjectSongs matches name query case-insensitively', () => {
  const result = filterProjectSongs(songs, { query: 'alpha', status: 'ALL' })
  assert.equal(result.length, 1)
  assert.equal(result[0].id, '1')
})

test('filterProjectSongs filters by workflow status', () => {
  const result = filterProjectSongs(songs, { query: '', status: 'APPROVED' })
  assert.equal(result.length, 1)
  assert.equal(result[0].id, '2')
})
```

- [ ] **Step 2: Run test to verify it fails**

Run:

```bash
cd apps/web && node --experimental-strip-types --test tests/song-table-filters.test.ts
```

Expected: FAIL.

- [ ] **Step 3: Implement filter helper**

Create `apps/web/src/features/songs/song-table-filters.ts`:

```typescript
import type { Song, SongStatus } from '@ama-midi/shared'

export type SongTableStatusFilter = 'ALL' | SongStatus

export function filterProjectSongs(
  songs: Song[],
  input: { query: string; status: SongTableStatusFilter },
): Song[] {
  const q = input.query.trim().toLowerCase()
  return songs.filter((song) => {
    const matchesQuery = !q || song.name.toLowerCase().includes(q)
    const matchesStatus = input.status === 'ALL' || song.status === input.status
    return matchesQuery && matchesStatus
  })
}
```

- [ ] **Step 4: Upgrade `SongTable.tsx`**

Add local state for `query` and `status`, render filter controls above the table, and update columns to:

| Column | Source |
|--------|--------|
| Song Name | `song.name` |
| Status | `<SongStatusBadge status={song.status} />` |
| Assigned Composer | `song.assignedComposerName ?? '—'` |
| Assigned QA | `song.assignedQaName ?? '—'` |
| Last Edited | `timeAgo(song.updatedAt)` |
| Validation | status-based hint: `NEEDS_FIX` → "Fix required", `IN_REVIEW` → "Review pending", `APPROVED/PUBLISHED` → "Passed", else "Not validated" |
| Actions | button `Open Editor` → `songEditorPath(projectId, song.id)` |

- [ ] **Step 5: Run tests**

Run:

```bash
cd apps/web && node --experimental-strip-types --test tests/song-table-filters.test.ts
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/features/songs/song-table-filters.ts apps/web/src/features/songs/SongTable.tsx apps/web/tests/song-table-filters.test.ts
git commit -m "feat(web): enhance project song table with filters and workflow columns"
```

---

## Task 15: Final verification

**Files:** none (verification only)

- [ ] **Step 1: Run API tests**

```bash
cd apps/api && pnpm test
```

Expected: all tests pass.

- [ ] **Step 2: Run web unit tests**

```bash
cd apps/web && node --experimental-strip-types --test tests/song-editor-path.test.ts tests/recent-navigation.test.ts tests/resolve-project-switch.test.ts tests/song-table-filters.test.ts
```

Expected: all tests pass.

- [ ] **Step 3: Type-check and build web**

```bash
cd apps/web && npx tsc --noEmit && pnpm build
```

Expected: exits 0.

- [ ] **Step 4: Manual route smoke checklist**

With `pnpm dev` running, verify:

1. `/` shows Recent Songs, Needs Review, Assigned to Me, My Projects.
2. `/projects` shows project grid only.
3. Opening `/songs/:songId` redirects to `/projects/:projectId/songs/:songId`.
4. Editor toolbar reads `← Project` with project and song dropdowns.
5. Song switcher lists only songs from the current project.
6. Project switcher opens recent song when available, otherwise project page.
7. Project Songs tab supports search + status filter.

- [ ] **Step 5: Commit any fixups**

```bash
git status
# if clean, no commit needed
```

---

## Self-Review

### Spec coverage

| Requirement | Task |
|-------------|------|
| Canonical project-song routes | Tasks 4, 6, 7, 11 |
| Legacy `/songs` redirects | Tasks 6, 7 |
| Dashboard sections | Task 13 + API Tasks 2–3 |
| `/` vs `/projects` split | Task 13 |
| Editor `← Project` + switchers | Tasks 9–12 |
| Project-scoped song switcher | Task 9 |
| Project switcher smart landing | Tasks 5, 10 |
| Project table columns/filters | Task 14 |
| Command palette | Explicitly deferred |
| Editor layout unchanged otherwise | Tasks 11–12 touch toolbar only |

### Placeholder scan

No TBD steps. Each task includes concrete file paths, code, and commands.

### Type consistency

- `DashboardFeed` / `DashboardSongRow` defined in Task 1, consumed in Tasks 2–3 and 13.
- `songEditorPath(projectId, songId)` used consistently from Task 4 onward.
- `ProjectSwitcher` uses `project.songCount` from existing `Project` type.
- `SongSwitcher` props require `projectId` everywhere after Task 11.

---

## Execution Handoff

Plan complete and saved to `docs/superpowers/plans/2026-05-23-project-song-navigation.md`. Two execution options:

**1. Subagent-Driven (recommended)** — dispatch a fresh subagent per task, review between tasks, fast iteration

**2. Inline Execution** — execute tasks in this session using executing-plans, batch execution with checkpoints

Which approach?
