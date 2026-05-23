import { useRef, useState, useCallback, useEffect } from 'react'
import { HOLD_DRAG_THRESHOLD_PX } from '@ama-midi/shared'
import { useEditorStore } from '../../../store/editor.store'
import { useNotes, useCreateNote, useDeleteNote } from '../../notes/useNotes'
import { useAuthStore } from '../../../store/auth.store'
import { useQuery } from '@tanstack/react-query'
import { apiClient } from '../../auth/api'
import { xToTrack, yToTime, timeToY, trackToX, getTrackLayout, getVisibleTimeGridLines } from '../engine'
import { getTotalHeight, getPrefetchTimeRange } from '../engine'
import { NoteCircle  } from './NoteCircle'
import { GhostCircle } from './GhostCircle'
import { GridLines   } from './GridLines'
import { Playhead    } from './Playhead'
import { TimeAxis    } from './TimeAxis'
import { NotePopup   } from './NotePopup'
import { AiSuggestions } from './AiSuggestions'
import { CollaboratorCursors } from '../../collaboration/CollaboratorCursors'
import { SectionMarkers } from './SectionMarkers'
import { SectionCreatePopover } from './SectionCreatePopover'
import { DifficultyOverlay } from './DifficultyOverlay'
import { HitZone } from './HitZone'
import { useSections } from '../../sections/useSections'
import { useThrottle } from '../../../hooks/useThrottle'
import { TIME_AXIS_WIDTH } from '../../../lib/constants'
import type { Note, Song } from '@ama-midi/shared'
import type { CursorData } from '../../collaboration/useSocket'

type PopupState =
  | { type: 'create'; track: number; time: number; pos: { x: number; y: number } }
  | { type: 'edit';   note: Note;    pos: { x: number; y: number } }
  | null

interface Props {
  songId:           string
  canEdit?:         boolean
  mutedTracks?:     Set<number>
  onNoteSelected?:  (note: Note | null) => void
  cursors?:         Map<string, CursorData>
  onCursorMove?:    (track: number, time: number) => void
}

