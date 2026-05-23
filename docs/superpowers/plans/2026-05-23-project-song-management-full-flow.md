# Project Song Management Full Flow Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the full project-based song management flow: projects own songs, members receive scoped permissions, and new songs are created through blank/template/import wizard flows.

**Architecture:** Add project and permission primitives to Prisma/API first, then route all song/editor access through a single project access service. Migrate the frontend from a flat song dashboard to project pages, then replace inline song creation with a wizard that supports blank, template, and import-copy starts.

**Tech Stack:** NestJS, Prisma 7, PostgreSQL, React 18, Vite, TanStack Query, Zustand, Radix UI, TypeScript, Jest.

---

## Source Spec

Implement from:

```txt
docs/superpowers/specs/2026-05-23-project-song-management-full-flow-design.md
```

Core product rules:

```txt
Project owns production context.
Song owns chart content.
Project membership owns access.
Import owns reuse.
```

---

## Scope Split

This is a large feature touching data model, authorization, routing, and UI. Execute in this order because each milestone is independently testable:

1. Shared types and Prisma schema.
2. Project access service.
3. Projects API.
4. Project member API and song scopes.
5. Project-owned songs API and create/import service.
6. Authorization retrofit for notes, sections, patterns, validation, history, and editor routes.
7. Frontend project dashboard and project detail.
8. Create song wizard.
9. Editor route/access migration.
10. Realtime/audit polish and final verification.

---

## File Structure

### Shared Package

- Modify `packages/shared/src/types.ts`
  - Add `Project`, `ProjectMember`, `ProjectPermission`, `SongScope`, `SongStatus`, `SongCategory`, `SongDifficulty`, `CreateProjectSongInput`, `ImportSongOptions`.
  - Extend `Song` with project/workflow fields.
- Modify `packages/shared/src/constants.ts`
  - Add production category, difficulty, status, permission, and scope options used by API/web.

### API

- Modify `apps/api/prisma/schema.prisma`
  - Add project enums and models.
  - Add `projectId`, workflow fields, assignment fields, and import audit fields to `Song`.
  - Add user relations for projects and assignments.
- Create migration with `cd apps/api && npx prisma migrate dev --name project_song_management`.
- Create `apps/api/src/modules/project-access/project-access.module.ts`
- Create `apps/api/src/modules/project-access/project-access.service.ts`
  - Central authorization rules for project/song access.
- Create `apps/api/src/modules/project-access/__tests__/project-access.service.spec.ts`
- Create `apps/api/src/modules/projects/projects.module.ts`
- Create `apps/api/src/modules/projects/projects.controller.ts`
- Create `apps/api/src/modules/projects/projects.service.ts`
- Create `apps/api/src/modules/projects/dto/create-project.dto.ts`
- Create `apps/api/src/modules/projects/dto/update-project.dto.ts`
- Create `apps/api/src/modules/projects/__tests__/projects.service.spec.ts`
- Create `apps/api/src/modules/project-members/project-members.module.ts`
- Create `apps/api/src/modules/project-members/project-members.controller.ts`
- Create `apps/api/src/modules/project-members/project-members.service.ts`
- Create `apps/api/src/modules/project-members/dto/add-project-member.dto.ts`
- Create `apps/api/src/modules/project-members/dto/update-project-member.dto.ts`
- Create `apps/api/src/modules/project-members/__tests__/project-members.service.spec.ts`
- Modify `apps/api/src/modules/songs/songs.module.ts`
  - Import `ProjectAccessModule`.
- Modify `apps/api/src/modules/songs/songs.controller.ts`
  - Add `/projects/:projectId/songs` routes and keep compatibility `/songs/:id`.
- Modify `apps/api/src/modules/songs/songs.service.ts`
  - Filter by project access.
  - Create songs in projects.
  - Implement template and import-copy creation.
- Create `apps/api/src/modules/songs/dto/create-project-song.dto.ts`
- Create `apps/api/src/modules/songs/__tests__/songs.project-flow.spec.ts`
- Modify `apps/api/src/modules/notes/notes.controller.ts`
- Modify `apps/api/src/modules/notes/notes.service.ts`
- Modify `apps/api/src/modules/notes/note-query.service.ts`
- Modify `apps/api/src/modules/sections/sections.controller.ts`
- Modify `apps/api/src/modules/sections/sections.service.ts`
- Modify `apps/api/src/modules/patterns/patterns.controller.ts`
- Modify `apps/api/src/modules/patterns/patterns.service.ts`
- Modify `apps/api/src/modules/validation/validation.controller.ts`
- Modify `apps/api/src/modules/versions/versions.controller.ts`
- Modify `apps/api/src/app.module.ts`
  - Register projects, project-members, and project-access modules.

### Web

- Create `apps/web/src/features/projects/useProjects.ts`
- Create `apps/web/src/features/projects/ProjectDashboardPage.tsx`
- Create `apps/web/src/features/projects/ProjectCard.tsx`
- Create `apps/web/src/features/projects/ProjectPage.tsx`
- Create `apps/web/src/features/project-members/useProjectMembers.ts`
- Create `apps/web/src/features/project-members/MemberTable.tsx`
- Create `apps/web/src/features/project-members/MemberAccessModal.tsx`
- Modify `apps/web/src/features/songs/useSongs.ts`
  - Add project-aware song list/create/update hooks.
- Create `apps/web/src/features/songs/CreateSongWizard.tsx`
- Create `apps/web/src/features/songs/ImportSongStep.tsx`
- Create `apps/web/src/features/songs/SongTable.tsx`
- Modify `apps/web/src/pages/SongListPage.tsx`
  - Replace global flat song creation with project dashboard redirect/compat surface.
- Modify `apps/web/src/pages/EditorPage.tsx`
  - Read `projectId` from route.
  - Use project-aware song/notes endpoints.
- Modify `apps/web/src/App.tsx`
  - Add `/projects`, `/projects/:projectId`, `/projects/:projectId/songs/:songId`, and compatibility `/songs/:songId`.
- Modify editor data hooks under `apps/web/src/features/notes`, `features/sections`, `features/patterns`
  - Add project-aware API path support.

---

## Task 1: Shared Types and Constants

**Files:**
- Modify: `packages/shared/src/types.ts`
- Modify: `packages/shared/src/constants.ts`

- [ ] **Step 1: Update shared production types**

In `packages/shared/src/types.ts`, add these exports near the existing role/song types:

```ts
export type ProjectStatus = 'ACTIVE' | 'PAUSED' | 'ARCHIVED'
export type ProjectPermission = 'READ' | 'EDIT' | 'ADMIN'
export type SongScope = 'ALL_SONGS' | 'SELECTED_SONGS' | 'NO_SONGS'
export type SongStatus = 'DRAFT' | 'IN_REVIEW' | 'NEEDS_FIX' | 'APPROVED' | 'PUBLISHED' | 'ARCHIVED'
export type SongCategory =
  | 'MAIN_CAMPAIGN'
  | 'EVENT'
  | 'TUTORIAL'
  | 'LIVE_OPS'
  | 'PROTOTYPE'
  | 'QA_TEST'
  | 'TEMPLATE'
  | 'REFERENCE'
export type SongDifficulty = 'EASY' | 'NORMAL' | 'HARD' | 'EXPERT' | 'MASTER'

export interface Project {
  id: string
  name: string
  description?: string | null
  status: ProjectStatus
  ownerId: string
  songCount: number
  memberCount: number
  createdAt: string
  updatedAt: string
  archivedAt?: string | null
}

export interface ProjectMember {
  id: string
  projectId: string
  userId: string
  userName: string
  userAvatarUrl?: string
  permission: ProjectPermission
  songScope: SongScope
  selectedSongIds: string[]
  createdAt: string
  updatedAt: string
}

export interface ImportSongOptions {
  sourceSongId: string
  copySettings: boolean
  copySections: boolean
  copyPatterns: boolean
  copyNotes: boolean
}

export interface CreateProjectSongInput {
  name: string
  category: SongCategory
  difficulty: SongDifficulty
  bpm: number
  timeSignature: string
  assignedComposerId?: string | null
  assignedQaId?: string | null
  startType: 'BLANK' | 'TEMPLATE' | 'IMPORT'
  templateId?: string | null
  import?: ImportSongOptions
}
```

Then extend the existing `Song` interface with these fields:

```ts
projectId: string
category: SongCategory
status: SongStatus
difficulty: SongDifficulty
assignedComposerId?: string | null
assignedComposerName?: string | null
assignedQaId?: string | null
assignedQaName?: string | null
sourceSongId?: string | null
archivedAt?: string | null
```

- [ ] **Step 2: Add shared option lists**

In `packages/shared/src/constants.ts`, append:

```ts
export const PROJECT_STATUS_OPTIONS = ['ACTIVE', 'PAUSED', 'ARCHIVED'] as const
export const PROJECT_PERMISSION_OPTIONS = ['READ', 'EDIT', 'ADMIN'] as const
export const SONG_SCOPE_OPTIONS = ['ALL_SONGS', 'SELECTED_SONGS', 'NO_SONGS'] as const
export const SONG_STATUS_OPTIONS = ['DRAFT', 'IN_REVIEW', 'NEEDS_FIX', 'APPROVED', 'PUBLISHED', 'ARCHIVED'] as const
export const SONG_CATEGORY_OPTIONS = [
  'MAIN_CAMPAIGN',
  'EVENT',
  'TUTORIAL',
  'LIVE_OPS',
  'PROTOTYPE',
  'QA_TEST',
  'TEMPLATE',
  'REFERENCE',
] as const
export const SONG_DIFFICULTY_OPTIONS = ['EASY', 'NORMAL', 'HARD', 'EXPERT', 'MASTER'] as const
export const SUPPORTED_TIME_SIGNATURES = ['4/4', '3/4', '6/8'] as const
```

- [ ] **Step 3: Verify shared package builds**

Run:

```bash
cd packages/shared && pnpm build
```

Expected:

```txt
tsc exits 0
```

- [ ] **Step 4: Commit**

```bash
git add packages/shared/src/types.ts packages/shared/src/constants.ts
git commit -m "feat(shared): add project song management types"
```

---

## Task 2: Prisma Schema and Migration

**Files:**
- Modify: `apps/api/prisma/schema.prisma`
- Generated: `apps/api/prisma/migrations/<timestamp>_project_song_management/migration.sql`

- [ ] **Step 1: Add Prisma enums**

In `apps/api/prisma/schema.prisma`, add after `OutboxStatus`:

```prisma
enum ProjectStatus {
  ACTIVE
  PAUSED
  ARCHIVED
}

enum ProjectPermission {
  READ
  EDIT
  ADMIN
}

enum SongScope {
  ALL_SONGS
  SELECTED_SONGS
  NO_SONGS
}

enum SongStatus {
  DRAFT
  IN_REVIEW
  NEEDS_FIX
  APPROVED
  PUBLISHED
  ARCHIVED
}

enum SongCategory {
  MAIN_CAMPAIGN
  EVENT
  TUTORIAL
  LIVE_OPS
  PROTOTYPE
  QA_TEST
  TEMPLATE
  REFERENCE
}

enum SongDifficulty {
  EASY
  NORMAL
  HARD
  EXPERT
  MASTER
}
```

- [ ] **Step 2: Add user relations**

In model `User`, add:

```prisma
  ownedProjects    Project[]       @relation("ProjectOwner")
  projectMembers   ProjectMember[]
  composedSongs    Song[]          @relation("SongComposer")
  qaSongs          Song[]          @relation("SongQa")
```

