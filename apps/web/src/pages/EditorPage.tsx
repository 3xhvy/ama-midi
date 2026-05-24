import { useRef, useState, useEffect, useMemo, useCallback, type ReactNode } from 'react'
import { useParams, useNavigate, useSearchParams } from 'react-router-dom'
import { useSongTour }  from '../features/onboarding/useSongTour'
import { TourOverlay }  from '../features/onboarding/TourOverlay'
import { useQuery } from '@tanstack/react-query'
import { EditorShell } from '../components/layout'
import { Toolbar }            from '../features/editor/components/Toolbar'
import { TrackHeader }        from '../features/editor/components/TrackHeader'
import { computeNps }         from '../features/editor/components/LiveContextStrip'
import { MultiSelectBar }     from '../features/editor/components/MultiSelectBar'
import { ChartPreviewBar }    from '../features/editor/components/ChartPreviewBar'
import { SavePatternModal }   from '../features/editor/components/SavePatternModal'
import { CopyToModal }        from '../features/editor/components/CopyToModal'
import { RepeatModal }       from '../features/editor/components/RepeatModal'
import { ConflictReviewModal } from '../features/editor/components/ConflictReviewModal'
import { mergeResolutions, noteCopyPreviewToPlacement } from '../features/editor/components/placement-preview'
import { useApplyNoteCopy }   from '../features/editor/hooks/useNoteCopy'
import { PatternPanel }       from '../features/editor/components/PatternPanel'
import { SectionJumpList }    from '../features/editor/components/SectionJumpList'
import { AnalysisSummaryPanel } from '../features/editor/components/AnalysisSummaryPanel'
import { BottomBarStats }     from '../features/editor/components/BottomBarStats'
import { useCharts } from '../features/charts/useCharts'
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
import { useSongChartAccess } from '../hooks/useSongChartAccess'
import { useKeyboardShortcuts } from '../hooks/useKeyboardShortcuts'
import { useIsMobile } from '../hooks/useMediaQuery'
import { useAuthStore } from '../store/auth.store'
import { apiClient } from '../features/auth/api'
import { type Note, type NoteType, type Song, type ConflictAction, type NoteCopyPreview, type NoteCopyPreviewRequest, trackColor } from '@ama-midi/shared'
import { toast } from 'sonner'
import { useProject } from '../features/projects/useProjects'
import { recordRecentProject, recordRecentSong } from '../features/navigation/recent-navigation'
import { useValidation } from '../features/validation/useValidation'
import { computeTrackDensity } from '../features/editor/utils/track-density'
import type { SnapMode } from '../features/editor/engine/beat-calculator'

