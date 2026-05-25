import type { Note, NoteType } from '@ama-midi/shared'
import type {
  PlacementPreview,
  PlacementCreatableSlot,
  PlacementConflict,
  PlacementExistingNote,
  PlacementIncomingNote,
} from '@ama-midi/shared'
import type { DraftTapNote } from '../../../store/editor.store'

interface BuildPreviewOptions {
  songId:        string
  draftNotes:    DraftTapNote[]
  existingNotes: Note[]
  offset:        number  // seconds to add to each draft note time
}

function noteTypeFor(draft: DraftTapNote): NoteType {
  return draft.duration != null && draft.duration > 0 ? 'HOLD' : 'TAP'
}

export function buildTapPlacementPreview({
  songId,
  draftNotes,
  existingNotes,
  offset,
}: BuildPreviewOptions): PlacementPreview {
  const creatable: PlacementCreatableSlot[] = []
  const conflicts: PlacementConflict[]      = []
  const claimedSlots = new Set<string>()

  draftNotes.forEach((draft, index) => {
    const time     = Math.round((draft.time + offset) * 100) / 100
    const slotKey  = `${draft.track}:${time}`
    const noteType = noteTypeFor(draft)
    const existing = existingNotes.find(
      (n) => n.track === draft.track && n.time === time,
    )

    const incoming: PlacementIncomingNote = {
      title:       '',
      description: '',
      track:       draft.track,
      timeOffset:  time,
      noteType,
      duration:    draft.duration,
    }

    if (existing) {
      const existingNote: PlacementExistingNote = {
        id:               existing.id,
        title:            existing.title,
        description:      existing.description,
        track:            existing.track,
        time:             existing.time,
        noteType:         existing.noteType as NoteType,
        duration:         existing.duration,
        createdBy:        existing.createdBy,
        creatorName:      existing.creatorName,
        creatorAvatarUrl: existing.creatorAvatarUrl,
        createdAt:        existing.createdAt,
      }
      conflicts.push({
        conflictId:   `tap-${index}-${draft.track}-${time}`,
        sourceIndex:  index,
        sourceNoteId: `tap-draft-${index}`,
        track:        draft.track,
        time,
        incomingNote: incoming,
        existingNote,
      })
    } else if (claimedSlots.has(slotKey)) {
      // Duplicate slot within the same tap session (e.g. before store dedup existed)
    } else {
      claimedSlots.add(slotKey)
      creatable.push({
        sourceIndex:  index,
        sourceNoteId: `tap-draft-${index}`,
        track:        draft.track,
        time,
        noteType,
        duration:     draft.duration,
        title:        '',
        description:  '',
      })
    }
  })

  return {
    songId,
    version: 'tap-session',
    summary: {
      totalNotes:            draftNotes.length,
      creatableNotes:        creatable.length,
      conflictCount:         conflicts.length,
      affectedExistingNotes: conflicts.length,
    },
    creatable,
    conflicts,
  }
}
