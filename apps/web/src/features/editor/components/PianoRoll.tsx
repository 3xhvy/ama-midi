import { useRef, useState, useCallback, useEffect } from 'react'
import { cn } from '../../../lib/utils'
import { toast } from 'sonner'
import { HOLD_DRAG_THRESHOLD_PX, trackColor } from '@ama-midi/shared'
import { useEditorStore } from '../../../store/editor.store'
import { useNotes, useCreateNote, useDeleteNote } from '../../notes/useNotes'
import { useAuthStore } from '../../../store/auth.store'
import { useQuery } from '@tanstack/react-query'
import { apiClient } from '../../auth/api'
import { xToTrack, yToTime, timeToY, trackToX, trackWidth, getVisibleTimeGridLines, resolveLayoutGridWidth, MIN_GRID_WIDTH } from '../engine'
import { getTotalHeight, getPrefetchTimeRange } from '../engine'
import { NoteCircle  } from './NoteCircle'
import { GhostCircle } from './GhostCircle'
import { GridLines   } from './GridLines'
import { Playhead    } from './Playhead'
import { TimeAxis    } from './TimeAxis'
import { NotePopup   } from './NotePopup'
import { AiSuggestions } from './AiSuggestions'
import { ChartPreviewLayer } from './ChartPreviewLayer'
import { CollaboratorCursors } from '../../collaboration/CollaboratorCursors'
import { SectionMarkers } from './SectionMarkers'
import { SectionCreatePopover } from './SectionCreatePopover'
import { DifficultyOverlay } from './DifficultyOverlay'
import { HitZone } from './HitZone'
import { useSections } from '../../sections/useSections'
import { useThrottle } from '../../../hooks/useThrottle'
import { TIME_AXIS_WIDTH } from '../../../lib/constants'
import { getSelectionRect, selectNotesInBox, type SelectionPoint } from '../engine/selection-box'
import type { Note, Song } from '@ama-midi/shared'
import type { CursorData } from '../../collaboration/useSocket'

const HOLD_ARM_MS = 100

type PopupState =
  | { type: 'create'; track: number; time: number; pos: { x: number; y: number } }
  | { type: 'edit';   note: Note;    pos: { x: number; y: number } }
  | null

type SelectionDragState = {
  start:    SelectionPoint
  current:  SelectionPoint
  hasMoved: boolean
} | null

interface Props {
  songId:           string
  chartId?:         string
  speedMultiplier?: number
  canEdit?:         boolean
  readOnlyMessage?: string | null
  mutedTracks?:     Set<number>
  onNoteSelected?:  (note: Note | null) => void
  cursors?:         Map<string, CursorData>
  onCursorMove?:    (track: number, time: number) => void
  onCursorHide?:    () => void
}

