# Project-Based Song Management Full Flow (Design Spec)

**Date:** 2026-05-23
**Goal:** Redesign AMA-MIDI around game-company production workflows: projects own songs, project members have scoped permissions, and song creation supports blank, template, and import-based starts.
**Scope:** Full target design, not just MVP.

---

## Decisions Locked in Brainstorm

| Topic | Decision |
|---|---|
| Song ownership | A song belongs to exactly one project. |
| Reuse across projects | Reuse is done by creating a new song and importing/copying from an existing source song. |
| Shared songs across projects | Not supported in the target model. This avoids cross-project ownership, permission, QA, and status conflicts. |
| Permission unit | Project membership is the source of truth. Song access is a scope inside project membership. |
| Add-member requirements | Admin must choose both permission and song scope when adding a user to a project. |
| Dynamic full access | `All songs now and future` includes current songs and future songs created in the project. |
| Create entry point | `+ New Song` opens a create-song wizard OR a quick-create shortcut. The inline song-name input is removed. |
| Composer flow state | The project layer must not add friction to the creative path. Quick-create and recent-songs shortcuts ensure composers reach the editor in 2 clicks or fewer. |

---

## Product Model

AMA-MIDI is a shared workspace where music composition and game production happen simultaneously. It bridges composers, game developers, product owners, and QA engineers around the same data with different lenses.

The system is single-tenant: one Amanotes organization is implied. Multi-tenancy is not in scope.

```txt
[Amanotes — single tenant]
→ Project (production workspace)
  → ProjectMember (access + scope)
  → Song (gameplay chart asset)
    → Version (future: song snapshots)
    → Notes / Sections / Patterns / Validation / History
```

The project is the production workspace. It contains songs, members, assignment, and workflow state.

The song is a project-owned gameplay chart asset. It contains musical/gameplay data and can be edited in the existing editor.

If another project needs similar content, the user creates a new song in that project and imports settings, structure, patterns, or notes from the source song. The new song is independent after creation.

---

## Per-Persona Experience

The original product insight: four users need one product with different presentations. The project layer must serve all four, not just admins.

### Composer

Primary job: place notes quickly in a flow state.

```txt
Login → Dashboard → Recently Edited Songs → click → Editor (2 clicks)
Login → Dashboard → My Projects → project → + Quick Create → Editor (3 clicks)
```

The project layer is invisible during active composition. The composer sees:
- Recent songs across projects on the dashboard (jump straight to editor)
- Quick-create button that skips the wizard with sensible defaults
- Project context only in the editor breadcrumb ("Back to project")
- AI Suggest button works identically regardless of project context

The composer must never feel the project layer is between them and their notes.

### Game Developer

Primary job: verify timing alignment and inspect note data for game integration.

```txt
Login → Dashboard → My Projects → project → song table (filtered by status: Approved) → Editor (Developer View)
```

The project layer helps developers by:
- Filtering songs by status (only look at APPROVED or PUBLISHED songs)
- Developer View in editor shows raw IDs, precise timestamps, track data on hover
- Read-only access by default (cannot accidentally edit production charts)
- Future: export endpoint for game-engine-ready JSON

### Product Owner / Producer

Primary job: review song structure, approve direction, track production progress.

```txt
Login → Dashboard → Needs My Review → click → Editor (read-only with status controls)
Login → Dashboard → My Projects → project overview (song count, status breakdown, member count)
```

The project layer helps producers by:
- Project dashboard with production health at a glance (% drafted, % approved, % published)
- "Needs My Review" shortcut on home dashboard
- Song table with status/category/assignment columns for production tracking
- Status transition controls visible to project admins (move to APPROVED, etc.)

### QA Engineer

Primary job: catch boundary violations, duplicates, and timing errors before release.

```txt
Login → Dashboard → Needs My Review (QA-assigned songs in IN_REVIEW status) → Editor (QA View)
```

The project layer helps QA by:
- "Needs My Review" automatically surfaces songs assigned to them as QA
- QA View in editor highlights boundary notes, density warnings, validation errors
- Validation tab in right panel shows project-wide validation summary
- Status can be moved to NEEDS_FIX with a note explaining the issue

---

## User Roles and Permissions

### Global Roles

Global roles remain useful for platform-level control.

| Role | Purpose |
|---|---|
| `ADMIN` | Can manage users, all projects, system settings, and recovery workflows. |
| `COMPOSER` | Can be assigned to projects and songs as an editor. |
| `VIEWER` | Can access only projects/songs granted through project membership. |

Global role alone does not decide project/song access, except for platform admins.

### Project Permissions

Each project membership has a required permission:

| Permission | Can view scoped songs | Can edit scoped songs | Can manage workflow | Can manage members/settings |
|---|---:|---:|---:|---:|
| `READ` | Yes | No | No | No |
| `EDIT` | Yes | Yes | Limited to assigned/accessible songs | No |
| `ADMIN` | Yes | Yes | Yes | Yes |

### Song Scope

