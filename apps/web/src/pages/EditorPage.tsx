import { useRef, useState, useEffect, type ReactNode } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useSongTour }  from '../features/onboarding/useSongTour'
import { TourOverlay }  from '../features/onboarding/TourOverlay'
import { useQuery } from '@tanstack/react-query'
import { EditorShell } from '../components/layout'
import { Toolbar }            from '../features/editor/components/Toolbar'
import { TrackHeader }        from '../features/editor/components/TrackHeader'
import { computeNps }         from '../features/editor/components/LiveContextStrip'
import { MultiSelectBar }     from '../features/editor/components/MultiSelectBar'
import { SavePatternModal }   from '../features/editor/components/SavePatternModal'
import { PatternPanel }       from '../features/editor/components/PatternPanel'
import { SectionJumpList }    from '../features/editor/components/SectionJumpList'
import { BottomBarStats }     from '../features/editor/components/BottomBarStats'
import { useNotes }           from '../features/notes/useNotes'
import { useDeleteNote, useUpdateNote } from '../features/notes/useNotes'
import { useSections }        from '../features/sections/useSections'
import { usePlayback }        from '../features/editor/hooks/usePlayback'
import { Button, Tabs, ToggleGroup } from '../components/ui'
import { PianoRoll } from '../features/editor/components/PianoRoll'
import { HistoryPanel } from '../features/editor/components/HistoryPanel'
import { ValidationPanel } from '../features/editor/components/ValidationPanel'
import { ShortcutLegend } from '../features/editor/components/ShortcutLegend'
import { useSocket } from '../features/collaboration/useSocket'
import { useEditorStore } from '../store/editor.store'
import { useUndo } from '../features/notes/useNotes'
import { useCanEdit } from '../hooks/useCanEdit'
import { useKeyboardShortcuts } from '../hooks/useKeyboardShortcuts'
import { useIsMobile } from '../hooks/useMediaQuery'
import { useAuthStore } from '../store/auth.store'
import { apiClient } from '../features/auth/api'
import { type Note, type NoteType, type Song, trackColor } from '@ama-midi/shared'
import type { SnapMode } from '../features/editor/engine/beat-calculator'

interface ValidationResult {
  summary: { errors: number; warnings: number }
}

