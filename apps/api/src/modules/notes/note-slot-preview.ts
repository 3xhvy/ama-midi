import type { NoteType } from '@ama-midi/shared'
import { findOverlapping, notesOverlap, type NoteSlot } from './note-overlap'

export interface IncomingSlot {
  sourceIndex: number
  sourceNoteId: string
  track: number
  time: number
  noteType: string
  duration?: number | null
  title: string
  description: string
}

export interface ExistingSlotRow extends NoteSlot {
  id: string
}

export interface ClassifiedCreatable {
  sourceIndex: number
  sourceNoteId: string
  track: number
  time: number
  noteType: NoteType
  duration?: number
  title: string
  description: string
}

export interface ClassifiedConflict {
  conflictId: string
  sourceIndex: number
  sourceNoteId: string
  track: number
  time: number
  incomingNote: {
    title: string
    description: string
    track: number
    timeOffset: number
    noteType: NoteType
    duration?: number
  }
  existingNote: ExistingSlotRow
}

export interface ClassifySlotsResult {
  creatable: ClassifiedCreatable[]
  conflicts: ClassifiedConflict[]
  internalCollision: boolean
}

export function detectInternalCollision(slots: IncomingSlot[]): boolean {
  for (let i = 0; i < slots.length; i++) {
    for (let j = i + 1; j < slots.length; j++) {
      const a: NoteSlot = {
        track: slots[i].track,
        time: slots[i].time,
        noteType: slots[i].noteType,
        duration: slots[i].duration ?? null,
      }
      const b: NoteSlot = {
        track: slots[j].track,
        time: slots[j].time,
        noteType: slots[j].noteType,
        duration: slots[j].duration ?? null,
      }
      if (notesOverlap(a, b)) return true
    }
  }
  return false
}

export function classifySlots(
  slots: IncomingSlot[],
  existingRows: ExistingSlotRow[],
  excludeIds: Set<string>,
  anchorTime = 0,
): ClassifySlotsResult {
  const internalCollision = detectInternalCollision(slots)
  if (internalCollision) {
    return { creatable: [], conflicts: [], internalCollision: true }
  }

  const filteredExisting = existingRows.filter((row) => !excludeIds.has(row.id))
  const creatable: ClassifiedCreatable[] = []
  const conflicts: ClassifiedConflict[] = []

  for (const slot of slots) {
    const candidate: NoteSlot = {
      track: slot.track,
      time: slot.time,
      noteType: slot.noteType,
      duration: slot.duration ?? null,
    }

    const overlap = findOverlapping(candidate, filteredExisting)
    if (overlap) {
      conflicts.push({
        conflictId: overlap.id,
        sourceIndex: slot.sourceIndex,
        sourceNoteId: slot.sourceNoteId,
        track: slot.track,
        time: slot.time,
        incomingNote: {
          title: slot.title,
          description: slot.description,
          track: slot.track,
          timeOffset: Math.round((slot.time - anchorTime) * 10) / 10,
          noteType: slot.noteType as NoteType,
          duration: slot.duration ?? undefined,
        },
        existingNote: overlap,
      })
    } else {
      creatable.push({
        sourceIndex: slot.sourceIndex,
        sourceNoteId: slot.sourceNoteId,
        track: slot.track,
        time: slot.time,
        noteType: slot.noteType as NoteType,
        duration: slot.duration ?? undefined,
        title: slot.title,
        description: slot.description,
      })
    }
  }

  return { creatable, conflicts, internalCollision: false }
}