Each project membership also has a required song scope:

| Scope | Behavior |
|---|---|
| `ALL_SONGS` | Access to all current and future songs in the project. |
| `SELECTED_SONGS` | Access only to explicitly selected songs in the project. |

`ALL_SONGS` is dynamic. When new songs are created in the project, these members automatically gain access.

`SELECTED_SONGS` is explicit. Admin must choose one or more songs when assigning access.

**Implementation phases:**

- **Phase 1 (MVP):** All project members get `ALL_SONGS`. The song scope column exists in the DB but defaults to `ALL_SONGS` for every membership. This keeps the permission model simple while the project structure matures.
- **Phase 2 (Full):** Enable `SELECTED_SONGS` in the member management UI. Admins can then restrict access per song.

This phasing avoids premature complexity. The `NO_SONGS` scope from earlier brainstorming is removed — it adds UI complexity (confirmation dialogs, confusing empty states) without a clear production use case. If a user shouldn't access any songs yet, the admin simply does not add them to the project until work is ready.

### Access Rules

```txt
Can view project =
  user is platform ADMIN
  OR user is a project member

Can view song =
  user is platform ADMIN
  OR (
    user is a member of song.projectId
    AND membership permission is READ, EDIT, or ADMIN
    AND song is inside membership song scope
  )

Can edit song =
  user is platform ADMIN
  OR (
    user is a member of song.projectId
    AND membership permission is EDIT or ADMIN
    AND song is inside membership song scope
  )

Can manage project members/settings =
  user is platform ADMIN
  OR membership permission is ADMIN
```

### Assignment vs Permission

Assignment is workflow ownership, not access control.

Examples:

```txt
Assigned composer = who should edit the chart.
Assigned QA = who should review the chart.
Permission + song scope = who is allowed to access or modify it.
```

A user can be assigned to a song only if they have access to that song. The UI should prevent invalid assignments.

---

## Project Lifecycle

### Project Status

| Status | Meaning |
|---|---|
| `ACTIVE` | Normal production work. |
| `PAUSED` | Visible, but work is intentionally stopped. |
| `ARCHIVED` | Read-only by default; hidden from active lists. |

### Project Fields

```ts
interface Project {
  id: string
  name: string
  description?: string
  status: 'ACTIVE' | 'PAUSED' | 'ARCHIVED'
  ownerId: string
  createdAt: string
  updatedAt: string
  archivedAt?: string | null
}
```

### Project Page

Project pages are the main production workspace.

Header:

```txt
Project name
Status
Song count
Member count
+ New Song
Manage Members
```

Tabs:

```txt
Songs
Members
Settings
```

Optional future tabs:

```txt
Review
Validation
Activity
```

---

## Song Lifecycle

### Song Status

| Status | Meaning |
|---|---|
| `DRAFT` | Work in progress. |
| `IN_REVIEW` | Composer is asking QA/lead to review. |
| `NEEDS_FIX` | Review failed or validation needs correction. |
| `APPROVED` | Accepted for production. |
| `PUBLISHED` | Used in a released/live build. |
| `ARCHIVED` | Retired or hidden from active work. |

Default status for new songs is `DRAFT`.

### Song Category

Categories describe production purpose, not music genre.

| Category | Meaning |
|---|---|
| `MAIN_CAMPAIGN` | Core game progression content. |
| `EVENT` | Time-limited or seasonal content. |
| `TUTORIAL` | Teaching/onboarding content. |
| `LIVE_OPS` | Ongoing operations content. |
| `PROTOTYPE` | Experimental chart or mechanic test. |
| `QA_TEST` | Validation, regression, or test content. |
| `TEMPLATE` | Intended as a reusable starting point. |
| `REFERENCE` | Reference-only content. |

### Difficulty

| Difficulty | Meaning |
|---|---|
| `EASY` | New players. |
| `NORMAL` | Standard chart. |
| `HARD` | Advanced play. |
| `EXPERT` | High complexity. |
| `MASTER` | Highest difficulty. |

Difficulty is a production label. Validation and heatmap can still compute objective difficulty separately.

### Song Fields

```ts
interface Song {
  id: string
  projectId: string
  name: string
  category: SongCategory
  status: SongStatus
  difficulty: SongDifficulty
  bpm: number
  timeSignature: string
  assignedComposerId?: string | null
  assignedQaId?: string | null
  createdBy: string
  creatorName: string
  creatorAvatarUrl?: string
  noteCount: number
  createdAt: string
  updatedAt: string
  archivedAt?: string | null
}
```

---

## Member Management Flow

### Add Project Member

Entry point:

```txt
Project → Members → Add Member
```

Required fields:

```txt
User
Permission: Read / Edit / Admin
Song scope: All songs now and future / Selected songs only
```

Conditional fields:

```txt
If Selected songs only:
  require at least one song selected from this project
```

Validation:

```txt
User is required.
Permission is required.
Song scope is required.
Selected songs are required and non-empty when scope is Selected songs only.
Only project ADMIN or platform ADMIN can add members.
```

