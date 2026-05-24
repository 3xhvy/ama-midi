import { useMemo } from 'react'
import type { Note } from '@ama-midi/shared'
import { trackColor } from '@ama-midi/shared'

interface Props {
  playheadTime: number
  notes:        Note[]
}

export function computeNps(notes: Note[], time: number, windowSeconds = 2): number {
  const half  = windowSeconds / 2
  const count = notes.filter(n => n.time >= time - half && n.time <= time + half).length
  return Math.round((count / windowSeconds) * 10) / 10
}

function npsColor(nps: number): string {
  if (nps < 3) return '#10B981'
  if (nps < 6) return '#F59E0B'
  return '#EF4444'
}

export function LiveContextStrip({ playheadTime, notes }: Props) {
  const nearNotes = useMemo(
    () => notes
      .filter(n => Math.abs(n.time - playheadTime) <= 1)
      .sort((a, b) => Math.abs(a.time - playheadTime) - Math.abs(b.time - playheadTime))
      .slice(0, 5),
    [notes, playheadTime],
  )

  const nps   = useMemo(() => computeNps(notes, playheadTime), [notes, playheadTime])
  const color = npsColor(nps)

  return (
    <div className="editor-chrome-bar shrink-0 border-b px-3 py-2">
      {/* NPS label */}
      <div className="flex items-center justify-end mb-1">
        <span className="text-[10px] font-mono" style={{ color }}>
          {nps} NPS
        </span>
      </div>

      {/* NPS bar */}
      <div className="w-full h-1 rounded-full bg-shell-border mb-2">
        <div
          className="h-full rounded-full transition-all"
          style={{ width: `${Math.min(100, (nps / 10) * 100)}%`, backgroundColor: color }}
        />
      </div>

      {/* Near notes */}
      {nearNotes.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {nearNotes.map((n) => (
            <span
              key={n.id}
              className="text-[9px] px-1 rounded font-mono text-white"
              style={{ backgroundColor: trackColor(n.track) + 'CC' }}
            >
              T{n.track}@{n.time}s
            </span>
          ))}
        </div>
      )}
    </div>
  )
}
