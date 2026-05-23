# Create Song Wizard Restyle — Design Spec

**Date:** 2026-05-24  
**Status:** Approved pending user review  
**Parent spec:** [2026-05-23-project-song-management-full-flow-design.md](./2026-05-23-project-song-management-full-flow-design.md)

## Summary

Restyle the Create Song wizard for structured UI/UX and full alignment with the project-song-management spec. Includes quick-create entry point, wider modal shell, decomposed step components, member pickers, import mode presets, complete review summary, and full backend materialization of six built-in templates.

## Decisions (from brainstorming)

| Decision | Choice |
|---|---|
| Scope | Full spec alignment (UI + missing functional pieces) |
| Templates | Full materialization — all 6 built-ins with server-side sections/patterns/notes |
| Quick-create | Yes — alongside wizard on project page + Cmd+N |
| Container | Wider centered modal (~560px) |
| Architecture | Structured decomposition (Approach 2) — no generic wizard framework |

---

## Entry Points

### Project page header

Replace single `+ New Song` button with a split action group:

```
[ Quick Create ]  [ + New Song ]
```

- **Quick Create** (primary): one click, no modal. Creates blank draft and navigates to editor.
- **+ New Song**: opens full wizard modal.

### Quick Create behavior

Calls `POST /projects/:projectId/songs` with:

```txt
name: "Untitled"
category: PROTOTYPE
difficulty: NORMAL
bpm: 120
timeSignature: "4/4"
startType: BLANK
assignedComposerId: current user id
assignedQaId: null
status: DRAFT (server default)
```

On success → `navigate(/projects/:projectId/songs/:songId)`.

On failure → toast error. Button shows loading state; disabled while pending.

### Keyboard shortcut

- **Cmd+N** (Mac) / **Ctrl+N** (Windows) on project page triggers Quick Create.
- Guard: skip when wizard is open or focus is inside a text input/textarea/select.
- Register in `ProjectPage` via `useEffect` + `keydown` listener; cleanup on unmount.

### Component

`QuickCreateSongButton.tsx` — wraps button + mutation + navigation. Used by `ProjectPage`.

---

## Wizard Shell

### Modal

- Override `Modal.Content` with `className="max-w-[560px]"`.
- Header title: **Create song**.
- Body: `max-h-[min(70vh,640px)] overflow-y-auto`.
- Footer: right-aligned button group, consistent with `EditSongModal` (`size="sm"`).

### Stepper (`CreateSongWizardStepper.tsx`)

Horizontal step indicator below header:

```txt
Start → Setup → Assignment → Review
```

Visual states:

| State | Treatment |
|---|---|
| Completed | Checkmark icon + primary text + filled connector |
| Current | Bold label + primary dot/underline |
| Upcoming | Muted text, dashed connector |

Steps are clickable only for **completed** steps (allows jumping back without losing data). Forward navigation only via Next button (validation gates).

### Navigation rules

- **Back**: decrements step; never clears form state.
- **Next**: validates current step before advancing.
- **Review footer**: `Create` (secondary) + `Create and open` (primary, autoFocus).
- Preserve all entered values when navigating back/forward.

### Orchestrator

`CreateSongWizard.tsx` holds wizard state and step routing. Step components are presentational + callbacks.

---

## Step 1 — Start

### Layout

Section header: **How do you want to start?**

Three start-type options as **selectable cards** (not a cramped ToggleGroup):

| Card | Title | Description |
|---|---|---|
| Blank | Blank song | Empty chart with your settings |
| Template | From template | Preset sections, patterns, or starter notes |
| Import | Import from song | Copy settings and chart data from an existing song |

Selected card: primary border + subtle primary background tint.

### Blank

No sub-content. Next is always enabled.

### Template

When Template is selected, show a **template grid** (2 columns on 560px modal):

Each card shows:
- Template name
- One-line description
- Metadata chips: category, difficulty, BPM
- Badge for what it creates (e.g. "Sections + notes", "Settings only")