export function EditorPage() {
  const { projectId, songId } = useParams<{ projectId?: string; songId: string }>()
  const navigate = useNavigate()
  const {
    viewMode,
    rightPanelTab, setRightPanelTab,
    leftCollapsed, rightCollapsed,
    toggleLeftPanel, toggleRightPanel,
    setLeftCollapsed, setRightCollapsed,
    playheadTime, selectNote, triggerAiSuggest,
    selectedNoteIds, clearSelection,
    activeTrack,
  } = useEditorStore()

  const isMobile = useIsMobile()

  function handleToggleLeft() {
    if (isMobile && leftCollapsed && !rightCollapsed) setRightCollapsed(true)
    toggleLeftPanel()
  }

  function handleToggleRight() {
    if (isMobile && rightCollapsed && !leftCollapsed) setLeftCollapsed(true)
    toggleRightPanel()
  }

  usePlayback()

  const songTour = useSongTour()
  const undo       = useUndo(songId!)
  const deleteNote = useDeleteNote(songId!)
  const updateNote = useUpdateNote(songId!)
  const { data: allNotes = [] } = useNotes(songId!)
  const { data: sections = [] } = useSections(songId!)
  const { presenceList, cursors, emitCursorMove } = useSocket(songId!, projectId)
  const canEdit = useCanEdit()
  const token = useAuthStore((s) => s.token)

  const { data: song } = useQuery<Song>({
    queryKey: ['song', songId],
    queryFn:  () => apiClient(token)<Song>(`/songs/${songId}`),
    enabled:  !!token && !!songId,
  })

  useEffect(() => {
    if (!projectId && song?.projectId && songId) {
      navigate(`/projects/${song.projectId}/songs/${song.id}`, { replace: true })
    }
  }, [projectId, song, songId, navigate])

  const [mutedTracks,         setMutedTracks]         = useState<Set<number>>(new Set())
  const [showShortcuts,       setShowShortcuts]       = useState(false)
  const [showSavePattern,     setShowSavePattern]     = useState(false)

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

  function handleNoteSelected(note: Note | null) {
    selectNote(note?.id ?? null)
  }

  useKeyboardShortcuts({
    canEdit,
    onUndo: () => undo.mutate(),
    onDeleteNote: () => {},
    onEditNote: () => {},
    onJumpToStart: () => jumpToRef.current?.(0),
    onToggleShortcuts: () => setShowShortcuts((v) => !v),
    onToggleLeftPanel:  handleToggleLeft,
    onToggleRightPanel: handleToggleRight,
  })

  if (!songId) return null

  const errCount = validationData?.summary.errors ?? 0
  const warnCount = validationData?.summary.warnings ?? 0

  const topBar = (
    <Toolbar
      songId={songId!}
      songName={song?.name ?? '…'}
      bpm={song?.bpm ?? 120}
      presenceList={presenceList}
      onSuggest={() => triggerAiSuggest?.()}
      onShowShortcuts={() => setShowShortcuts(true)}
      onBack={() => navigate(projectId ? `/projects/${projectId}` : '/projects')}
      leftCollapsed={leftCollapsed}
      rightCollapsed={rightCollapsed}
      onToggleLeft={handleToggleLeft}
      onToggleRight={handleToggleRight}
    />
  )

  const maxNoteCount = Math.max(
    1,
    ...Array.from({ length: 8 }, (_, i) => allNotes.filter(n => n.track === i + 1).length),
  )
  const selectedNoteObjects = allNotes.filter(n => selectedNoteIds.has(n.id))

  const leftPanel = (
    <>
      <div className="px-3 py-2 border-b border-shell-border">
        <span className="text-xs font-medium text-shell-text uppercase tracking-wide">Tracks</span>
      </div>
      <div className="py-1">
        {Array.from({ length: 8 }, (_, i) => i + 1).map((track) => (
          <TrackHeader
            key={track}
            track={track}
            isMuted={mutedTracks.has(track)}
            noteCount={allNotes.filter(n => n.track === track).length}
            maxCount={maxNoteCount}
            isActive={activeTrack === track}
            onToggleMute={() => toggleMute(track, false)}
          />
        ))}
      </div>
      <SectionJumpList songId={songId!} sections={sections} />
      <PatternPanel songId={songId!} />
      <div className="border-t border-shell-border">
        <div className="px-3 py-2 border-b border-shell-border">
          <span className="text-xs font-medium text-shell-text uppercase tracking-wide">Song Stats</span>
        </div>
        <BottomBarStats notes={allNotes} />
      </div>
    </>
  )

  const rightPanel = (
    <div className="flex flex-col flex-1 min-h-0">
      {/* Tabs */}
      <Tabs.Root
        value={rightPanelTab}
        onValueChange={(v) => setRightPanelTab(v as typeof rightPanelTab)}
        className="flex flex-col flex-1 min-h-0"
      >
        <Tabs.List>
          <Tabs.Trigger value="tools" variant="editor">tools</Tabs.Trigger>
          <Tabs.Trigger value="validation" variant="editor">
            val
            {(errCount > 0 || warnCount > 0) && (
              <span className={`ml-1 text-[10px] ${errCount > 0 ? 'text-red-400' : 'text-yellow-400'}`}>
                {errCount > 0 ? errCount : warnCount}
              </span>
            )}
          </Tabs.Trigger>
          <Tabs.Trigger value="history" variant="editor" data-tour="history-tab">history</Tabs.Trigger>
        </Tabs.List>
        <Tabs.Content value="tools">
          <ToolsTab
            notes={allNotes}
            selectedNotes={selectedNoteObjects}
            canEdit={canEdit}
            onSavePattern={() => setShowSavePattern(true)}
            onDelete={() => {
              selectedNoteObjects.forEach(n => deleteNote.mutate(n.id))
              clearSelection()
            }}
            onDeselect={clearSelection}
            onUpdateSelected={(patch) => {
              selectedNoteObjects.forEach(n => updateNote.mutate({ noteId: n.id, ...patch }))
            }}
          />
        </Tabs.Content>
        <Tabs.Content value="validation">
          <ValidationPanel
            songId={songId}
            onJumpTo={(time, track) => {
              jumpToRef.current = (t) => console.log('jump to', t, track)
              jumpToRef.current(time)
            }}
          />
        </Tabs.Content>
        <Tabs.Content value="history">
          <HistoryPanel songId={songId} inline />
        </Tabs.Content>
      </Tabs.Root>
    </div>
  )

  const liveNps = computeNps(allNotes, playheadTime)
  const npsColor = liveNps < 3 ? '#10B981' : liveNps < 6 ? '#F59E0B' : '#EF4444'

  const bottomBar = (
    <>
      <span className="text-xs font-mono" style={{ color: npsColor }}>
        {liveNps} NPS
      </span>
      <div className="w-24 h-1 rounded-full bg-shell-border mx-2">
        <div
          className="h-full rounded-full transition-all duration-100"
          style={{ width: `${Math.min(100, (liveNps / 10) * 100)}%`, backgroundColor: npsColor }}
        />
      </div>
      {selectedNoteIds.size > 0 && (
        <span className="text-xs text-shell-muted">
          <span className="text-shell-text font-medium">{selectedNoteIds.size}</span> selected
        </span>
      )}
      <div className="ml-auto">
        {!validationData ? null : errCount === 0 && warnCount === 0 ? (
          <span className="text-xs text-green-500">✓ Valid</span>
        ) : (
          <span className="flex items-center gap-2 text-xs">
            {errCount > 0 && <span className="text-red-400">{errCount} err</span>}
            {warnCount > 0 && <span className="text-yellow-400">{warnCount} warn</span>}
          </span>
        )}
      </div>
    </>
  )

  return (
    <div className="relative">
      <MultiSelectBar
        count={selectedNoteIds.size}
        onSavePattern={() => setShowSavePattern(true)}
        onDelete={() => {
          selectedNoteObjects.forEach(n => deleteNote.mutate(n.id))
          clearSelection()
        }}
        onDeselect={clearSelection}
      />
      {showSavePattern && (
        <SavePatternModal
          songId={songId!}
          selectedNotes={selectedNoteObjects}
          onClose={() => setShowSavePattern(false)}
        />
      )}
      <EditorShell
        topBar={topBar}
        leftPanel={leftPanel}
        rightPanel={rightPanel}
        bottomBar={bottomBar}
        leftCollapsed={leftCollapsed}
        rightCollapsed={rightCollapsed}
        onLeftToggle={toggleLeftPanel}
        onRightToggle={toggleRightPanel}
      >
        <div data-tour="piano-roll" className="flex-1 overflow-hidden flex flex-col h-full">
          <PianoRoll
            songId={songId}
            canEdit={canEdit}
            mutedTracks={mutedTracks}
            onNoteSelected={handleNoteSelected}
            cursors={cursors}
            onCursorMove={emitCursorMove}
          />
        </div>
      </EditorShell>

      {viewMode !== 'composer' && (
        <div className="fixed bottom-14 right-4 px-3 py-1 bg-shell-surface border border-shell-border rounded-full text-xs text-shell-muted uppercase tracking-wide z-50">
          {viewMode} view
        </div>
      )}

      {showShortcuts && <ShortcutLegend onClose={() => setShowShortcuts(false)} />}
      {songTour.active && (
        <TourOverlay steps={songTour.steps} onComplete={songTour.complete} onSkip={songTour.skip} />
      )}
    </div>
  )
}