### Edit Project Member

Admins can change:

```txt
Permission
Song scope
Selected song allowlist
```

When changing from `ALL_SONGS` to `SELECTED_SONGS`, admin must choose at least one song.

When changing from `EDIT` to `READ`, user loses edit access immediately.

When removing song access while the user is editing that song, the next mutation should fail with `403`. The UI should detect permission changes via query invalidation or socket event and move the user out of edit mode.

### Remove Member

Removing a member revokes all project and song access through that project.

If the removed member is assigned to songs, those assignments should become unassigned or require reassignment. Recommended behavior:

```txt
Remove member
→ show impacted assignments
→ require either Unassign or Reassign
```

---

## Song List and Project Home

### Global Home

The app home should move from a flat song grid toward a project-first dashboard.

Primary areas:

```txt
My Projects
Needs My Review
Recently Edited Songs
```

`My Projects` shows projects where the user is a member.

`Needs My Review` shows songs where the user is assigned QA and status is `IN_REVIEW` or `NEEDS_FIX`.

`Recently Edited Songs` shows accessible songs across projects.

### Project Song List

Project song list is the main song management surface.

Filters:

```txt
Status
Category
Difficulty
Assigned composer
Assigned QA
Validation state
```

Default views:

```txt
All Songs
My Songs
Needs Review
Needs Fix
Approved
Templates
Archived
```

Song card/table fields:

```txt
Name
Status
Category
Difficulty
Assigned composer
Assigned QA
Validation errors/warnings
Note count
Updated at
```

For dense production work, a table view is preferred. Cards can remain useful for small teams or onboarding.

---

## Create Song Wizard

### Entry Points

**Full wizard** (project admins, batch production):

```txt
Project → Songs → + New Song → Wizard (Start → Setup → Assignment → Review)
```

**Quick-create** (composers in flow state):

```txt
Project → Songs → Quick Create (or keyboard shortcut Cmd+N inside project)
```

Quick-create skips the wizard entirely. It creates a blank DRAFT song with:
- Name: "Untitled" (editable in editor header inline)
- Category: project default or PROTOTYPE
- Difficulty: NORMAL
- BPM: 120
- Time signature: 4/4
- Assigned composer: current user
- No QA assigned

The song opens in the editor immediately. This is the composer's fast path: one click to start charting.

The inline `New song name` input from the old UI is removed, but the quick-create button preserves the same speed.

**From home dashboard:**

If the user starts song creation outside a project, the wizard begins with a project-selection step. If launched inside a project, project is preselected and hidden or shown as read-only.

### Wizard Steps

```txt
1. Start
2. Setup
3. Assignment
4. Review
```

### Step 1: Start

Options:

| Option | Behavior |
|---|---|
| Blank Song | Create an empty chart in the current project. |
| Template | Prefill setup and optionally create starter sections/patterns/notes. |
| Import From Song | Create a new independent song by copying selected data from a readable source song. |

`Import From Song` is copy-based, not sharing-based.

### Step 2: Setup

Fields:

```txt
Name
Category
Difficulty
BPM
Time signature
```

Defaults:

```txt
Category: Prototype or Main Campaign, depending on project default
Difficulty: Normal
BPM: 120
Time signature: 4/4
Status: Draft
```

Validation:

```txt
Name is required.
BPM must be 40–300.
Time signature must be one of supported values.
Category is required.
Difficulty is required.
```

Supported time signatures:

```txt
4/4
3/4
6/8
```

The engine can support more later, but the UI should avoid unsupported combinations until beat-grid behavior is verified.

### Step 3: Assignment

Fields:

```txt
Composer
QA reviewer
Initial status
```

Rules:

```txt
Composer must have EDIT or ADMIN permission for the song.
QA reviewer must have READ, EDIT, or ADMIN permission for the song.
Initial status defaults to Draft.
Only Admin can assign users outside the current user's own workflow if strict assignment is enabled.
```

If no valid assignee exists, the field is optional and shows an empty state:

```txt
No eligible project members yet.
```

### Step 4: Review

Summary:

```txt
Project
Start type
Name
Category
Difficulty
BPM
Time signature
Composer
QA reviewer
Initial status
Import/template options
```

Primary action:

```txt
Create and Open Editor
```

Secondary action:

```txt
Create and Stay in Project
```

Default primary action should open the editor because composers usually create a song to begin charting.

---

## Templates

Templates are production presets. They can start as frontend presets and later become project-owned template songs.

### Built-In Templates

| Template | Category | Difficulty | BPM | Creates |
|---|---|---:|---:|---|
| Empty Draft | `PROTOTYPE` | `NORMAL` | 120 | Settings only |
| Tap Starter | `PROTOTYPE` | `EASY` | 120 | Settings + simple TAP examples |
| Mixed Mechanics | `PROTOTYPE` | `NORMAL` | 128 | TAP/HOLD/SWIPE examples |
| QA Validation | `QA_TEST` | `NORMAL` | 100 | Sections and validation edge-case examples |
| Sectioned Layout | `MAIN_CAMPAIGN` | `NORMAL` | 120 | Intro/Verse/Chorus/Outro sections |
| Pattern Lab | `TEMPLATE` | `NORMAL` | 120 | Reusable note patterns |

