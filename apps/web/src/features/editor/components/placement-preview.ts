import type {
  ConflictAction,
  NoteCopyPreview,
  PatternPastePreview,
  PlacementConflict,
  PlacementPreview,
} from '@ama-midi/shared'

export function patternPreviewToPlacement(preview: PatternPastePreview): PlacementPreview {
  return {
    songId: preview.songId,
    version: preview.patternVersion,
    anchorTime: preview.startTime,
    summary: {
      totalNotes: preview.summary.totalPatternNotes,
      creatableNotes: preview.summary.creatableNotes,
      conflictCount: preview.summary.conflictCount,
      affectedExistingNotes: preview.summary.affectedExistingNotes,
    },
    creatable: preview.creatable.map((slot) => ({
      sourceIndex: slot.patternNoteIndex,
      sourceNoteId: String(slot.patternNoteIndex),
      track: slot.track,
      time: slot.time,
      noteType: slot.noteType,
      duration: slot.duration,
      title: '',
      description: '',
    })),
    conflicts: preview.conflicts.map((conflict) => ({
      conflictId: conflict.conflictId,
      sourceIndex: conflict.patternNoteIndex,
      sourceNoteId: String(conflict.patternNoteIndex),
      track: conflict.track,
      time: conflict.time,
      incomingNote: {
        title: '',
        description: '',
        track: conflict.patternNote.track,
        timeOffset: conflict.patternNote.timeOffset,
        noteType: conflict.patternNote.noteType,
        duration: conflict.patternNote.duration,
      },
      existingNote: conflict.existingNote,
    })),
  }
}

export function noteCopyPreviewToPlacement(preview: NoteCopyPreview): PlacementPreview {
  return {
    songId: preview.songId,
    version: preview.selectionVersion,
    summary: preview.summary,
    creatable: preview.creatable,
    conflicts: preview.conflicts,
  }
}

export function mergeResolutions(
  old: Record<string, ConflictAction>,
  conflicts: PlacementConflict[],
): Record<string, ConflictAction> {
  const result: Record<string, ConflictAction> = {}
  for (const conflict of conflicts) {
    if (old[conflict.conflictId] === 'REPLACE_WITH_PATTERN') {
      result[conflict.conflictId] = 'REPLACE_WITH_PATTERN'
    }
  }
  return result
}