interface ToolsTabProps {
  notes: Note[]
  selectedNotes: Note[]
  canEdit: boolean
  onSavePattern: () => void
  onDelete: () => void
  onDeselect: () => void
  onUpdateSelected: (patch: { noteType?: NoteType }) => void
}

const VIEW_MODES = [
  { value: 'composer',  label: 'Composer' },
  { value: 'developer', label: 'Dev' },
  { value: 'qa',        label: 'QA' },
  { value: 'preview',   label: 'Preview' },
]

const ZOOM_MODES = [
  { value: '1', label: '1x' },
  { value: '2', label: '2x' },
  { value: '4', label: '4x' },
  { value: '8', label: '8x' },
]

const SNAP_MODES: { value: SnapMode; label: string }[] = [
  { value: '0.1s',     label: '0.1s' },
  { value: 'beat',     label: 'Beat' },
  { value: 'halfBeat', label: '1/2' },
]

const TYPE_MODES: { value: NoteType; label: string }[] = [
  { value: 'TAP',  label: 'Tap' },
  { value: 'HOLD', label: 'Hold' },
]

function SingleNoteDetail({ note }: { note: Note }) {
  const color = trackColor(note.track)
  const typeLabel = note.noteType === 'HOLD' ? 'Hold' : note.noteType === 'SWIPE' ? 'Swipe' : 'Tap'
  return (
    <div className="flex flex-col gap-0.5 text-[11px]" style={{ color: 'var(--color-editor-body)' }}>
      <div className="flex items-center gap-1.5">
        <div className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: color }} />
        <span>Track {note.track} · {typeLabel}</span>
      </div>
      <span>{note.time}s{note.noteType === 'HOLD' && note.duration ? ` · ${note.duration}s hold` : ''}</span>
    </div>
  )
}

