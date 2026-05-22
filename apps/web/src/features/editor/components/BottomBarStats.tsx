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
    <div className="flex items-center gap-4 text-xs text-shell-muted px-3">
      <span><span className="text-shell-text font-medium">{notes.length}</span> notes</span>
      <span>Max combo: <span className="text-shell-text font-medium">{combo}</span></span>
      <span>Peak NPS: <span className="text-shell-text font-medium">{peakNps.toFixed(1)}</span></span>
      <span>Difficulty: <span className={`font-semibold ${RATING_COLOR[rating]}`}>{rating}</span></span>
    </div>
  )
}
