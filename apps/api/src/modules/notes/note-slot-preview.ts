import { ConflictException } from '@nestjs/common'
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

/** Incoming note that repeats an existing note at the same slot (LLM echo) — not a merge conflict. */
export function isUnchangedEcho(
  incoming: Pick<IncomingSlot, 'track' | 'time' | 'noteType' | 'duration'>,
  existing: Pick<ExistingSlotRow, 'track' | 'time' | 'noteType' | 'duration'>,
): boolean {
  if (incoming.track !== existing.track || incoming.time !== existing.time) return false

  const inType = incoming.noteType.toUpperCase()
  const exType = existing.noteType.toUpperCase()

  if (inType === 'TAP' && exType === 'TAP') return true

  if (inType === 'HOLD' && exType === 'HOLD') {
    const inDur = Math.round((incoming.duration ?? 0) * 10) / 10
    const exDur = Math.round((existing.duration ?? 0) * 10) / 10
    return inDur === exDur
  }

  return false
}

export function filterUnchangedEchoes(
  incoming: IncomingSlot[],
  existingRows: ExistingSlotRow[],
): IncomingSlot[] {
  if (existingRows.length === 0) return incoming

  const byStartKey = new Map<string, ExistingSlotRow>()
  for (const row of existingRows) {
    byStartKey.set(`${row.track}:${row.time}`, row)
  }

  return incoming.filter((slot) => {
    const existing = byStartKey.get(`${slot.track}:${slot.time}`)
    if (!existing) return true
    return !isUnchangedEcho(slot, existing)
  })
}

function toNoteSlot(slot: Pick<IncomingSlot, 'track' | 'time' | 'noteType' | 'duration'>): NoteSlot {
  return {
    track: slot.track,
    time: slot.time,
    noteType: slot.noteType,
    duration: slot.duration ?? null,
  }
}

/** Drop later incoming notes that overlap an earlier one on the same track (LLM duplicates / hold+tap). */
export function filterInternalOverlaps(slots: IncomingSlot[]): IncomingSlot[] {
  const accepted: NoteSlot[] = []
  const out: IncomingSlot[] = []

  for (const slot of slots) {
    const candidate = toNoteSlot(slot)
    if (findOverlapping(candidate, accepted)) continue
    accepted.push(candidate)
    out.push(slot)
  }

  return out
}

export function detectInternalCollision(slots: IncomingSlot[]): boolean {
  for (let i = 0; i < slots.length; i++) {
    for (let j = i + 1; j < slots.length; j++) {
      if (notesOverlap(toNoteSlot(slots[i]), toNoteSlot(slots[j]))) return true
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

export function assertNoFinalCreateOverlaps(
  slots: Array<Pick<IncomingSlot, 'track' | 'time' | 'noteType' | 'duration'>>,
  activeExisting: NoteSlot[],
): void {
  const pendingCreates: NoteSlot[] = []

  for (const slot of slots) {
    const candidate = toNoteSlot(slot)
    if (findOverlapping(candidate, [...activeExisting, ...pendingCreates])) {
      throw new ConflictException({ error: 'POSITION_TAKEN' })
    }
    pendingCreates.push(candidate)
  }
}
