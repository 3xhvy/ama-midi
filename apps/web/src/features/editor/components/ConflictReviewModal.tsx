import { useState, useEffect, useCallback } from 'react'
import type { ConflictAction, PatternPastePreview } from '@ama-midi/shared'
import { trackColor } from '@ama-midi/shared'
import { ConflictListItem } from './ConflictListItem'
import { ConflictDiffCards } from './ConflictDiffCards'
import { ConflictContextStrip } from './ConflictContextStrip'
import { formatTime } from './conflict-formatters'

interface Props {
  preview:                  PatternPastePreview
  resolutions:              Record<string, ConflictAction>
  onResolve:                (conflictId: string, action: ConflictAction) => void
  onApply:                  () => void
  onCancel:                 () => void
  patternName:              string
  hasConflictChanged?:      boolean
  onDismissConflictBanner?: () => void
}

export function ConflictReviewModal({
  preview,
  resolutions,
  onResolve,
  onApply,
  onCancel,
  patternName,
  hasConflictChanged,
  onDismissConflictBanner,
}: Props) {
  const conflicts = preview.conflicts
  const [activeIndex, setActiveIndex] = useState(0)

  // Derived values
  const unresolved   = conflicts.filter(c => resolutions[c.conflictId] === undefined)
  const keepCount    = conflicts.filter(c => resolutions[c.conflictId] === 'KEEP_EXISTING').length
  const replaceCount = conflicts.filter(c => resolutions[c.conflictId] === 'REPLACE_WITH_PATTERN').length
  const skipCount    = keepCount
  const createCount  = preview.summary.creatableNotes + replaceCount
  const allResolved  = unresolved.length === 0
  const applyDisabled = !allResolved || (createCount + replaceCount === 0)

  const activeConflict = conflicts[activeIndex]

  function resolveAndAdvance(conflictId: string, action: ConflictAction) {
    onResolve(conflictId, action)
    // Find next unresolved after current index (pre-update snapshot — current conflict
    // is still in resolutions as undefined, but we skip it by starting at activeIndex + 1)
    const next = conflicts.findIndex((c, i) => i > activeIndex && resolutions[c.conflictId] === undefined)
    if (next !== -1) setActiveIndex(next)
  }

  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return
    switch (e.key) {
      case 'ArrowLeft':
        e.preventDefault()
        setActiveIndex(i => Math.max(0, i - 1))
        break
      case 'ArrowRight':
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
  }, [conflicts, activeIndex, resolutions, activeConflict, applyDisabled, onCancel, onApply])

  useEffect(() => {
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [handleKeyDown])

  if (!activeConflict) return null

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      style={{ backgroundColor: 'rgba(8,6,20,0.72)' }}
      onClick={onCancel}
    >
      <div
        className="flex flex-col rounded-2xl overflow-hidden"
        style={{
          width: '80vw',
          maxWidth: 860,
          height: 560,
          backgroundColor: 'var(--modal-bg)',
          boxShadow: '0 24px 60px rgba(0,0,0,0.30), 0 0 0 1px rgba(108,99,255,0.14)',
        }}
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex-shrink-0 px-6 py-4 border-b" style={{ borderColor: 'var(--modal-border)' }}>
          <div className="flex items-start justify-between gap-4">
            <div>
              <h2 className="text-sm font-semibold" style={{ color: 'var(--modal-text)' }}>
                Paste Pattern — {patternName}
              </h2>
              <p className="text-xs mt-0.5" style={{ color: 'var(--modal-muted)' }}>
                Pasting at {formatTime(preview.startTime)} · {preview.summary.totalPatternNotes} pattern notes
              </p>
              <div className="flex items-center gap-2 mt-2">
                <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-600">
                  {preview.summary.creatableNotes} will be created
                </span>
                <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-red-50 text-red-500">
                  {preview.summary.conflictCount} conflicts
                </span>
                <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-amber-50 text-amber-600">
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

        {/* Body */}
        <div className="flex flex-row flex-1 overflow-hidden">
          {/* Left panel */}
          <div className="w-[220px] flex-shrink-0 border-r overflow-y-auto" style={{ borderColor: 'var(--modal-border)' }}>
            <div className="flex items-center justify-between px-3 py-2 border-b" style={{ borderColor: 'var(--modal-border)' }}>
              <span className="text-[9px] font-bold uppercase tracking-wider text-slate-400">Conflicts</span>
              {unresolved.length > 0 ? (
                <span className="text-[9px] font-semibold px-2 py-0.5 rounded-full bg-amber-50 text-amber-600">
                  {unresolved.length} unresolved
                </span>
              ) : (
                <span className="text-[9px] font-semibold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-600">
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

          {/* Right detail panel */}
          <div className="flex-1 flex flex-col overflow-y-auto p-5 gap-4">
            {/* 409 banner */}
            {hasConflictChanged && (
              <div className="flex items-center justify-between rounded-md border border-amber-300 bg-amber-50 px-3 py-2">
                <span className="text-xs text-amber-800">⚠ Conflicts changed — review again</span>
                <button
                  type="button"
                  onClick={onDismissConflictBanner}
                  className="text-amber-600 hover:opacity-60 text-xs ml-3"
                >
                  ✕
                </button>
              </div>
            )}

            {/* Detail header */}
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
                  className="rounded-lg border px-3 py-1.5 text-xs disabled:opacity-30 hover:bg-slate-50"
                  style={{ borderColor: 'var(--modal-border)', color: 'var(--modal-text)' }}
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
                  className="rounded-lg border px-3 py-1.5 text-xs disabled:opacity-30 hover:bg-slate-50"
                  style={{ borderColor: 'var(--modal-border)', color: 'var(--modal-text)' }}
                >
                  Next →
                </button>
              </div>
            </div>

            {/* Diff cards */}
            <ConflictDiffCards
              conflict={activeConflict}
              resolution={resolutions[activeConflict.conflictId]}
            />

            {/* Context strip */}
            <ConflictContextStrip conflict={activeConflict} preview={preview} />

            {/* Action buttons */}
            <div className="flex gap-3 mt-auto">
              <button
                type="button"
                onClick={() => resolveAndAdvance(activeConflict.conflictId, 'KEEP_EXISTING')}
                className={`flex-1 rounded-xl border py-3 text-sm font-semibold transition-colors ${
                  resolutions[activeConflict.conflictId] === 'KEEP_EXISTING'
                    ? 'bg-[#EEF0FF] text-[#6C63FF] border-[#6C63FF]'
                    : 'bg-white text-slate-500 border-slate-200 hover:bg-[#F5F3FF] hover:border-slate-300'
                }`}
              >
                {resolutions[activeConflict.conflictId] === 'KEEP_EXISTING' ? '✓ ' : ''}Keep Existing
              </button>
              <button
                type="button"
                onClick={() => resolveAndAdvance(activeConflict.conflictId, 'REPLACE_WITH_PATTERN')}
                className={`flex-1 rounded-xl border py-3 text-sm font-semibold transition-colors ${
                  resolutions[activeConflict.conflictId] === 'REPLACE_WITH_PATTERN'
                    ? 'bg-red-50 text-red-500 border-red-500'
                    : 'bg-white text-slate-500 border-slate-200 hover:bg-red-50 hover:border-red-200'
                }`}
              >
                {resolutions[activeConflict.conflictId] === 'REPLACE_WITH_PATTERN' ? '✕ ' : ''}Replace With Pattern
              </button>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div
          className="flex-shrink-0 flex items-center justify-between px-6 py-3 border-t"
          style={{ borderColor: 'var(--modal-border)' }}
        >
          <div className="text-xs" style={{ color: 'var(--modal-muted)' }}>
            {unresolved.length > 0 && (
              <span className="font-semibold text-amber-600">{unresolved.length} unresolved · </span>
            )}
            Create <strong>{createCount}</strong> · Replace <strong>{replaceCount}</strong> · Skip <strong>{skipCount}</strong>
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
              {allResolved ? `Paste ${createCount} notes →` : 'Resolve all to apply'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
