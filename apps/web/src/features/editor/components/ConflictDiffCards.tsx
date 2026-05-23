import { Avatar } from '../../../components/ui/Avatar'
import type { ConflictAction, PlacementConflict } from '@ama-midi/shared'
import { formatTime, formatOffset } from './conflict-formatters'

interface Props {
  conflict:      PlacementConflict
  resolution:    ConflictAction | undefined
  incomingLabel: string
}

const NOTE_TYPE_COLORS: Record<string, string> = {
  TAP:   'bg-[#EEF0FF] text-[#6C63FF]',
  HOLD:  'bg-red-50 text-red-500',
  SWIPE: 'bg-blue-50 text-blue-500',
}

function TypePill({ type }: { type: string }) {
  return (
    <span className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-semibold ${NOTE_TYPE_COLORS[type] ?? 'bg-slate-100 text-slate-500'}`}>
      {type}
    </span>
  )
}

function formatDate(iso: string): string {
  const d = new Date(iso)
  const date = d.toISOString().slice(0, 10)
  const time = d.toTimeString().slice(0, 5)
  return `${date} · ${time}`
}

export function ConflictDiffCards({ conflict, resolution, incomingLabel }: Props) {
  const { existingNote, incomingNote } = conflict
  const isReplacing = resolution === 'REPLACE_WITH_PATTERN'
  const isKeeping   = resolution === 'KEEP_EXISTING'
  const incomingUpper = incomingLabel.toUpperCase()

  const existingCls = isReplacing
    ? 'border-slate-200 bg-slate-50 opacity-50'
    : isKeeping
    ? 'border-red-200 bg-red-50'
    : 'border-slate-200 bg-slate-50'

  const incomingCls = isKeeping
    ? 'border-slate-200 bg-slate-50 opacity-50'
    : isReplacing
    ? 'border-[#6C63FF] bg-[#F5F3FF]'
    : 'border-slate-200 bg-slate-50'

  const existingLabel = isReplacing
    ? 'EXISTING — WILL BE REMOVED'
    : isKeeping
    ? 'EXISTING — WILL BE KEPT'
    : 'EXISTING NOTE'

  const existingLabelCls = isReplacing
    ? 'text-slate-400'
    : isKeeping
    ? 'text-red-500'
    : 'text-slate-400'

  const incomingSideLabel = isKeeping
    ? `${incomingUpper} — WILL BE SKIPPED`
    : isReplacing
    ? `${incomingUpper} — WILL BE CREATED`
    : `${incomingUpper} NOTE`

  const incomingLabelCls = isKeeping
    ? 'text-slate-400'
    : isReplacing
    ? 'text-[#6C63FF]'
    : 'text-slate-400'

  const incomingTitle = incomingNote.title || 'New note'

  return (
    <div className="flex items-start gap-3">
      <div className={`flex-1 rounded-xl border p-4 transition-all ${existingCls}`}>
        <div className={`text-[9px] font-bold tracking-wider mb-3 ${existingLabelCls}`}>
          {existingLabel}
        </div>
        <div className={`text-base font-bold text-slate-800 mb-2 ${isReplacing ? 'line-through text-slate-400' : ''}`}>
          {existingNote.title}
        </div>
        <TypePill type={existingNote.noteType} />
        {existingNote.duration != null && (
          <div className="text-xs text-slate-500 mt-2">
            Duration: {formatTime(existingNote.duration)}
          </div>
        )}
        <div className="flex items-center gap-2 mt-3">
          <Avatar
            src={existingNote.creatorAvatarUrl}
            name={existingNote.creatorName}
            size="xs"
          />
          <span className="text-xs text-slate-600">{existingNote.creatorName}</span>
        </div>
        <div className="text-[10px] text-slate-400 mt-1">
          {formatDate(existingNote.createdAt)}
        </div>
      </div>

      <div className="flex-shrink-0 mt-8 text-slate-300 text-lg">→</div>

      <div className={`flex-1 rounded-xl border p-4 transition-all ${incomingCls}`}>
        <div className={`text-[9px] font-bold tracking-wider mb-3 ${incomingLabelCls}`}>
          {incomingSideLabel}
        </div>
        <div className="text-base font-bold text-slate-400 mb-2">{incomingTitle}</div>
        <TypePill type={incomingNote.noteType} />
        {incomingNote.duration != null && (
          <div className="text-xs text-slate-500 mt-2">
            Duration: {formatTime(incomingNote.duration)}
          </div>
        )}
        {incomingNote.duration == null && (
          <div className="text-xs text-slate-400 mt-2">No duration</div>
        )}
        <div className="text-xs text-slate-400 mt-3">
          offset {formatOffset(incomingNote.timeOffset)} from anchor
        </div>
      </div>
    </div>
  )
}