Built-in templates (from parent spec):

| ID | Name | Category | Difficulty | BPM | Creates |
|---|---|---|---|---:|---|
| `empty-draft` | Empty Draft | PROTOTYPE | NORMAL | 120 | Settings only |
| `tap-starter` | Tap Starter | PROTOTYPE | EASY | 120 | Starter TAP notes |
| `mixed-mechanics` | Mixed Mechanics | PROTOTYPE | NORMAL | 128 | TAP/HOLD/SWIPE examples |
| `qa-validation` | QA Validation | QA_TEST | NORMAL | 100 | Sections + edge-case notes |
| `sectioned-layout` | Sectioned Layout | MAIN_CAMPAIGN | NORMAL | 120 | Intro/Verse/Chorus/Outro sections |
| `pattern-lab` | Pattern Lab | TEMPLATE | NORMAL | 120 | Reusable note patterns |

Selecting a template:
1. Sets `templateId` and `startType: TEMPLATE`.
2. Prefills setup defaults (category, difficulty, BPM, time signature, suggested name).
3. Tracks `setupTouched: boolean` — set true when user manually edits any setup field.

**Overwrite confirmation:** If user returns to Start, picks a different template, and `setupTouched` is true, show inline confirm:

```txt
Apply template defaults to name, category, difficulty, and BPM?
[ Keep my edits ]  [ Apply defaults ]
```

Next disabled until a template is selected (when start type is Template).

### Import

When Import is selected, render refactored `ImportSongStep` below cards.

Next disabled until `sourceSongId` is set.

---

## Step 2 — Setup

### Layout

Section header: **Song details**

Labeled form groups matching `EditSongModal` pattern:

```txt
Name          [ Input — autoFocus on step entry ]
Category      [ Select dropdown — not ToggleGroup ]
Difficulty    [ Select dropdown ]
BPM / Time    [ 2-column grid — Input + select ]
```

Use `SongCategoryEnum.label()` and `SongDifficultyEnum.label()` for option text.

### Defaults

| Field | Default |
|---|---|
| Name | Empty (required) or template-suggested name |
| Category | PROTOTYPE (or template value) |
| Difficulty | NORMAL (or template value) |
| BPM | 120 (or template value) |
| Time signature | 4/4 |
| Status | DRAFT (implicit, not editable here) |

### Validation (inline, on Next attempt)

| Rule | Message |
|---|---|
| Name empty | "Song name is required" |
| BPM < 40 or > 300 | "BPM must be between 40 and 300" |
| Time signature not in supported list | "Choose a supported time signature" |

Use shared `SUPPORTED_TIME_SIGNATURES` constant.

---

## Step 3 — Assignment

### Layout

Section header: **Team assignment**

Fields (all optional):

```txt
Composer     [ SearchSelect — project members with EDIT or ADMIN ]
QA reviewer  [ SearchSelect — project members with READ, EDIT, or ADMIN ]
Status       [ Read-only badge: Draft ]
```

Data source: `useProjectMembers(projectId)` — no raw user ID inputs.

Filter logic:
- **Composer options:** members where `permission ∈ { EDIT, ADMIN }`
- **QA options:** members where `permission ∈ { READ, EDIT, ADMIN }`

Empty state when no eligible members:

```txt
No eligible project members yet. You can assign later from the song list.
```

Default composer: pre-select current user if they appear in composer options.

Initial status is always **Draft** at creation time. Display as read-only `SongStatusBadge`. Setting non-Draft status at create is out of scope (requires workflow rules not yet wired to create endpoint).

---

## Step 4 — Review

### Layout

Section header: **Review and create**

Grouped summary card with human-readable labels:

```txt
Start
  Blank song | Template: Tap Starter | Import from: "Summer Event"

Details
  Name, Category, Difficulty, BPM, Time signature

Team
  Composer, QA reviewer, Status

Import options (if applicable)
  Copy groups selected + source song name

Template (if applicable)
  Template name + what will be created
```