export function EditorPage() {
  const { projectId, songId } = useParams<{ projectId?: string; songId: string }>()
  const navigate = useNavigate()
  const {
    viewMode,
    rightPanelTab, setRightPanelTab,
    leftCollapsed, rightCollapsed,
    toggleLeftPanel, toggleRightPanel,
    setLeftCollapsed, setRightCollapsed,
    playheadTime, triggerAiSuggest, snapMode,
    selectedNoteIds, clearSelection, focusNote,
    activeTrack,
    activeChartId,
    setActiveChartId,
    setPlayheadTime,
  } = useEditorStore()

  const [searchParams] = useSearchParams()

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
  const { data: charts = [] } = useCharts(songId!)
  const activeChart = charts.find((c) => c.id === activeChartId) ?? charts[0]

  useEffect(() => {
    setActiveChartId(null)
  }, [songId, setActiveChartId])

  useEffect(() => {
    if (!charts.length) return
    const chartParam = searchParams.get('chart')
    if (chartParam && charts.some((c) => c.id === chartParam)) {
      setActiveChartId(chartParam)
      return
    }
    if (!activeChartId || !charts.some((c) => c.id === activeChartId)) {
      setActiveChartId(charts[0].id)
    }
  }, [charts, activeChartId, searchParams, setActiveChartId])

  useEffect(() => {
    const t = searchParams.get('t')
    if (t) {
      const parsed = parseFloat(t)
      if (!Number.isNaN(parsed)) setPlayheadTime(parsed)
    }
  }, [searchParams, setPlayheadTime])

  const chartId = activeChart?.id

  const undo       = useUndo(chartId)
  const deleteNote = useDeleteNote(chartId)
  const updateNote = useUpdateNote(chartId)
  const { data: allNotes = [] } = useNotes(chartId)
  const { data: sections = [] } = useSections(songId!)
  const { presenceList, isConnected, cursors, emitCursorMove, emitCursorHide } = useSocket(songId!, chartId, projectId)
  const token = useAuthStore((s) => s.token)

  const { data: song } = useQuery<Song>({
    queryKey: ['song', songId],
    queryFn:  () => apiClient(token)<Song>(`/songs/${songId}`),
    enabled:  !!token && !!songId,
  })

  const { canEdit, readOnlyMessage } = useSongChartAccess(songId, song)

  const { data: project } = useProject(projectId)

  useEffect(() => {
    if (!projectId || !songId) return
    recordRecentSong(localStorage, projectId, songId)
    recordRecentProject(localStorage, projectId)
  }, [projectId, songId])

  useEffect(() => {
    if (!projectId && song?.projectId && songId) {
      navigate(`/projects/${song.projectId}/songs/${song.id}`, { replace: true })
    }
  }, [projectId, song, songId, navigate])

  const [mutedTracks,         setMutedTracks]         = useState<Set<number>>(new Set())
  const [showShortcuts,       setShowShortcuts]       = useState(false)
  const [showSavePattern,     setShowSavePattern]     = useState(false)
  const [showCopyTo,          setShowCopyTo]          = useState(false)
  const [showRepeat,          setShowRepeat]          = useState(false)
  const [copyPreview,         setCopyPreview]         = useState<NoteCopyPreview | null>(null)
  const [copyRequest,         setCopyRequest]         = useState<NoteCopyPreviewRequest | null>(null)
  const [copyResolutions,     setCopyResolutions]     = useState<Record<string, ConflictAction>>({})
  const [copyConflictChanged, setCopyConflictChanged] = useState(false)
  const [copyStep,            setCopyStep]            = useState<'INPUT' | 'REVIEW' | 'APPLYING'>('INPUT')

  const applyNoteCopy = useApplyNoteCopy(chartId)

  const jumpToRef = useRef<((time: number, track?: number) => void) | null>(null)

  const { summary: validationSummary, data: validationData } = useValidation(songId)

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
    focusNote(note?.id ?? null)
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

  const trackDensities = useMemo(() => computeTrackDensity(allNotes), [allNotes])

  if (!songId) return null

  const { errors: errCount, warnings: warnCount, total: validationTotal } = validationSummary

  const selectedNoteObjects = allNotes.filter(n => selectedNoteIds.has(n.id))

  const handleContinuePattern = useCallback(async () => {
    if (!canEdit || !chartId || selectedNoteObjects.length < 2 || !triggerAiSuggest) return
    const selectedNotes = selectedNoteObjects
      .map((n) => ({ track: n.track, time: n.time }))
      .sort((a, b) => a.time - b.time || a.track - b.track)
    const toastId = toast.loading('Getting AI suggestions…')
    try {
      await triggerAiSuggest({
        chartId,
        mode: 'continue_pattern',
        playheadTime: selectedNotes[selectedNotes.length - 1]!.time,
        snapMode,
        selectedNotes,
      })
    } finally {
      toast.dismiss(toastId)
    }
  }, [canEdit, chartId, selectedNoteObjects, triggerAiSuggest, snapMode])

  const topBar = (
    <>
      <Toolbar
        projectId={projectId!}
        projectName={project?.name ?? 'Project'}
        songId={songId!}
        songName={song?.name ?? '…'}
        songStatus={song?.status ?? 'DRAFT'}
        charts={charts}
        activeChartId={activeChartId}
        canEdit={canEdit}
        readOnlyMessage={readOnlyMessage}
        bpm={song?.bpm ?? 120}
        song={song}
        presenceList={presenceList}
        isConnected={isConnected}
        onShowShortcuts={() => setShowShortcuts(true)}
        leftCollapsed={leftCollapsed}
        rightCollapsed={rightCollapsed}
        onToggleLeft={handleToggleLeft}
        onToggleRight={handleToggleRight}
      />
      {canEdit && <ChartPreviewBar songId={songId!} chartId={chartId} />}
    </>
  )

  function resetCopyState() {
    setShowCopyTo(false)
    setShowRepeat(false)
    setCopyPreview(null)
    setCopyRequest(null)
    setCopyResolutions({})
    setCopyConflictChanged(false)
    setCopyStep('INPUT')
  }

  function handleCopyPreviewReady(preview: NoteCopyPreview, request: NoteCopyPreviewRequest) {
    setCopyPreview(preview)
    setCopyRequest(request)
    setCopyResolutions({})
    setCopyConflictChanged(false)
    setCopyStep('REVIEW')
    setShowCopyTo(false)
    setShowRepeat(false)
  }

  function handleCopyResolve(conflictId: string, action: ConflictAction) {
    setCopyResolutions((prev) => ({ ...prev, [conflictId]: action }))
  }

  function handleApplyCopy() {
    if (!copyPreview || !copyRequest) return

    const skippedCount = copyPreview.conflicts.length
      - Object.values(copyResolutions).filter((action) => action === 'REPLACE_WITH_PATTERN').length

    setCopyStep('APPLYING')
    applyNoteCopy.mutate(
      {
        ...copyRequest,
        selectionVersion: copyPreview.selectionVersion,
        resolutions: copyPreview.conflicts.map((conflict) => ({
          conflictId: conflict.conflictId,
          action: copyResolutions[conflict.conflictId] ?? 'KEEP_EXISTING',
        })),
      },
      {
        onSuccess: (result) => {
          const verb = copyPreview.mode === 'REPEAT_INTERVAL'
            ? 'Repeated'
            : copyPreview.operation === 'MOVE'
              ? 'Moved'
              : 'Copied'
          toast.success(
            `${verb} ${result.createdCount} notes, replaced ${result.replacedCount}, skipped ${skippedCount}`,
          )
          resetCopyState()
          clearSelection()
        },
        onError: (err: any) => {
          setCopyStep('REVIEW')
          const nextPreview = err?.body?.preview as NoteCopyPreview | undefined
          if (err?.status === 409 && nextPreview) {
            setCopyPreview(nextPreview)
            setCopyResolutions(mergeResolutions(copyResolutions, nextPreview.conflicts))
            setCopyConflictChanged(true)
            toast.warning('Copy changed while you were reviewing. Review the updated conflicts.')
            return
          }
          toast.error('Could not apply copy/move')
        },
      },
    )
  }

  const copyReviewTitle = copyPreview?.mode === 'REPEAT_INTERVAL'
    ? 'Repeat Notes'
    : copyPreview?.operation === 'MOVE'
      ? 'Move Notes'
      : 'Copy Notes'

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
            density={trackDensities[track] ?? 0}
            isActive={activeTrack === track}
            onToggleMute={() => toggleMute(track, false)}
          />
        ))}
      </div>
      <SectionJumpList songId={songId!} sections={sections} />
      <PatternPanel songId={songId!} chartId={chartId} />
      <div className="border-t border-shell-border">
        <div className="px-3 py-2 border-b border-shell-border">
          <span className="text-xs font-medium text-shell-text uppercase tracking-wide">Song Stats</span>
        </div>
        <BottomBarStats
          notes={allNotes}
          bpm={song?.bpm ?? 120}
          speedMultiplier={activeChart?.speedMultiplier ?? 1}
        />
      </div>
      {chartId && projectId && (
        <div className="border-t border-shell-border">
          <div className="px-3 py-2 border-b border-shell-border">
            <span className="text-xs font-medium text-shell-text uppercase tracking-wide">Analysis</span>
          </div>
          <AnalysisSummaryPanel
            notes={allNotes}
            bpm={song?.bpm ?? 120}
            timeSignature={song?.timeSignature ?? '4/4'}
            speedMultiplier={activeChart?.speedMultiplier ?? 1}
            chartId={chartId}
            projectId={projectId}
            songId={songId!}
            onSeek={(timeMs) => setPlayheadTime(timeMs / 1000)}
            embedded
          />
        </div>
      )}
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
          <Tabs.Trigger value="tools">tools</Tabs.Trigger>
          <Tabs.Trigger value="validation">
            val
            {validationTotal > 0 && (
              <span
                className="ml-1 text-[10px]"
                style={{ color: errCount > 0 ? 'var(--color-error)' : 'var(--color-warning)' }}
              >
                {validationTotal}
              </span>
            )}
          </Tabs.Trigger>
          <Tabs.Trigger value="history" data-tour="history-tab">history</Tabs.Trigger>
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
          <HistoryPanel chartId={chartId} inline />
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
            {errCount > 0 && <span className="bottombar-errors">{errCount} err</span>}
            {warnCount > 0 && <span className="bottombar-warnings">{warnCount} warn</span>}
          </span>
        )}
      </div>
    </>
  )

  return (
    <div className="relative">
      <MultiSelectBar
        count={selectedNoteIds.size}
        canEdit={canEdit}
        onContinuePattern={() => void handleContinuePattern()}
        onRepeat={() => setShowRepeat(true)}
        onSavePattern={() => setShowSavePattern(true)}
        onCopyTo={() => setShowCopyTo(true)}
        copyDisabled={!canEdit}
        onDelete={() => {
          selectedNoteObjects.forEach(n => deleteNote.mutate(n.id))
          clearSelection()
        }}
        onDeselect={clearSelection}
      />
      {showCopyTo && canEdit && chartId && (
        <CopyToModal
          chartId={chartId}
          selectedNotes={selectedNoteObjects}
          onCancel={resetCopyState}
          onPreviewReady={handleCopyPreviewReady}
        />
      )}
      {showRepeat && canEdit && chartId && (
        <RepeatModal
          chartId={chartId}
          selectedNotes={selectedNoteObjects}
          bpm={song?.bpm ?? 120}
          timeSignature={song?.timeSignature ?? '4/4'}
          onCancel={resetCopyState}
          onPreviewReady={handleCopyPreviewReady}
        />
      )}
      {copyStep === 'REVIEW' && copyPreview && (
        <ConflictReviewModal
          preview={noteCopyPreviewToPlacement(copyPreview)}
          title={copyReviewTitle}
          incomingLabel="Incoming"
          applyLabel={copyPreview.mode === 'REPEAT_INTERVAL' ? 'Repeat' : copyPreview.operation === 'MOVE' ? 'Move' : 'Copy'}
          resolutions={copyResolutions}
          onResolve={handleCopyResolve}
          onApply={handleApplyCopy}
          onCancel={resetCopyState}
          hasConflictChanged={copyConflictChanged}
          onDismissConflictBanner={() => setCopyConflictChanged(false)}
        />
      )}
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
        <div data-tour="piano-roll" className="flex flex-1 overflow-hidden flex-col h-full">
          <PianoRoll
            songId={songId}
            chartId={chartId}
            speedMultiplier={activeChart?.speedMultiplier ?? 1}
            canEdit={canEdit}
            readOnlyMessage={readOnlyMessage}
            mutedTracks={mutedTracks}
            onNoteSelected={handleNoteSelected}
            cursors={cursors}
            onCursorMove={emitCursorMove}
            onCursorHide={emitCursorHide}
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
    <div className="flex flex-col gap-0.5 text-[11px] text-shell-muted">
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
    <div className="flex flex-col gap-0.5 text-[11px] text-shell-muted">
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
    heatmapEnabled, setHeatmapEnabled,
    createMode, setCreateMode,
  } = useEditorStore()

  const selectedCount = selectedNotes.length
  const selectedType = selectedCount > 0 ? selectedNotes[0].noteType : 'TAP'

  return (
    <div className="flex-1 overflow-y-auto p-3 space-y-4">
      <section className="space-y-3">
        <PanelHeading title="Editor" meta={`${notes.length} notes`} />

        <ToolRow label="View">
          <ToggleGroup
            items={VIEW_MODES}
            value={viewMode}
            onValueChange={(v) => setViewMode(v as typeof viewMode)}
            className="w-full"
          />
        </ToolRow>

        <ToolRow label="Zoom">
          <ToggleGroup
            items={ZOOM_MODES}
            value={String(zoom)}
            onValueChange={(v) => setZoom(Number(v) as 1 | 2 | 4 | 8)}
            className="w-full"
          />
        </ToolRow>

        <ToolRow label="Snap">
          <ToggleGroup
            items={SNAP_MODES}
            value={snapMode}
            onValueChange={(v) => setSnapMode(v as SnapMode)}
            className="w-full"
          />
        </ToolRow>

        {!canEdit && (
          <p className="rounded-md border border-amber-500/20 bg-amber-500/[0.08] px-3 py-2 text-xs text-amber-100/90">
            Chart is read-only — select notes to inspect, but changes are disabled.
          </p>
        )}

        {canEdit && (
          <>
            <p className="text-xs leading-relaxed text-shell-muted">
              Place notes: click for tap · drag down for hold
            </p>

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
            className={heatmapEnabled ? 'text-warning' : 'text-shell-muted'}
          >
            {heatmapEnabled ? 'On' : 'Off'}
          </span>
        </button>
      </section>

      <section className="space-y-3 border-t border-shell-border pt-4">
        <PanelHeading title="Selection" meta={selectedCount ? `${selectedCount} selected` : 'none'} />

        {selectedCount === 0 ? (
          <p className="text-xs leading-relaxed text-shell-muted">
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
      <span className="text-xs font-medium text-shell-text uppercase tracking-wide">{title}</span>
      {meta && <span className="text-[10px] text-shell-muted">{meta}</span>}
    </div>
  )
}

function ToolRow({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="space-y-1.5">
      <span className="text-xs text-shell-muted">{label}</span>
      {children}
    </div>
  )
}
