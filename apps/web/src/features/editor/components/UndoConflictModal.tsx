import { useState, useCallback, useEffect } from 'react'
import type { UndoConflict, UndoPreview } from '@ama-midi/shared'
import { trackColor } from '@ama-midi/shared'
import { formatTime } from './conflict-formatters'
import { conflictChipStyle, typePillStyle } from './conflict-theme'
import type { UndoResolution } from '../../undo/undo.types'

interface Props {
  preview:     UndoPreview
  resolutions: Record<string, UndoResolution['action']>
  onResolve:   (conflictId: string, action: UndoResolution['action']) => void
  onApply:     () => void
  onCancel:    () => void
}

function TypePill({ type }: { type: string }) {
  return (
    <span className="inline-block px-1.5 py-0.5 rounded text-[9px] font-semibold" style={typePillStyle(type)}>
      {type}
    </span>
  )
}

function StatusDot({ resolution }: { resolution: UndoResolution['action'] | undefined }) {
  const color = resolution === 'KEEP_EXISTING'
    ? 'var(--conflict-success)'
    : resolution === 'REPLACE_WITH_UNDO'
    ? 'var(--conflict-danger)'
    : 'var(--conflict-warning)'
  return <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: color }} />
}

function UndoConflictListItem({
  conflict,
  resolution,
  isActive,
  onClick,
}: {
  conflict:   UndoConflict
  resolution: UndoResolution['action'] | undefined
  isActive:   boolean
  onClick:    () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="w-full text-left px-3 py-2.5 flex items-start gap-2 transition-colors border-l-2"
      style={{
        backgroundColor: isActive ? 'var(--conflict-list-active)' : 'transparent',
        borderLeftColor: isActive ? 'var(--conflict-accent)' : 'transparent',
      }}
      onMouseEnter={(e) => { if (!isActive) e.currentTarget.style.backgroundColor = 'var(--conflict-list-hover)' }}
      onMouseLeave={(e) => { if (!isActive) e.currentTarget.style.backgroundColor = 'transparent' }}
    >
      <span className="w-2.5 h-2.5 rounded-full flex-shrink-0 mt-0.5" style={{ backgroundColor: trackColor(conflict.track) }} />
      <div className="flex-1 min-w-0">
        <div className="text-xs font-semibold truncate" style={{ color: 'var(--modal-text)' }}>
          T{conflict.track} · {formatTime(conflict.time)}
        </div>
        <div className="flex items-center gap-1 mt-0.5">
          <TypePill type={conflict.existingNote.noteType} />
          <span className="text-[9px]" style={{ color: 'var(--modal-muted)' }}>→</span>
          <TypePill type={conflict.incomingNote.noteType} />
        </div>
        <div className="text-[10px] truncate mt-0.5" style={{ color: 'var(--modal-muted)' }}>
          {conflict.existingNote.creatorName}
        </div>
      </div>
      <StatusDot resolution={resolution} />
    </button>
  )
}

function UndoDiffCards({
  conflict,
  resolution,
}: {
  conflict:   UndoConflict
  resolution: UndoResolution['action'] | undefined
}) {
  const keepActive    = resolution === 'KEEP_EXISTING'
  const restoreActive = resolution === 'REPLACE_WITH_UNDO'

  const keepStyle = {
    flex: 1,
    padding: '12px 14px',
    borderRadius: 10,
    border: `1.5px solid ${keepActive ? 'var(--conflict-success)' : 'var(--modal-border)'}`,
    backgroundColor: keepActive ? 'var(--conflict-keep-bg)' : 'var(--modal-input-bg)',
  }
  const restoreStyle = {
    flex: 1,
    padding: '12px 14px',
    borderRadius: 10,
    border: `1.5px solid ${restoreActive ? 'var(--conflict-accent)' : 'var(--modal-border)'}`,
    backgroundColor: restoreActive ? 'var(--conflict-incoming-bg)' : 'var(--modal-input-bg)',
  }

  return (
    <div style={{ display: 'flex', gap: 12 }}>
      <div style={keepStyle}>
        <div className="text-[9px] font-bold uppercase tracking-wider mb-1" style={{ color: 'var(--conflict-success)' }}>Keep Existing</div>
        <div className="text-xs font-semibold truncate" style={{ color: 'var(--modal-text)' }}>{conflict.existingNote.title}</div>
        <div className="text-[10px] mt-0.5" style={{ color: 'var(--modal-muted)' }}>
          by {conflict.existingNote.creatorName} · <TypePill type={conflict.existingNote.noteType} />
        </div>
      </div>
      <div style={restoreStyle}>
        <div className="text-[9px] font-bold uppercase tracking-wider mb-1" style={{ color: 'var(--conflict-accent)' }}>Restore from Undo</div>
        <div className="text-xs font-semibold truncate" style={{ color: 'var(--modal-text)' }}>{conflict.incomingNote.title}</div>
        <div className="text-[10px] mt-0.5" style={{ color: 'var(--modal-muted)' }}>
          by {conflict.incomingNote.creatorName} · <TypePill type={conflict.incomingNote.noteType} />
        </div>
      </div>
    </div>
  )
}

