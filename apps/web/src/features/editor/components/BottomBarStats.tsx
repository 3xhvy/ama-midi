import { useMemo } from 'react'
import { maxCombo, difficultyRating, computeNpsOverTime } from '../engine/difficulty-calculator'
import type { Note } from '@ama-midi/shared'

interface Props { notes: Note[] }

const RATING_COLOR: Record<string, string> = {
  Easy:   'text-green-400',
  Normal: 'text-yellow-400',
  Hard:   'text-orange-400',
  Expert: 'text-red-400',
}

export function BottomBarStats({ notes }: Props) {
  const rating = useMemo(() => difficultyRating(notes), [notes])
  const combo  = useMemo(() => maxCombo(notes),         [notes])
  const peakNps = useMemo(() => {
    const bands = computeNpsOverTime(notes)
    return bands.length ? Math.max(...bands.map(b => b.nps)) : 0
  }, [notes])

  return (
    <div className="px-3 py-2 grid grid-cols-2 gap-x-4 gap-y-1.5 text-xs" style={{ color: 'var(--color-editor-field-label)' }}>
      <span>Notes</span>
      <span className="font-medium text-right" style={{ color: 'var(--color-editor-stat-value)' }}>{notes.length}</span>
      <span>Max combo</span>
      <span className="font-medium text-right" style={{ color: 'var(--color-editor-stat-value)' }}>{combo}</span>
      <span>Peak NPS</span>
      <span className="font-medium text-right" style={{ color: 'var(--color-editor-stat-value)' }}>{peakNps.toFixed(1)}</span>
      <span>Difficulty</span>
      <span className={`font-semibold text-right ${RATING_COLOR[rating]}`}>{rating}</span>
    </div>
  )
}