Keep the existing `songs Song[]` relation as the creator relation.

- [ ] **Step 3: Add project models**

Add after `User`:

```prisma
model Project {
  id          String        @id @default(uuid())
  name        String
  description String?
  status      ProjectStatus @default(ACTIVE)
  ownerId     String
  createdAt   DateTime      @default(now())
  updatedAt   DateTime      @updatedAt
  archivedAt  DateTime?

  owner   User            @relation("ProjectOwner", fields: [ownerId], references: [id])
  members ProjectMember[]
  songs   Song[]

  @@index([ownerId])
  @@index([status])
  @@map("projects")
}

model ProjectMember {
  id         String            @id @default(uuid())
  projectId String
  userId    String
  permission ProjectPermission
  songScope SongScope
  createdAt DateTime           @default(now())
  updatedAt DateTime           @updatedAt

  project       Project                    @relation(fields: [projectId], references: [id], onDelete: Cascade)
  user          User                       @relation(fields: [userId], references: [id], onDelete: Cascade)
  selectedSongs ProjectMemberSongAccess[]

  @@unique([projectId, userId])
  @@index([userId])
  @@map("project_members")
}

model ProjectMemberSongAccess {
  id              String @id @default(uuid())
  projectMemberId String
  songId          String

  projectMember ProjectMember @relation(fields: [projectMemberId], references: [id], onDelete: Cascade)
  song          Song          @relation(fields: [songId], references: [id], onDelete: Cascade)

  @@unique([projectMemberId, songId])
  @@index([songId])
  @@map("project_member_song_access")
}
```

- [ ] **Step 4: Extend Song model**

In `Song`, add these fields:

```prisma
  projectId          String
  category           SongCategory   @default(PROTOTYPE)
  status             SongStatus     @default(DRAFT)
  difficulty         SongDifficulty @default(NORMAL)
  assignedComposerId String?
  assignedQaId       String?
  sourceSongId       String?
  importOptions      Json?
  archivedAt         DateTime?
```

Add these relations:

```prisma
  project          Project @relation(fields: [projectId], references: [id], onDelete: Cascade)
  assignedComposer User?   @relation("SongComposer", fields: [assignedComposerId], references: [id])
  assignedQa       User?   @relation("SongQa", fields: [assignedQaId], references: [id])
  sourceSong       Song?   @relation("SongImportSource", fields: [sourceSongId], references: [id])
  importedSongs    Song[]  @relation("SongImportSource")
  allowedMembers   ProjectMemberSongAccess[]
```

Add indexes:

```prisma
  @@index([projectId, status])
  @@index([projectId, category])
  @@index([assignedComposerId])
  @@index([assignedQaId])
```

- [ ] **Step 5: Create migration**

Run:

```bash
cd apps/api && npx prisma migrate dev --name project_song_management
```

Expected:

```txt
Migration applies successfully.
Generated Prisma client succeeds.
```

If migration fails because existing songs require a project, edit generated SQL so it:

```sql
INSERT INTO projects (id, name, status, owner_id, created_at, updated_at)
SELECT gen_random_uuid(), 'Default Project', 'ACTIVE', id, now(), now()
FROM users
ORDER BY created_at ASC
LIMIT 1;
```

Then set existing songs to the created project before making `songs.project_id` not null.

- [ ] **Step 6: Verify API builds**

Run:

```bash
cd apps/api && pnpm build
```

Expected:

```txt
nest build exits 0
```

- [ ] **Step 7: Commit**

```bash
git add apps/api/prisma/schema.prisma apps/api/prisma/migrations
git commit -m "feat(api): add project song management schema"
```

---

## Task 3: Project Access Service

**Files:**
- Create: `apps/api/src/modules/project-access/project-access.module.ts`
- Create: `apps/api/src/modules/project-access/project-access.service.ts`
- Create: `apps/api/src/modules/project-access/__tests__/project-access.service.spec.ts`
- Modify: `apps/api/src/app.module.ts`

- [ ] **Step 1: Write failing tests**

Create `apps/api/src/modules/project-access/__tests__/project-access.service.spec.ts`:

```ts
import { ForbiddenException, NotFoundException } from '@nestjs/common'
import { ProjectAccessService } from '../project-access.service'
import { PrismaService } from '../../prisma/prisma.service'
import type { AuthUser } from '@ama-midi/shared'

const prisma = {
  projectMember: { findUnique: jest.fn() },
  song: { findUnique: jest.fn() },
}

const admin: AuthUser = {
  id: 'admin',
  email: 'admin@example.com',
  name: 'Admin',
  role: 'ADMIN',
  profileComplete: true,
  tourComplete: true,
}

const composer: AuthUser = {
  id: 'u1',
  email: 'u1@example.com',
  name: 'Composer',
  role: 'COMPOSER',
  profileComplete: true,
  tourComplete: true,
}

describe('ProjectAccessService', () => {
  let service: ProjectAccessService

  beforeEach(() => {
    service = new ProjectAccessService(prisma as unknown as PrismaService)
    jest.clearAllMocks()
  })

  it('allows platform admin to manage any project', async () => {
    await expect(service.assertProjectAdmin('project1', admin)).resolves.toBeUndefined()
    expect(prisma.projectMember.findUnique).not.toHaveBeenCalled()
  })

  it('allows edit when member has EDIT and ALL_SONGS', async () => {
    prisma.song.findUnique.mockResolvedValue({ id: 'song1', projectId: 'project1' })
    prisma.projectMember.findUnique.mockResolvedValue({
      id: 'pm1',
      projectId: 'project1',
      userId: 'u1',
      permission: 'EDIT',
      songScope: 'ALL_SONGS',
      selectedSongs: [],
    })

    await expect(service.assertCanEditSong('song1', composer)).resolves.toEqual({ id: 'song1', projectId: 'project1' })
  })

  it('denies edit when member has READ and ALL_SONGS', async () => {
    prisma.song.findUnique.mockResolvedValue({ id: 'song1', projectId: 'project1' })
    prisma.projectMember.findUnique.mockResolvedValue({
      id: 'pm1',
      projectId: 'project1',
      userId: 'u1',
      permission: 'READ',
      songScope: 'ALL_SONGS',
      selectedSongs: [],
    })

    await expect(service.assertCanEditSong('song1', composer)).rejects.toBeInstanceOf(ForbiddenException)
  })

  it('allows selected scoped song only when song is in allowlist', async () => {
    prisma.song.findUnique.mockResolvedValue({ id: 'song1', projectId: 'project1' })
    prisma.projectMember.findUnique.mockResolvedValue({
      id: 'pm1',
      projectId: 'project1',
      userId: 'u1',
      permission: 'READ',
      songScope: 'SELECTED_SONGS',
      selectedSongs: [{ songId: 'song1' }],
    })

    await expect(service.assertCanViewSong('song1', composer)).resolves.toEqual({ id: 'song1', projectId: 'project1' })
  })

  it('denies selected scoped song when song is not in allowlist', async () => {
    prisma.song.findUnique.mockResolvedValue({ id: 'song2', projectId: 'project1' })
    prisma.projectMember.findUnique.mockResolvedValue({
      id: 'pm1',
      projectId: 'project1',
      userId: 'u1',
      permission: 'READ',
      songScope: 'SELECTED_SONGS',
      selectedSongs: [{ songId: 'song1' }],
    })

    await expect(service.assertCanViewSong('song2', composer)).rejects.toBeInstanceOf(ForbiddenException)
  })

  it('throws not found for missing song', async () => {
    prisma.song.findUnique.mockResolvedValue(null)
    await expect(service.assertCanViewSong('missing', composer)).rejects.toBeInstanceOf(NotFoundException)
  })
})
```

- [ ] **Step 2: Run tests to verify failure**

Run:

```bash
cd apps/api && pnpm test -- project-access.service.spec.ts
```

Expected:

```txt
FAIL because project-access.service does not exist.
```

- [ ] **Step 3: Implement service and module**

Create `apps/api/src/modules/project-access/project-access.module.ts`:

```ts
import { Module } from '@nestjs/common'
import { PrismaModule } from '../prisma/prisma.module'
import { ProjectAccessService } from './project-access.service'

@Module({
  imports: [PrismaModule],
  providers: [ProjectAccessService],
  exports: [ProjectAccessService],
})
export class ProjectAccessModule {}
```

Create `apps/api/src/modules/project-access/project-access.service.ts`:

```ts
import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common'
import { PrismaService } from '../prisma/prisma.service'
import type { AuthUser } from '@ama-midi/shared'

type Permission = 'READ' | 'EDIT' | 'ADMIN'
type Scope = 'ALL_SONGS' | 'SELECTED_SONGS' | 'NO_SONGS'

interface Membership {
  permission: Permission
  songScope: Scope
  selectedSongs: { songId: string }[]
}

@Injectable()
export class ProjectAccessService {
  constructor(private readonly prisma: PrismaService) {}

  async assertProjectAdmin(projectId: string, user: AuthUser): Promise<void> {
    if (user.role === 'ADMIN') return
    const membership = await this.getMembership(projectId, user.id)
    if (membership.permission !== 'ADMIN') throw new ForbiddenException()
  }

  async assertCanViewProject(projectId: string, user: AuthUser): Promise<void> {
    if (user.role === 'ADMIN') return
    await this.getMembership(projectId, user.id)
  }

  async assertCanCreateSong(projectId: string, user: AuthUser): Promise<void> {
    if (user.role === 'ADMIN') return
    const membership = await this.getMembership(projectId, user.id)
    const canCreate = membership.songScope === 'ALL_SONGS' && ['EDIT', 'ADMIN'].includes(membership.permission)
    if (!canCreate) throw new ForbiddenException()
  }

  async assertCanViewSong(songId: string, user: AuthUser) {
    const song = await this.getSong(songId)
    if (user.role === 'ADMIN') return song
    const membership = await this.getMembership(song.projectId, user.id)
    if (!this.isSongInScope(song.id, membership)) throw new ForbiddenException()
    return song
  }

  async assertCanEditSong(songId: string, user: AuthUser) {
    const song = await this.assertCanViewSong(songId, user)
    if (user.role === 'ADMIN') return song
    const membership = await this.getMembership(song.projectId, user.id)
    if (!['EDIT', 'ADMIN'].includes(membership.permission)) throw new ForbiddenException()
    return song
  }

  async getAccessibleSongWhere(projectId: string, user: AuthUser) {
    if (user.role === 'ADMIN') return { projectId }
    const membership = await this.getMembership(projectId, user.id)
    if (membership.songScope === 'ALL_SONGS') return { projectId }
    if (membership.songScope === 'NO_SONGS') return { projectId, id: { in: [] } }
    return { projectId, id: { in: membership.selectedSongs.map((s) => s.songId) } }
  }

  private async getSong(songId: string) {
    const song = await this.prisma.song.findUnique({
      where: { id: songId },
      select: { id: true, projectId: true },
    })
    if (!song) throw new NotFoundException('Song not found')
    return song
  }

  private async getMembership(projectId: string, userId: string): Promise<Membership> {
    const membership = await this.prisma.projectMember.findUnique({
      where: { projectId_userId: { projectId, userId } },
      include: { selectedSongs: { select: { songId: true } } },
    })
    if (!membership) throw new ForbiddenException()
    return membership as Membership
  }

  private isSongInScope(songId: string, membership: Membership): boolean {
    if (membership.songScope === 'ALL_SONGS') return true
    if (membership.songScope === 'NO_SONGS') return false
    return membership.selectedSongs.some((s) => s.songId === songId)
  }
}
```

- [ ] **Step 4: Register module**