export function PianoRoll({ songId, canEdit = true, mutedTracks = new Set(), onNoteSelected, cursors, onCursorMove }: Props) {
  const containerRef   = useRef<HTMLDivElement>(null)
  const pxPerSecondRef = useRef(3)

  const [scrollTop,    setScrollTop]    = useState(0)
  const [gridMetrics,  setGridMetrics]  = useState({ width: 800, scrollbarGutter: 0 })
  const [ghost,        setGhost]        = useState<{ track: number; time: number } | null>(null)
  const [popup,        setPopup]        = useState<PopupState>(null)
  const [drag,         setDrag]         = useState<
    | { start: { x: number; y: number; track: number; time: number }; currentY: number }
    | null
  >(null)
  const [sectionPopover, setSectionPopover] = useState<{ time: number; pos: { x: number; y: number } } | null>(null)

  const { pxPerSecond, viewMode, playheadTime, snapMode, heatmapEnabled, isPlaying, zoom, setZoom, createMode,
          selectedNoteIds, selectNote, toggleNoteSelection, clearSelection, setActiveTrack } = useEditorStore()
  pxPerSecondRef.current = pxPerSecond

  useEffect(() => {
    const el = containerRef.current
    if (!el) return

    const updateMetrics = () => {
      const width = el.clientWidth
      const scrollbarGutter = Math.max(0, el.offsetWidth - el.clientWidth)
      setGridMetrics((current) => (
        current.width === width && current.scrollbarGutter === scrollbarGutter
          ? current
          : { width, scrollbarGutter }
      ))
    }

    updateMetrics()
    const observer = new ResizeObserver(updateMetrics)
    observer.observe(el)
    return () => observer.disconnect()
  }, [])

  // Ctrl/Cmd + scroll wheel to zoom
  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    const LEVELS: (1 | 2 | 4 | 8)[] = [1, 2, 4, 8]
    function onWheel(e: WheelEvent) {
      if (!e.ctrlKey && !e.metaKey) return
      e.preventDefault()
      const idx  = LEVELS.indexOf(zoom as 1 | 2 | 4 | 8)
      const next = e.deltaY < 0
        ? LEVELS[Math.min(idx + 1, LEVELS.length - 1)]
        : LEVELS[Math.max(idx - 1, 0)]
      if (next !== zoom) setZoom(next)
    }
    el.addEventListener('wheel', onWheel, { passive: false })
    return () => el.removeEventListener('wheel', onWheel)
  }, [zoom, setZoom])
  const isPreview = viewMode === 'preview'
  const effectiveCanEdit = canEdit && !isPreview

  const token = useAuthStore(s => s.token)
  const { data: song } = useQuery<Song>({
    queryKey: ['song', songId],
    queryFn:  () => apiClient(token)<Song>(`/songs/${songId}`),
    enabled:  !!token && !!songId,
  })
  const bpm           = song?.bpm ?? 120
  const timeSignature = song?.timeSignature ?? '4/4'

  const throttledCursorEmit = useThrottle(
    useCallback((track: number, time: number) => { onCursorMove?.(track, time) }, [onCursorMove]),
    66,
  )

  const viewportHeight = containerRef.current?.clientHeight ?? 600
  const gridWidth      = gridMetrics.width
  const scrollbarGutter = gridMetrics.scrollbarGutter
  const trackLayout    = getTrackLayout({
    editorWidth: gridWidth + TIME_AXIS_WIDTH,
    timeAxisWidth: TIME_AXIS_WIDTH,
    zoom,
  })
  const tw             = trackLayout.trackWidth

  const { timeFrom, timeTo } = getPrefetchTimeRange(scrollTop, viewportHeight, pxPerSecond)
  const { data: notes = [], isLoading } = useNotes(songId, timeFrom, timeTo)
  const { data: sections = [] } = useSections(songId)
  const createNote = useCreateNote(songId)
  const deleteNote = useDeleteNote(songId)

  const totalHeight = getTotalHeight(pxPerSecond)
  const timeGridLines = getVisibleTimeGridLines(pxPerSecond, timeFrom, timeTo)

  // Auto-scroll to follow playhead during playback
  useEffect(() => {
    if (!isPlaying) return
    let raf: number
    const tick = () => {
      if (!containerRef.current) return
      const target = Math.max(
        0,
        timeToY(useEditorStore.getState().playheadTime, pxPerSecond) - containerRef.current.clientHeight * 0.3,
      )
      containerRef.current.scrollTop = target
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [isPlaying, pxPerSecond])

  const handleScroll = useCallback((e: React.UIEvent<HTMLDivElement>) => {
    setScrollTop(e.currentTarget.scrollTop)
  }, [])

  const handleMouseMove = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    if (!containerRef.current) return
    const rect  = containerRef.current.getBoundingClientRect()
    const x     = e.clientX - rect.left
    const y     = e.clientY - rect.top + scrollTop
    const track = xToTrack(x, gridWidth)
    const time  = yToTime(y, pxPerSecond, snapMode, bpm)
    throttledCursorEmit(track, time)
    setActiveTrack(track)
    if (!effectiveCanEdit) return
    setGhost({ track, time })
  }, [effectiveCanEdit, gridWidth, pxPerSecond, scrollTop, snapMode, bpm, throttledCursorEmit, setActiveTrack])

  const handleMouseDown = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    if (!effectiveCanEdit || !containerRef.current) return
    if (useEditorStore.getState().activeNoteType !== 'HOLD') return
    if ((e.target as HTMLElement).closest('[data-note]')) return
    const rect  = containerRef.current.getBoundingClientRect()
    const x     = e.clientX - rect.left
    const y     = e.clientY - rect.top + scrollTop
    const track = xToTrack(x, gridWidth)
    const time  = yToTime(y, pxPerSecond, snapMode, bpm)
    setDrag({ start: { x: e.clientX, y: e.clientY, track, time }, currentY: e.clientY })
  }, [effectiveCanEdit, gridWidth, pxPerSecond, scrollTop, snapMode, bpm])

  useEffect(() => {
    if (!drag) return
    function onMove(e: MouseEvent) { setDrag(d => d ? { ...d, currentY: e.clientY } : null) }
    function onUp(e: MouseEvent) {
      if (!drag) return
      const dragPx = e.clientY - drag.start.y
      if (dragPx >= HOLD_DRAG_THRESHOLD_PX) {
        const duration = Math.max(0.1, dragPx / pxPerSecond)
        createNote.mutate({
          track:    drag.start.track,
          time:     drag.start.time,
          noteType: 'HOLD',
          duration,
          title:    `Hold ${drag.start.track}:${drag.start.time}`,
        })
      } else {
        createNote.mutate({
          track:    drag.start.track,
          time:     drag.start.time,
          noteType: 'TAP',
          title:    `Note ${drag.start.track}:${drag.start.time}`,
        })
      }
      setDrag(null)
    }
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup',  onUp)
    return () => {
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup',  onUp)
    }
  }, [drag, createNote, pxPerSecond])

  const handleGridClick = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    if (!effectiveCanEdit || !ghost) return
    if (useEditorStore.getState().activeNoteType === 'HOLD') return
    if (createMode === 'popup') {
      setPopup({ type: 'create', track: ghost.track, time: ghost.time, pos: { x: e.clientX, y: e.clientY } })
      setGhost(null)
      return
    }
    const activeNoteType = useEditorStore.getState().activeNoteType
    setGhost(null)
    createNote.mutate({
      track:    ghost.track,
      time:     ghost.time,
      noteType: activeNoteType === 'SWIPE' ? 'SWIPE' : 'TAP',
      title:    `${activeNoteType} ${ghost.track}:${ghost.time}`,
    })
  }, [effectiveCanEdit, ghost, createNote, createMode])

  const handleNoteClick = useCallback((note: Note, e: React.MouseEvent) => {
    e.stopPropagation()
    if (e.shiftKey) {
      toggleNoteSelection(note.id)
    } else {
      selectNote(note.id)
      setPopup({ type: 'edit', note, pos: { x: e.clientX, y: e.clientY } })
    }
    onNoteSelected?.(note)
  }, [onNoteSelected, selectNote, toggleNoteSelection])

  useEffect(() => {
    function handler(e: KeyboardEvent) {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return
      if ((e.key === 'e' || e.key === 'E') && selectedNoteIds.size === 1 && effectiveCanEdit && !popup) {
        const note = notes.find(n => selectedNoteIds.has(n.id))
        if (note) setPopup({ type: 'edit', note, pos: { x: window.innerWidth / 2 - 160, y: window.innerHeight / 2 - 230 } })
      }
      if ((e.key === 'Delete' || e.key === 'Backspace') && selectedNoteIds.size > 0 && effectiveCanEdit && !popup) {
        notes.filter(n => selectedNoteIds.has(n.id)).forEach(n => deleteNote.mutate(n.id))
        clearSelection()
        onNoteSelected?.(null)
      }
      if (e.key === 'Escape' && !popup) {
        clearSelection()
        onNoteSelected?.(null)
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [selectedNoteIds, effectiveCanEdit, deleteNote, popup, onNoteSelected, notes, clearSelection])

  const visibleNotes = notes.filter((n) => !mutedTracks.has(n.track))

  if (isLoading) {
    return (
      <div className="flex flex-col h-full bg-canvas-bg animate-pulse">
        <div className="flex h-8 border-b border-canvas-border bg-canvas-surface shrink-0">
          <div className="shrink-0 border-r border-canvas-border" style={{ width: TIME_AXIS_WIDTH }} />
          <div className="grid grid-cols-8 flex-1">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="border-r border-canvas-border flex items-center justify-center">
                <div className="w-4 h-3 bg-canvas-border rounded" />
              </div>
            ))}
          </div>
        </div>
        <div className="flex flex-1">
          <div className="shrink-0 border-r border-canvas-border" style={{ width: TIME_AXIS_WIDTH }} />
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
      </div>
    )
  }

  return (
    <div className="relative flex-1 overflow-hidden flex flex-col h-full">
      <div className="flex border-b border-canvas-border bg-canvas-surface h-8 shrink-0">
        <div className="shrink-0 border-r border-canvas-border" style={{ width: TIME_AXIS_WIDTH }} />
        <div className="flex shrink-0" style={{ width: gridWidth }}>
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
        {scrollbarGutter > 0 && <div className="shrink-0" style={{ width: scrollbarGutter }} />}
      </div>


      <div className="flex flex-1 min-h-0 overflow-hidden">
        <TimeAxis
          pxPerSecond={pxPerSecond}
          scrollTop={scrollTop}
          bpm={bpm}
          timeSignature={timeSignature}
          onAddSection={(time, e) => setSectionPopover({ time, pos: { x: e.clientX, y: e.clientY } })}
        />

        <div className="relative flex-1 min-h-0 overflow-hidden">
          <div
            ref={containerRef}
            className="overflow-y-auto overflow-x-hidden w-full h-full"
            onScroll={handleScroll}
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onClick={handleGridClick}
            onMouseLeave={() => {
              if (effectiveCanEdit) setGhost(null)
              setActiveTrack(null)
            }}
          >
            <div className="relative" style={{ height: totalHeight }}>
              <GridLines
                timeGridLines={timeGridLines}
                gridWidth={gridWidth}
              />

              {/* Vignette — soft top/bottom fade to reduce edge harshness */}
              <div
                className="absolute inset-0 pointer-events-none"
                style={{
                  background: 'linear-gradient(180deg, rgba(19,17,30,0.30) 0%, transparent 6%, transparent 94%, rgba(19,17,30,0.30) 100%)',
                  zIndex: 1,
                }}
              />

              {heatmapEnabled && (
                <DifficultyOverlay
                  notes={notes}
                  pxPerSecond={pxPerSecond}
                  width={gridWidth}
                />
              )}

            <SectionMarkers sections={sections} pxPerSecond={pxPerSecond} />

            {cursors && cursors.size > 0 && (
              <CollaboratorCursors
                cursors={cursors}
                gridWidth={gridWidth}
                pxPerSecond={pxPerSecond}
                scrollTop={scrollTop}
              />
            )}

            {visibleNotes.map((note) => (
              <NoteCircle
                key={note.id}
                note={note}
                gridWidth={gridWidth}
                pxPerSecond={pxPerSecond}
                viewMode={viewMode}
                isSelected={selectedNoteIds.has(note.id)}
                allNotes={notes}
                onClick={handleNoteClick}
              />
            ))}

            {effectiveCanEdit && ghost && (
              <GhostCircle
                track={ghost.track}
                time={ghost.time}
                gridWidth={gridWidth}
                pxPerSecond={pxPerSecond}
              />
            )}

            {drag && (() => {
              const startY = timeToY(drag.start.time, pxPerSecond)
              const px     = Math.max(HOLD_DRAG_THRESHOLD_PX, drag.currentY - drag.start.y)
              const x      = trackToX(drag.start.track, gridWidth)
              return (
                <div
                  className="absolute rounded-sm bg-primary/40 pointer-events-none"
                  style={{
                    left:   x + tw / 3,
                    top:    startY,
                    width:  tw / 3,
                    height: px,
                  }}
                />
              )
            })()}

            {visibleNotes.length === 0 && viewMode === 'composer' && effectiveCanEdit && (
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                <p className="text-sm text-canvas-muted">Click anywhere to place your first note</p>
              </div>
            )}
            </div>
          </div>

          {/* Playhead outside scroll — position: absolute relative to this wrapper */}
          <Playhead pxPerSecond={pxPerSecond} containerRef={containerRef} />
        </div>
      </div>

      {isPreview && (
        <HitZone
          pxPerSecond={pxPerSecond}
          playheadTime={playheadTime}
          width={gridWidth}
        />
      )}

      {effectiveCanEdit && <AiSuggestions songId={songId} gridWidth={gridWidth} pxPerSecond={pxPerSecond} scrollTop={scrollTop} />}

      {popup && (
        popup.type === 'create' ? (
          <NotePopup mode="create" songId={songId} initialTrack={popup.track} initialTime={popup.time} pos={popup.pos} onClose={() => setPopup(null)} />
        ) : (
          <NotePopup mode="edit" songId={songId} note={popup.note} pos={popup.pos} onClose={() => setPopup(null)} />
        )
      )}

      {sectionPopover && (
        <SectionCreatePopover
          songId={songId}
          time={sectionPopover.time}
          pos={sectionPopover.pos}
          onClose={() => setSectionPopover(null)}
        />
      )}
    </div>
  )
}