### Template Materialization

When a template is selected, the wizard can prefill:

```txt
Category
Difficulty
BPM
Time signature
Sections
Patterns
Starter notes
```

Templates should never silently publish production-ready content. New songs from templates still start as `DRAFT`.

---

## Import From Song

Import creates a new independent song in the current project.

### Source Song Eligibility

A source song is available if:

```txt
user can view the source song
AND source song is not archived, unless "include archived" is enabled
```

Source songs can come from any project the user can read.

### Import Options

Copy groups:

```txt
Settings
- BPM
- time signature

Structure
- sections

Reusable work
- patterns

Gameplay
- notes
```

Default selection:

```txt
Settings + Structure
```

Notes are not selected by default. Copying notes can accidentally create a full duplicate when the user only wanted timing and section structure.

### Import Modes

| Mode | Copies |
|---|---|
| Structure only | Settings + sections |
| Pattern starter | Settings + sections + patterns |
| Full duplicate | Settings + sections + patterns + notes |
| Custom | User-selected copy groups |

### Import Review Warning

If notes are selected:

```txt
This creates an independent copy of the source chart. Future edits will not sync with the original song.
```

### Import Audit

The new song should store:

```txt
sourceSongId
importedBy
importedAt
importOptions
```

This is audit metadata only. It does not create shared ownership.

---

## Editor Access and Behavior

### Opening Editor

When opening `/projects/:projectId/songs/:songId`:

```txt
Validate song.projectId matches route projectId.
Validate user can view song.
If user cannot edit, editor opens read-only.
```

The existing editor uses `useCanEdit`. That hook should eventually check project membership permission and song scope, not only global role.

### Editor Header

The editor header should remain focused on global/session controls:

```txt
Back to project
Song name
Playback
Time/BPM
Suggest
Presence
Theme/help
Panel toggles
```

Editor manipulation and note manipulation belong in the right-side Tools panel, not the header.

### Right Panel

Tabs:

```txt
Tools
Validation
History
```

`Tools` contains:

```txt
Editor controls
- View mode
- Zoom
- Snap
- Create type
- Create mode
- Heatmap

Selection controls
- Batch type
- Batch color
- Save pattern
- Delete
- Deselect
```

Single-note detail/edit remains in the note popup.

---

## Integration with Existing Features

The project layer must not break or orphan existing editor features. This section maps each current feature to the new authorization model.

### AI Note Suggester

| Aspect | Behavior |
|---|---|
| Who can trigger | Users with EDIT or ADMIN permission for the song (same as note creation). |
| Cross-project context | AI suggestions are scoped to the current song only. The AI does not access notes from other projects. |
| Accepting a suggestion | Goes through the same POST /notes flow with the same conflict handling, WebSocket broadcast, and ledger event. |
| Global role requirement | COMPOSER or ADMIN global role (unchanged from current). |

### View Modes (Composer / Developer / QA)

View modes are a presentation preference, not a permission layer.

| Mode | Who typically uses it | Authorization requirement |
|---|---|---|
| Composer View | Composers (EDIT permission) | Can view song |
| Developer View | Game developers (READ permission) | Can view song |
| QA View | QA engineers (READ permission) | Can view song |

Any user who can view a song can switch between view modes. The mode does not grant additional access. A READ-permission user in Composer View still cannot create or edit notes.

### Heatmap and Validation

- Heatmap renders based on the loaded notes for the current song. No cross-project data.
- Validation warnings (boundary notes, density issues) run client-side on loaded data. No permission change needed.
- The Validation tab in the right panel can optionally show a project-level summary (count of songs with validation errors) fetched via `GET /projects/:projectId/validation-summary`. This requires project READ access.

### Real-time Collaboration and Presence

- WebSocket room authorization: when a client emits `join-song`, the gateway must verify project membership and song scope before admitting the client to the room. This replaces the current global-role-only check.
- Presence indicators show users currently in the same song room (unchanged behavior).
- Permission change events (`project.member.updated`, `project.song.access.updated`) are broadcast to the project's WebSocket channel. Clients react by invalidating queries and, if access was revoked, exiting the editor gracefully.

### Real-time Permission Revocation in Editor

When a user loses access to the song they are currently editing:

```txt
1. Server emits `project.song.access.updated` to the project channel.
2. Client receives event, checks if current song is affected.
3. If access revoked:
   a. Disable all mutation controls immediately (optimistic lock).
   b. Show non-blocking banner: "Your access to this song has changed."
   c. After 3 seconds, navigate to project page.
4. If permission downgraded (EDIT → READ):
   a. Disable mutation controls.
   b. Show banner: "You now have read-only access to this song."
   c. Remain in editor in read-only mode.
```

