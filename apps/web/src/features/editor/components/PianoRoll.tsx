import { useRef, useState, useCallback, useEffect } from 'react'
import { useVirtualizer } from '@tanstack/react-virtual'
import { TIME_MAX } from '@ama-midi/shared'
import { useEditorStore } from '../../../store/editor.store'
import { useNotes, useCreateNote, useDeleteNote } from '../../notes/useNotes'
import { xToTrack, yToTime, trackToX, timeToY, trackWidth } from '../engine/coordinate-mapper'
import { getTotalHeight, getPrefetchTimeRange } from '../engine/viewport-calculator'
import { NoteBlock } from './NoteBlock'
import { NotePopup } from './NotePopup'
import { AiSuggestions } from './AiSuggestions'
import type { Note } from '@ama-midi/shared'

type CreateMode = 'fast' | 'popup'

type PopupState =
  | { type: 'create'; track: number; time: number; pos: { x: number; y: number } }
  | { type: 'edit'; note: Note; pos: { x: number; y: number } }
  | null

interface Props {
  songId: string
  canEdit?: boolean
  mutedTracks?: Set<number>
  onNoteSelected?: (note: Note | null) => void
}

export function PianoRoll({
  songId,
  canEdit = true,
  mutedTracks = new Set(),
  onNoteSelected,
}: Props) {
  const containerRef = useRef<HTMLDivElement>(null)
  const pxPerSecondRef = useRef(3)

  const [scrollTop, setScrollTop] = useState(0)
  const [ghost, setGhost] = useState<{ track: number; time: number; x: number; y: number } | null>(null)
  const [selectedNote, setSelectedNote] = useState<Note | null>(null)
  const [popup, setPopup] = useState<PopupState>(null)
  const [createMode, setCreateMode] = useState<CreateMode>('fast')

  const { pxPerSecond, viewMode } = useEditorStore()
  pxPerSecondRef.current = pxPerSecond

  const viewportHeight = containerRef.current?.clientHeight ?? 600
  const gridWidth = containerRef.current?.clientWidth ?? 800

  const { timeFrom, timeTo } = getPrefetchTimeRange(scrollTop, viewportHeight, pxPerSecond)
  const { data: notes = [], isLoading } = useNotes(songId, timeFrom, timeTo)
  const createNote = useCreateNote(songId)
  const deleteNote = useDeleteNote(songId)

  const totalHeight = getTotalHeight(pxPerSecond)
  const tw = trackWidth(gridWidth)

  // Virtualizer for time marker grid lines
  const rowVirtualizer = useVirtualizer({
    count: TIME_MAX + 1,
    getScrollElement: () => containerRef.current,
    estimateSize: () => pxPerSecondRef.current,
    overscan: 10,
  })

  // Re-measure when zoom changes so grid line positions update
  useEffect(() => {
    rowVirtualizer.measure()
  }, [pxPerSecond]) // eslint-disable-line react-hooks/exhaustive-deps

  const handleScroll = useCallback((e: React.UIEvent<HTMLDivElement>) => {
    setScrollTop(e.currentTarget.scrollTop)
  }, [])

  const handleMouseMove = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      if (!canEdit || !containerRef.current) return
      const rect = containerRef.current.getBoundingClientRect()
      const x = e.clientX - rect.left
      const y = e.clientY - rect.top + scrollTop
      const track = xToTrack(x, gridWidth)
      const time = yToTime(y, pxPerSecond)
      setGhost({ track, time, x: trackToX(track, gridWidth), y: timeToY(time, pxPerSecond) - scrollTop })
    },
    [canEdit, gridWidth, pxPerSecond, scrollTop],
  )

  const handleGridClick = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      if (!canEdit || !containerRef.current || !ghost) return
      if (createMode === 'popup') {
        setPopup({ type: 'create', track: ghost.track, time: ghost.time, pos: { x: e.clientX, y: e.clientY } })
        setGhost(null)
        return
      }
      setGhost(null)
      createNote.mutate({
        track: ghost.track,
        time: ghost.time,
        title: `Note ${ghost.track}:${ghost.time}`,
      })
    },
    [canEdit, ghost, createNote, createMode],
  )

  const handleNoteClick = useCallback(
    (note: Note, e: React.MouseEvent) => {
      e.stopPropagation()
      setSelectedNote(note)
      onNoteSelected?.(note)
      setPopup({ type: 'edit', note, pos: { x: e.clientX, y: e.clientY } })
    },
    [onNoteSelected],
  )

  // Keyboard shortcuts
  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      // Don't fire shortcuts when typing in inputs
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return

      if ((e.key === 'e' || e.key === 'E') && selectedNote && !popup) {
        setPopup({
          type: 'edit',
          note: selectedNote,
          pos: { x: window.innerWidth / 2 - 160, y: window.innerHeight / 2 - 230 },
        })
      }
      if ((e.key === 'Delete' || e.key === 'Backspace') && selectedNote && canEdit && !popup) {
        deleteNote.mutate(selectedNote.id)
        setSelectedNote(null)
        onNoteSelected?.(null)
      }
      if (e.key === 'Escape' && !popup) {
        setSelectedNote(null)
        onNoteSelected?.(null)
      }
    }
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [selectedNote, canEdit, deleteNote, popup, onNoteSelected])

  const visibleNotes = notes.filter((n) => !mutedTracks.has(n.track))

  if (isLoading) {
    return (
      <div className="flex flex-col h-full bg-editor-bg animate-pulse">
        <div className="grid grid-cols-8 h-8 border-b border-editor-border bg-editor-surface shrink-0">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="border-r border-editor-border flex items-center justify-center">
              <div className="w-4 h-3 bg-editor-border rounded" />
            </div>
          ))}
        </div>
        <div className="grid grid-cols-8 flex-1 gap-0">
          {Array.from({ length: 8 }).map((_, col) => (
            <div key={col} className="border-r border-editor-border flex flex-col gap-4 p-4">
              {Array.from({ length: 3 }).map((_, row) => (
                <div key={row} className="w-4 h-4 rounded-full bg-editor-border/50 mx-auto" />
              ))}
            </div>
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="relative flex-1 overflow-hidden flex flex-col">
      {/* Track headers */}
      <div className="flex border-b border-editor-border bg-editor-surface h-8 shrink-0">
        {Array.from({ length: 8 }, (_, i) => i + 1).map((track) => (
          <div
            key={track}
            className={`flex items-center justify-center text-xs border-r border-editor-border transition-opacity select-none ${
              mutedTracks.has(track)
                ? 'opacity-30 text-editor-muted'
                : 'text-editor-muted'
            }`}
            style={{ width: tw }}
          >
            T{track}
          </div>
        ))}
      </div>

      {/* Create mode toggle */}
      {canEdit && (
        <div className="absolute top-9 left-2 z-30">
          <button
            onClick={() => setCreateMode((m) => (m === 'fast' ? 'popup' : 'fast'))}
            className={`px-2 py-0.5 text-[10px] border rounded transition-colors ${
              createMode === 'popup'
                ? 'bg-primary text-white border-primary'
                : 'text-editor-muted border-editor-border hover:text-editor-text'
            }`}
          >
            {createMode === 'popup' ? '⊞ Popup' : '⚡ Fast'}
          </button>
        </div>
      )}

      {/* Scrollable grid */}
      <div
        ref={containerRef}
        className="overflow-y-auto overflow-x-hidden flex-1"
        onScroll={handleScroll}
        onMouseMove={handleMouseMove}
        onClick={handleGridClick}
        onMouseLeave={() => canEdit && setGhost(null)}
      >
        <div className="relative" style={{ height: totalHeight }}>
          {/* Virtualized time marker lines */}
          {rowVirtualizer.getVirtualItems().map((virtualRow) => {
            const isBold = virtualRow.index % 5 === 0
            return (
              <div
                key={virtualRow.index}
                style={{
                  position: 'absolute',
                  top: virtualRow.start,
                  left: 0,
                  right: 0,
                  height: 1,
                  background: isBold ? 'rgba(255,255,255,0.12)' : 'rgba(255,255,255,0.06)',
                }}
              >
                {isBold && (
                  <span
                    className="absolute left-1 text-[9px] text-editor-muted leading-none select-none"
                    style={{ top: 2 }}
                  >
                    {virtualRow.index}s
                  </span>
                )}
              </div>
            )
          })}

          {/* Vertical track dividers */}
          {Array.from({ length: 7 }, (_, t) => (
            <div
              key={`v${t}`}
              className="absolute top-0 bottom-0"
              style={{ left: (t + 1) * tw, width: 1, background: 'rgba(255,255,255,0.06)' }}
            />
          ))}

          {/* Notes */}
          {visibleNotes.map((note) => (
            <NoteBlock
              key={note.id}
              note={note}
              gridWidth={gridWidth}
              pxPerSecond={pxPerSecond}
              onClick={handleNoteClick}
              viewMode={viewMode}
              isSelected={selectedNote?.id === note.id}
              allNotes={notes}
            />
          ))}

          {/* Ghost note preview */}
          {canEdit && ghost && (
            <div
              className="absolute pointer-events-none border-2 border-white/50 bg-white/20 rounded-sm"
              style={{
                left: ghost.x,
                top: ghost.y,
                width: tw - 2,
                height: 20,
              }}
            />
          )}

          {/* Empty state */}
          {visibleNotes.length === 0 && viewMode === 'composer' && canEdit && (
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <div className="text-center text-editor-muted">
                <p className="text-sm">Click anywhere on the grid to place your first note</p>
                <p className="text-xs mt-1 opacity-60">Or switch to Popup Mode for more options</p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* AI suggestions */}
      {canEdit && (
        <AiSuggestions
          songId={songId}
          notes={notes}
          gridWidth={gridWidth}
          pxPerSecond={pxPerSecond}
          scrollTop={scrollTop}
        />
      )}

      {/* Note popup */}
      {popup && (
        popup.type === 'create' ? (
          <NotePopup
            mode="create"
            songId={songId}
            initialTrack={popup.track}
            initialTime={popup.time}
            pos={popup.pos}
            onClose={() => setPopup(null)}
          />
        ) : (
          <NotePopup
            mode="edit"
            songId={songId}
            note={popup.note}
            pos={popup.pos}
            onClose={() => setPopup(null)}
          />
        )
      )}
    </div>
  )
}