function MultiNoteDetail({ notes }: { notes: Note[] }) {
  const uniqueTracks = [...new Set(notes.map(n => n.track))].sort((a, b) => a - b)
  const minTime = Math.min(...notes.map(n => n.time))
  const maxTime = Math.max(...notes.map(n => n.time + (n.duration ?? 0)))
  return (
    <div className="flex flex-col gap-0.5 text-[11px]" style={{ color: 'var(--color-editor-body)' }}>
      <div className="flex items-center gap-1">
        <span>{notes.length} notes</span>
        <div className="flex items-center gap-0.5 ml-1">
          {uniqueTracks.map(t => (
            <div
              key={t}
              className="w-1.5 h-1.5 rounded-full shrink-0"
              style={{ backgroundColor: trackColor(t) }}
            />
          ))}
        </div>
      </div>
      <span>{Math.round(minTime * 10) / 10}s – {Math.round(maxTime * 10) / 10}s</span>
    </div>
  )
}

function ToolsTab({
  notes, selectedNotes, canEdit,
  onSavePattern, onDelete, onDeselect, onUpdateSelected,
}: ToolsTabProps) {
  const {
    viewMode, setViewMode,
    zoom, setZoom,
    snapMode, setSnapMode,
    activeNoteType, setActiveNoteType,
    heatmapEnabled, setHeatmapEnabled,
    createMode, setCreateMode,
  } = useEditorStore()

  const selectedCount = selectedNotes.length
  const selectedType = selectedCount === 1 ? selectedNotes[0].noteType : activeNoteType

  return (
    <div className="flex-1 overflow-y-auto p-3 space-y-4">
      <section className="space-y-3">
        <PanelHeading title="Editor" meta={`${notes.length} notes`} />

        <ToolRow label="View">
          <ToggleGroup
            items={VIEW_MODES}
            value={viewMode}
            onValueChange={(v) => setViewMode(v as typeof viewMode)}
            variant="editor"
            className="w-full"
          />
        </ToolRow>

        <ToolRow label="Zoom">
          <ToggleGroup
            items={ZOOM_MODES}
            value={String(zoom)}
            onValueChange={(v) => setZoom(Number(v) as 1 | 2 | 4 | 8)}
            variant="editor"
            className="w-full"
          />
        </ToolRow>

        <ToolRow label="Snap">
          <ToggleGroup
            items={SNAP_MODES}
            value={snapMode}
            onValueChange={(v) => setSnapMode(v as SnapMode)}
            variant="editor"
            className="w-full"
          />
        </ToolRow>

        {canEdit && (
          <>
            <ToolRow label="Create type">
              <ToggleGroup
                items={TYPE_MODES}
                value={activeNoteType}
                onValueChange={(v) => setActiveNoteType(v as NoteType)}
                className="w-full"
              />
            </ToolRow>

            <ToolRow label="Create mode">
              <ToggleGroup
                items={[
                  { value: 'fast',  label: 'Fast' },
                  { value: 'popup', label: 'Popup' },
                ]}
                value={createMode}
                onValueChange={(v) => setCreateMode(v as 'fast' | 'popup')}
                className="w-full"
              />
            </ToolRow>
          </>
        )}

        <button
          type="button"
          onClick={() => setHeatmapEnabled(!heatmapEnabled)}
          className="w-full flex items-center justify-between rounded-md border border-shell-border bg-shell-bg px-3 py-2 text-xs text-shell-text hover:bg-shell-surface transition-colors"
        >
          <span>Difficulty heatmap</span>
          <span
            className={heatmapEnabled ? 'text-warning' : ''}
            style={heatmapEnabled ? undefined : { color: 'var(--color-editor-btn-inactive)' }}
          >
            {heatmapEnabled ? 'On' : 'Off'}
          </span>
        </button>
      </section>

      <section className="space-y-3 border-t border-shell-border pt-4">
        <PanelHeading title="Selection" meta={selectedCount ? `${selectedCount} selected` : 'none'} />

        {selectedCount === 0 ? (
          <p className="text-xs leading-relaxed" style={{ color: 'var(--color-editor-body)' }}>
            Select notes on the canvas to edit groups here.
          </p>
        ) : (
          <>
            {selectedCount === 1
              ? <SingleNoteDetail note={selectedNotes[0]} />
              : <MultiNoteDetail notes={selectedNotes} />
            }

            {canEdit && (
              <ToolRow label="Type">
                <ToggleGroup
                  items={TYPE_MODES}
                  value={selectedType}
                  onValueChange={(v) => onUpdateSelected({ noteType: v as NoteType })}
                  className="w-full"
                />
              </ToolRow>
            )}

            <div className="grid grid-cols-2 gap-2">
              <Button
                size="sm"
                variant="secondary"
                onClick={onSavePattern}
                disabled={!canEdit || selectedCount < 2}
              >
                Save pattern
              </Button>
              <Button size="sm" variant="danger" onClick={onDelete} disabled={!canEdit}>
                Delete
              </Button>
              <Button size="sm" variant="ghost" onClick={onDeselect} className="col-span-2">
                Deselect
              </Button>
            </div>
          </>
        )}
      </section>
    </div>
  )
}

function PanelHeading({ title, meta }: { title: string; meta?: string }) {
  return (
    <div className="flex items-center justify-between gap-2">
      <h3 className="text-xs font-semibold uppercase tracking-wide" style={{ color: 'var(--color-editor-btn-inactive)' }}>{title}</h3>
      {meta && <span className="text-[10px]" style={{ color: 'var(--color-editor-section-label)' }}>{meta}</span>}
    </div>
  )
}

function ToolRow({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="space-y-1.5">
      <span className="text-xs" style={{ color: 'var(--color-editor-field-label)' }}>{label}</span>
      {children}
    </div>
  )
}
