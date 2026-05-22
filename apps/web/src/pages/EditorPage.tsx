import { useState, useEffect, useRef } from 'react'
import { useParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { NOTE_PRESET_COLORS } from '@ama-midi/shared'
import { PianoRoll } from '../features/editor/components/PianoRoll'
import { HistoryPanel } from '../features/editor/components/HistoryPanel'
import { ValidationPanel } from '../features/editor/components/ValidationPanel'
import { ShortcutLegend } from '../features/editor/components/ShortcutLegend'
import { PresenceBar } from '../features/collaboration/PresenceBar'
import { useSocket } from '../features/collaboration/useSocket'
import { useEditorStore } from '../store/editor.store'
import { useUndo } from '../features/notes/useNotes'
import { useCanEdit } from '../hooks/useCanEdit'
import { useAuthStore } from '../store/auth.store'
import { apiClient } from '../features/auth/api'
import type { Note } from '@ama-midi/shared'

type RightTab = 'details' | 'validation' | 'history'

interface ValidationResult {
  summary: { errors: number; warnings: number }
}

const TRACK_COLORS = NOTE_PRESET_COLORS as readonly string[]

export function EditorPage() {
  const { songId } = useParams<{ songId: string }>()
  const { viewMode, zoom, setViewMode, setZoom } = useEditorStore()
  const undo = useUndo(songId!)
  const { presenceList } = useSocket(songId!)
  const canEdit = useCanEdit()
  const token = useAuthStore((s) => s.token)

  const [rightTab, setRightTab] = useState<RightTab>('details')
  const [selectedNote, setSelectedNote] = useState<Note | null>(null)
  const [mutedTracks, setMutedTracks] = useState<Set<number>>(new Set())
  const [showShortcuts, setShowShortcuts] = useState(false)

  const jumpToRef = useRef<((time: number, track?: number) => void) | null>(null)

  const { data: validationData } = useQuery<ValidationResult>({
    queryKey: ['validation', songId],
    queryFn: () => apiClient(token)<ValidationResult>(`/songs/${songId}/validation`),
    staleTime: 30_000,
    enabled: !!token && !!songId,
  })

  function toggleMute(track: number, alt: boolean) {
    if (alt) {
      const allOthers = new Set([1, 2, 3, 4, 5, 6, 7, 8].filter((t) => t !== track))
      setMutedTracks((prev) => (prev.size === 7 && !prev.has(track) ? new Set() : allOthers))
    } else {
      setMutedTracks((prev) => {
        const next = new Set(prev)
        if (next.has(track)) next.delete(track)
        else next.add(track)
        return next
      })
    }
  }

  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return
      if ((e.key === 'j' || e.key === 'J') && viewMode === 'qa') {
        jumpToRef.current?.(0)
      }
      if (e.key === '?' || (e.key === '/' && e.shiftKey)) {
        setShowShortcuts((v) => !v)
      }
      // Zoom shortcuts
      if (e.key === '1') setZoom(1)
      if (e.key === '2') setZoom(2)
      if (e.key === '4') setZoom(4)
      // Cmd+Z undo
      if ((e.metaKey || e.ctrlKey) && e.key === 'z' && canEdit) {
        e.preventDefault()
        undo.mutate()
      }
    }
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [viewMode, canEdit, undo, setZoom])

  if (!songId) return null

  const errCount = validationData?.summary.errors ?? 0
  const warnCount = validationData?.summary.warnings ?? 0

  return (
    <div className="flex flex-col h-screen bg-editor-bg">
      {/* TopBar */}
      <div className="flex items-center justify-between px-4 h-12 bg-editor-surface border-b border-editor-border shrink-0">
        <div className="flex items-center gap-4">
          <a href="/" className="text-editor-muted hover:text-editor-text text-sm">
            ← Songs
          </a>
          <span className="text-editor-text font-medium text-sm">Editor</span>
        </div>

        <div className="flex items-center gap-3">
          <PresenceBar users={presenceList} />

          {/* View mode */}
          <div className="flex bg-editor-bg rounded-md overflow-hidden border border-editor-border">
            {(['composer', 'developer', 'qa'] as const).map((mode) => (
              <button
                key={mode}
                onClick={() => setViewMode(mode)}
                className={`px-3 py-1 text-xs capitalize transition-colors ${
                  viewMode === mode ? 'bg-primary text-white' : 'text-editor-muted hover:text-editor-text'
                }`}
              >
                {mode}
              </button>
            ))}
          </div>

          {/* Undo */}
          {canEdit && (
            <button
              onClick={() => undo.mutate()}
              disabled={undo.isPending}
              className="px-3 py-1 text-xs text-editor-muted hover:text-editor-text border border-editor-border rounded-md transition-colors disabled:opacity-50"
            >
              Undo
            </button>
          )}

          {/* Shortcut legend */}
          <button
            onClick={() => setShowShortcuts(true)}
            className="px-2 py-1 text-xs text-editor-muted hover:text-editor-text border border-editor-border rounded-md transition-colors"
            title="Keyboard shortcuts (?)"
          >
            ?
          </button>

          {/* Viewer-only badge */}
          {!canEdit && (
            <span className="px-2 py-1 text-xs bg-editor-border text-editor-muted rounded-full">
              Viewing only
            </span>
          )}
        </div>
      </div>

      {/* Middle zone */}
      <div className="flex flex-1 overflow-hidden">
        {/* LeftPanel: Tracks */}
        <div className="w-48 border-r border-editor-border bg-editor-surface flex flex-col shrink-0">
          <div className="px-3 py-2 border-b border-editor-border">
            <span className="text-xs font-medium text-editor-text uppercase tracking-wide">Tracks</span>
          </div>
          <div className="flex-1 overflow-y-auto py-1">
            {Array.from({ length: 8 }, (_, i) => i + 1).map((track) => (
              <div
                key={track}
                onClick={(e) => canEdit && toggleMute(track, e.altKey)}
                className={`flex items-center gap-2 px-3 py-1.5 cursor-pointer transition-opacity hover:bg-editor-border/30 select-none ${
                  mutedTracks.has(track) ? 'opacity-30' : ''
                }`}
                title={
                  mutedTracks.has(track)
                    ? `Track ${track} (muted — click to unmute)`
                    : `Track ${track} (click to mute, alt+click to solo)`
                }
              >
                <div
                  className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                  style={{ backgroundColor: TRACK_COLORS[(track - 1) % TRACK_COLORS.length] }}
                />
                <span className="text-xs text-editor-text">Track {track}</span>
                {mutedTracks.has(track) && (
                  <span className="ml-auto text-[9px] text-editor-muted">M</span>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* PianoRoll */}
        <div className="flex-1 overflow-hidden">
          <PianoRoll
            songId={songId}
            canEdit={canEdit}
            mutedTracks={mutedTracks}
            onNoteSelected={setSelectedNote}
          />
        </div>

        {/* RightPanel */}
        <div className="w-64 border-l border-editor-border bg-editor-surface flex flex-col shrink-0">
          {/* Tab bar */}
          <div className="flex border-b border-editor-border shrink-0">
            {(['details', 'validation', 'history'] as RightTab[]).map((tab) => (
              <button
                key={tab}
                onClick={() => setRightTab(tab)}
                className={`flex-1 py-2 text-xs capitalize transition-colors ${
                  rightTab === tab
                    ? 'text-editor-text border-b-2 border-primary'
                    : 'text-editor-muted hover:text-editor-text'
                }`}
              >
                {tab}
                {tab === 'validation' && (errCount > 0 || warnCount > 0) && (
                  <span
                    className={`ml-1 text-[10px] ${errCount > 0 ? 'text-red-400' : 'text-yellow-400'}`}
                  >
                    {errCount > 0 ? errCount : warnCount}
                  </span>
                )}
              </button>
            ))}
          </div>

          {/* Tab content */}
          <div className="flex-1 overflow-hidden flex flex-col">
            {rightTab === 'details' && (
              <DetailsTab note={selectedNote} />
            )}
            {rightTab === 'validation' && (
              <ValidationPanel
                songId={songId}
                onJumpTo={(time, track) => {
                  jumpToRef.current = (t) => console.log('jump to', t, track)
                  jumpToRef.current(time)
                }}
              />
            )}
            {rightTab === 'history' && (
              <HistoryPanel songId={songId} inline />
            )}
          </div>
        </div>
      </div>

      {/* BottomBar */}
      <div className="h-10 border-t border-editor-border bg-editor-surface flex items-center px-4 gap-6 shrink-0">
        {/* Time display placeholder */}
        <span className="text-xs font-mono text-editor-muted">00:00.0</span>

        {/* Zoom controls */}
        <div className="flex bg-editor-bg rounded-md overflow-hidden border border-editor-border">
          {([1, 2, 4] as const).map((z) => (
            <button
              key={z}
              onClick={() => setZoom(z)}
              className={`px-3 py-1 text-xs transition-colors ${
                zoom === z ? 'bg-primary text-white' : 'text-editor-muted hover:text-editor-text'
              }`}
            >
              {z}x
            </button>
          ))}
        </div>

        {/* Validation badge */}
        <div className="ml-auto">
          {!validationData ? null : errCount === 0 && warnCount === 0 ? (
            <span className="text-xs text-green-400">✓ Valid</span>
          ) : (
            <span className="flex items-center gap-2 text-xs">
              {errCount > 0 && <span className="text-red-400">{errCount} err</span>}
              {warnCount > 0 && <span className="text-yellow-400">{warnCount} warn</span>}
            </span>
          )}
        </div>
      </div>

      {/* View mode badge (non-composer) */}
      {viewMode !== 'composer' && (
        <div className="absolute bottom-14 right-4 px-3 py-1 bg-editor-surface border border-editor-border rounded-full text-xs text-editor-muted uppercase tracking-wide">
          {viewMode} view
        </div>
      )}

      {/* Keyboard shortcut legend */}
      {showShortcuts && <ShortcutLegend onClose={() => setShowShortcuts(false)} />}
    </div>
  )
}

function DetailsTab({ note }: { note: Note | null }) {
  if (!note) {
    return (
      <div className="flex-1 flex items-center justify-center p-4">
        <p className="text-xs text-editor-muted text-center">Select a note to view details</p>
      </div>
    )
  }

  return (
    <div className="p-4 space-y-3">
      <div className="flex items-center gap-2">
        <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: note.color }} />
        <span className="text-sm font-medium text-editor-text truncate">{note.title}</span>
      </div>
      <div className="space-y-1.5 text-xs text-editor-muted">
        <div className="flex justify-between">
          <span>Track</span>
          <span className="text-editor-text">{note.track}</span>
        </div>
        <div className="flex justify-between">
          <span>Time</span>
          <span className="text-editor-text">{note.time}s</span>
        </div>
        <div className="flex justify-between">
          <span>Created by</span>
          <span className="text-editor-text truncate ml-2">{note.creatorName}</span>
        </div>
      </div>
      {note.description && (
        <p className="text-xs text-editor-muted border-t border-editor-border pt-2">{note.description}</p>
      )}
      <div className="text-[10px] font-mono text-editor-muted/60 break-all">{note.id}</div>
    </div>
  )
}
