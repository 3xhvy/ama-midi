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
| Create entry point | `+ New Song` opens a create-song wizard. The inline song-name input is removed. |

---

## Product Model

AMA-MIDI should behave like a game production asset tool, not a generic song file list.

```txt
Organization
→ Project
→ ProjectMember
→ Song
→ Version
→ Notes / Sections / Patterns / Validation / History
```

The project is the production workspace. It contains songs, members, assignment, and workflow state.

The song is a project-owned gameplay chart asset. It contains musical/gameplay data and can be edited in the existing editor.

If another project needs similar content, the user creates a new song in that project and imports settings, structure, patterns, or notes from the source song. The new song is independent after creation.

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
| `NO_SONGS` | Project membership exists, but no song access yet. |

`ALL_SONGS` is dynamic. When new songs are created in the project, these members automatically gain access.

`SELECTED_SONGS` is explicit. Admin must choose one or more songs when assigning access. If no songs should be assigned yet, admin must choose `NO_SONGS`.

`NO_SONGS` is useful for adding someone to a project before work is assigned.

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
Song scope: All songs now and future / Selected songs only / No songs yet
```

Conditional fields:

```txt
If Selected songs only:
  require selected songs from this project

If No songs yet:
  show confirmation that the user can view project metadata but no songs
```

Validation:

```txt
User is required.
Permission is required.
Song scope is required.
Selected songs are required when scope is Selected songs only.
Only Admin can add members.
```

### Edit Project Member

Admins can change:

```txt
Permission
Song scope
Selected song allowlist
```

When changing from `ALL_SONGS` to `SELECTED_SONGS`, admin must choose at least one song or explicitly choose `NO_SONGS`.

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

### Entry Point

Inside a project:

```txt
Project → Songs → + New Song
```

The inline `New song name` input is removed.

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
  songScope: 'ALL_SONGS' | 'SELECTED_SONGS' | 'NO_SONGS'
  songIds?: string[]
}
```

Validation:

```txt
songIds required and non-empty when songScope is SELECTED_SONGS.
songIds must belong to projectId.
Only project ADMIN or platform ADMIN can mutate members.
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
project.member.updated
project.member.removed
project.song.access.updated
```

Clients in that project should invalidate project/member/song queries.

If a user loses access to the song currently open, the UI should show:

```txt
Your access to this song changed.
```

Then navigate to the project page or read-only fallback if still viewable.

### Audit Trail

Audit events should track:

```txt
project created/updated/archived
member added/updated/removed
song created/imported/archived
song status changed
song assignment changed
```

Existing note ledger remains focused on note mutations.

Project/song workflow audit can be separate from note ledger.

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

First screen after login:

```txt
My Projects
Needs My Review
Recently Edited Songs
```

Primary action:

```txt
+ New Project
```

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
User picker
Permission segmented control
Song scope radio group
Song multiselect if selected scope
```

The save button remains disabled until required choices are valid.

---

## Migration Strategy

### Phase 1: Schema Foundation

Add:

```txt
projects
project_members
project_member_song_access
song project/status/category/difficulty/assignment fields
```

Create a default project for existing songs:

```txt
Default Project
```

Assign all existing songs to that project.

Create project membership for existing users based on global role:

```txt
ADMIN → ADMIN + ALL_SONGS
COMPOSER → EDIT + ALL_SONGS
VIEWER → READ + ALL_SONGS
```

### Phase 2: API Authorization

Update song/note/section/pattern APIs to authorize through project membership and song scope.

Existing routes can continue temporarily:

```txt
/songs/:songId
```

But they must resolve project access internally.

### Phase 3: Project UI

Add project dashboard and project detail.

Move current song list into project page.

Keep old global song list as a compatibility view or replace it with `Recently Edited Songs`.

### Phase 4: Create Song Wizard

Replace inline song creation with wizard.

Support:

```txt
Blank
Template
Import
```

### Phase 5: Member Management and Scopes

Ship full member admin UI.

Enforce:

```txt
Permission required
Song scope required
Selected songs required when scope is selected-only
```

### Phase 6: Workflow Enhancements

Add:

```txt
Review dashboard
Status transition controls
Assignment notifications
Workflow audit
Validation summary by project
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

Within one project, duplicate names should be allowed only if the UI clearly disambiguates by status/date. Recommended constraint:

```txt
No duplicate active song names in the same project.
Archived songs do not block reuse.
```

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
READ + SELECTED_SONGS can view only selected songs.
EDIT + selected scope can edit selected songs only.
READ cannot mutate songs.
ADMIN can manage members.
Selected scope rejects songs from other projects.
```

Create song:

```txt
creates song in project
rejects unauthorized project
validates BPM/time signature
assigns eligible composer/QA only
```

Import:

```txt
copies settings only
copies sections
copies patterns
copies notes
does not link future edits to source
rejects unreadable source song
```

### Frontend Tests

Create-song wizard:

```txt
requires name/category/difficulty/BPM/time signature
preserves values between steps
template applies defaults
import mode shows copy options
review step summarizes choices
```

Member access modal:

```txt
requires permission
requires song scope
requires song selection for selected-only scope
disables save until valid
```

Editor access:

```txt
read-only user cannot create/update/delete notes
edit user can mutate scoped song
out-of-scope song redirects or shows access denied
```

### Integration Tests

```txt
project admin adds editor with selected song scope
editor can edit selected song
editor cannot view unselected song
admin switches editor to all songs
editor can view newly created future song
```

---

## Design Policies

| Policy | Decision |
|---|---|
| `EDIT + SELECTED_SONGS` creating new songs | Not allowed in the target design. |
| Duplicate active song names in one project | Not allowed. |
| Published song editing | Not allowed directly; require new version or admin status change. |
| Project archive effect | Archived projects make songs read-only by default. |
| Import default | Notes are not included by default. |

---

## Success Criteria

The full flow is successful when:

```txt
Users land on projects, not a flat song list.
Admins can add project members with required permission and song scope.
Songs belong to one project.
Song access is understandable from project membership.
Create Song opens a wizard instead of inline name input.
Users can create blank/template/import-based songs.
Import creates independent copies, not shared songs.
Editor editability follows project permission and song scope.
Project pages show production status, assignment, validation, and ownership clearly.
```

The central product rule:

```txt
Project owns production context.
Song owns chart content.
Project membership owns access.
Import owns reuse.
```
