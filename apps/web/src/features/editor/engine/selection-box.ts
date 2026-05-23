import type { Note } from '@ama-midi/shared'

export interface SelectionPoint {
  x: number
  y: number
}

export interface SelectionRect {
  left:   number
  top:    number
  width:  number
  height: number
}

export function getSelectionRect(start: SelectionPoint, current: SelectionPoint): SelectionRect {
  const left = Math.min(start.x, current.x)
  const top = Math.min(start.y, current.y)
  return {
    left,
    top,
    width:  Math.abs(current.x - start.x),
    height: Math.abs(current.y - start.y),
  }
}

export function selectNotesInBox({
  notes,
  rect,
  gridWidth,
  pxPerSecond,
}: {
  notes: Note[]
  rect: SelectionRect
  gridWidth: number
  pxPerSecond: number
}): string[] {
  const right = rect.left + rect.width
  const bottom = rect.top + rect.height
  const width = gridWidth / 8

  return notes
    .filter((note) => {
      const x = (note.track - 1) * width + width / 2
      const y = note.time * pxPerSecond
      return x >= rect.left && x <= right && y >= rect.top && y <= bottom
    })
    .map((note) => note.id)
}