export function UndoConflictModal({ preview, resolutions, onResolve, onApply, onCancel }: Props) {
  const conflicts  = preview.conflicts
  const [activeIndex, setActiveIndex] = useState(0)

  const unresolved    = conflicts.filter(c => resolutions[c.conflictId] === undefined)
  const allResolved   = unresolved.length === 0
  const applyDisabled = !allResolved

  const activeConflict = conflicts[activeIndex]

  function resolveAndAdvance(conflictId: string, action: UndoResolution['action']) {
    onResolve(conflictId, action)
    const next = conflicts.findIndex((c, i) => i > activeIndex && resolutions[c.conflictId] === undefined)
    if (next !== -1) setActiveIndex(next)
  }

  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return
    switch (e.key) {
      case 'ArrowLeft':  e.preventDefault(); setActiveIndex(i => Math.max(0, i - 1)); break
      case 'ArrowRight': e.preventDefault(); setActiveIndex(i => Math.min(conflicts.length - 1, i + 1)); break
      case 'k': case 'K': if (activeConflict) resolveAndAdvance(activeConflict.conflictId, 'KEEP_EXISTING'); break
      case 'r': case 'R': if (activeConflict) resolveAndAdvance(activeConflict.conflictId, 'REPLACE_WITH_UNDO'); break
      case 'Escape': onCancel(); break
      case 'Enter': if (!applyDisabled) onApply(); break
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [conflicts, activeIndex, resolutions, activeConflict, applyDisabled, onCancel, onApply])

  useEffect(() => {
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [handleKeyDown])

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      style={{ backgroundColor: 'var(--modal-overlay)' }}
      onClick={onCancel}
    >
      <div
        className="flex flex-col rounded-2xl overflow-hidden"
        style={{
          width: '80vw', maxWidth: 860, height: 520,
          backgroundColor: 'var(--modal-bg)',
          boxShadow: '0 24px 60px rgba(0,0,0,0.30), 0 0 0 1px rgba(108,99,255,0.14)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex-shrink-0 px-6 py-4 border-b" style={{ borderColor: 'var(--modal-border)' }}>
          <div className="flex items-start justify-between gap-4">
            <div>
              <h2 className="text-sm font-semibold" style={{ color: 'var(--modal-text)' }}>Undo — Resolve Conflicts</h2>
              <p className="text-xs mt-0.5" style={{ color: 'var(--modal-muted)' }}>
                Restoring notes from a previous action caused conflicts.
              </p>
              <div className="flex items-center gap-2 mt-2">
                <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full" style={conflictChipStyle('red')}>
                  {conflicts.length} conflict{conflicts.length !== 1 ? 's' : ''}
                </span>
              </div>
            </div>
            <button type="button" onClick={onCancel} className="text-xl leading-none hover:opacity-60 flex-shrink-0 mt-1" style={{ color: 'var(--modal-muted)' }}>✕</button>
          </div>
        </div>

        <div className="flex flex-row flex-1 overflow-hidden">
          <div className="w-[220px] flex-shrink-0 border-r overflow-y-auto" style={{ borderColor: 'var(--modal-border)' }}>
            <div className="flex items-center justify-between px-3 py-2 border-b" style={{ borderColor: 'var(--modal-border)' }}>
              <span className="text-[9px] font-bold uppercase tracking-wider" style={{ color: 'var(--modal-muted)' }}>Conflicts</span>
              {unresolved.length > 0
                ? <span className="text-[9px] font-semibold px-2 py-0.5 rounded-full" style={conflictChipStyle('amber')}>{unresolved.length} unresolved</span>
                : <span className="text-[9px] font-semibold px-2 py-0.5 rounded-full" style={conflictChipStyle('emerald')}>All resolved ✓</span>
              }
            </div>
            {conflicts.map((c, i) => (
              <UndoConflictListItem
                key={c.conflictId}
                conflict={c}
                resolution={resolutions[c.conflictId]}
                isActive={i === activeIndex}
                onClick={() => setActiveIndex(i)}
              />
            ))}
          </div>

          <div className="flex-1 flex flex-col overflow-y-auto p-5 gap-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: trackColor(activeConflict.track) }} />
                <span className="text-sm font-semibold" style={{ color: 'var(--modal-text)' }}>
                  Track {activeConflict.track} · {formatTime(activeConflict.time)}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  disabled={activeIndex === 0}
                  onClick={() => setActiveIndex(i => Math.max(0, i - 1))}
                  className="rounded-lg border px-3 py-1.5 text-xs disabled:opacity-30"
                  style={{ borderColor: 'var(--modal-border)', color: 'var(--modal-text)', backgroundColor: 'transparent' }}
                >← Prev</button>
                <span className="text-xs" style={{ color: 'var(--modal-muted)' }}>{activeIndex + 1} of {conflicts.length}</span>
                <button
                  type="button"
                  disabled={activeIndex === conflicts.length - 1}
                  onClick={() => setActiveIndex(i => Math.min(conflicts.length - 1, i + 1))}
                  className="rounded-lg border px-3 py-1.5 text-xs disabled:opacity-30"
                  style={{ borderColor: 'var(--modal-border)', color: 'var(--modal-text)', backgroundColor: 'transparent' }}
                >Next →</button>
              </div>
            </div>

            <UndoDiffCards conflict={activeConflict} resolution={resolutions[activeConflict.conflictId]} />

            <div className="flex gap-3 mt-auto">
              <button
                type="button"
                onClick={() => resolveAndAdvance(activeConflict.conflictId, 'KEEP_EXISTING')}
                className="flex-1 rounded-xl border py-3 text-sm font-semibold transition-colors"
                style={
                  resolutions[activeConflict.conflictId] === 'KEEP_EXISTING'
                    ? { backgroundColor: 'var(--conflict-keep-bg)', borderColor: 'var(--conflict-success)', color: 'var(--conflict-success)' }
                    : { backgroundColor: 'var(--modal-input-bg)', borderColor: 'var(--modal-border)', color: 'var(--modal-muted)' }
                }
              >
                {resolutions[activeConflict.conflictId] === 'KEEP_EXISTING' ? '✓ ' : ''}Keep Existing
              </button>
              <button
                type="button"
                onClick={() => resolveAndAdvance(activeConflict.conflictId, 'REPLACE_WITH_UNDO')}
                className="flex-1 rounded-xl border py-3 text-sm font-semibold transition-colors"
                style={
                  resolutions[activeConflict.conflictId] === 'REPLACE_WITH_UNDO'
                    ? { backgroundColor: 'var(--conflict-incoming-bg)', borderColor: 'var(--conflict-accent)', color: 'var(--conflict-accent)' }
                    : { backgroundColor: 'var(--modal-input-bg)', borderColor: 'var(--modal-border)', color: 'var(--modal-muted)' }
                }
              >
                {resolutions[activeConflict.conflictId] === 'REPLACE_WITH_UNDO' ? '✓ ' : ''}Restore from Undo
              </button>
            </div>
          </div>
        </div>

        <div className="flex-shrink-0 flex items-center justify-between px-6 py-3 border-t" style={{ borderColor: 'var(--modal-border)' }}>
          <div className="text-xs" style={{ color: 'var(--modal-muted)' }}>
            {unresolved.length > 0 && (
              <span className="font-semibold" style={{ color: 'var(--conflict-warning)' }}>{unresolved.length} unresolved · </span>
            )}
            <span>K = Keep &nbsp;·&nbsp; R = Restore &nbsp;·&nbsp; ← → Navigate</span>
          </div>
          <div className="flex items-center gap-2">
            <button type="button" onClick={onCancel} className="rounded-xl border px-4 py-2 text-sm" style={{ borderColor: 'var(--modal-border)', color: 'var(--modal-text)' }}>
              Cancel
            </button>
            <button
              type="button"
              onClick={onApply}
              disabled={applyDisabled}
              className={`rounded-xl px-4 py-2 text-sm font-semibold transition-colors ${applyDisabled ? 'opacity-40 cursor-not-allowed bg-[#6C63FF] text-white' : 'bg-[#6C63FF] text-white hover:bg-[#5a52e0]'}`}
            >
              {allResolved ? 'Apply Undo →' : 'Resolve all to apply'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