In `apps/api/src/app.module.ts`, import and add `ProjectAccessModule`:

```ts
import { ProjectAccessModule } from './modules/project-access/project-access.module'
```

Add it to `imports` after `PrismaModule`.

- [ ] **Step 5: Run tests**

Run:

```bash
cd apps/api && pnpm test -- project-access.service.spec.ts
```

Expected:

```txt
PASS project-access.service.spec.ts
```

- [ ] **Step 6: Commit**

```bash
git add apps/api/src/modules/project-access apps/api/src/app.module.ts
git commit -m "feat(api): add project access service"
```

---

## Task 4: Projects API

**Files:**
- Create: `apps/api/src/modules/projects/projects.module.ts`
- Create: `apps/api/src/modules/projects/projects.controller.ts`
- Create: `apps/api/src/modules/projects/projects.service.ts`
- Create: `apps/api/src/modules/projects/dto/create-project.dto.ts`
- Create: `apps/api/src/modules/projects/dto/update-project.dto.ts`
- Create: `apps/api/src/modules/projects/__tests__/projects.service.spec.ts`
- Modify: `apps/api/src/app.module.ts`

- [ ] **Step 1: Write failing service tests**

Create `apps/api/src/modules/projects/__tests__/projects.service.spec.ts`:

```ts
import { ProjectsService } from '../projects.service'
import { PrismaService } from '../../prisma/prisma.service'
import { ProjectAccessService } from '../../project-access/project-access.service'
import type { AuthUser } from '@ama-midi/shared'

const prisma = {
  project: {
    findMany: jest.fn(),
    create: jest.fn(),
    findUnique: jest.fn(),
    update: jest.fn(),
  },
  projectMember: {
    create: jest.fn(),
  },
}

const access = {
  assertCanViewProject: jest.fn(),
  assertProjectAdmin: jest.fn(),
}

const user: AuthUser = {
  id: 'u1',
  email: 'u1@example.com',
  name: 'User',
  role: 'COMPOSER',
  profileComplete: true,
  tourComplete: true,
}

describe('ProjectsService', () => {
  let service: ProjectsService

  beforeEach(() => {
    service = new ProjectsService(prisma as unknown as PrismaService, access as unknown as ProjectAccessService)
    jest.clearAllMocks()
  })

  it('creates project and admin membership for creator', async () => {
    const row = {
      id: 'project1',
      name: 'Game A',
      description: null,
      status: 'ACTIVE',
      ownerId: 'u1',
      createdAt: new Date('2026-01-01T00:00:00Z'),
      updatedAt: new Date('2026-01-01T00:00:00Z'),
      archivedAt: null,
      _count: { songs: 0, members: 1 },
    }
    prisma.project.create.mockResolvedValue(row)

    const result = await service.create({ name: 'Game A' }, user)

    expect(prisma.project.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        name: 'Game A',
        ownerId: 'u1',
        members: { create: { userId: 'u1', permission: 'ADMIN', songScope: 'ALL_SONGS' } },
      }),
    }))
    expect(result.name).toBe('Game A')
    expect(result.memberCount).toBe(1)
  })

  it('lists projects visible to non-admin through membership', async () => {
    prisma.project.findMany.mockResolvedValue([])

    await service.findAll(user)

    expect(prisma.project.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({ members: { some: { userId: 'u1' } } }),
    }))
  })
})
```

- [ ] **Step 2: Run tests to verify failure**

Run:

```bash
cd apps/api && pnpm test -- projects.service.spec.ts
```

Expected:

```txt
FAIL because ProjectsService does not exist.
```

- [ ] **Step 3: Add DTOs**

Create `apps/api/src/modules/projects/dto/create-project.dto.ts`:

```ts
import { IsOptional, IsString, MaxLength, MinLength } from 'class-validator'

export class CreateProjectDto {
  @IsString()
  @MinLength(1)
  @MaxLength(120)
  name!: string

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  description?: string
}
```

Create `apps/api/src/modules/projects/dto/update-project.dto.ts`:

```ts
import { IsIn, IsOptional, IsString, MaxLength, MinLength } from 'class-validator'

export class UpdateProjectDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(120)
  name?: string

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  description?: string | null

  @IsOptional()
  @IsIn(['ACTIVE', 'PAUSED', 'ARCHIVED'])
  status?: 'ACTIVE' | 'PAUSED' | 'ARCHIVED'
}
```

- [ ] **Step 4: Implement ProjectsService**

Create `apps/api/src/modules/projects/projects.service.ts`:

```ts
import { Injectable, NotFoundException } from '@nestjs/common'
import { PrismaService } from '../prisma/prisma.service'
import { ProjectAccessService } from '../project-access/project-access.service'
import { CreateProjectDto } from './dto/create-project.dto'
import { UpdateProjectDto } from './dto/update-project.dto'
import type { AuthUser, Project } from '@ama-midi/shared'

@Injectable()
export class ProjectsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly access: ProjectAccessService,
  ) {}

  async findAll(user: AuthUser): Promise<Project[]> {
    const rows = await this.prisma.project.findMany({
      where: user.role === 'ADMIN' ? {} : { members: { some: { userId: user.id } } },
      include: { _count: { select: { songs: true, members: true } } },
      orderBy: { updatedAt: 'desc' },
    })
    return rows.map(this.toProject)
  }

  async findOne(projectId: string, user: AuthUser): Promise<Project> {
    await this.access.assertCanViewProject(projectId, user)
    const row = await this.prisma.project.findUnique({
      where: { id: projectId },
      include: { _count: { select: { songs: true, members: true } } },
    })
    if (!row) throw new NotFoundException('Project not found')
    return this.toProject(row)
  }

  async create(dto: CreateProjectDto, user: AuthUser): Promise<Project> {
    const row = await this.prisma.project.create({
      data: {
        name: dto.name.trim(),
        description: dto.description?.trim() || null,
        ownerId: user.id,
        members: {
          create: { userId: user.id, permission: 'ADMIN', songScope: 'ALL_SONGS' },
        },
      },
      include: { _count: { select: { songs: true, members: true } } },
    })
    return this.toProject(row)
  }

  async update(projectId: string, dto: UpdateProjectDto, user: AuthUser): Promise<Project> {
    await this.access.assertProjectAdmin(projectId, user)
    const row = await this.prisma.project.update({
      where: { id: projectId },
      data: {
        ...(dto.name !== undefined ? { name: dto.name.trim() } : {}),
        ...(dto.description !== undefined ? { description: dto.description?.trim() || null } : {}),
        ...(dto.status !== undefined ? {
          status: dto.status,
          archivedAt: dto.status === 'ARCHIVED' ? new Date() : null,
        } : {}),
      },
      include: { _count: { select: { songs: true, members: true } } },
    })
    return this.toProject(row)
  }

  private toProject(row: any): Project {
    return {
      id: row.id,
      name: row.name,
      description: row.description,
      status: row.status,
      ownerId: row.ownerId,
      songCount: row._count?.songs ?? 0,
      memberCount: row._count?.members ?? 0,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
      archivedAt: row.archivedAt?.toISOString() ?? null,
    }
  }
}
```

- [ ] **Step 5: Implement controller and module**

Create `apps/api/src/modules/projects/projects.controller.ts`:

```ts
import { Body, Controller, Get, Param, Patch, Post, Req, UseGuards } from '@nestjs/common'
import { AuthGuard } from '@nestjs/passport'
import type { Request } from 'express'
import type { AuthUser } from '@ama-midi/shared'
import { ProjectsService } from './projects.service'
import { CreateProjectDto } from './dto/create-project.dto'
import { UpdateProjectDto } from './dto/update-project.dto'

@Controller('projects')
@UseGuards(AuthGuard('jwt'))
export class ProjectsController {
  constructor(private readonly projects: ProjectsService) {}

  @Get()
  findAll(@Req() req: Request) {
    return this.projects.findAll(req.user as AuthUser)
  }

  @Get(':projectId')
  findOne(@Param('projectId') projectId: string, @Req() req: Request) {
    return this.projects.findOne(projectId, req.user as AuthUser)
  }

  @Post()
  create(@Body() dto: CreateProjectDto, @Req() req: Request) {
    return this.projects.create(dto, req.user as AuthUser)
  }

  @Patch(':projectId')
  update(@Param('projectId') projectId: string, @Body() dto: UpdateProjectDto, @Req() req: Request) {
    return this.projects.update(projectId, dto, req.user as AuthUser)
  }
}
```

Create `apps/api/src/modules/projects/projects.module.ts`:

```ts
import { Module } from '@nestjs/common'
import { PrismaModule } from '../prisma/prisma.module'
import { ProjectAccessModule } from '../project-access/project-access.module'
import { ProjectsController } from './projects.controller'
import { ProjectsService } from './projects.service'

@Module({
  imports: [PrismaModule, ProjectAccessModule],
  controllers: [ProjectsController],
  providers: [ProjectsService],
})
export class ProjectsModule {}
```

- [ ] **Step 6: Register ProjectsModule**

In `apps/api/src/app.module.ts`, import:

```ts
import { ProjectsModule } from './modules/projects/projects.module'
```

Add `ProjectsModule` to `imports` after `UsersModule`.

- [ ] **Step 7: Run tests**

Run:

```bash
cd apps/api && pnpm test -- projects.service.spec.ts
```

Expected:

```txt
PASS projects.service.spec.ts
```

- [ ] **Step 8: Commit**

```bash
git add apps/api/src/modules/projects apps/api/src/app.module.ts
git commit -m "feat(api): add projects API"
```

---

## Task 5: Project Members API and Song Scopes

**Files:**
- Create: `apps/api/src/modules/project-members/project-members.module.ts`
- Create: `apps/api/src/modules/project-members/project-members.controller.ts`
- Create: `apps/api/src/modules/project-members/project-members.service.ts`
- Create: `apps/api/src/modules/project-members/dto/add-project-member.dto.ts`
- Create: `apps/api/src/modules/project-members/dto/update-project-member.dto.ts`
- Create: `apps/api/src/modules/project-members/__tests__/project-members.service.spec.ts`
- Modify: `apps/api/src/app.module.ts`

- [ ] **Step 1: Write failing service tests**

Create `apps/api/src/modules/project-members/__tests__/project-members.service.spec.ts`:

```ts
import { BadRequestException } from '@nestjs/common'
import { ProjectMembersService } from '../project-members.service'
import { PrismaService } from '../../prisma/prisma.service'
import { ProjectAccessService } from '../../project-access/project-access.service'
import type { AuthUser } from '@ama-midi/shared'

const prisma = {
  song: { count: jest.fn() },
  projectMember: {
    findMany: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
  },
  projectMemberSongAccess: { deleteMany: jest.fn(), createMany: jest.fn() },
}

const access = { assertProjectAdmin: jest.fn() }

const admin: AuthUser = {
  id: 'admin',
  email: 'admin@example.com',
  name: 'Admin',
  role: 'ADMIN',
  profileComplete: true,
  tourComplete: true,
}

describe('ProjectMembersService', () => {
  let service: ProjectMembersService

  beforeEach(() => {
    service = new ProjectMembersService(prisma as unknown as PrismaService, access as unknown as ProjectAccessService)
    jest.clearAllMocks()
  })

  it('requires selected songs when scope is SELECTED_SONGS', async () => {
    await expect(service.add('project1', {
      userId: 'u2',
      permission: 'READ',
      songScope: 'SELECTED_SONGS',
      songIds: [],
    }, admin)).rejects.toBeInstanceOf(BadRequestException)
  })

  it('rejects selected songs from another project', async () => {
    prisma.song.count.mockResolvedValue(1)
    await expect(service.add('project1', {
      userId: 'u2',
      permission: 'READ',
      songScope: 'SELECTED_SONGS',
      songIds: ['song1', 'song2'],
    }, admin)).rejects.toBeInstanceOf(BadRequestException)
  })

  it('creates selected song access rows when selected scope is valid', async () => {
    prisma.song.count.mockResolvedValue(2)
    prisma.projectMember.create.mockResolvedValue({
      id: 'pm1',
      projectId: 'project1',
      userId: 'u2',
      permission: 'READ',
      songScope: 'SELECTED_SONGS',
      createdAt: new Date('2026-01-01T00:00:00Z'),
      updatedAt: new Date('2026-01-01T00:00:00Z'),
      user: { name: 'QA', avatarUrl: null },
      selectedSongs: [{ songId: 'song1' }, { songId: 'song2' }],
    })

    const result = await service.add('project1', {
      userId: 'u2',
      permission: 'READ',
      songScope: 'SELECTED_SONGS',
      songIds: ['song1', 'song2'],
    }, admin)

    expect(result.selectedSongIds).toEqual(['song1', 'song2'])
  })
})
```