Use enum label helpers — never show raw keys like `MAIN_CAMPAIGN`.

### Actions

| Button | Variant | Behavior |
|---|---|---|
| Create | secondary | Create song, close modal, stay on project page |
| Create and open | primary | Create song, close modal, navigate to editor |

Primary default per parent spec: composers usually want to chart immediately.

---

## Import UX (`ImportSongStep.tsx`)

### Source song picker

Use `useSongs()` to load all songs the user can read (cross-project per spec).

`SearchSelect` with:
- Label: song name
- Description: project name (disambiguates duplicate names)
- Exclude archived songs by default
- Optional toggle: "Include archived" (shows archived sources)

### Import mode presets

Replace raw checkboxes with mode selector + optional custom:

| Mode | copySettings | copySections | copyPatterns | copyNotes |
|---|---|---|---|---|
| Structure only | ✓ | ✓ | | |
| Pattern starter | ✓ | ✓ | ✓ | |
| Full duplicate | ✓ | ✓ | ✓ | ✓ |
| Custom | user-selected | user-selected | user-selected | user-selected |

Default mode: **Structure only** (notes off by default per spec policy).

Custom mode reveals the four checkboxes.

### Warning

When `copyNotes` is true, show warning callout:

```txt
This creates an independent copy of the source chart. Future edits will not sync with the original song.
```

---

## Built-In Templates (shared + API)

### Shared definitions — `packages/shared/src/song-templates.ts`

Export:

```typescript
interface SongTemplateDefinition {
  id: string
  name: string
  description: string
  category: SongCategory
  difficulty: SongDifficulty
  bpm: number
  timeSignature: string
  suggestedName: string
  createsLabel: string  // UI badge text
  sections?: Array<{ time: number; label: string; color?: string }>
  patterns?: Array<{ name: string; notes: PatternNote[] }>
  notes?: Array<{ track: number; time: number; noteType: NoteType; duration?: number; title?: string }>
}

export const SONG_TEMPLATES: SongTemplateDefinition[]
export function getSongTemplate(id: string): SongTemplateDefinition | undefined
```

### Template payloads (concrete content)

**empty-draft** — metadata only, no sections/patterns/notes.

**tap-starter** — 8 TAP notes on track 1, spaced 0.5s apart starting at t=1.0.

**mixed-mechanics** — 3 notes: TAP at t=1, HOLD at t=2 (duration 1.0), SWIPE at t=4.

**qa-validation** — sections at t=0 (Intro), t=8 (Verse), t=16 (Chorus); 2 overlapping-edge notes for validation demo at t=4 and t=4.05 on same track.

**sectioned-layout** — sections: Intro (0), Verse (8), Chorus (16), Outro (24).

**pattern-lab** — 2 patterns:
- "Basic 4-step" — 4 TAP notes with timeOffset 0/0.5/1.0/1.5
- "Hold swell" — 1 HOLD note duration 2.0

All template-created songs start as `DRAFT`. Templates never set status beyond Draft.

### API — `SongTemplateService`

New file: `apps/api/src/modules/songs/song-template.service.ts`

```typescript
materialize(templateId: string, songId: string, userId: string): Promise<void>
```

Called from `SongsService.createInProject` when `startType === 'TEMPLATE'` and `templateId` is set.

Behavior:
1. Look up template in shared definitions (import from `@ama-midi/shared`).
2. Validate `templateId` exists; throw `BadRequestException` if not.
3. Create sections via `sectionMarker.createMany`.
4. Create patterns via `notePattern.createMany`.
5. Create notes via `note.createMany`.

Follow the same direct-creation pattern as `copyImportedData` (no ledger events for bulk seed — consistent with import copy today).

Validate `templateId` required when `startType === 'TEMPLATE'` in DTO.

### DTO validation update

`CreateProjectSongDto`:
- When `startType === 'TEMPLATE'`, require `templateId`.
- When `startType === 'IMPORT'`, require `import` (existing).

---

## File Structure

