import { useState } from 'react'
import { useCallback, useEffect } from 'react'
import type { ConflictAction, PlacementPreview } from '@ama-midi/shared'
import { trackColor } from '@ama-midi/shared'
import { ConflictListItem } from './ConflictListItem'
import { ConflictDiffCards } from './ConflictDiffCards'
import { ConflictContextStrip } from './ConflictContextStrip'
import { EditorModalOverlay, EditorModalPanel } from './EditorModal'
import { formatTime } from './conflict-formatters'
import { conflictChipStyle } from './conflict-theme'

interface Props {
  preview:                  PlacementPreview
  title:                    string
  incomingLabel?:           string
  applyLabel?:              string
  resolutions:              Record<string, ConflictAction>
  onResolve:                (conflictId: string, action: ConflictAction) => void
  onApply:                  () => void
  onCancel:                 () => void
  hasConflictChanged?:      boolean
  onDismissConflictBanner?: () => void
}

export function ConflictReviewModal({
  preview,
  title,
  incomingLabel = 'Incoming',
  applyLabel = 'Apply',
  resolutions,
  onResolve,
  onApply,
  onCancel,
  hasConflictChanged,
  onDismissConflictBanner,
}: Props) {
  const conflicts = preview.conflicts
  const [activeIndex, setActiveIndex] = useState(0)

  const unresolved   = conflicts.filter(c => resolutions[c.conflictId] === undefined)
  const keepCount    = conflicts.filter(c => resolutions[c.conflictId] === 'KEEP_EXISTING').length
  const replaceCount = conflicts.filter(c => resolutions[c.conflictId] === 'REPLACE_WITH_PATTERN').length
  const skipCount    = keepCount
  const createCount  = preview.summary.creatableNotes + replaceCount
  const allResolved  = unresolved.length === 0
  const applyDisabled = !allResolved || (createCount + replaceCount === 0)

  const activeConflict = conflicts[activeIndex]
  const hasConflicts = conflicts.length > 0

  function resolveAndAdvance(conflictId: string, action: ConflictAction) {
    onResolve(conflictId, action)
    const next = conflicts.findIndex((c, i) => i > activeIndex && resolutions[c.conflictId] === undefined)
    if (next !== -1) setActiveIndex(next)
  }

  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return
    switch (e.key) {
      case 'ArrowLeft':
        if (!hasConflicts) break
        e.preventDefault()
        setActiveIndex(i => Math.max(0, i - 1))
        break
      case 'ArrowRight':
        if (!hasConflicts) break
        e.preventDefault()
        setActiveIndex(i => Math.min(conflicts.length - 1, i + 1))
        break
      case 'k':
      case 'K':
        if (activeConflict) resolveAndAdvance(activeConflict.conflictId, 'KEEP_EXISTING')
        break
      case 'r':
      case 'R':
        if (activeConflict) resolveAndAdvance(activeConflict.conflictId, 'REPLACE_WITH_PATTERN')
        break
      case 'Escape':
        onCancel()
        break
      case 'Enter':
        if (!applyDisabled) onApply()
        break
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [conflicts, activeIndex, resolutions, activeConflict, applyDisabled, onCancel, onApply, hasConflicts])

  useEffect(() => {
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [handleKeyDown])

  const subtitle = preview.anchorTime != null
    ? `At ${formatTime(preview.anchorTime)} · ${preview.summary.totalNotes} notes`
    : `${preview.summary.totalNotes} notes`

  const replaceButtonLabel = `Replace With ${incomingLabel}`

  return (
    <EditorModalOverlay onClick={onCancel}>
      <EditorModalPanel size="wide" onClick={(e) => e.stopPropagation()}>
        <div className="flex-shrink-0 px-6 py-4 border-b" style={{ borderColor: 'var(--modal-border)' }}>
          <div className="flex items-start justify-between gap-4">
            <div>
              <h2 className="text-sm font-semibold" style={{ color: 'var(--modal-text)' }}>
                {title}
              </h2>
              <p className="text-xs mt-0.5" style={{ color: 'var(--modal-muted)' }}>
                {subtitle}
              </p>
              <div className="flex items-center gap-2 mt-2">
                <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full" style={conflictChipStyle('emerald')}>
                  {preview.summary.creatableNotes} will be created
                </span>
                <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full" style={conflictChipStyle('red')}>
                  {preview.summary.conflictCount} conflicts
                </span>
                <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full" style={conflictChipStyle('amber')}>
                  {preview.summary.affectedExistingNotes} notes affected
                </span>
              </div>
            </div>
            <button
              type="button"
              onClick={onCancel}
              className="text-xl leading-none hover:opacity-60 flex-shrink-0 mt-1"
              style={{ color: 'var(--modal-muted)' }}
            >
              ✕
            </button>
          </div>
        </div>

        <div className="flex flex-row flex-1 overflow-hidden">
          {!hasConflicts && (
            <div className="flex-1 flex items-center justify-center p-8">
              <p className="text-sm" style={{ color: 'var(--modal-muted)' }}>
                No conflicts — {preview.summary.creatableNotes} notes will be created.
              </p>
            </div>
          )}

          {hasConflicts && (
          <>
          <div className="w-[220px] flex-shrink-0 border-r overflow-y-auto" style={{ borderColor: 'var(--modal-border)' }}>
            <div className="flex items-center justify-between px-3 py-2 border-b" style={{ borderColor: 'var(--modal-border)' }}>
              <span className="text-[9px] font-bold uppercase tracking-wider" style={{ color: 'var(--modal-muted)' }}>Conflicts</span>
              {unresolved.length > 0 ? (
                <span className="text-[9px] font-semibold px-2 py-0.5 rounded-full" style={conflictChipStyle('amber')}>
                  {unresolved.length} unresolved
                </span>
              ) : (
                <span className="text-[9px] font-semibold px-2 py-0.5 rounded-full" style={conflictChipStyle('emerald')}>
                  All resolved ✓
                </span>
              )}
            </div>
            {conflicts.map((c, i) => (
              <ConflictListItem
                key={c.conflictId}
                conflict={c}
                resolution={resolutions[c.conflictId]}
                isActive={i === activeIndex}
                onClick={() => setActiveIndex(i)}
              />
            ))}
          </div>

          <div className="flex-1 flex flex-col overflow-y-auto p-5 gap-4">
            {hasConflictChanged && (
              <div
                className="flex items-center justify-between rounded-md border px-3 py-2"
                style={{
                  backgroundColor: 'var(--conflict-banner-bg)',
                  borderColor: 'var(--conflict-banner-border)',
                }}
              >
                <span className="text-xs" style={{ color: 'var(--conflict-banner-text)' }}>
                  ⚠ Conflicts changed — review again
                </span>
                <button
                  type="button"
                  onClick={onDismissConflictBanner}
                  className="hover:opacity-60 text-xs ml-3"
                  style={{ color: 'var(--conflict-banner-text)' }}
                >
                  ✕
                </button>
              </div>
            )}

            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span
                  className="w-2.5 h-2.5 rounded-full"
                  style={{ backgroundColor: trackColor(activeConflict.track) }}
                />
                <span className="text-sm font-semibold" style={{ color: 'var(--modal-text)' }}>
                  Track {activeConflict.track} · {formatTime(activeConflict.time)}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  disabled={activeIndex === 0}
                  onClick={() => setActiveIndex(i => Math.max(0, i - 1))}
                  className="rounded-lg border px-3 py-1.5 text-xs disabled:opacity-30 transition-colors"
                  style={{ borderColor: 'var(--modal-border)', color: 'var(--modal-text)', backgroundColor: 'transparent' }}
                  onMouseEnter={(e) => { if (activeIndex !== 0) e.currentTarget.style.backgroundColor = 'var(--conflict-list-hover)' }}
                  onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'transparent' }}
                >
                  ← Prev
                </button>
                <span className="text-xs" style={{ color: 'var(--modal-muted)' }}>
                  {activeIndex + 1} of {conflicts.length}
                </span>
                <button
                  type="button"
                  disabled={activeIndex === conflicts.length - 1}
                  onClick={() => setActiveIndex(i => Math.min(conflicts.length - 1, i + 1))}
                  className="rounded-lg border px-3 py-1.5 text-xs disabled:opacity-30 transition-colors"
                  style={{ borderColor: 'var(--modal-border)', color: 'var(--modal-text)', backgroundColor: 'transparent' }}
                  onMouseEnter={(e) => { if (activeIndex !== conflicts.length - 1) e.currentTarget.style.backgroundColor = 'var(--conflict-list-hover)' }}
                  onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'transparent' }}
                >
                  Next →
                </button>
              </div>
            </div>

            <ConflictDiffCards
              conflict={activeConflict}
              resolution={resolutions[activeConflict.conflictId]}
              incomingLabel={incomingLabel}
            />

            <ConflictContextStrip conflict={activeConflict} preview={preview} />

            <div className="flex gap-3 mt-auto">
              <button
                type="button"
                onClick={() => resolveAndAdvance(activeConflict.conflictId, 'KEEP_EXISTING')}
                className="flex-1 rounded-xl border py-3 text-sm font-semibold transition-colors"
                style={
                  resolutions[activeConflict.conflictId] === 'KEEP_EXISTING'
                    ? {
                        backgroundColor: 'var(--conflict-incoming-bg)',
                        borderColor: 'var(--conflict-incoming-border)',
                        color: 'var(--conflict-accent)',
                      }
                    : {
                        backgroundColor: 'var(--modal-input-bg)',
                        borderColor: 'var(--modal-border)',
                        color: 'var(--modal-muted)',
                      }
                }
              >
                {resolutions[activeConflict.conflictId] === 'KEEP_EXISTING' ? '✓ ' : ''}Keep Existing
              </button>
              <button
                type="button"
                onClick={() => resolveAndAdvance(activeConflict.conflictId, 'REPLACE_WITH_PATTERN')}
                className="flex-1 rounded-xl border py-3 text-sm font-semibold transition-colors"
                style={
                  resolutions[activeConflict.conflictId] === 'REPLACE_WITH_PATTERN'
                    ? {
                        backgroundColor: 'var(--conflict-keep-bg)',
                        borderColor: 'var(--conflict-keep-border)',
                        color: 'var(--conflict-danger)',
                      }
                    : {
                        backgroundColor: 'var(--modal-input-bg)',
                        borderColor: 'var(--modal-border)',
                        color: 'var(--modal-muted)',
                      }
                }
              >
                {resolutions[activeConflict.conflictId] === 'REPLACE_WITH_PATTERN' ? '✕ ' : ''}{replaceButtonLabel}
              </button>
            </div>
          </div>
          </>
          )}
        </div>

        <div
          className="flex-shrink-0 flex items-center justify-between px-6 py-3 border-t"
          style={{ borderColor: 'var(--modal-border)' }}
        >
          <div className="text-xs" style={{ color: 'var(--modal-muted)' }}>
            {unresolved.length > 0 && (
              <span className="font-semibold" style={{ color: 'var(--conflict-warning)' }}>{unresolved.length} unresolved · </span>
            )}
            Create <strong style={{ color: 'var(--modal-text)' }}>{createCount}</strong> · Replace <strong style={{ color: 'var(--modal-text)' }}>{replaceCount}</strong> · Skip <strong style={{ color: 'var(--modal-text)' }}>{skipCount}</strong>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onCancel}
              className="rounded-xl border px-4 py-2 text-sm"
              style={{ borderColor: 'var(--modal-border)', color: 'var(--modal-text)' }}
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={onApply}
              disabled={applyDisabled}
              className={`rounded-xl px-4 py-2 text-sm font-semibold transition-colors ${
                applyDisabled
                  ? 'opacity-40 cursor-not-allowed bg-[#6C63FF] text-white'
                  : 'bg-[#6C63FF] text-white hover:bg-[#5a52e0]'
              }`}
            >
              {allResolved ? `${applyLabel} ${createCount} notes →` : 'Resolve all to apply'}
            </button>
          </div>
        </div>
      </EditorModalPanel>
    </EditorModalOverlay>
  )
}