- [ ] **Step 2: Run tests to verify failure**

Run:

```bash
cd apps/api && pnpm test -- project-members.service.spec.ts
```

Expected:

```txt
FAIL because ProjectMembersService does not exist.
```

- [ ] **Step 3: Add DTOs**

Create `apps/api/src/modules/project-members/dto/add-project-member.dto.ts`:

```ts
import { ArrayNotEmpty, IsArray, IsIn, IsOptional, IsString, IsUUID, ValidateIf } from 'class-validator'

export class AddProjectMemberDto {
  @IsUUID()
  userId!: string

  @IsIn(['READ', 'EDIT', 'ADMIN'])
  permission!: 'READ' | 'EDIT' | 'ADMIN'

  @IsIn(['ALL_SONGS', 'SELECTED_SONGS', 'NO_SONGS'])
  songScope!: 'ALL_SONGS' | 'SELECTED_SONGS' | 'NO_SONGS'

  @ValidateIf((dto) => dto.songScope === 'SELECTED_SONGS')
  @IsArray()
  @ArrayNotEmpty()
  @IsUUID('4', { each: true })
  songIds?: string[]
}
```

Create `apps/api/src/modules/project-members/dto/update-project-member.dto.ts`:

```ts
import { ArrayNotEmpty, IsArray, IsIn, IsOptional, IsUUID, ValidateIf } from 'class-validator'

export class UpdateProjectMemberDto {
  @IsOptional()
  @IsIn(['READ', 'EDIT', 'ADMIN'])
  permission?: 'READ' | 'EDIT' | 'ADMIN'

  @IsOptional()
  @IsIn(['ALL_SONGS', 'SELECTED_SONGS', 'NO_SONGS'])
  songScope?: 'ALL_SONGS' | 'SELECTED_SONGS' | 'NO_SONGS'

  @ValidateIf((dto) => dto.songScope === 'SELECTED_SONGS')
  @IsArray()
  @ArrayNotEmpty()
  @IsUUID('4', { each: true })
  songIds?: string[]
}
```

- [ ] **Step 4: Implement ProjectMembersService**

Create `apps/api/src/modules/project-members/project-members.service.ts` with these public methods:

```ts
import { BadRequestException, Injectable } from '@nestjs/common'
import { PrismaService } from '../prisma/prisma.service'
import { ProjectAccessService } from '../project-access/project-access.service'
import { AddProjectMemberDto } from './dto/add-project-member.dto'
import { UpdateProjectMemberDto } from './dto/update-project-member.dto'
import type { AuthUser, ProjectMember } from '@ama-midi/shared'

@Injectable()
export class ProjectMembersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly access: ProjectAccessService,
  ) {}

  async list(projectId: string, user: AuthUser): Promise<ProjectMember[]> {
    await this.access.assertCanViewProject(projectId, user)
    const rows = await this.prisma.projectMember.findMany({
      where: { projectId },
      include: {
        user: { select: { name: true, avatarUrl: true } },
        selectedSongs: { select: { songId: true } },
      },
      orderBy: { createdAt: 'asc' },
    })
    return rows.map(this.toMember)
  }

  async add(projectId: string, dto: AddProjectMemberDto, user: AuthUser): Promise<ProjectMember> {
    await this.access.assertProjectAdmin(projectId, user)
    await this.assertValidScope(projectId, dto.songScope, dto.songIds)

    const row = await this.prisma.projectMember.create({
      data: {
        projectId,
        userId: dto.userId,
        permission: dto.permission,
        songScope: dto.songScope,
        selectedSongs: dto.songScope === 'SELECTED_SONGS'
          ? { createMany: { data: dto.songIds!.map((songId) => ({ songId })) } }
          : undefined,
      },
      include: {
        user: { select: { name: true, avatarUrl: true } },
        selectedSongs: { select: { songId: true } },
      },
    })
    return this.toMember(row)
  }

  async update(projectId: string, memberId: string, dto: UpdateProjectMemberDto, user: AuthUser): Promise<ProjectMember> {
    await this.access.assertProjectAdmin(projectId, user)
    const nextScope = dto.songScope
    await this.assertValidScope(projectId, nextScope, dto.songIds)

    await this.prisma.projectMemberSongAccess.deleteMany({ where: { projectMemberId: memberId } })
    const row = await this.prisma.projectMember.update({
      where: { id: memberId },
      data: {
        ...(dto.permission ? { permission: dto.permission } : {}),
        ...(dto.songScope ? { songScope: dto.songScope } : {}),
        ...(dto.songScope === 'SELECTED_SONGS' ? {
          selectedSongs: { createMany: { data: dto.songIds!.map((songId) => ({ songId })) } },
        } : {}),
      },
      include: {
        user: { select: { name: true, avatarUrl: true } },
        selectedSongs: { select: { songId: true } },
      },
    })
    return this.toMember(row)
  }

  async remove(projectId: string, memberId: string, user: AuthUser): Promise<void> {
    await this.access.assertProjectAdmin(projectId, user)
    await this.prisma.projectMember.delete({ where: { id: memberId } })
  }

  private async assertValidScope(projectId: string, scope?: string, songIds?: string[]) {
    if (scope !== 'SELECTED_SONGS') return
    if (!songIds || songIds.length === 0) throw new BadRequestException('Selected song scope requires songs')
    const count = await this.prisma.song.count({ where: { projectId, id: { in: songIds } } })
    if (count !== songIds.length) throw new BadRequestException('Selected songs must belong to project')
  }

  private toMember(row: any): ProjectMember {
    return {
      id: row.id,
      projectId: row.projectId,
      userId: row.userId,
      userName: row.user.name,
      userAvatarUrl: row.user.avatarUrl ?? undefined,
      permission: row.permission,
      songScope: row.songScope,
      selectedSongIds: row.selectedSongs.map((s: { songId: string }) => s.songId),
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    }
  }
}
```

- [ ] **Step 5: Add controller/module and register**

Create controller with routes:

```ts
@Controller('projects/:projectId/members')
```

Methods:

```ts
@Get() list()
@Post() add()
@Patch(':memberId') update()
@Delete(':memberId') remove()
```

Create module importing `PrismaModule` and `ProjectAccessModule`, then register `ProjectMembersModule` in `AppModule`.

- [ ] **Step 6: Run tests**

Run:

```bash
cd apps/api && pnpm test -- project-members.service.spec.ts
```

Expected:

```txt
PASS project-members.service.spec.ts
```

- [ ] **Step 7: Commit**

```bash
git add apps/api/src/modules/project-members apps/api/src/app.module.ts
git commit -m "feat(api): add project member scopes"
```

---

## Task 6: Project-Owned Songs API and Import Creation

**Files:**
- Create: `apps/api/src/modules/songs/dto/create-project-song.dto.ts`
- Create: `apps/api/src/modules/songs/__tests__/songs.project-flow.spec.ts`
- Modify: `apps/api/src/modules/songs/songs.service.ts`
- Modify: `apps/api/src/modules/songs/songs.controller.ts`
- Modify: `apps/api/src/modules/songs/songs.module.ts`

- [ ] **Step 1: Write failing tests for project song creation**

Create `apps/api/src/modules/songs/__tests__/songs.project-flow.spec.ts`:

```ts
import { BadRequestException } from '@nestjs/common'
import { SongsService } from '../songs.service'
import { PrismaService } from '../../prisma/prisma.service'
import { ProjectAccessService } from '../../project-access/project-access.service'
import type { AuthUser } from '@ama-midi/shared'

const prisma = {
  song: { findMany: jest.fn(), findUnique: jest.fn(), create: jest.fn() },
  sectionMarker: { findMany: jest.fn(), createMany: jest.fn() },
  notePattern: { findMany: jest.fn(), createMany: jest.fn() },
  note: { findMany: jest.fn(), createMany: jest.fn() },
}

const access = {
  assertCanCreateSong: jest.fn(),
  assertCanViewSong: jest.fn(),
  getAccessibleSongWhere: jest.fn(),
}

const user: AuthUser = {
  id: 'u1',
  email: 'u1@example.com',
  name: 'Composer',
  role: 'COMPOSER',
  profileComplete: true,
  tourComplete: true,
}

describe('SongsService project flow', () => {
  let service: SongsService

  beforeEach(() => {
    service = new SongsService(prisma as unknown as PrismaService, access as unknown as ProjectAccessService)
    jest.clearAllMocks()
  })

  it('creates blank song in a project', async () => {
    const row = {
      id: 'song1',
      projectId: 'project1',
      name: 'New Song',
      category: 'PROTOTYPE',
      status: 'DRAFT',
      difficulty: 'NORMAL',
      createdBy: 'u1',
      assignedComposerId: null,
      assignedQaId: null,
      sourceSongId: null,
      archivedAt: null,
      bpm: 120,
      timeSignature: '4/4',
      createdAt: new Date('2026-01-01T00:00:00Z'),
      updatedAt: new Date('2026-01-01T00:00:00Z'),
      creator: { name: 'Composer', avatarUrl: null },
      assignedComposer: null,
      assignedQa: null,
      _count: { notes: 0 },
    }
    prisma.song.create.mockResolvedValue(row)

    const result = await service.createInProject('project1', {
      name: 'New Song',
      category: 'PROTOTYPE',
      difficulty: 'NORMAL',
      bpm: 120,
      timeSignature: '4/4',
      startType: 'BLANK',
    }, user)

    expect(access.assertCanCreateSong).toHaveBeenCalledWith('project1', user)
    expect(result.projectId).toBe('project1')
  })

  it('rejects import without source song', async () => {
    await expect(service.createInProject('project1', {
      name: 'Imported',
      category: 'PROTOTYPE',
      difficulty: 'NORMAL',
      bpm: 120,
      timeSignature: '4/4',
      startType: 'IMPORT',
    }, user)).rejects.toBeInstanceOf(BadRequestException)
  })
})
```

- [ ] **Step 2: Run tests to verify failure**

Run:

```bash
cd apps/api && pnpm test -- songs.project-flow.spec.ts
```

Expected:

```txt
FAIL because SongsService constructor and createInProject do not match.
```

- [ ] **Step 3: Add create DTO**

Create `apps/api/src/modules/songs/dto/create-project-song.dto.ts`:

```ts
import { IsBoolean, IsIn, IsInt, IsOptional, IsString, IsUUID, Max, MaxLength, Min, MinLength, ValidateIf, ValidateNested } from 'class-validator'
import { Type } from 'class-transformer'

class ImportSongDto {
  @IsUUID()
  sourceSongId!: string

  @IsBoolean()
  copySettings!: boolean

  @IsBoolean()
  copySections!: boolean

  @IsBoolean()
  copyPatterns!: boolean

  @IsBoolean()
  copyNotes!: boolean
}

export class CreateProjectSongDto {
  @IsString()
  @MinLength(1)
  @MaxLength(160)
  name!: string

  @IsIn(['MAIN_CAMPAIGN', 'EVENT', 'TUTORIAL', 'LIVE_OPS', 'PROTOTYPE', 'QA_TEST', 'TEMPLATE', 'REFERENCE'])
  category!: any

  @IsIn(['EASY', 'NORMAL', 'HARD', 'EXPERT', 'MASTER'])
  difficulty!: any

  @IsInt()
  @Min(40)
  @Max(300)
  bpm!: number

  @IsIn(['4/4', '3/4', '6/8'])
  timeSignature!: string

  @IsOptional()
  @IsUUID()
  assignedComposerId?: string

  @IsOptional()
  @IsUUID()
  assignedQaId?: string

  @IsIn(['BLANK', 'TEMPLATE', 'IMPORT'])
  startType!: 'BLANK' | 'TEMPLATE' | 'IMPORT'

  @IsOptional()
  @IsString()
  templateId?: string

  @ValidateIf((dto) => dto.startType === 'IMPORT')
  @ValidateNested()
  @Type(() => ImportSongDto)
  import?: ImportSongDto
}
```

- [ ] **Step 4: Modify SongsService constructor**

In `apps/api/src/modules/songs/songs.service.ts`, inject `ProjectAccessService`:

```ts
constructor(
  private readonly prisma: PrismaService,
  private readonly access: ProjectAccessService,
) {}
```

Import:

```ts
import { BadRequestException, Injectable, NotFoundException, ForbiddenException } from '@nestjs/common'
import { ProjectAccessService } from '../project-access/project-access.service'
import { CreateProjectSongDto } from './dto/create-project-song.dto'
```

- [ ] **Step 5: Add project-aware service methods**

Add methods to `SongsService`:

```ts
async findByProject(projectId: string, user: AuthUser): Promise<Song[]> {
  const where = await this.access.getAccessibleSongWhere(projectId, user)
  const rows = await this.prisma.song.findMany({
    where,
    include: this.songInclude(),
    orderBy: { updatedAt: 'desc' },
  })
  return rows.map((s) => this.toSong(s))
}

async createInProject(projectId: string, dto: CreateProjectSongDto, user: AuthUser): Promise<Song> {
  await this.access.assertCanCreateSong(projectId, user)
  if (dto.startType === 'IMPORT' && !dto.import) throw new BadRequestException('Import options are required')

  const source = dto.import ? await this.access.assertCanViewSong(dto.import.sourceSongId, user) : null
  const createData = {
    projectId,
    name: dto.name.trim(),
    category: dto.category,
    difficulty: dto.difficulty,
    bpm: dto.bpm,
    timeSignature: dto.timeSignature,
    assignedComposerId: dto.assignedComposerId ?? null,
    assignedQaId: dto.assignedQaId ?? null,
    createdBy: user.id,
    sourceSongId: source?.id ?? null,
    importOptions: dto.import ?? undefined,
  }

  const row = await this.prisma.song.create({
    data: createData,
    include: this.songInclude(),
  })

  if (dto.import) await this.copyImportedData(row.id, dto.import)
  return this.toSong(row)
}

private async copyImportedData(targetSongId: string, options: NonNullable<CreateProjectSongDto['import']>) {
  if (options.copySections) {
    const sections = await this.prisma.sectionMarker.findMany({ where: { songId: options.sourceSongId } })
    if (sections.length) {
      await this.prisma.sectionMarker.createMany({
        data: sections.map((s) => ({
          songId: targetSongId,
          time: s.time,
          label: s.label,
          color: s.color,
          createdBy: s.createdBy,
        })),
      })
    }
  }

  if (options.copyPatterns) {
    const patterns = await this.prisma.notePattern.findMany({ where: { songId: options.sourceSongId } })
    if (patterns.length) {
      await this.prisma.notePattern.createMany({
        data: patterns.map((p) => ({
          songId: targetSongId,
          name: p.name,
          notes: p.notes,
          createdBy: p.createdBy,
        })),
      })
    }
  }

  if (options.copyNotes) {
    const notes = await this.prisma.note.findMany({ where: { songId: options.sourceSongId, deletedAt: null } })
    if (notes.length) {
      await this.prisma.note.createMany({
        data: notes.map((n) => ({
          songId: targetSongId,
          track: n.track,
          time: n.time,
          title: n.title,
          description: n.description,
          color: n.color,
          noteType: n.noteType,
          duration: n.duration,
          createdBy: n.createdBy,
        })),
      })
    }
  }
}
```

Also replace repeated include/mapping with:

```ts
private songInclude() {
  return {
    creator: { select: { name: true, avatarUrl: true } },
    assignedComposer: { select: { name: true } },
    assignedQa: { select: { name: true } },
    _count: { select: { notes: { where: { deletedAt: null } } } },
  } as const
}

private toSong(s: any): Song {
  return {
    id: s.id,
    projectId: s.projectId,
    name: s.name,
    category: s.category,
    status: s.status,
    difficulty: s.difficulty,
    assignedComposerId: s.assignedComposerId,
    assignedComposerName: s.assignedComposer?.name ?? null,
    assignedQaId: s.assignedQaId,
    assignedQaName: s.assignedQa?.name ?? null,
    sourceSongId: s.sourceSongId,
    archivedAt: s.archivedAt?.toISOString() ?? null,
    createdBy: s.createdBy,
    creatorName: s.creator.name,
    creatorAvatarUrl: s.creator.avatarUrl ?? undefined,
    noteCount: s._count.notes,
    createdAt: s.createdAt.toISOString(),
    updatedAt: s.updatedAt.toISOString(),
    bpm: s.bpm,
    timeSignature: s.timeSignature,
  }
}
```

- [ ] **Step 6: Add project song routes**

In `SongsController`, add:

```ts
@Get('/projects/:projectId/songs')
findByProject(@Param('projectId') projectId: string, @Req() req: Request) {
  return this.songs.findByProject(projectId, req.user as AuthUser)
}

@Post('/projects/:projectId/songs')
createInProject(
  @Param('projectId') projectId: string,
  @Body() dto: CreateProjectSongDto,
  @Req() req: Request,
) {
  return this.songs.createInProject(projectId, dto, req.user as AuthUser)
}
```

Because the controller currently has `@Controller('songs')`, either:

```txt
Move project routes to a new ProjectSongsController with @Controller('projects/:projectId/songs')
```

or:

```txt
Change controller structure carefully so existing /songs routes continue working.
```

Preferred implementation: create `ProjectSongsController` in the same module with `@Controller('projects/:projectId/songs')`.

- [ ] **Step 7: Run tests**

Run:

```bash
cd apps/api && pnpm test -- songs.project-flow.spec.ts
```

Expected:

```txt
PASS songs.project-flow.spec.ts
```

- [ ] **Step 8: Commit**

```bash
git add apps/api/src/modules/songs
git commit -m "feat(api): add project song creation and import"
```

---

## Task 7: Retrofit Editor Resource Authorization

**Files:**
- Modify: `apps/api/src/modules/notes/notes.controller.ts`
- Modify: `apps/api/src/modules/notes/notes.service.ts`
- Modify: `apps/api/src/modules/notes/note-query.service.ts`
- Modify: `apps/api/src/modules/notes/notes.module.ts`
- Modify: `apps/api/src/modules/sections/sections.controller.ts`
- Modify: `apps/api/src/modules/sections/sections.service.ts`
- Modify: `apps/api/src/modules/sections/sections.module.ts`
- Modify: `apps/api/src/modules/patterns/patterns.controller.ts`
- Modify: `apps/api/src/modules/patterns/patterns.service.ts`
- Modify: `apps/api/src/modules/validation/validation.controller.ts`
- Modify: `apps/api/src/modules/versions/versions.controller.ts`

- [ ] **Step 1: Write note query authorization test**

Create or extend `apps/api/src/modules/notes/__tests__/notes.service.spec.ts` with:

```ts
it('checks edit access before creating a note', async () => {
  mockAccess.assertCanEditSong.mockResolvedValue({ id: 'song1', projectId: 'project1' })
  mockPrisma.note.create.mockResolvedValue({
    id: 'n1',
    songId: 'song1',
    track: 1,
    time: 1,
    title: 'Tap',
    description: '',
    color: '#6C63FF',
    noteType: 'TAP',
    duration: null,
    createdBy: 'u1',
    creator: { name: 'Composer' },
    createdAt: new Date(),
    updatedAt: new Date(),
  })

  await service.create('song1', { track: 1, time: 1, title: 'Tap' }, user)

  expect(mockAccess.assertCanEditSong).toHaveBeenCalledWith('song1', user)
})
```

Add `mockAccess` provider:

```ts
const mockAccess = { assertCanViewSong: jest.fn(), assertCanEditSong: jest.fn() }
```

- [ ] **Step 2: Run notes tests to verify failure**

Run:

```bash
cd apps/api && pnpm test -- notes.service.spec.ts
```

Expected:

```txt
FAIL because NotesService does not inject ProjectAccessService yet.
```

- [ ] **Step 3: Inject access service into notes**

In `NotesModule`, import `ProjectAccessModule`.

In `NotesService`, inject:

```ts
private readonly access: ProjectAccessService
```

Before mutations:

```ts
await this.access.assertCanEditSong(songId, user)
```

Before read queries in `NoteQueryService.findBySong`, add user parameter and call:

```ts
await this.access.assertCanViewSong(songId, user)
```

Update `NotesController.findAll` to pass `req.user`.

- [ ] **Step 4: Apply the same authorization pattern to sections, patterns, validation, and versions**

For read endpoints:

```ts
await this.access.assertCanViewSong(songId, user)
```

For create/update/delete endpoints:

```ts
await this.access.assertCanEditSong(songId, user)
```

Update controllers so every affected handler receives `@Req() req: Request` and passes `req.user as AuthUser`.

- [ ] **Step 5: Run targeted API tests**

Run:

```bash
cd apps/api && pnpm test -- notes.service.spec.ts sections.service.spec.ts
```

Expected:

```txt
PASS notes.service.spec.ts
PASS sections.service.spec.ts
```

- [ ] **Step 6: Commit**

```bash
git add apps/api/src/modules/notes apps/api/src/modules/sections apps/api/src/modules/patterns apps/api/src/modules/validation apps/api/src/modules/versions
git commit -m "feat(api): enforce project song access on editor resources"
```

---

## Task 8: Frontend Project API Hooks

**Files:**
- Create: `apps/web/src/features/projects/useProjects.ts`
- Create: `apps/web/src/features/project-members/useProjectMembers.ts`
- Modify: `apps/web/src/features/songs/useSongs.ts`

- [ ] **Step 1: Create project hooks**

Create `apps/web/src/features/projects/useProjects.ts`:

```ts
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useAuthStore } from '../../store/auth.store'
import { apiClient } from '../auth/api'
import type { Project } from '@ama-midi/shared'

export function useProjects() {
  const token = useAuthStore((s) => s.token)
  return useQuery<Project[]>({
    queryKey: ['projects'],
    queryFn: () => apiClient(token)<Project[]>('/projects'),
    enabled: !!token,
  })
}

export function useProject(projectId?: string) {
  const token = useAuthStore((s) => s.token)
  return useQuery<Project>({
    queryKey: ['project', projectId],
    queryFn: () => apiClient(token)<Project>(`/projects/${projectId}`),
    enabled: !!token && !!projectId,
  })
}

export function useCreateProject() {
  const token = useAuthStore((s) => s.token)
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (body: { name: string; description?: string }) =>
      apiClient(token)<Project>('/projects', { method: 'POST', body: JSON.stringify(body) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['projects'] }),
  })
}
```

- [ ] **Step 2: Create member hooks**

Create `apps/web/src/features/project-members/useProjectMembers.ts`:

```ts
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useAuthStore } from '../../store/auth.store'
import { apiClient } from '../auth/api'
import type { ProjectMember, ProjectPermission, SongScope } from '@ama-midi/shared'

export function useProjectMembers(projectId?: string) {
  const token = useAuthStore((s) => s.token)
  return useQuery<ProjectMember[]>({
    queryKey: ['project-members', projectId],
    queryFn: () => apiClient(token)<ProjectMember[]>(`/projects/${projectId}/members`),
    enabled: !!token && !!projectId,
  })
}

export function useAddProjectMember(projectId?: string) {
  const token = useAuthStore((s) => s.token)
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (body: { userId: string; permission: ProjectPermission; songScope: SongScope; songIds?: string[] }) =>
      apiClient(token)<ProjectMember>(`/projects/${projectId}/members`, {
        method: 'POST',
        body: JSON.stringify(body),
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['project-members', projectId] }),
  })
}
```

- [ ] **Step 3: Add project song hooks**

Modify `apps/web/src/features/songs/useSongs.ts`:

```ts
export function useProjectSongs(projectId?: string) {
  const token = useAuthStore((s) => s.token)
  return useQuery<Song[]>({
    queryKey: ['project-songs', projectId],
    queryFn: () => apiClient(token)<Song[]>(`/projects/${projectId}/songs`),
    enabled: !!token && !!projectId,
  })
}

export function useCreateProjectSong(projectId?: string) {
  const token = useAuthStore((s) => s.token)
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (body: CreateProjectSongInput) =>
      apiClient(token)<Song>(`/projects/${projectId}/songs`, {
        method: 'POST',
        body: JSON.stringify(body),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['project-songs', projectId] })
      qc.invalidateQueries({ queryKey: ['projects'] })
    },
  })
}
```

Import `CreateProjectSongInput` from shared.

- [ ] **Step 4: Verify web build**

Run:

```bash
npm run build
```

Expected:

```txt
Tasks: 3 successful
```

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/features/projects apps/web/src/features/project-members apps/web/src/features/songs/useSongs.ts
git commit -m "feat(web): add project data hooks"
```

---

## Task 9: Project Dashboard and Project Page

**Files:**
- Create: `apps/web/src/features/projects/ProjectDashboardPage.tsx`
- Create: `apps/web/src/features/projects/ProjectCard.tsx`
- Create: `apps/web/src/features/projects/ProjectPage.tsx`
- Create: `apps/web/src/features/songs/SongTable.tsx`
- Modify: `apps/web/src/App.tsx`
- Modify: `apps/web/src/pages/SongListPage.tsx`

- [ ] **Step 1: Create ProjectCard**

Create `apps/web/src/features/projects/ProjectCard.tsx`:

```tsx
import { useNavigate } from 'react-router-dom'
import { timeAgo } from '../../lib/utils'
import type { Project } from '@ama-midi/shared'

export function ProjectCard({ project }: { project: Project }) {
  const navigate = useNavigate()
  return (
    <button
      type="button"
      onClick={() => navigate(`/projects/${project.id}`)}
      className="text-left rounded-lg border border-shell-border bg-shell-surface p-4 hover:bg-shell-bg transition-colors"
    >
      <div className="flex items-start justify-between gap-3">
        <h3 className="text-sm font-semibold text-shell-text truncate">{project.name}</h3>
        <span className="text-[10px] uppercase tracking-wide text-shell-muted">{project.status}</span>
      </div>
      {project.description && (
        <p className="mt-2 line-clamp-2 text-xs text-shell-muted">{project.description}</p>
      )}
      <div className="mt-4 flex items-center justify-between text-xs text-shell-muted">
        <span>{project.songCount} songs</span>
        <span>{project.memberCount} members</span>
        <span>{timeAgo(project.updatedAt)}</span>
      </div>
    </button>
  )
}
```

- [ ] **Step 2: Create dashboard**

Create `apps/web/src/features/projects/ProjectDashboardPage.tsx`:

```tsx
import { useState } from 'react'
import { AppShell } from '../../components/layout'
import { Button, Input, Modal } from '../../components/ui'
import { useProjects, useCreateProject } from './useProjects'
import { ProjectCard } from './ProjectCard'

export function ProjectDashboardPage() {
  const { data: projects = [], isLoading } = useProjects()
  const createProject = useCreateProject()
  const [open, setOpen] = useState(false)
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')

  function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim()) return
    createProject.mutate(
      { name: name.trim(), description: description.trim() || undefined },
      { onSuccess: () => { setOpen(false); setName(''); setDescription('') } },
    )
  }

  return (
    <AppShell>
      <div className="mb-6 flex items-end justify-between gap-4">
        <div>
          <p className="text-sm text-shell-muted">Production workspace</p>
          <h1 className="mt-1 text-2xl font-semibold text-shell-text">My Projects</h1>
        </div>
        <Button size="sm" rounded onClick={() => setOpen(true)}>+ New Project</Button>
      </div>

      {isLoading ? (
        <p className="text-sm text-shell-muted">Loading projects...</p>
      ) : projects.length === 0 ? (
        <div className="rounded-lg border border-shell-border bg-shell-surface p-6">
          <h2 className="text-sm font-semibold text-shell-text">No projects yet</h2>
          <p className="mt-2 text-sm text-shell-muted">Create a project before adding songs and members.</p>
        </div>
      ) : (
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {projects.map((project) => <ProjectCard key={project.id} project={project} />)}
        </div>
      )}

      {open && (
        <Modal.Root open onOpenChange={setOpen}>
          <Modal.Content>
            <Modal.Header onClose={() => setOpen(false)}>New Project</Modal.Header>
            <Modal.Body>
              <form id="project-form" onSubmit={submit} className="space-y-3">
                <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Project name" autoFocus />
                <Input value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Description" />
              </form>
            </Modal.Body>
            <Modal.Footer>
              <Button type="submit" form="project-form" disabled={!name.trim()} loading={createProject.isPending}>Create</Button>
            </Modal.Footer>
          </Modal.Content>
        </Modal.Root>
      )}
    </AppShell>
  )
}
```

- [ ] **Step 3: Create SongTable**

Create `apps/web/src/features/songs/SongTable.tsx`:

```tsx
import { useNavigate } from 'react-router-dom'
import { timeAgo } from '../../lib/utils'
import type { Song } from '@ama-midi/shared'

