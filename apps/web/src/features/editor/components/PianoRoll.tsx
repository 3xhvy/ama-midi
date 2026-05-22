import { useRef, useState, useCallback, useEffect } from 'react'
import { useVirtualizer } from '@tanstack/react-virtual'
import { TIME_MAX } from '@ama-midi/shared'
import { useEditorStore } from '../../../store/editor.store'
import { useNotes, useCreateNote, useDeleteNote } from '../../notes/useNotes'
import { xToTrack, yToTime, trackWidth } from '../engine'
import { getTotalHeight, getPrefetchTimeRange } from '../engine'
import { NoteCircle  } from './NoteCircle'
import { GhostCircle } from './GhostCircle'
import { GridLines   } from './GridLines'
import { Playhead    } from './Playhead'
import { NotePopup   } from './NotePopup'
import { AiSuggestions } from './AiSuggestions'
import type { Note } from '@ama-midi/shared'

type CreateMode = 'fast' | 'popup'
type PopupState =
  | { type: 'create'; track: number; time: number; pos: { x: number; y: number } }
  | { type: 'edit';   note: Note;    pos: { x: number; y: number } }
  | null

interface Props {
  songId:           string
  canEdit?:         boolean
  mutedTracks?:     Set<number>
  onNoteSelected?:  (note: Note | null) => void
}

