# Management Flow UI Refactor Design

**Date:** 2026-05-23
**Goal:** Refactor the dashboard, project directory, and project workspace into a more professional, dense, user-friendly management flow.
**Scope:** Frontend management UI only. The editor UI, editor routes, and editor navigation chrome are explicitly out of scope.

## Decisions

| Topic | Decision |
|---|---|
| Primary audience | Balanced team workspace for composers, producers, QA, and developers. |
| Visual direction | Dense professional SaaS: compact, operational, table-first, fast scanning. |
| Route model | Keep the existing route model and canonical project-song-editor flow. |
| Editor impact | Do not change editor components, editor layout, or editor route styling. |
| Behavior impact | Prefer presentation and layout refactors over new product behavior. |

## Current Issues

The current management pages are functional, but they read as separate plain pages rather than one coherent product surface.

- The app shell has branding and account controls but no primary management navigation.
- Dashboard sections are stacked equally, so urgent work does not stand out.
- Project pages use simple headings and tabs, with limited production context in the header.
- Project cards and song rows are usable but visually light for a production management workflow.
- Empty and loading states are minimal and do not guide the user toward the next action.

## Target Flow

The navigation flow remains stable:

```txt
Dashboard -> Project Directory -> Project Workspace -> Song Editor
Dashboard -> Recent / Assigned / Review Song -> Song Editor
```

The management pages should feel like a single operational system:

- Dashboard answers: "What needs attention across projects?"
- Project directory answers: "Which workspace should I enter?"
- Project workspace answers: "What is happening inside this project?"
- Editor remains the focused chart editing surface and is not restyled by this work.

## App Shell

Management pages use a stronger shared shell.

Header:

- AMA-MIDI brand on the left.
- Primary navigation links: `Dashboard` and `Projects`.
- Active route state for the current management page.
- Existing theme toggle and account menu on the right.

Main area:

- Wider operational max width, approximately `1280px`.
- Compact top and bottom padding.
- Shared page header patterns across dashboard, project list, and project detail.

The shell must remain compatible with pages that already pass custom `maxWidth` or hide the header. Editor-specific shells and editor layout components are not part of this refactor.

## Dashboard

The dashboard becomes a compact team operations overview.

Layout:

```txt
Page header
  Title: Dashboard
  Subtitle: Cross-project production work, reviews, and recent activity

Summary strip
  Needs review count
  Assigned to me count
  Recent songs count
  Active projects count

Main grid
  Left column:
    Needs Review
    Assigned to Me
    Recent Songs

  Right column:
    My Projects
```

Design rules:

- Put `Needs Review` first because it is the most team-actionable queue.
- Use compact section headers with counts where useful.
- Render song rows in a denser list style: song, project, status, updated time.
- Keep status badges visible but not oversized.
- Use inline empty states for empty queues.
- Keep `View all projects` available from the project panel.

Data flow:

- Continue using `useDashboard()` for `recentSongs`, `assignedToMe`, and `needsReview`.
- Continue using `useProjects()` for project data.
- Do not introduce new API requirements for this UI refactor.

## Project Directory

`/projects` becomes a proper project directory rather than a loose card grid.

Header:

- Breadcrumb or back link to `Dashboard`.
- Title: `Projects`.
- Subtitle: `Workspaces for songs, members, and production status`.
- Primary action: `New Project`.

Directory controls:

- Search projects by name and description.
- Filter by project status.

Project list:

- Use compact project cards or row-like cards.
- Emphasize project name and status.
- Group metadata: song count, member count, last updated.
- Keep description optional and visually secondary.
- Use clear hover and keyboard focus states.

Empty state:

- Explain that projects contain songs and members.
- Surface `New Project` as the next action.

Filtering should be implemented locally against the already loaded project list unless the existing API shape changes later.

## Project Workspace

`/projects/:projectId` becomes the main production workspace for a project.

Header:

- Back link to `Projects`.
- Project name.
- Status badge.
- Metadata: song count, member count, last updated if available.
- Primary action: `New Song`.

Tabs:

```txt
Songs | Members | Settings
```

Songs tab:

- Keep the existing search and status filter.
- Improve spacing and alignment so the table reads as the primary object.
- Keep columns focused on management: song, status, composer, QA, last edited, validation, actions.
- Keep `Open Editor` as the route into chart editing.

Members tab:

- Keep existing behavior.
- Apply only surrounding layout polish if needed.

Settings tab:

- Keep current placeholder behavior unless existing project settings are already implemented.
- Style it consistently with the management surface.

## Components

Expected focused changes:

- `AppShell`: add primary management navigation and support the wider default management layout.
- `DashboardPage`: reorganize into summary strip plus two-column operational grid.
- `DashboardSongList`: make rows denser and more table-like.
- `ProjectDashboardPage`: add directory controls and improve header/action hierarchy.
- `ProjectListSection`: support compact professional cards and better empty/loading states.
- `ProjectCard`: polish metadata hierarchy and status display.
- `ProjectPage`: improve project header and tab surface.
- `SongTable`: polish table toolbar, empty state, and row density without changing editor links.

No editor components should be modified as part of this work.

## Styling Direction

The management UI should be professional and restrained:

- Use compact spacing and clear hierarchy.
- Avoid decorative hero sections.
- Avoid marketing-style cards and oversized headings.
- Keep border radius at `8px` or below for new management cards and panels unless an existing component requires otherwise.
- Prefer neutral surfaces with limited brand accent use for active states and primary actions.
- Ensure light and dark themes both remain readable.
- Avoid a one-color visual theme; primary purple should be an accent, not the whole page personality.

## Error, Loading, And Empty States

Loading states:

- Use quiet inline skeleton-like panels or concise loading rows.
- Avoid large centered loading messages on management pages.

Empty states:

- Dashboard queues: short inline messages.
- Project directory: explain the next action and offer `New Project`.
- Project song table: explain filters may be hiding songs, and keep the filter controls visible.

Errors:

- No new error handling is required unless existing hooks expose errors.
- If surfaced, errors should appear near the affected section, not as full-page failures.

## Testing

Focused tests should cover behavior introduced by the UI refactor:

- Project directory filtering by search text and status if implemented as pure helper logic.
- Existing dashboard and song table unit tests should continue passing.
- Build or type-check the web app after implementation.

Manual verification should cover:

- `/` dashboard in light and dark modes.
- `/projects` with zero, one, and many projects.
- `/projects/:projectId` with empty and populated song lists.
- Responsive behavior at mobile and desktop widths.
- Confirming editor pages are visually unaffected.

## Out Of Scope

- Editor layout, toolbar, breadcrumb, piano roll, panels, and editor interactions.
- API schema changes.
- New role-based dashboard behavior.
- Command palette.
- Server-side project search or pagination.
- Project settings implementation beyond existing placeholder styling.