The existing `useCanEdit` hook evolves to check:

```txt
1. User's project membership for song.projectId
2. Membership permission is EDIT or ADMIN
3. Song is within membership song scope
4. Song status is not PUBLISHED or ARCHIVED (unless admin override)
```

### Change History / Ledger

- Note-level ledger (NoteEvent) remains unchanged. Every note mutation still writes an event.
- Project-level audit (member changes, status transitions, assignments) uses a separate `ProjectEvent` table. This keeps the note ledger focused and performant.
- History panel in the editor shows note events only (unchanged).
- Project activity tab (future) shows project-level audit events.

### Keyboard Shortcuts

All existing shortcuts (E to edit, Delete to remove, Cmd+Z to undo) work identically within the editor. The project layer does not intercept keyboard shortcuts.

New shortcut: `Cmd+N` inside a project page triggers quick-create.

---

## Performance Considerations

### Project and Song List Pages

- Project list and song list use TanStack Query with pagination (cursor-based, 20 items per page).
- Song table with filters: the API must support combined filtering (`status + category + difficulty + assignedComposerId`) with a single query. Indexes on `[projectId, status]` and `[projectId, category]` already cover the common cases.
- Member table is typically small (< 50 members per project). No pagination needed initially.

### Editor Load Path

The nested route `/projects/:projectId/songs/:songId` requires resolving project access before loading the editor. To avoid adding latency:

```txt
1. Frontend fetches song detail (GET /projects/:projectId/songs/:songId).
   This single endpoint validates project membership, song scope, and returns song + permission level in one response.
2. Note fetching begins immediately after song detail resolves (parallel with UI mount).
3. No extra "check permission" API call — authorization is bundled into the song detail response.
```

Response shape includes permission context:

```ts
interface SongDetailResponse {
  song: Song
  permissions: {
    canEdit: boolean
    canManageWorkflow: boolean
    viewMode: 'full' | 'readonly'
  }
}
```

### WebSocket Authorization

Room join authorization adds one DB query (check project membership). This is cached per connection session — not re-checked on every event. If permissions change, the server actively evicts the client from the room via the permission-change event flow.

### Large Projects (1000+ Songs)

For projects with many songs:
- Song list uses server-side pagination and filtering (not client-side).
- Song search uses a simple `ILIKE` query on name with the project filter. Full-text search is a future enhancement.
- The "Recently Edited Songs" dashboard widget queries across projects with `ORDER BY updatedAt DESC LIMIT 10` using the existing `[projectId, status]` index.

---

## Backend Data Model

### Prisma Sketch

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

model Project {
  id          String        @id @default(uuid())
  name        String
  description String?
  status      ProjectStatus @default(ACTIVE)
  ownerId     String
  createdAt   DateTime      @default(now())
  updatedAt   DateTime      @updatedAt
  archivedAt  DateTime?

  owner   User            @relation(fields: [ownerId], references: [id])
  members ProjectMember[]
  songs   Song[]

  @@map("projects")
}

