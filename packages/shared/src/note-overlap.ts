export interface NoteSpan {
  time: number
  noteType: string
  duration?: number | null
}

export interface NoteSlot extends NoteSpan {
  track: number
}

function isHoldSpan(note: NoteSpan): boolean {
  return note.noteType?.toUpperCase() === 'HOLD'
    && note.duration != null
    && note.duration > 0
}

export function noteEnd(note: NoteSpan): number {
  if (isHoldSpan(note)) {
    return note.time + note.duration!
  }
  return note.time
}

export function noteRange(note: NoteSpan): { start: number; end: number } {
  const start = note.time
  const end = noteEnd(note)
  return end === start ? { start, end: start + 0.0001 } : { start, end }
}

export function rangesOverlap(
  a: { start: number; end: number },
  b: { start: number; end: number },
): boolean {
  return a.start < b.end && b.start < a.end
}

export function notesOverlap(a: NoteSlot, b: NoteSlot): boolean {
  return a.track === b.track && rangesOverlap(noteRange(a), noteRange(b))
}

export function findOverlapping<T extends NoteSlot>(
  candidate: NoteSlot,
  existing: T[],
): T | undefined {
  return existing.find((note) => notesOverlap(candidate, note))
}

export function overlapsAny(
  candidate: NoteSpan,
  others: NoteSpan[],
): boolean {
  const next = noteRange(candidate)
  return others.some((other) => rangesOverlap(next, noteRange(other)))
}
