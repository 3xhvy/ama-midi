 Pattern Paste Conflict Review Plan (v2)

  Summary

  Git-like pattern paste flow with conflict resolution, batched
  ledger, atomic apply.

1. User clicks Paste on pattern.
2. Popup asks paste time.
3. Backend previews → returns creatable count, conflicts,
  existing-note creator details, patternVersion, stable
  conflictIds.
4. User resolves per-note: Keep Existing (default) / Replace
  With Pattern.
5. Bulk "Replace all" requires confirmation listing affected
  creators.
6. Backend revalidates inside transaction, applies atomically,
  emits one batched event.

  Hard rules:

- Replace = soft-delete existing + create new (ledger
  preserved).
- All events in one paste share batchId → single undo unit.
- Server is sole source for snap, conflict detection, pattern
  version check.

  Key Changes

  Shared Types (packages/shared/src/types.ts)

  export type ConflictAction = 'KEEP_EXISTING' |
  'REPLACE_WITH_PATTERN'

  export interface PatternPastePreviewRequest {
    songId: string
    startTime: number
  }

  export interface PatternPasteCreatableNote {
    patternNoteIndex: number
    track: number
    time: number
    noteType: NoteType
    duration?: number
  }

  export interface PatternPasteConflict {
    conflictId: string              // = existingNote.id (stable
  across previews)
    patternNoteIndex: number
    track: number
    time: number
    patternNote: {
      track: number
      timeOffset: number
      noteType: NoteType
      duration?: number
    }
    existingNote: {
      id: string
      title: string
      description: string
      track: number
      time: number
      noteType: NoteType
      duration?: number
      createdBy: string
      creatorName: string
      creatorAvatarUrl?: string
      createdAt: string
    }
  }

  export interface PatternPastePreview {
    patternId: string
    patternVersion: string          // updatedAt ISO; guards
  mid-flow pattern edits
    songId: string
    startTime: number               // server-snapped value
    summary: {
      totalPatternNotes: number
      creatableNotes: number
      conflictCount: number
      affectedExistingNotes: number
    }
    creatable: PatternPasteCreatableNote[]
    conflicts: PatternPasteConflict[]
  }

  export interface PatternPasteApplyRequest {
    songId: string
    startTime: number
    patternVersion: string          // must match server
    resolutions: Array<{
      conflictId: string
      action: ConflictAction
    }>
  }

  export interface PatternPasteApplyResult {
    batchId: string
    createdCount: number
    replacedCount: number
    skippedCount: number
    notes: Note[]
  }

  Backend API (apps/api/src/modules/patterns)

  Two authenticated endpoints:

  POST /patterns/:patternId/preview-paste
  POST /patterns/:patternId/apply-paste

  Limits:

- MAX_PATTERN_PASTE_NOTES = 500. Reject larger pattern with 422.

  Error codes:

- 403 — user cannot edit song chart.
- 409 CONFLICTS_CHANGED — returns fresh preview payload.
- 409 PATTERN_VERSION_CHANGED — returns fresh preview payload.
- 422 — pattern too large / invalid startTime.

  Backend Behavior

  Extract shared overlap detector to
  apps/api/src/modules/notes/note-overlap.util.ts:

  export interface NoteSlot {
    track: number
    time: number
    noteType: NoteType
    duration?: number
  }
  export function notesOverlap(a: NoteSlot, b: NoteSlot): boolean
  export function findOverlapping(
    candidate: NoteSlot,
    existing: NoteSlot[],
  ): NoteSlot | undefined

  NotesService and PatternsService both call this. No duplicated
  rules.

  Snap util (note-snap.util.ts): single snapTime(t) used
  everywhere. Client never snaps for conflict purposes.

  Preview (PatternsService.previewPaste):

1. Load pattern (updatedAt → patternVersion).
2. Assert ProjectAccessService.canEditSong(user, songId).
3. Reject if pattern.notes.length > MAX_PATTERN_PASTE_NOTES.
4. For each pattern note: time = snapTime(startTime +
  timeOffset), clamp to [TIME_MIN, TIME_MAX], validate track ∈
  [TRACK_MIN, TRACK_MAX].
