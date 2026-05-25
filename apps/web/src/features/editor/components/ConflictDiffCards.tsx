import { Avatar } from '../../../components/ui/Avatar'
import type { ConflictAction, PlacementConflict } from '@ama-midi/shared'
import { formatTime, formatOffset } from './conflict-formatters'
import type { CSSProperties } from 'react'
import { typePillStyle } from './conflict-theme'

interface Props {
  conflict:      PlacementConflict
  resolution:    ConflictAction | undefined
  incomingLabel: string
}

function TypePill({ type }: { type: string }) {
  return (
    <span
      className="inline-block px-2 py-0.5 rounded-full text-[10px] font-semibold"
      style={typePillStyle(type)}
    >
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

function cardStyle(
  variant: 'neutral' | 'dimmed' | 'keep' | 'incoming',
): CSSProperties {
  switch (variant) {
    case 'dimmed':
      return {
        backgroundColor: 'var(--conflict-card-bg)',
        borderColor: 'var(--conflict-card-border)',
        opacity: 0.55,
      }
    case 'keep':
      return {
        backgroundColor: 'var(--conflict-keep-bg)',
        borderColor: 'var(--conflict-keep-border)',
      }
    case 'incoming':
      return {
        backgroundColor: 'var(--conflict-incoming-bg)',
        borderColor: 'var(--conflict-incoming-border)',
      }
    default:
      return {
        backgroundColor: 'var(--conflict-card-bg)',
        borderColor: 'var(--conflict-card-border)',
      }
  }
}

export function ConflictDiffCards({ conflict, resolution, incomingLabel }: Props) {
  const { existingNote, incomingNote } = conflict
  const isReplacing = resolution === 'REPLACE_WITH_PATTERN'
  const isKeeping   = resolution === 'KEEP_EXISTING'
  const incomingUpper = incomingLabel.toUpperCase()

  const existingVariant = isReplacing ? 'dimmed' : isKeeping ? 'keep' : 'neutral'
  const incomingVariant = isKeeping ? 'dimmed' : isReplacing ? 'incoming' : 'neutral'

  const existingLabel = isReplacing
    ? 'EXISTING — WILL BE REMOVED'
    : isKeeping
    ? 'EXISTING — WILL BE KEPT'
    : 'EXISTING NOTE'

  const existingLabelColor = isReplacing
    ? 'var(--modal-muted)'
    : isKeeping
    ? 'var(--conflict-success)'
    : 'var(--modal-muted)'

  const incomingSideLabel = isKeeping
    ? `${incomingUpper} — WILL BE SKIPPED`
    : isReplacing
    ? `${incomingUpper} — WILL BE CREATED`
    : `${incomingUpper} NOTE`

  const incomingLabelColor = isKeeping
    ? 'var(--modal-muted)'
    : isReplacing
    ? 'var(--conflict-accent)'
    : 'var(--modal-muted)'

  const incomingTitle = incomingNote.title || 'New note'

  return (
    <div className="flex items-start gap-3">
      <div
        className="flex-1 rounded-xl border p-4 transition-all"
        style={cardStyle(existingVariant)}
      >
        <div className="text-[9px] font-bold tracking-wider mb-3" style={{ color: existingLabelColor }}>
          {existingLabel}
        </div>
        <div
          className={`text-base font-bold mb-2 ${isReplacing ? 'line-through' : ''}`}
          style={{ color: isReplacing ? 'var(--modal-muted)' : 'var(--modal-text)' }}
        >
          {existingNote.title}
        </div>
        <TypePill type={existingNote.noteType} />
        {existingNote.duration != null && (
          <div className="text-xs mt-2" style={{ color: 'var(--modal-muted)' }}>
            Duration: {formatTime(existingNote.duration)}
          </div>
        )}
        <div className="flex items-center gap-2 mt-3">
          <Avatar
            src={existingNote.creatorAvatarUrl}
            name={existingNote.creatorName}
            size="xs"
          />
          <span className="text-xs" style={{ color: 'var(--modal-text)' }}>{existingNote.creatorName}</span>
        </div>
        <div className="text-[10px] mt-1" style={{ color: 'var(--modal-muted)' }}>
          {formatDate(existingNote.createdAt)}
        </div>
      </div>

      <div className="flex-shrink-0 mt-8 text-lg" style={{ color: 'var(--modal-muted)' }}>→</div>

      <div
        className="flex-1 rounded-xl border p-4 transition-all"
        style={cardStyle(incomingVariant)}
      >
        <div className="text-[9px] font-bold tracking-wider mb-3" style={{ color: incomingLabelColor }}>
          {incomingSideLabel}
        </div>
        <div className="text-base font-bold mb-2" style={{ color: 'var(--modal-muted)' }}>{incomingTitle}</div>
        <TypePill type={incomingNote.noteType} />
        {incomingNote.duration != null && (
          <div className="text-xs mt-2" style={{ color: 'var(--modal-muted)' }}>
            Duration: {formatTime(incomingNote.duration)}
          </div>
        )}
        {incomingNote.duration == null && (
          <div className="text-xs mt-2" style={{ color: 'var(--modal-muted)' }}>No duration</div>
        )}
        <div className="text-xs mt-3" style={{ color: 'var(--modal-muted)' }}>
          offset {formatOffset(incomingNote.timeOffset)} from anchor
        </div>
      </div>
    </div>
  )
}