```
packages/shared/src/
  song-templates.ts                    NEW — template definitions

apps/api/src/modules/songs/
  song-template.service.ts             NEW
  songs.service.ts                     UPDATE — call template service
  songs.module.ts                      UPDATE — register service
  dto/create-project-song.dto.ts       UPDATE — templateId required when TEMPLATE
  __tests__/song-template.service.spec.ts  NEW

apps/web/src/features/songs/
  QuickCreateSongButton.tsx            NEW
  create-wizard/
    CreateSongWizard.tsx               REFACTOR from flat file
    CreateSongWizardStepper.tsx        NEW
    ImportSongStep.tsx                 MOVE + refactor
    steps/
      StartStep.tsx                    NEW
      SetupStep.tsx                    NEW
      AssignmentStep.tsx               NEW
      ReviewStep.tsx                   NEW

apps/web/src/features/projects/
  ProjectPage.tsx                      UPDATE — quick create + Cmd+N

apps/web/tests/
  create-song-wizard.test.ts           NEW — wizard validation + template prefill
  song-templates.test.ts               NEW — shared template shape tests
```

Delete original `apps/web/src/features/songs/CreateSongWizard.tsx` after move (update imports).

---

## Data Flow

```txt
Quick Create
  ProjectPage → QuickCreateSongButton → POST /projects/:id/songs → navigate editor

Wizard
  ProjectPage → CreateSongWizard
    Step 1: startType + templateId | importOptions
    Step 2: name, category, difficulty, bpm, timeSignature
    Step 3: assignedComposerId, assignedQaId
    Step 4: review → POST /projects/:id/songs
      startType TEMPLATE → SongTemplateService.materialize()
      startType IMPORT   → copyImportedData()
      startType BLANK    → song row only
```

---

## Error Handling

| Scenario | UX |
|---|---|
| Create API failure | Toast error; modal stays open; review step buttons re-enabled |
| Invalid templateId | API 400; toast "Unknown template" |
| Import source inaccessible | API 403; toast on submit |
| Quick create failure | Toast; button re-enabled |
| Network timeout | Standard mutation error toast |

No silent failures. Loading states on all submit buttons.

---

## Testing

### Shared unit tests

- All 6 template IDs resolve via `getSongTemplate`.
- Each template has valid category/difficulty/BPM.
- Templates with notes: HOLD notes have duration > 0.
- Templates with patterns: notes use `timeOffset` not absolute time.

### API unit tests (`song-template.service.spec.ts`)

- Materializes sections for `sectioned-layout`.
- Materializes notes for `tap-starter`.
- Materializes patterns for `pattern-lab`.
- Unknown templateId throws BadRequestException.
- createInProject with TEMPLATE + templateId creates song + seeded data.

### Frontend tests (`create-song-wizard.test.ts`)

- Step validation: cannot advance Start (Import) without source song.
- Step validation: cannot advance Setup without name.
- Values preserved when navigating back.
- Template selection prefills setup defaults.
- Template overwrite confirm shown when setupTouched + new template.
- Review renders human-readable labels.

### Frontend tests (`quick-create`)

- Quick create sends blank defaults with current user as composer.
- Cmd+N handler skipped when input focused.

### Manual test plan

1. Quick Create → editor opens with "Untitled".
2. Wizard blank flow → Create and open → editor.
3. Each of 6 templates → verify seeded content in editor.
4. Import structure only → sections copied, notes not copied.
5. Import full duplicate → warning shown, notes copied.
6. Assignment pickers show project members only.
7. Review shows all selections before submit.

---

## Out of Scope

- Generic reusable `WizardShell` UI component.
- Project-selection step (wizard launched inside project only).
- Non-Draft initial status at create time.
- Project-owned custom templates (future: template songs in DB).
- Drawer layout variant.
- Duplicate name warning UI (allowed per spec policy).

---

## Migration / Rollout

No schema migration required. Template definitions are code-only. Existing create API extended with validation + materialization path.

Ship as single feature PR: backend template service first, then frontend wizard restyle + quick create.