model ProjectMember {
  id         String            @id @default(uuid())
  projectId  String
  userId     String
  permission ProjectPermission
  songScope  SongScope
  createdAt  DateTime          @default(now())
  updatedAt  DateTime          @updatedAt

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

model Song {
  id                 String         @id @default(uuid())
  projectId          String
  name               String
  category           SongCategory   @default(PROTOTYPE)
  status             SongStatus     @default(DRAFT)
  difficulty         SongDifficulty @default(NORMAL)
  bpm                Int            @default(120)
  timeSignature      String         @default("4/4")
  assignedComposerId String?
  assignedQaId       String?
  createdBy          String
  sourceSongId       String?
  importOptions      Json?
  createdAt          DateTime       @default(now())
  updatedAt          DateTime       @updatedAt
  archivedAt         DateTime?

  project          Project @relation(fields: [projectId], references: [id], onDelete: Cascade)
  creator          User    @relation("SongCreator", fields: [createdBy], references: [id])
  assignedComposer User?   @relation("SongComposer", fields: [assignedComposerId], references: [id])
  assignedQa       User?   @relation("SongQa", fields: [assignedQaId], references: [id])
  sourceSong       Song?   @relation("SongImportSource", fields: [sourceSongId], references: [id])
  importedSongs    Song[]  @relation("SongImportSource")

  notes            Note[]
  sections         SectionMarker[]
  patterns         NotePattern[]
  allowedMembers   ProjectMemberSongAccess[]

  @@index([projectId, status])
  @@index([projectId, category])
  @@index([assignedComposerId])
  @@index([assignedQaId])
  @@map("songs")
}
```

Relation names may need adjustment based on the existing `User` model. The important model boundary is stable:

```txt
Project owns Song.
ProjectMember owns permission.
ProjectMemberSongAccess owns selected song allowlist.
```

---

## API Design

### Projects

```txt
GET    /projects
POST   /projects
GET    /projects/:projectId
PATCH  /projects/:projectId
DELETE /projects/:projectId
```

Delete should soft-archive unless platform admin explicitly performs hard deletion.

### Project Members

```txt
GET    /projects/:projectId/members
POST   /projects/:projectId/members
PATCH  /projects/:projectId/members/:memberId
DELETE /projects/:projectId/members/:memberId
```

Create payload:

```ts
interface AddProjectMemberDto {
  userId: string
  permission: 'READ' | 'EDIT' | 'ADMIN'
  songScope: 'ALL_SONGS' | 'SELECTED_SONGS'
  songIds?: string[]
}
```

Validation:

```txt
songIds required and non-empty when songScope is SELECTED_SONGS.
songIds must belong to projectId.
songIds are ignored when songScope is ALL_SONGS.
Only project ADMIN or platform ADMIN can mutate members.
Cannot add a user who is already a member (returns 409).
```

### Project Songs

```txt
GET  /projects/:projectId/songs
POST /projects/:projectId/songs
GET  /projects/:projectId/songs/:songId
PATCH /projects/:projectId/songs/:songId
```

Create payload:

```ts
interface CreateProjectSongDto {
  name: string
  category: SongCategory
  difficulty: SongDifficulty
  bpm: number
  timeSignature: string
  assignedComposerId?: string
  assignedQaId?: string
  startType: 'BLANK' | 'TEMPLATE' | 'IMPORT'
  templateId?: string
  import?: {
    sourceSongId: string
    copySettings: boolean
    copySections: boolean
    copyPatterns: boolean
    copyNotes: boolean
  }
}
```

### Permission Checks

Every song route must check:

```txt
song belongs to projectId
user can access project
user can access song by scope
mutation requires EDIT or ADMIN
```

Do not rely on frontend hiding controls for security.

---

## Realtime and Audit

### Permission Events

When project member permissions or song scopes change, emit events:

```txt
project.member.updated   → { memberId, projectId, changes }
project.member.removed   → { userId, projectId }
project.song.access.updated → { memberId, projectId, songIds }
```

Clients in that project should invalidate project/member/song queries.

Permission revocation while a user is in the editor is handled by the flow described in "Integration with Existing Features > Real-time Permission Revocation in Editor" above.

### Song Status Events

When a song's status changes (e.g., DRAFT → IN_REVIEW):

```txt
song.status.changed → { songId, projectId, oldStatus, newStatus, changedBy }
```

This enables:
- Dashboard widgets to update in real-time
- QA engineers to see new review assignments immediately
- Composers to see when their song needs fixes

### Audit Trail

Audit events should track:

```txt
project created/updated/archived
member added/updated/removed
song created/imported/archived
song status changed
song assignment changed
```

Existing note ledger (`NoteEvent` table) remains focused on note mutations. It is not modified by the project layer.

Project/song workflow audit uses a separate `ProjectEvent` table:

```ts
interface ProjectEvent {
  id: string
  projectId: string
  eventType: string
  actorId: string
  metadata: Record<string, unknown>
  createdAt: string
}
```

This separation keeps the note ledger performant (high write volume from note edits) and the project audit clean (low write volume from admin actions).

---

## Frontend Architecture

### Routes

Target routes:

```txt
/projects
/projects/:projectId
/projects/:projectId/songs/:songId
/projects/:projectId/members
/projects/:projectId/settings
```

Compatibility route:

```txt
/songs/:songId
```

This can redirect to the song's project route after fetching the song.

### Feature Folders

```txt
features/projects/
  useProjects.ts
  ProjectGrid.tsx
  ProjectCard.tsx
  ProjectPage.tsx

features/project-members/
  useProjectMembers.ts
  MemberTable.tsx
  MemberAccessModal.tsx

features/songs/
  useSongs.ts
  SongGrid.tsx
  SongTable.tsx
  CreateSongWizard.tsx
  ImportSongStep.tsx
```

Existing editor components remain under:

```txt
features/editor/
```

### State Management

Server state:

```txt
Projects
Project members
Project songs
Song detail
```

Use TanStack Query.

Client state:

```txt
Create-song wizard current step/form values
Editor selected notes/panels/view controls
```

Use local component state for wizard. Use Zustand for editor.

---

## UI Flow Details

### Home Dashboard

First screen after login. The dashboard adapts its emphasis by role:

```txt
┌─────────────────────────────────────────────────────┐
│ Recently Edited Songs (max 10, cross-project)       │  ← Composer fast path
│ [song card] [song card] [song card] ...             │
├─────────────────────────────────────────────────────┤
│ Needs My Review (songs assigned to me as QA)        │  ← QA / Producer fast path
│ [song] [song] ...                                   │
├─────────────────────────────────────────────────────┤
│ My Projects                                         │  ← Everyone
│ [project card] [project card] ...                   │
└─────────────────────────────────────────────────────┘
```

Primary action:

```txt
+ New Project (Admin only)
```

Composers primarily use "Recently Edited Songs" to jump straight back to work. The project layer is a secondary navigation path for them.

QA engineers and producers primarily use "Needs My Review" to find their assigned work.

Song creation should usually happen inside a project. If there is no project, empty state guides user to create or join a project.

### Project Page

Header:

```txt
Project name
Active/Paused/Archived
+ New Song
Members
Settings
```

Songs tab:

```txt
Filters
Song table/card
Bulk actions for admins/editors
```

Members tab:

```txt
Member
Permission
Song scope
Selected song count
Last activity
Actions
```

Settings tab:

```txt
Project name
Description
Status
Archive project
```

### Create Song Wizard UI

Use a modal or drawer with stable width. Do not use the page header as a form.

Step indicator:

```txt
Start → Setup → Assignment → Review
```

The wizard should preserve entered values when navigating back.

If template/import changes setup defaults after the user manually edited fields, ask before overwriting:

```txt
Apply template defaults to BPM, category, and difficulty?
```

### Member Access Modal UI

Required controls:

```txt
User picker (search by name/email)
Permission segmented control (Read / Edit / Admin)
Song scope radio group (All songs / Selected songs) — only shown in Phase 5+
Song multiselect if selected scope — only shown in Phase 5+
```

The save button remains disabled until required choices are valid.

In Phase 1–4 (before SELECTED_SONGS is enabled), the modal only shows the user picker and permission selector. Song scope defaults to ALL_SONGS silently.

---

## Migration Strategy

### Essential Phases (required for the project model to function)

#### Phase 1: Schema Foundation

Add:

```txt
projects
project_members
project_member_song_access (empty initially — all members get ALL_SONGS)
song.projectId, song.status, song.category, song.difficulty, song.assignedComposerId, song.assignedQaId fields
```

Create a default project for existing songs:

```txt
Default Project (name: "Amanotes Production")
```

Assign all existing songs to that project.

Create project membership for existing users based on global role:

```txt
ADMIN → ADMIN + ALL_SONGS
COMPOSER → EDIT + ALL_SONGS
VIEWER → READ + ALL_SONGS
```

This migration must be non-breaking: the app continues to work identically after the migration runs.

#### Phase 2: API Authorization

Update song/note/section/pattern APIs to authorize through project membership.

In this phase, all members have `ALL_SONGS`, so the authorization check is:

```txt
user is platform ADMIN
OR user is a member of song.projectId with READ/EDIT/ADMIN
```

Existing routes continue temporarily:

```txt
/songs/:songId → resolves projectId internally, checks membership
```

New routes are added in parallel:

```txt
/projects/:projectId/songs/:songId
```

#### Phase 3: Project UI + Quick Create

Add project dashboard and project detail page.

Move current song list into project page.

Replace old global song list with home dashboard:

```txt
My Projects
Recently Edited Songs (cross-project, max 10)
```

Add quick-create button (single click → blank song → open editor).

Add full create-song wizard (Blank / Template / Import).

### Progressive Phases (enhance the model, can ship independently)

#### Phase 4: Song Workflow and Status

Enable status transitions:

```txt
DRAFT → IN_REVIEW → NEEDS_FIX → APPROVED → PUBLISHED → ARCHIVED
```

Add:

```txt
Status transition controls (project ADMIN and assigned QA can transition)
"Needs My Review" dashboard widget
Published song read-only enforcement
```

#### Phase 5: Selected Song Scopes

Enable `SELECTED_SONGS` in the member management UI.

Ship full member admin UI with:

```txt
Permission selector
Song scope selector
Song multiselect for SELECTED_SONGS
```

This phase is only needed when projects grow large enough that not all members should see all songs. Small teams (< 10 members) may never need this.

#### Phase 6: Workflow Enhancements

Add:

```txt
Review dashboard (project-level view of all songs by status)
Assignment notifications (WebSocket + optional email)
Workflow audit trail (ProjectEvent table)
Validation summary by project
Status transition history
```

---

## Edge Cases

### User Creates Song in Project With Selected Scope

If user has `EDIT + SELECTED_SONGS`, they cannot create new songs by default.

Creation rule:

```txt
Only EDIT/ADMIN with ALL_SONGS can create project songs by default.
```

This avoids surprising access expansion. A future `canCreateSongs` flag can relax this by allowing selected-scope editors to create songs and automatically add the created song to their selected scope.

### User Is Assigned But Loses Scope

If a user is removed from a song scope while assigned:

```txt
Clear assignment or require reassignment during access edit.
```

Recommended: require admin to choose.

### Source Song Imported From Archived Project

Archived project songs should be hidden by default.

Allow import only if:

```txt
user can view archived project/song
AND include archived is enabled
```

### Name Collisions

Song names do not need to be globally unique.

Within one project, duplicate names are allowed. The UI disambiguates by showing status badge, difficulty, and last-modified date alongside the name. Composers often create variations ("Boss Battle Easy", "Boss Battle Hard") or iterations with similar names — a hard uniqueness constraint would cause friction during rapid prototyping.

Recommended behavior:

```txt
Duplicate song names are allowed (soft warning only).
If names match, the UI appends status and date for disambiguation.
The song list table always shows enough metadata columns to distinguish songs visually.
```

The critical uniqueness constraint remains on note positions `(song_id, track, time)`, not on song names. Song names are metadata — duplicates are annoying but not corrupting.

### Project Archive

Archiving a project:

```txt
keeps all songs
makes songs read-only by default
hides project from active views
```

Admins can unarchive.

### Published Song Editing

Published songs should not be freely edited.

Recommended behavior:

```txt
Published song opens read-only.
To edit, create a new version or move status back to Draft with Admin permission.
```

Versioning can be implemented after project permissions, but the design should leave room for it.

---

## Testing Strategy

### Backend Unit Tests

Permission service:

```txt
READ + ALL_SONGS can view all current and future project songs.
READ + SELECTED_SONGS can view only selected songs (Phase 5+).
EDIT + ALL_SONGS can edit all project songs.
EDIT + SELECTED_SONGS can edit selected songs only (Phase 5+).
READ cannot mutate songs.
ADMIN can manage members.
Non-member cannot access project songs.
Platform ADMIN bypasses project membership check.
```

Create song:

```txt
creates song in project with valid permissions
quick-create creates song with defaults and returns song + editor URL
rejects user without EDIT/ADMIN permission
rejects user without ALL_SONGS scope (when SELECTED_SONGS is enforced)
validates BPM range (40–300)
validates time signature (4/4, 3/4, 6/8)
assigns eligible composer/QA only
rejects assignee without song access
```

Import:

```txt
copies settings only
copies sections
copies patterns
copies notes
does not link future edits to source
rejects unreadable source song
stores audit metadata (sourceSongId, importedBy, importedAt)
```

### Frontend Tests

Quick-create:

```txt
single click creates song and navigates to editor
song is created with default values (PROTOTYPE, NORMAL, 120 BPM, 4/4)
current user is auto-assigned as composer
```

Create-song wizard:

```txt
requires name/category/difficulty/BPM/time signature
preserves values when navigating back between steps
template applies defaults (with confirmation if user edited fields)
import mode shows copy options
review step summarizes all choices
"Create and Open Editor" navigates to editor
"Create and Stay in Project" returns to song list
```

Member access modal:

```txt
requires user selection
requires permission selection
save button disabled until valid
shows song multiselect only when SELECTED_SONGS scope enabled (Phase 5+)
```

Editor access:

```txt
read-only user cannot create/update/delete notes
edit user can mutate scoped song
out-of-scope song shows access denied page
permission revocation mid-edit shows banner and disables mutations
useCanEdit returns false for READ permission, PUBLISHED status, ARCHIVED status
```

### Integration Tests

```txt
project admin adds editor with ALL_SONGS
editor can edit any song in project
editor cannot edit song in a different project
admin switches editor to SELECTED_SONGS (Phase 5+)
editor can only view/edit selected songs
editor cannot view unselected song
new song created in project is accessible to ALL_SONGS members
quick-create → editor → place note → full flow works
```

### Persona Flow Tests

```txt
Composer: login → dashboard → recent song → editor → place notes (< 3 seconds path)
Composer: login → project → quick-create → editor → place notes
Developer: login → project → filter by APPROVED → open editor in Developer View → see raw data
QA: login → dashboard → Needs My Review → open song → QA View → flag issue → set NEEDS_FIX
Producer: login → project overview → see status breakdown → open song → read-only review
```

---

## Design Policies

| Policy | Decision |
|---|---|
| `EDIT + SELECTED_SONGS` creating new songs | Not allowed in the target design. |
| Duplicate song names in one project | Allowed (soft warning only, UI disambiguates with metadata). |
| Published song editing | Not allowed directly; require new version or admin status change. |
| Project archive effect | Archived projects make songs read-only by default. |
| Import default | Notes are not included by default. |
| Composer flow state | Quick-create must exist alongside the full wizard. 2 clicks to editor from dashboard. |
| View modes and permissions | View modes are presentation preferences, not access controls. Any viewer can switch modes. |

---

## Success Criteria

The full flow is successful when:

```txt
Composers can reach the editor in 2 clicks from the dashboard (quick-create or recent songs).
Admins can add project members with required permission.
Songs belong to one project.
Song access is understandable from project membership.
Create Song offers both quick-create (fast path) and wizard (full control).
Users can create blank/template/import-based songs via the wizard.
Import creates independent copies, not shared songs.
Editor editability follows project permission and song scope.
Project pages show production status, assignment, validation, and ownership clearly.
Game developers can filter songs by status and inspect data in Developer View.
QA engineers see songs needing their review on the dashboard.
Product owners can track production progress from the project overview.
```

The central product rule:

```txt
Project owns production context.
Song owns chart content.
Project membership owns access.
Import owns reuse.
The project layer is invisible during active composition.
```