export function SongTable({ projectId, songs }: { projectId: string; songs: Song[] }) {
  const navigate = useNavigate()
  return (
    <div className="overflow-hidden rounded-lg border border-shell-border bg-shell-surface">
      <table className="w-full text-sm">
        <thead className="bg-shell-bg text-xs uppercase text-shell-muted">
          <tr>
            <th className="px-3 py-2 text-left">Song</th>
            <th className="px-3 py-2 text-left">Status</th>
            <th className="px-3 py-2 text-left">Category</th>
            <th className="px-3 py-2 text-left">Difficulty</th>
            <th className="px-3 py-2 text-left">Owner</th>
            <th className="px-3 py-2 text-right">Updated</th>
          </tr>
        </thead>
        <tbody>
          {songs.map((song) => (
            <tr
              key={song.id}
              className="cursor-pointer border-t border-shell-border hover:bg-shell-bg"
              onClick={() => navigate(`/projects/${projectId}/songs/${song.id}`)}
            >
              <td className="px-3 py-2 font-medium text-shell-text">{song.name}</td>
              <td className="px-3 py-2 text-shell-muted">{song.status}</td>
              <td className="px-3 py-2 text-shell-muted">{song.category}</td>
              <td className="px-3 py-2 text-shell-muted">{song.difficulty}</td>
              <td className="px-3 py-2 text-shell-muted">{song.assignedComposerName ?? song.creatorName}</td>
              <td className="px-3 py-2 text-right text-shell-muted">{timeAgo(song.updatedAt)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
```

- [ ] **Step 4: Create ProjectPage**

Create `apps/web/src/features/projects/ProjectPage.tsx`:

```tsx
import { useState } from 'react'
import { useParams } from 'react-router-dom'
import { AppShell } from '../../components/layout'
import { Button, Tabs } from '../../components/ui'
import { useProject } from './useProjects'
import { useProjectSongs } from '../songs/useSongs'
import { SongTable } from '../songs/SongTable'
import { CreateSongWizard } from '../songs/CreateSongWizard'
import { MemberTable } from '../project-members/MemberTable'

export function ProjectPage() {
  const { projectId } = useParams<{ projectId: string }>()
  const { data: project } = useProject(projectId)
  const { data: songs = [] } = useProjectSongs(projectId)
  const [wizardOpen, setWizardOpen] = useState(false)

  if (!projectId) return null

  return (
    <AppShell>
      <div className="mb-5 flex items-end justify-between gap-4">
        <div>
          <p className="text-sm text-shell-muted">{project?.status ?? 'ACTIVE'}</p>
          <h1 className="mt-1 text-2xl font-semibold text-shell-text">{project?.name ?? 'Project'}</h1>
        </div>
        <Button size="sm" rounded onClick={() => setWizardOpen(true)}>+ New Song</Button>
      </div>

      <Tabs.Root defaultValue="songs">
        <Tabs.List>
          <Tabs.Trigger value="songs">songs</Tabs.Trigger>
          <Tabs.Trigger value="members">members</Tabs.Trigger>
          <Tabs.Trigger value="settings">settings</Tabs.Trigger>
        </Tabs.List>
        <Tabs.Content value="songs" className="pt-4">
          <SongTable projectId={projectId} songs={songs} />
        </Tabs.Content>
        <Tabs.Content value="members" className="pt-4">
          <MemberTable projectId={projectId} songs={songs} />
        </Tabs.Content>
        <Tabs.Content value="settings" className="pt-4">
          <div className="rounded-lg border border-shell-border bg-shell-surface p-4 text-sm text-shell-muted">
            Project settings are managed by project admins.
          </div>
        </Tabs.Content>
      </Tabs.Root>

      {wizardOpen && <CreateSongWizard projectId={projectId} songs={songs} onClose={() => setWizardOpen(false)} />}
    </AppShell>
  )
}
```

- [ ] **Step 5: Wire routes**

In `apps/web/src/App.tsx`, add routes:

```tsx
<Route path="/projects" element={<ProjectDashboardPage />} />
<Route path="/projects/:projectId" element={<ProjectPage />} />
<Route path="/projects/:projectId/songs/:songId" element={<EditorPage />} />
```

Make `/` render `ProjectDashboardPage` instead of `SongListPage`. Keep `/songs/:songId` for compatibility until Task 11.

- [ ] **Step 6: Verify web build**

Run:

```bash
npm run build
```

Expected:

```txt
Tasks: 3 successful
```

- [ ] **Step 7: Commit**

```bash
git add apps/web/src/features/projects apps/web/src/features/songs/SongTable.tsx apps/web/src/App.tsx apps/web/src/pages/SongListPage.tsx
git commit -m "feat(web): add project dashboard and project page"
```

---

## Task 10: Member Management UI

**Files:**
- Create: `apps/web/src/features/project-members/MemberTable.tsx`
- Create: `apps/web/src/features/project-members/MemberAccessModal.tsx`
- Modify: `apps/web/src/features/projects/ProjectPage.tsx`

- [ ] **Step 1: Create MemberAccessModal**

Create `apps/web/src/features/project-members/MemberAccessModal.tsx`:

```tsx
import { useMemo, useState } from 'react'
import { Button, Modal, ToggleGroup } from '../../components/ui'
import { useAddProjectMember } from './useProjectMembers'
import type { ProjectPermission, Song, SongScope } from '@ama-midi/shared'

const PERMISSIONS = [
  { value: 'READ', label: 'Read' },
  { value: 'EDIT', label: 'Edit' },
  { value: 'ADMIN', label: 'Admin' },
]

const SCOPES = [
  { value: 'ALL_SONGS', label: 'All' },
  { value: 'SELECTED_SONGS', label: 'Selected' },
  { value: 'NO_SONGS', label: 'None' },
]

export function MemberAccessModal({
  projectId,
  songs,
  onClose,
}: {
  projectId: string
  songs: Song[]
  onClose: () => void
}) {
  const addMember = useAddProjectMember(projectId)
  const [userId, setUserId] = useState('')
  const [permission, setPermission] = useState<ProjectPermission>('READ')
  const [songScope, setSongScope] = useState<SongScope>('NO_SONGS')
  const [songIds, setSongIds] = useState<string[]>([])

  const valid = useMemo(() => {
    if (!userId.trim()) return false
    if (songScope === 'SELECTED_SONGS') return songIds.length > 0
    return true
  }, [songIds.length, songScope, userId])

  function toggleSong(songId: string) {
    setSongIds((prev) => prev.includes(songId) ? prev.filter((id) => id !== songId) : [...prev, songId])
  }

  function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!valid) return
    addMember.mutate(
      { userId: userId.trim(), permission, songScope, songIds: songScope === 'SELECTED_SONGS' ? songIds : undefined },
      { onSuccess: onClose },
    )
  }

  return (
    <Modal.Root open onOpenChange={(open) => !open && onClose()}>
      <Modal.Content>
        <Modal.Header onClose={onClose}>Add Project Member</Modal.Header>
        <Modal.Body>
          <form id="member-access-form" onSubmit={submit} className="space-y-4">
            <input
              value={userId}
              onChange={(e) => setUserId(e.target.value)}
              placeholder="User id"
              className="w-full rounded-md border border-shell-border bg-shell-bg px-3 py-2 text-sm text-shell-text"
            />
            <div className="space-y-1.5">
              <span className="text-xs text-shell-muted">Permission</span>
              <ToggleGroup items={PERMISSIONS} value={permission} onValueChange={(v) => setPermission(v as ProjectPermission)} />
            </div>
            <div className="space-y-1.5">
              <span className="text-xs text-shell-muted">Song scope</span>
              <ToggleGroup items={SCOPES} value={songScope} onValueChange={(v) => setSongScope(v as SongScope)} />
            </div>
            {songScope === 'SELECTED_SONGS' && (
              <div className="max-h-56 space-y-1 overflow-y-auto rounded-md border border-shell-border p-2">
                {songs.map((song) => (
                  <label key={song.id} className="flex items-center gap-2 text-sm text-shell-text">
                    <input type="checkbox" checked={songIds.includes(song.id)} onChange={() => toggleSong(song.id)} />
                    {song.name}
                  </label>
                ))}
              </div>
            )}
          </form>
        </Modal.Body>
        <Modal.Footer>
          <Button type="submit" form="member-access-form" disabled={!valid} loading={addMember.isPending}>Add</Button>
          <Button type="button" variant="secondary" onClick={onClose}>Cancel</Button>
        </Modal.Footer>
      </Modal.Content>
    </Modal.Root>
  )
}
```

- [ ] **Step 2: Create MemberTable**

Create `apps/web/src/features/project-members/MemberTable.tsx`:

```tsx
import { useState } from 'react'
import { Button } from '../../components/ui'
import { useProjectMembers } from './useProjectMembers'
import { MemberAccessModal } from './MemberAccessModal'
import type { Song } from '@ama-midi/shared'

export function MemberTable({ projectId, songs }: { projectId: string; songs: Song[] }) {
  const { data: members = [] } = useProjectMembers(projectId)
  const [open, setOpen] = useState(false)

  return (
    <div className="space-y-3">
      <div className="flex justify-end">
        <Button size="sm" rounded onClick={() => setOpen(true)}>Add Member</Button>
      </div>
      <div className="overflow-hidden rounded-lg border border-shell-border bg-shell-surface">
        <table className="w-full text-sm">
          <thead className="bg-shell-bg text-xs uppercase text-shell-muted">
            <tr>
              <th className="px-3 py-2 text-left">Member</th>
              <th className="px-3 py-2 text-left">Permission</th>
              <th className="px-3 py-2 text-left">Scope</th>
              <th className="px-3 py-2 text-right">Selected</th>
            </tr>
          </thead>
          <tbody>
            {members.map((member) => (
              <tr key={member.id} className="border-t border-shell-border">
                <td className="px-3 py-2 text-shell-text">{member.userName}</td>
                <td className="px-3 py-2 text-shell-muted">{member.permission}</td>
                <td className="px-3 py-2 text-shell-muted">{member.songScope}</td>
                <td className="px-3 py-2 text-right text-shell-muted">{member.selectedSongIds.length}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {open && <MemberAccessModal projectId={projectId} songs={songs} onClose={() => setOpen(false)} />}
    </div>
  )
}
```

- [ ] **Step 3: Verify selected scope behavior manually**

Run dev server:

```bash
npm run dev
```

Expected:

```txt
Web app starts.
Add Member modal disables Add when Selected is chosen and no songs are selected.
```

- [ ] **Step 4: Verify build**

Run:

```bash
npm run build
```

Expected:

```txt
Tasks: 3 successful
```

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/features/project-members apps/web/src/features/projects/ProjectPage.tsx
git commit -m "feat(web): add project member access UI"
```

---

## Task 11: Create Song Wizard

**Files:**
- Create: `apps/web/src/features/songs/CreateSongWizard.tsx`
- Create: `apps/web/src/features/songs/ImportSongStep.tsx`
- Modify: `apps/web/src/features/projects/ProjectPage.tsx`

- [ ] **Step 1: Create ImportSongStep**

Create `apps/web/src/features/songs/ImportSongStep.tsx`:

```tsx
import type { ImportSongOptions, Song } from '@ama-midi/shared'

export function ImportSongStep({
  songs,
  value,
  onChange,
}: {
  songs: Song[]
  value: ImportSongOptions
  onChange: (value: ImportSongOptions) => void
}) {
  function patch(next: Partial<ImportSongOptions>) {
    onChange({ ...value, ...next })
  }

  return (
    <div className="space-y-3">
      <select
        value={value.sourceSongId}
        onChange={(e) => patch({ sourceSongId: e.target.value })}
        className="w-full rounded-md border border-shell-border bg-shell-bg px-3 py-2 text-sm text-shell-text"
      >
        <option value="">Choose source song</option>
        {songs.map((song) => <option key={song.id} value={song.id}>{song.name}</option>)}
      </select>

      {[
        ['copySettings', 'Settings'],
        ['copySections', 'Sections'],
        ['copyPatterns', 'Patterns'],
        ['copyNotes', 'Notes'],
      ].map(([key, label]) => (
        <label key={key} className="flex items-center gap-2 text-sm text-shell-text">
          <input
            type="checkbox"
            checked={Boolean(value[key as keyof ImportSongOptions])}
            onChange={(e) => patch({ [key]: e.target.checked } as Partial<ImportSongOptions>)}
          />
          {label}
        </label>
      ))}

      {value.copyNotes && (
        <p className="rounded-md border border-warning/40 bg-warning/10 px-3 py-2 text-xs text-warning">
          This creates an independent copy of the source chart. Future edits will not sync with the original song.
        </p>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Create CreateSongWizard**

Create `apps/web/src/features/songs/CreateSongWizard.tsx`:

```tsx
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Button, Input, Modal, ToggleGroup } from '../../components/ui'
import { useCreateProjectSong } from './useSongs'
import { ImportSongStep } from './ImportSongStep'
import type { CreateProjectSongInput, ImportSongOptions, Song, SongCategory, SongDifficulty } from '@ama-midi/shared'

type Step = 'start' | 'setup' | 'assignment' | 'review'
type StartType = 'BLANK' | 'TEMPLATE' | 'IMPORT'

const STARTS = [
  { value: 'BLANK', label: 'Blank' },
  { value: 'TEMPLATE', label: 'Template' },
  { value: 'IMPORT', label: 'Import' },
]

const CATEGORIES = [
  { value: 'MAIN_CAMPAIGN', label: 'Campaign' },
  { value: 'EVENT', label: 'Event' },
  { value: 'TUTORIAL', label: 'Tutorial' },
  { value: 'LIVE_OPS', label: 'Live Ops' },
  { value: 'PROTOTYPE', label: 'Prototype' },
  { value: 'QA_TEST', label: 'QA' },
  { value: 'TEMPLATE', label: 'Template' },
  { value: 'REFERENCE', label: 'Reference' },
]

const DIFFICULTIES = [
  { value: 'EASY', label: 'Easy' },
  { value: 'NORMAL', label: 'Normal' },
  { value: 'HARD', label: 'Hard' },
  { value: 'EXPERT', label: 'Expert' },
  { value: 'MASTER', label: 'Master' },
]

export function CreateSongWizard({
  projectId,
  songs,
  onClose,
}: {
  projectId: string
  songs: Song[]
  onClose: () => void
}) {
  const navigate = useNavigate()
  const createSong = useCreateProjectSong(projectId)
  const [step, setStep] = useState<Step>('start')
  const [startType, setStartType] = useState<StartType>('BLANK')
  const [name, setName] = useState('')
  const [category, setCategory] = useState<SongCategory>('PROTOTYPE')
  const [difficulty, setDifficulty] = useState<SongDifficulty>('NORMAL')
  const [bpm, setBpm] = useState(120)
  const [timeSignature, setTimeSignature] = useState('4/4')
  const [assignedComposerId, setAssignedComposerId] = useState('')
  const [assignedQaId, setAssignedQaId] = useState('')
  const [importOptions, setImportOptions] = useState<ImportSongOptions>({
    sourceSongId: '',
    copySettings: true,
    copySections: true,
    copyPatterns: false,
    copyNotes: false,
  })

  const setupValid = name.trim() && bpm >= 40 && bpm <= 300
  const importValid = startType !== 'IMPORT' || importOptions.sourceSongId
  const canCreate = setupValid && importValid

  function create(openEditor: boolean) {
    if (!canCreate) return
    const body: CreateProjectSongInput = {
      name: name.trim(),
      category,
      difficulty,
      bpm,
      timeSignature,
      assignedComposerId: assignedComposerId || null,
      assignedQaId: assignedQaId || null,
      startType,
      import: startType === 'IMPORT' ? importOptions : undefined,
    }
    createSong.mutate(body, {
      onSuccess: (song) => {
        onClose()
        if (openEditor) navigate(`/projects/${projectId}/songs/${song.id}`)
      },
    })
  }

  return (
    <Modal.Root open onOpenChange={(open) => !open && onClose()}>
      <Modal.Content>
        <Modal.Header onClose={onClose}>Create Song</Modal.Header>
        <Modal.Body>
          <div className="mb-4 flex gap-2 text-xs text-shell-muted">
            {['start', 'setup', 'assignment', 'review'].map((item) => (
              <span key={item} className={step === item ? 'text-shell-text' : ''}>{item}</span>
            ))}
          </div>

          {step === 'start' && (
            <div className="space-y-3">
              <ToggleGroup items={STARTS} value={startType} onValueChange={(v) => setStartType(v as StartType)} />
              {startType === 'IMPORT' && (
                <ImportSongStep songs={songs} value={importOptions} onChange={setImportOptions} />
              )}
            </div>
          )}

          {step === 'setup' && (
            <div className="space-y-3">
              <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Song name" autoFocus />
              <ToggleGroup items={CATEGORIES} value={category} onValueChange={(v) => setCategory(v as SongCategory)} />
              <ToggleGroup items={DIFFICULTIES} value={difficulty} onValueChange={(v) => setDifficulty(v as SongDifficulty)} />
              <input type="number" min={40} max={300} value={bpm} onChange={(e) => setBpm(Number(e.target.value))} className="w-full rounded-md border border-shell-border bg-shell-bg px-3 py-2 text-sm text-shell-text" />
              <select value={timeSignature} onChange={(e) => setTimeSignature(e.target.value)} className="w-full rounded-md border border-shell-border bg-shell-bg px-3 py-2 text-sm text-shell-text">
                <option value="4/4">4/4</option>
                <option value="3/4">3/4</option>
                <option value="6/8">6/8</option>
              </select>
            </div>
          )}

          {step === 'assignment' && (
            <div className="space-y-3">
              <Input value={assignedComposerId} onChange={(e) => setAssignedComposerId(e.target.value)} placeholder="Composer user id" />
              <Input value={assignedQaId} onChange={(e) => setAssignedQaId(e.target.value)} placeholder="QA user id" />
            </div>
          )}

          {step === 'review' && (
            <dl className="space-y-2 text-sm">
              <div className="flex justify-between"><dt className="text-shell-muted">Start</dt><dd className="text-shell-text">{startType}</dd></div>
              <div className="flex justify-between"><dt className="text-shell-muted">Name</dt><dd className="text-shell-text">{name}</dd></div>
              <div className="flex justify-between"><dt className="text-shell-muted">Category</dt><dd className="text-shell-text">{category}</dd></div>
              <div className="flex justify-between"><dt className="text-shell-muted">Difficulty</dt><dd className="text-shell-text">{difficulty}</dd></div>
              <div className="flex justify-between"><dt className="text-shell-muted">BPM</dt><dd className="text-shell-text">{bpm}</dd></div>
              <div className="flex justify-between"><dt className="text-shell-muted">Time</dt><dd className="text-shell-text">{timeSignature}</dd></div>
            </dl>
          )}
        </Modal.Body>
        <Modal.Footer>
          {step !== 'start' && <Button variant="secondary" onClick={() => setStep(step === 'setup' ? 'start' : step === 'assignment' ? 'setup' : 'assignment')}>Back</Button>}
          {step !== 'review' ? (
            <Button onClick={() => setStep(step === 'start' ? 'setup' : step === 'setup' ? 'assignment' : 'review')} disabled={step === 'start' && !importValid}>Next</Button>
          ) : (
            <>
              <Button variant="secondary" onClick={() => create(false)} disabled={!canCreate} loading={createSong.isPending}>Create</Button>
              <Button onClick={() => create(true)} disabled={!canCreate} loading={createSong.isPending}>Create and Open</Button>
            </>
          )}
        </Modal.Footer>
      </Modal.Content>
    </Modal.Root>
  )
}
```

- [ ] **Step 3: Remove inline song-name creation**

In `apps/web/src/pages/SongListPage.tsx`, remove the `newName` state, inline `<form>`, and direct `useCreateSong` usage. Replace with a project dashboard entry or redirect to `/projects`.

- [ ] **Step 4: Verify build**

Run:

```bash
npm run build
```

Expected:

```txt
Tasks: 3 successful
```

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/features/songs/CreateSongWizard.tsx apps/web/src/features/songs/ImportSongStep.tsx apps/web/src/pages/SongListPage.tsx
git commit -m "feat(web): add create song wizard"
```

---

## Task 12: Project-Aware Editor Routes and Hooks

**Files:**
- Modify: `apps/web/src/App.tsx`
- Modify: `apps/web/src/pages/EditorPage.tsx`
- Modify: `apps/web/src/features/notes/useNotes.ts`
- Modify: `apps/web/src/features/sections/useSections.ts`
- Modify: `apps/web/src/features/patterns/usePatterns.ts`
- Modify: `apps/web/src/features/collaboration/useSocket.ts`

- [ ] **Step 1: Update editor route params**

In `EditorPage.tsx`, read:

```ts
const { projectId, songId } = useParams<{ projectId?: string; songId: string }>()
```

When navigating back:

```ts
onBack={() => navigate(projectId ? `/projects/${projectId}` : '/projects')}
```

- [ ] **Step 2: Update notes hook signatures**

In `useNotes.ts`, keep old signature compatible but prefer project path:

```ts
function songBase(projectId: string | undefined, songId: string) {
  return projectId ? `/projects/${projectId}/songs/${songId}` : `/songs/${songId}`
}
```

Use:

```ts
apiClient(token)<Note[]>(`${songBase(projectId, songId)}/notes${qs ? `?${qs}` : ''}`)
```

Update create/update/delete similarly.

- [ ] **Step 3: Update sections and patterns hooks**

Apply the same `songBase(projectId, songId)` helper to section and pattern endpoints.

- [ ] **Step 4: Keep compatibility route**

In `App.tsx`, keep:

```tsx
<Route path="/songs/:songId" element={<EditorPage />} />
```

and add:

```tsx
<Route path="/projects/:projectId/songs/:songId" element={<EditorPage />} />
```

- [ ] **Step 5: Verify build**

Run:

```bash
npm run build
```

Expected:

```txt
Tasks: 3 successful
```

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/App.tsx apps/web/src/pages/EditorPage.tsx apps/web/src/features/notes apps/web/src/features/sections apps/web/src/features/patterns apps/web/src/features/collaboration
git commit -m "feat(web): route editor through projects"
```

---

## Task 13: Compatibility and Data Migration Polish

**Files:**
- Modify: `apps/api/src/modules/songs/songs.controller.ts`
- Modify: `apps/api/src/modules/songs/songs.service.ts`
- Modify: `apps/web/src/pages/SongListPage.tsx`

- [ ] **Step 1: Make `/songs/:id` return projectId**

Ensure `SongsService.findOne` maps `projectId` and all new required shared fields.

Expected returned shape includes:

```ts
{
  projectId: s.projectId,
  category: s.category,
  status: s.status,
  difficulty: s.difficulty,
}
```

- [ ] **Step 2: Add web redirect for compatibility**

If `/songs/:songId` is opened and loaded song includes `projectId`, navigate to:

```ts
navigate(`/projects/${song.projectId}/songs/${song.id}`, { replace: true })
```

Do this only after the song query succeeds, so old links still work.

- [ ] **Step 3: Verify old links**

Run dev server:

```bash
npm run dev
```

Expected:

```txt
Opening /songs/:songId redirects to /projects/:projectId/songs/:songId.
```

- [ ] **Step 4: Commit**

```bash
git add apps/api/src/modules/songs apps/web/src/pages/SongListPage.tsx apps/web/src/pages/EditorPage.tsx
git commit -m "feat: add project route compatibility"
```

---

## Task 14: Realtime Permission Change Events

**Files:**
- Modify: `packages/shared/src/events.ts`
- Modify: `apps/api/src/modules/project-members/project-members.service.ts`
- Modify: `apps/api/src/modules/realtime/realtime.listener.ts`
- Modify: `apps/web/src/features/collaboration/useSocket.ts`

- [ ] **Step 1: Add event names**

In `packages/shared/src/events.ts`, add:

```ts
export const PROJECT_MEMBER_UPDATED = 'project.member.updated'
export const PROJECT_MEMBER_REMOVED = 'project.member.removed'
export const PROJECT_SONG_ACCESS_UPDATED = 'project.song.access.updated'
```

- [ ] **Step 2: Emit from member service**

Inject `EventEmitter2` into `ProjectMembersService`:

```ts
constructor(
  private readonly prisma: PrismaService,
  private readonly access: ProjectAccessService,
  private readonly emitter: EventEmitter2,
) {}
```

After add/update/remove:

```ts
this.emitter.emit('project.member.updated', { projectId, memberId: row.id })
```

For remove:

```ts
this.emitter.emit('project.member.removed', { projectId, memberId })
```

- [ ] **Step 3: Bridge realtime listener**

In `realtime.listener.ts`, add listeners for project member events and broadcast to project room:

```ts
@OnEvent('project.member.updated')
handleProjectMemberUpdated(payload: { projectId: string; memberId: string }) {
  this.gateway.server.to(`project:${payload.projectId}`).emit('project.member.updated', payload)
}
```

Use the existing gateway access pattern already present in the file.

- [ ] **Step 4: Invalidate frontend queries**

In socket hook, listen for:

```ts
socket.on('project.member.updated', () => {
  queryClient.invalidateQueries({ queryKey: ['project-members', projectId] })
  queryClient.invalidateQueries({ queryKey: ['project-songs', projectId] })
})
```

- [ ] **Step 5: Verify build**

Run:

```bash
npm run build
```

Expected:

```txt
Tasks: 3 successful
```

- [ ] **Step 6: Commit**

```bash
git add packages/shared/src/events.ts apps/api/src/modules/project-members apps/api/src/modules/realtime apps/web/src/features/collaboration
git commit -m "feat: broadcast project access changes"
```

---

## Task 15: Final Verification

**Files:**
- All files touched in prior tasks.

- [ ] **Step 1: Run API tests**

Run:

```bash
cd apps/api && pnpm test
```

Expected:

```txt
All Jest suites pass.
```

- [ ] **Step 2: Run full build**

Run:

```bash
npm run build
```

Expected:

```txt
Tasks: 3 successful, 3 total
```

- [ ] **Step 3: Manual smoke test**

Run:

```bash
npm run dev
```

Verify in browser:

```txt
/projects loads.
New project can be created.
Project page opens.
New Song opens wizard.
Blank song can be created and opened.
Project Members tab opens Add Member modal.
Selected song scope requires selecting at least one song.
Editor opens through /projects/:projectId/songs/:songId.
Read-only/edit restrictions match project access.
```

- [ ] **Step 4: Review git diff**

Run:

```bash
git status --short
git diff --stat
```

Expected:

```txt
Only project song management files are modified.
No unrelated generated noise except intended Prisma migration/client artifacts.
```

- [ ] **Step 5: Final commit if needed**

If verification required fixes:

```bash
git add <fixed-files>
git commit -m "fix: stabilize project song management flow"
```

---

## Plan Self-Review

Spec coverage:

```txt
Project-owned songs: Tasks 2, 6, 9, 12.
Project member permission and song scope: Tasks 3, 5, 10.
Create song wizard: Tasks 6, 11.
Blank/template/import starts: Tasks 6, 11.
Import copy, not sharing: Task 6.
Project dashboard and page: Task 9.
Editor access through project permissions: Tasks 7, 12.
Compatibility from old song routes: Task 13.
Realtime permission changes: Task 14.
Testing and verification: Every implementation task plus Task 15.
```

Every task has concrete files, commands, and expected results.