export function PianoRoll({ songId, chartId, speedMultiplier = 1, canEdit = true, readOnlyMessage = null, mutedTracks = new Set(), onNoteSelected, cursors, onCursorMove, onCursorHide }: Props) {
  const containerRef          = useRef<HTMLDivElement>(null)
  const trackAreaRef          = useRef<HTMLDivElement>(null)
  const headerTracksScrollRef = useRef<HTMLDivElement>(null)
  const pxPerSecondRef = useRef(3)

  const [scrollTop,    setScrollTop]    = useState(0)
  const [gridMetrics,  setGridMetrics]  = useState({ width: 0, scrollbarGutter: 0 })
  const [ghost,        setGhost]        = useState<{ track: number; time: number } | null>(null)
  const [popup,        setPopup]        = useState<PopupState>(null)
  const [drag,         setDrag]         = useState<
    | {
        start: { x: number; y: number; track: number; time: number }
        currentY: number
        holdArmed: boolean
      }
    | null
  >(null)
  const [selectionDrag, setSelectionDrag] = useState<SelectionDragState>(null)
  const [sectionPopover, setSectionPopover] = useState<{ time: number; pos: { x: number; y: number } } | null>(null)
  const dragRef = useRef(drag)
  dragRef.current = drag
  const justPlacedRef = useRef(false)

  const { pxPerSecond, viewMode, playheadTime, snapMode, heatmapEnabled, isPlaying, zoom, setZoom, createMode,
          selectedNoteIds, selectNote, toggleNoteSelection, addNoteSelection, clearSelection, setActiveTrack } = useEditorStore()
  pxPerSecondRef.current = pxPerSecond

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

  function notifyReadOnly() {
    toast.info(readOnlyMessage ?? 'This chart is read-only — you cannot add or change notes.', { id: 'read-only-chart' })
  }

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
    true,
  )

  const viewportHeight = containerRef.current?.clientHeight ?? 600
  const { timeFrom, timeTo } = getPrefetchTimeRange(scrollTop, viewportHeight, pxPerSecond)
  const { data: notes = [], isLoading } = useNotes(chartId, timeFrom, timeTo)
  const { data: sections = [] } = useSections(songId)
  const createNote = useCreateNote(chartId)
  const deleteNote = useDeleteNote(chartId)

  useEffect(() => {
    if (isLoading) return
    const area = trackAreaRef.current
    const scroll = containerRef.current
    if (!area || !scroll) return

    const updateMetrics = () => {
      const width = scroll.clientWidth
      const scrollbarGutter = Math.max(0, scroll.offsetWidth - scroll.clientWidth)
      setGridMetrics((current) => (
        current.width === width && current.scrollbarGutter === scrollbarGutter
          ? current
          : { width, scrollbarGutter }
      ))
    }

    updateMetrics()
    const observer = new ResizeObserver(updateMetrics)
    observer.observe(area)
    observer.observe(scroll)
    return () => observer.disconnect()
  }, [isLoading])

  const measuredWidth  = gridMetrics.width || containerRef.current?.clientWidth || 0
  const layoutGridWidth = measuredWidth > 0 ? resolveLayoutGridWidth(measuredWidth) : MIN_GRID_WIDTH
  const tw             = layoutGridWidth / 8

  const totalHeight = getTotalHeight(pxPerSecond)
  const timeGridLines = getVisibleTimeGridLines(pxPerSecond, timeFrom, timeTo)

  const getCanvasPoint = useCallback((clientX: number, clientY: number): SelectionPoint | null => {
    if (!containerRef.current) return null
    const rect = containerRef.current.getBoundingClientRect()
    const scrollLeft = containerRef.current.scrollLeft
    return {
      x: Math.max(0, Math.min(layoutGridWidth, clientX - rect.left + scrollLeft)),
      y: Math.max(0, Math.min(totalHeight, clientY - rect.top + containerRef.current.scrollTop)),
    }
  }, [layoutGridWidth, totalHeight])

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
    const header = headerTracksScrollRef.current
    if (header && header.scrollLeft !== e.currentTarget.scrollLeft) {
      header.scrollLeft = e.currentTarget.scrollLeft
    }
  }, [])

  const handleMouseMove = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    if (!containerRef.current) return
    const rect       = containerRef.current.getBoundingClientRect()
    const scrollLeft = containerRef.current.scrollLeft
    const x          = e.clientX - rect.left + scrollLeft
    const y          = e.clientY - rect.top + scrollTop
    const track      = xToTrack(x, layoutGridWidth)
    const time       = yToTime(y, pxPerSecond, snapMode, bpm)
    throttledCursorEmit(track, time)
    if (selectionDrag) return
    setActiveTrack(track)
    if (!effectiveCanEdit) return
    setGhost({ track, time })
  }, [effectiveCanEdit, layoutGridWidth, pxPerSecond, scrollTop, snapMode, bpm, throttledCursorEmit, setActiveTrack, selectionDrag])

  const handleMouseDown = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    if (!effectiveCanEdit || !containerRef.current) return
    if ((e.target as HTMLElement).closest('[data-note]')) return
    if (e.shiftKey) {
      e.preventDefault()
      window.getSelection()?.removeAllRanges()
      const start = getCanvasPoint(e.clientX, e.clientY)
      if (!start) return
      setGhost(null)
      setSelectionDrag({ start, current: start, hasMoved: false })
      return
    }
    if (useEditorStore.getState().createMode !== 'fast') return
    const rect  = containerRef.current.getBoundingClientRect()
    const scrollLeft = containerRef.current.scrollLeft
    const x     = e.clientX - rect.left + scrollLeft
    const y     = e.clientY - rect.top + scrollTop
    const track = xToTrack(x, layoutGridWidth)
    const time  = yToTime(y, pxPerSecond, snapMode, bpm)
    setDrag({ start: { x: e.clientX, y: e.clientY, track, time }, currentY: e.clientY, holdArmed: false })
  }, [effectiveCanEdit, getCanvasPoint, layoutGridWidth, pxPerSecond, scrollTop, snapMode, bpm])

  useEffect(() => {
    if (!selectionDrag) return
    const activeDrag = selectionDrag

    function onMove(e: MouseEvent) {
      e.preventDefault()
      const current = getCanvasPoint(e.clientX, e.clientY)
      if (!current) return
      setSelectionDrag((state) => {
        if (!state) return null
        const moved = Math.abs(current.x - state.start.x) > 4 || Math.abs(current.y - state.start.y) > 4
        return { ...state, current, hasMoved: state.hasMoved || moved }
      })
    }

    function onUp(e: MouseEvent) {
      e.preventDefault()
      const current = getCanvasPoint(e.clientX, e.clientY) ?? activeDrag.current
      const finalDrag = { ...activeDrag, current }
      const rect = getSelectionRect(finalDrag.start, finalDrag.current)
      if (finalDrag.hasMoved && rect.width >= 4 && rect.height >= 4) {
        const ids = selectNotesInBox({
          notes: notes.filter((note) => !mutedTracks.has(note.track)),
          rect,
          gridWidth: layoutGridWidth,
          pxPerSecond,
        })
        if (ids.length > 0) addNoteSelection(ids)
      }
      setSelectionDrag(null)
    }

    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
    return () => {
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
    }
  }, [addNoteSelection, getCanvasPoint, layoutGridWidth, mutedTracks, notes, pxPerSecond, selectionDrag])

  useEffect(() => {
    if (!drag) return

    function onMove(e: MouseEvent) {
      setDrag(d => {
        if (!d) return null
        const dragPx = e.clientY - d.start.y
        const holdArmed = d.holdArmed || dragPx >= HOLD_DRAG_THRESHOLD_PX
        return { ...d, currentY: e.clientY, holdArmed }
      })
    }

    function onUp(e: MouseEvent) {
      const current = dragRef.current
      if (!current) return
      dragRef.current = null
      setDrag(null)
      justPlacedRef.current = true

      const dragPx = e.clientY - current.start.y
      if (current.holdArmed) {
        const duration = Math.max(0.1, dragPx / pxPerSecond)
        createNote.mutate({
          track:    current.start.track,
          time:     current.start.time,
          noteType: 'HOLD',
          duration,
          title:    `Hold ${current.start.track}:${current.start.time}`,
        })
      } else {
        createNote.mutate({
          track:    current.start.track,
          time:     current.start.time,
          noteType: 'TAP',
          title:    `Note ${current.start.track}:${current.start.time}`,
        })
      }
    }

    const armTimer = window.setTimeout(() => {
      setDrag(d => d ? { ...d, holdArmed: true } : null)
    }, HOLD_ARM_MS)

    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup',  onUp)
    return () => {
      clearTimeout(armTimer)
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup',  onUp)
    }
  }, [drag?.start.x, drag?.start.y, drag?.start.track, drag?.start.time, createNote, pxPerSecond])

  const handleGridClick = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    if (justPlacedRef.current) {
      justPlacedRef.current = false
      return
    }
    if (e.shiftKey) return
    if (!effectiveCanEdit || !ghost) {
      if (!effectiveCanEdit) notifyReadOnly()
      return
    }
    if (createMode !== 'popup') return
    setPopup({ type: 'create', track: ghost.track, time: ghost.time, pos: { x: e.clientX, y: e.clientY } })
    setGhost(null)
  }, [effectiveCanEdit, ghost, createMode, readOnlyMessage])

  const handleNoteClick = useCallback((note: Note, e: React.MouseEvent) => {
    e.stopPropagation()
    if (e.shiftKey) {
      e.preventDefault()
      window.getSelection()?.removeAllRanges()
      toggleNoteSelection(note.id)
    } else {
      selectNote(note.id)
      if (effectiveCanEdit) {
        setPopup({ type: 'edit', note, pos: { x: e.clientX, y: e.clientY } })
      }
    }
    onNoteSelected?.(note)
  }, [onNoteSelected, selectNote, toggleNoteSelection, effectiveCanEdit])

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
    <div className="relative flex-1 overflow-hidden flex flex-col h-full select-none">
      <div className="flex border-b border-canvas-border bg-canvas-surface h-8 shrink-0 min-w-0">
        <div className="shrink-0 border-r border-canvas-border" style={{ width: TIME_AXIS_WIDTH }} />
        <div
          ref={headerTracksScrollRef}
          className="overflow-x-hidden flex-1 min-w-0"
        >
          <div className="flex shrink-0 h-full" style={{ width: layoutGridWidth }}>
            {Array.from({ length: 8 }, (_, i) => i + 1).map((track) => (
              <div
                key={track}
                style={{ width: tw }}
                className={cn(
                  'shrink-0 flex items-center justify-center text-xs border-r border-canvas-border transition-opacity select-none',
                  mutedTracks.has(track) ? 'opacity-30 text-canvas-muted' : 'text-canvas-muted',
                )}
              >
                T{track}
              </div>
            ))}
          </div>
        </div>
      </div>


      <div className="flex flex-1 min-h-0 overflow-hidden">
        <TimeAxis
          pxPerSecond={pxPerSecond}
          scrollTop={scrollTop}
          bpm={bpm}
          timeSignature={timeSignature}
          onAddSection={(time, e) => setSectionPopover({ time, pos: { x: e.clientX, y: e.clientY } })}
        />

        <div ref={trackAreaRef} className="relative flex-1 min-h-0 overflow-hidden">
          <div
            ref={containerRef}
            className={`overflow-y-auto overflow-x-auto w-full h-full select-none [scrollbar-gutter:stable] ${effectiveCanEdit ? '' : 'cursor-not-allowed'}`}
            onScroll={handleScroll}
            onMouseDownCapture={(e) => {
              if (e.shiftKey) {
                e.preventDefault()
                window.getSelection()?.removeAllRanges()
              }
            }}
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onClick={handleGridClick}
            onMouseLeave={() => {
              if (effectiveCanEdit) setGhost(null)
              setActiveTrack(null)
              onCursorHide?.()
            }}
          >
            <div className="relative" style={{ height: totalHeight, width: layoutGridWidth }}>
              <GridLines
                timeGridLines={timeGridLines}
                gridWidth={layoutGridWidth}
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
                  bpm={bpm}
                  timeSignature={timeSignature}
                  speedMultiplier={speedMultiplier}
                  pxPerSecond={pxPerSecond}
                  width={layoutGridWidth}
                />
              )}

            <SectionMarkers sections={sections} pxPerSecond={pxPerSecond} />

            {cursors && cursors.size > 0 && (
              <CollaboratorCursors
                cursors={cursors}
                gridWidth={layoutGridWidth}
                pxPerSecond={pxPerSecond}
                scrollTop={scrollTop}
              />
            )}

            {visibleNotes.map((note) => (
              <NoteCircle
                key={note.id}
                note={note}
                gridWidth={layoutGridWidth}
                pxPerSecond={pxPerSecond}
                viewMode={viewMode}
                isSelected={selectedNoteIds.has(note.id)}
                allNotes={notes}
                onClick={handleNoteClick}
              />
            ))}

            {selectionDrag && (() => {
              const rect = getSelectionRect(selectionDrag.start, selectionDrag.current)
              return (
                <div
                  className="absolute pointer-events-none rounded border border-primary bg-primary/15"
                  style={{
                    left:   rect.left,
                    top:    rect.top,
                    width:  rect.width,
                    height: rect.height,
                    zIndex: 30,
                  }}
                />
              )
            })()}

            {effectiveCanEdit && ghost && (
              <GhostCircle
                track={ghost.track}
                time={ghost.time}
                gridWidth={layoutGridWidth}
                pxPerSecond={pxPerSecond}
              />
            )}

            {drag && !drag.holdArmed && (
              <GhostCircle
                track={drag.start.track}
                time={drag.start.time}
                gridWidth={layoutGridWidth}
                pxPerSecond={pxPerSecond}
              />
            )}

            {drag && drag.holdArmed && (() => {
              const startY = timeToY(drag.start.time, pxPerSecond)
              const dragPx = Math.max(0, drag.currentY - drag.start.y)
              const px     = Math.max(HOLD_DRAG_THRESHOLD_PX, dragPx)
              const x      = trackToX(drag.start.track, layoutGridWidth)
              const tw     = trackWidth(layoutGridWidth)
              const color  = trackColor(drag.start.track)
              return (
                <div
                  className="absolute rounded-sm pointer-events-none"
                  style={{
                    left:   x + tw / 3,
                    top:    startY,
                    width:  tw / 3,
                    height: px,
                    backgroundColor: `${color}66`,
                  }}
                />
              )
            })()}

            {visibleNotes.length === 0 && viewMode === 'composer' && effectiveCanEdit && (
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                <p className="text-sm text-canvas-muted">Click for tap · hold 0.1s or drag for hold</p>
              </div>
            )}

            {effectiveCanEdit && chartId && (
              <AiSuggestions songId={songId} chartId={chartId} gridWidth={layoutGridWidth} pxPerSecond={pxPerSecond} notes={notes} />
            )}
            {effectiveCanEdit && (
              <ChartPreviewLayer gridWidth={layoutGridWidth} pxPerSecond={pxPerSecond} />
            )}
            </div>
          </div>

          {isPreview && (
            <HitZone
              pxPerSecond={pxPerSecond}
              playheadTime={playheadTime}
              width={layoutGridWidth}
              containerRef={containerRef}
            />
          )}

          {/* Playhead outside scroll — position: absolute relative to this wrapper */}
          <Playhead pxPerSecond={pxPerSecond} containerRef={containerRef} />
        </div>
      </div>

      {popup && chartId && (
        popup.type === 'create' ? (
          <NotePopup mode="create" chartId={chartId} initialTrack={popup.track} initialTime={popup.time} pos={popup.pos} onClose={() => setPopup(null)} />
        ) : (
          <NotePopup mode="edit" chartId={chartId} note={popup.note} pos={popup.pos} onClose={() => setPopup(null)} />
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