5. Load active notes for (songId, track ∈ patternTracks, time ∈
  paste window).
6. Use findOverlapping → split into creatable vs conflicts.
7. Hydrate conflicts with creator (User join → name, avatarUrl).
8. conflictId = existingNote.id.
9. Return payload.

  Apply (PatternsService.applyPaste) — inside prisma.$transaction:

1. Reload pattern. If updatedAt.toISOString() !==
  request.patternVersion → 409 PATTERN_VERSION_CHANGED + fresh
  preview.
2. Re-run preview logic inside txn.
3. Build current conflictId set. Compare to request resolutions:
- Missing resolution for current conflict → 409
  CONFLICTS_CHANGED.
- New conflict not in request → 409 CONFLICTS_CHANGED.
4. Generate batchId = uuid().
5. For REPLACE_WITH_PATTERN:
- Soft-delete existing note (deleted_at = now).
- Emit NOTE_DELETED with batchId, actorId = user.id,
  replacedByBatch: true.
6. For each creatable + each replace-selected pattern note:
- Create note (createdBy = user.id).
- Emit NOTE_CREATED with batchId, replacesNoteId? linking to
  soft-deleted note.
7. Emit single realtime broadcast notes:batch-applied with {
  batchId, created: Note[], deleted: string[] } — collaborators
  apply in one render pass.
8. Return result.

  Atomicity: txn ensures unique-index
  uq_notes_song_track_time_active cannot trip (deletes happen
  before inserts at same (track, time)).

  Ledger Schema Tweak (apps/api/prisma/schema.prisma)

  Add to NoteEvent:

  batchId       String?  @db.Uuid
  replacesNoteId String? @db.Uuid

  @@index([batchId])

  Migration: add_note_event_batch_id.

  Undo behavior:

- Single undo on a batchId reverts whole paste (compensating
  events for every note in batch).
- Update UndoService to detect batchId and group.

  Realtime (apps/api/src/modules/realtime)

  New event:

  interface NotesBatchAppliedPayload {
    songId: string
    batchId: string
    created: Note[]
    deletedIds: string[]
    actorId: string
  }

  Channel: existing song room. Replaces N individual note:created
  / note:deleted for paste flow only. Single-note paths unchanged.

  Frontend useSocket handler merges into React Query cache in one
  update.

  Frontend
  (apps/web/src/features/editor/components/PatternPanel.tsx)

  State machine inside popup:

  INPUT → VALIDATING → REVIEW → (CONFIRM_REPLACE_ALL) → APPLYING →
   DONE
                                                      ↘ ERROR_409
  → REVIEW (fresh)

  Initial state:

  Pattern: 
  Notes in pattern: 
  Paste at: [____] s
  [Cancel] [Validate]

  No conflicts:

  8 pattern notes
  8 will be created
  0 conflicts
  [Cancel] [Paste]

  With conflicts:

  8 pattern notes
  5 will be created
  3 conflicts found · 3 existing notes affected

  [Keep all existing]  [Replace all conflicts]

  — Conflicts —
  Track 2 · 42.5s
  Existing: "Kick 42.5" · TAP · Linh Nguyen · 2026-05-12
  Pattern:  TAP · offset +0.0s
  [ Keep Existing ] [ Replace With Pattern ]
  ...

  — Summary —
  Create 5 · Replace 0 · Skip 3
  [Cancel] [Apply Paste]

  Replace-all confirmation:

  Replace 3 existing notes?
  Removes notes by:
    Linh Nguyen: 2
    Minh Tran: 1
  Recorded in history. Undo restores all.
  [Cancel] [Replace all]

  Apply button disabled when createdCount === 0 && replacedCount
  === 0.

  Frontend State (apps/web/src/features/patterns/usePatterns.ts)

  usePreviewPatternPaste(patternId)   // POST /preview-paste
  useApplyPatternPaste(patternId)     // POST /apply-paste

  interface PastePopupState {
    phase: 'INPUT' | 'REVIEW' | 'CONFIRM_REPLACE_ALL' | 'APPLYING'
   | 'DONE'
    startTime: number
    preview?: PatternPastePreview
    resolutions: Record<string, ConflictAction>  // keyed by
  conflictId
  }

  On 409 response:

