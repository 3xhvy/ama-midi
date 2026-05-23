import { trackColor } from '@ama-midi/shared'
import type { PlacementConflict, PlacementPreview } from '@ama-midi/shared'
import { formatTime } from './conflict-formatters'

interface ContextEntry {
  time:       number
  isConflict: boolean
}

interface Props {
  conflict: PlacementConflict
  preview:  PlacementPreview
}

export function ConflictContextStrip({ conflict, preview }: Props) {
  const trackNotes: ContextEntry[] = []

  for (const c of preview.conflicts) {
    if (c.track === conflict.track) {
      trackNotes.push({ time: c.time, isConflict: c.conflictId === conflict.conflictId })
    }
  }

  for (const n of preview.creatable) {
    if (n.track === conflict.track) {
      trackNotes.push({ time: n.time, isConflict: false })
    }
  }

  const seen = new Set<number>()
  const sorted = trackNotes
    .filter(n => { if (seen.has(n.time)) return false; seen.add(n.time); return true })
    .sort((a, b) => a.time - b.time)

  const conflictIdx = sorted.findIndex(n => n.isConflict)

  const before = sorted.slice(Math.max(0, conflictIdx - 2), conflictIdx)
  const after  = sorted.slice(conflictIdx + 1, conflictIdx + 3)
  const color  = trackColor(conflict.track)

  return (
    <div className="rounded-lg border border-slate-100 bg-[#F8F7FF] px-3 py-2.5">
      <div className="text-[9px] font-semibold uppercase tracking-wider text-slate-400 mb-2">
        Surrounding context — Track {conflict.track}
      </div>
      <div className="flex items-end gap-4">
        {before.map(n => (
          <div key={n.time} className="flex flex-col items-center gap-1">
            <span className="w-3 h-3 rounded-full" style={{ backgroundColor: color }} />
            <span className="text-[8px] text-slate-400 font-mono">{formatTime(n.time)}</span>
          </div>
        ))}

        <div className="flex flex-col items-center gap-1">
          <span className="w-3.5 h-3.5 rounded-full border-2 border-red-500 bg-red-50 flex items-center justify-center text-[7px] font-bold text-red-500">
            !
          </span>
          <span className="text-[8px] font-mono font-semibold text-red-500">{formatTime(conflict.time)}</span>
        </div>

        {after.map(n => (
          <div key={n.time} className="flex flex-col items-center gap-1">
            <span className="w-3 h-3 rounded-full" style={{ backgroundColor: color }} />
            <span className="text-[8px] text-slate-400 font-mono">{formatTime(n.time)}</span>
          </div>
        ))}
      </div>
    </div>
  )
}
