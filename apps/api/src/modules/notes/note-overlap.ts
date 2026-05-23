export interface NoteSpan {
  time: number
  noteType: string
  duration?: number | null
}

export function noteEnd(note: NoteSpan): number {
  if (note.noteType === 'HOLD' && note.duration != null && note.duration > 0) {
    return note.time + note.duration
  }
  return note.time
}

export function noteRange(note: NoteSpan): { start: number; end: number } {
  const start = note.time
  return { start, end: noteEnd(note) }
}

export function rangesOverlap(
  a: { start: number; end: number },
  b: { start: number; end: number },
): boolean {
  return a.start < b.end && b.start < a.end
}

export function overlapsAny(
  candidate: NoteSpan,
  others: NoteSpan[],
): boolean {
  const next = noteRange(candidate)
  return others.some((other) => rangesOverlap(next, noteRange(other)))
}