export function PianoRoll({ songId, canEdit = true, mutedTracks = new Set(), onNoteSelected }: Props) {
  const containerRef   = useRef<HTMLDivElement>(null)
  const pxPerSecondRef = useRef(3)

  const [scrollTop,    setScrollTop]    = useState(0)
  const [ghost,        setGhost]        = useState<{ track: number; time: number } | null>(null)
  const [selectedNote, setSelectedNote] = useState<Note | null>(null)
  const [popup,        setPopup]        = useState<PopupState>(null)
  const [createMode,   setCreateMode]   = useState<CreateMode>('fast')

  const { pxPerSecond, viewMode, playheadTime } = useEditorStore()
  pxPerSecondRef.current = pxPerSecond

  const viewportHeight = containerRef.current?.clientHeight ?? 600
  const gridWidth      = containerRef.current?.clientWidth  ?? 800
  const tw             = trackWidth(gridWidth)

  const { timeFrom, timeTo } = getPrefetchTimeRange(scrollTop, viewportHeight, pxPerSecond)
  const { data: notes = [], isLoading } = useNotes(songId, timeFrom, timeTo)
  const createNote = useCreateNote(songId)
  const deleteNote = useDeleteNote(songId)

  const totalHeight = getTotalHeight(pxPerSecond)

  const rowVirtualizer = useVirtualizer({
    count:           TIME_MAX + 1,
    getScrollElement: () => containerRef.current,
    estimateSize:    () => pxPerSecondRef.current,
    overscan:        10,
  })

  useEffect(() => { rowVirtualizer.measure() }, [pxPerSecond]) // eslint-disable-line

  const handleScroll = useCallback((e: React.UIEvent<HTMLDivElement>) => {
    setScrollTop(e.currentTarget.scrollTop)
  }, [])

  const handleMouseMove = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    if (!canEdit || !containerRef.current) return
    const rect  = containerRef.current.getBoundingClientRect()
    const x     = e.clientX - rect.left
    const y     = e.clientY - rect.top + scrollTop
    const track = xToTrack(x, gridWidth)
    const time  = yToTime(y, pxPerSecond)
    setGhost({ track, time })
  }, [canEdit, gridWidth, pxPerSecond, scrollTop])

  const handleGridClick = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    if (!canEdit || !ghost) return
    if (createMode === 'popup') {
      setPopup({ type: 'create', track: ghost.track, time: ghost.time, pos: { x: e.clientX, y: e.clientY } })
      setGhost(null)
      return
    }
    setGhost(null)
    createNote.mutate({ track: ghost.track, time: ghost.time, title: `Note ${ghost.track}:${ghost.time}` })
  }, [canEdit, ghost, createNote, createMode])

  const handleNoteClick = useCallback((note: Note, e: React.MouseEvent) => {
    e.stopPropagation()
    setSelectedNote(note)
    onNoteSelected?.(note)
    setPopup({ type: 'edit', note, pos: { x: e.clientX, y: e.clientY } })
  }, [onNoteSelected])

  useEffect(() => {
    function handler(e: KeyboardEvent) {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return
      if ((e.key === 'e' || e.key === 'E') && selectedNote && canEdit && !popup) {
        setPopup({ type: 'edit', note: selectedNote, pos: { x: window.innerWidth / 2 - 160, y: window.innerHeight / 2 - 230 } })
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
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [selectedNote, canEdit, deleteNote, popup, onNoteSelected])

  const visibleNotes = notes.filter((n) => !mutedTracks.has(n.track))

  if (isLoading) {
    return (
      <div className="flex flex-col h-full bg-canvas-bg animate-pulse">
        <div className="grid grid-cols-8 h-8 border-b border-canvas-border bg-canvas-surface shrink-0">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="border-r border-canvas-border flex items-center justify-center">
              <div className="w-4 h-3 bg-canvas-border rounded" />
            </div>
          ))}
        </div>
        <div className="grid grid-cols-8 flex-1 gap-0">
          {Array.from({ length: 8 }).map((_, col) => (
            <div key={col} className="border-r border-canvas-border flex flex-col gap-4 p-4">
              {Array.from({ length: 3 }).map((_, row) => (
                <div key={row} className="w-4 h-4 rounded-full bg-canvas-border/50 mx-auto" />
              ))}
            </div>
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="relative flex-1 overflow-hidden flex flex-col h-full">
      <div className="flex border-b border-canvas-border bg-canvas-surface h-8 shrink-0">
        {Array.from({ length: 8 }, (_, i) => i + 1).map((track) => (
          <div
            key={track}
            className={`flex items-center justify-center text-xs border-r border-canvas-border transition-opacity select-none ${mutedTracks.has(track) ? 'opacity-30 text-canvas-muted' : 'text-canvas-muted'}`}
            style={{ width: tw }}
          >
            T{track}
          </div>
        ))}
      </div>

      {canEdit && (
        <div className="absolute top-9 left-2 z-30">
          <button
            onClick={() => setCreateMode((m) => (m === 'fast' ? 'popup' : 'fast'))}
            className={`px-2 py-0.5 text-[10px] border rounded transition-colors ${createMode === 'popup' ? 'bg-primary text-white border-primary' : 'text-canvas-muted border-canvas-border hover:text-canvas-text'}`}
          >
            {createMode === 'popup' ? '⊞ Popup' : '⚡ Fast'}
          </button>
        </div>
      )}

      <div
        ref={containerRef}
        className="overflow-y-auto overflow-x-hidden flex-1"
        onScroll={handleScroll}
        onMouseMove={handleMouseMove}
        onClick={handleGridClick}
        onMouseLeave={() => canEdit && setGhost(null)}
      >
        <div className="relative" style={{ height: totalHeight }}>
          <GridLines
            virtualItems={rowVirtualizer.getVirtualItems()}
            gridWidth={gridWidth}
          />

          <Playhead time={playheadTime} pxPerSecond={pxPerSecond} scrollTop={scrollTop} />

          {visibleNotes.map((note) => (
            <NoteCircle
              key={note.id}
              note={note}
              gridWidth={gridWidth}
              pxPerSecond={pxPerSecond}
              viewMode={viewMode}
              isSelected={selectedNote?.id === note.id}
              allNotes={notes}
              onClick={handleNoteClick}
            />
          ))}

          {canEdit && ghost && (
            <GhostCircle
              track={ghost.track}
              time={ghost.time}
              gridWidth={gridWidth}
              pxPerSecond={pxPerSecond}
            />
          )}

          {visibleNotes.length === 0 && viewMode === 'composer' && canEdit && (
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <p className="text-sm text-canvas-muted">Click anywhere to place your first note</p>
            </div>
          )}
        </div>
      </div>

      {canEdit && <AiSuggestions songId={songId} gridWidth={gridWidth} pxPerSecond={pxPerSecond} scrollTop={scrollTop} />}

      {popup && (
        popup.type === 'create' ? (
          <NotePopup mode="create" songId={songId} initialTrack={popup.track} initialTime={popup.time} pos={popup.pos} onClose={() => setPopup(null)} />
        ) : (
          <NotePopup mode="edit" songId={songId} note={popup.note} pos={popup.pos} onClose={() => setPopup(null)} />
        )
      )}
    </div>
  )
}
