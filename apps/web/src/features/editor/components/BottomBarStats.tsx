import { useMemo } from 'react'
import { analyzeChart, maxCombo, computeNpsOverTime } from '../engine/difficulty-calculator'
import { SongDifficultyEnum, type Note } from '@ama-midi/shared'
import { Skeleton } from '../../../components/ui'

interface Props {
  notes: Note[]
  bpm?: number
  speedMultiplier?: number
  isLoading?: boolean
}

const TIER_TEXT: Record<string, string> = {
  EASY: 'text-green-400',
  NORMAL: 'text-blue-400',
  HARD: 'text-orange-400',
  EXPERT: 'text-red-400',
  MASTER: 'text-red-500',
}

export function BottomBarStats({ notes, bpm = 120, speedMultiplier = 1, isLoading = false }: Props) {
  const tier = useMemo(() => {
    const r = analyzeChart({
      notes: notes.map((n) => ({
        track: n.track,
        time: n.time,
        noteType: n.noteType,
        duration: n.duration,
      })),
      bpm,
      timeSignature: '4/4',
      speedMultiplier,
    })
    return r.computedDifficulty
  }, [notes, bpm, speedMultiplier])

  const combo = useMemo(() => maxCombo(notes), [notes])
  const peakNps = useMemo(() => {
    const bands = computeNpsOverTime(notes)
    return bands.length ? Math.max(...bands.map((b) => b.nps)) : 0
  }, [notes])

  return (
    <div data-tour="song-difficulty-stats" className="px-3 py-2 grid grid-cols-2 gap-x-4 gap-y-1.5 text-xs text-shell-muted">
      <span>Notes</span>
      {isLoading ? <Skeleton height={10} width={32} className="justify-self-end self-center" /> : <span className="font-medium text-right text-shell-text">{notes.length}</span>}
      <span>Max combo</span>
      {isLoading ? <Skeleton height={10} width={40} className="justify-self-end self-center" /> : <span className="font-medium text-right text-shell-text">{combo}</span>}
      <span>Peak NPS</span>
      {isLoading ? <Skeleton height={10} width={28} className="justify-self-end self-center" /> : <span className="font-medium text-right text-shell-text">{peakNps.toFixed(1)}</span>}
      <span>Difficulty</span>
      {isLoading ? <Skeleton height={10} width={44} className="justify-self-end self-center" /> : <span className={`font-semibold text-right ${TIER_TEXT[tier] ?? 'text-shell-text'}`}>{SongDifficultyEnum.label(tier)}</span>}
    </div>
  )
}