- Replace preview with payload from error.
- Reset resolutions: keep prior REPLACE_WITH_PATTERN for
  still-present conflictIds, default new ones to KEEP_EXISTING.
- Banner: "Conflicts changed. Review again."

  Test Plan

  Backend

  PatternsService:

- Preview returns all creatable when no overlap.
- Preview detects exact (track, time) conflict.
- Preview detects HOLD overlap (existing HOLD covering pattern
  TAP, pattern HOLD over existing TAP).
- Preview rejects pattern > 500 notes (422).
- Preview rejects user without edit access (403).
- Preview snaps startTime server-side (client sends 42.53 →
  server uses 42.5).
- Apply with all KEEP_EXISTING creates only safe notes, no
  deletes.
- Apply with REPLACE_WITH_PATTERN soft-deletes + creates, both
  events share batchId.
- Apply replaces note created by different user when actor has
  edit access.
- Apply returns 409 CONFLICTS_CHANGED when concurrent note added
   in target slot.
- Apply returns 409 PATTERN_VERSION_CHANGED when pattern edited
  mid-flow.
- Apply emits one notes:batch-applied event, not N individual
  events.
- NoteEvent.batchId populated for every event in batch.
- replacesNoteId links create event to soft-deleted note.

  NoteOverlapUtil:

- Unit tests parity with existing NotesService overlap behavior
  (regression guard).

  UndoService:

- Undoing one event in a batch undoes whole batch.
- Redo restores whole batch.

  Frontend

  PatternPanel:

- Popup INPUT phase validates positive startTime.
- REVIEW shows totals + per-conflict creator name + avatar.
- Default resolutions[id] = KEEP_EXISTING.
- "Replace all conflicts" opens CONFIRM_REPLACE_ALL with grouped
   creator counts.
- Apply payload includes patternVersion + every current
  conflictId.
- 409 response replaces preview, preserves user-selected REPLACE
   intents for surviving conflictIds.
- Apply button disabled when create + replace counts both zero.

  useSocket:

- notes:batch-applied merges created + deleted in single cache
  update.

  Manual QA

- Paste pattern, no conflicts → notes appear, single batch event
   in history.
- Paste with TAP exact conflict, Keep → existing untouched,
  pattern note skipped.
- Paste with HOLD overlap, Replace → existing soft-deleted, new
  HOLD created.
- Two browsers: B adds note in paste window between A's preview
  and apply → A sees 409, popup refreshes with new conflict.
- Two browsers: B edits pattern between A's preview and apply →
  A sees 409 PATTERN_VERSION_CHANGED.
- Undo after replace-all → all soft-deletes restored, all new
  notes removed, one undo step.
- History panel shows batch as grouped entry, not 2N rows.
- Pattern > 500 notes → 422, popup shows clear error.
- Collaborator receives one socket event, piano roll updates
  without flicker.

  Assumptions

- pattern.updatedAt mutates only when pattern notes change.
  Pattern rename does not break in-flight paste (decision: include
   name changes too — simpler invariant).
- batchId grouping is project-wide undo contract; non-paste
  paths continue using per-event undo, treated as batchId =
  eventId.
- MAX_PATTERN_PASTE_NOTES = 500 is initial cap; revisit after
  telemetry.
- Replace permission gated only by canEditSong. Per-creator ACL
  not in scope; auditability via ledger + replacesNoteId is
  sufficient.
- Existing single-note create/delete socket events unchanged;
  only paste introduces notes:batch-applied.