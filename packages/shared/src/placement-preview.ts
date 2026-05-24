import type { ConflictAction, Note, NoteType } from './types'

export interface PlacementExistingNote {
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

export interface PlacementIncomingNote {
  title: string
  description: string
  track: number
  timeOffset: number
  noteType: NoteType
  duration?: number
}

export interface PlacementCreatableSlot {
  sourceIndex: number
  sourceNoteId: string
  track: number
  time: number
  noteType: NoteType
  duration?: number
  title: string
  description: string
}

export interface PlacementConflict {
  conflictId: string
  sourceIndex: number
  sourceNoteId: string
  track: number
  time: number
  incomingNote: PlacementIncomingNote
  existingNote: PlacementExistingNote
}

export interface PlacementSummary {
  totalNotes: number
  creatableNotes: number
  conflictCount: number
  affectedExistingNotes: number
}

export interface PlacementPreview {
  songId: string
  version: string
  anchorTime?: number
  summary: PlacementSummary
  creatable: PlacementCreatableSlot[]
  conflicts: PlacementConflict[]
}

export type ConflictResolutionMap = Record<string, ConflictAction>

export type NoteCopyOperation = 'COPY' | 'MOVE'
export type NoteCopyTransformMode = 'TIME_SHIFT' | 'TRACK_SHIFT' | 'TRACK_TIME_ANCHOR' | 'REPEAT_INTERVAL'

export interface NoteCopyPreviewRequest {
  noteIds: string[]
  operation: NoteCopyOperation
  mode: NoteCopyTransformMode
  timeDelta?: number
  targetTrack?: number
  anchorTrack?: number
  anchorTime?: number
  repeatCount?: number
  repeatInterval?: number
}

export interface NoteCopyApplyRequest extends NoteCopyPreviewRequest {
  selectionVersion: string
  resolutions: Array<{ conflictId: string; action: ConflictAction }>
}

export interface NoteCopyPreview {
  songId: string
  selectionVersion: string
  operation: NoteCopyOperation
  mode: NoteCopyTransformMode
  summary: PlacementSummary
  creatable: PlacementCreatableSlot[]
  conflicts: PlacementConflict[]
}

export interface NoteCopyApplyResult {
  batchId: string
  createdCount: number
  replacedCount: number
  skippedCount: number
  movedCount: number
  notes: Note[]
}
