import { useRef, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useSongTour }  from '../features/onboarding/useSongTour'
import { TourOverlay }  from '../features/onboarding/TourOverlay'
import { useQuery } from '@tanstack/react-query'
import { EditorShell } from '../components/layout'
import { Toolbar }            from '../features/editor/components/Toolbar'
import { TrackHeader }        from '../features/editor/components/TrackHeader'
import { LiveContextStrip }   from '../features/editor/components/LiveContextStrip'
import { MultiSelectBar }     from '../features/editor/components/MultiSelectBar'
import { SavePatternModal }   from '../features/editor/components/SavePatternModal'
import { PatternPanel }       from '../features/editor/components/PatternPanel'
import { SectionJumpList }    from '../features/editor/components/SectionJumpList'
import { BottomBarStats }     from '../features/editor/components/BottomBarStats'
import { useNotes }           from '../features/notes/useNotes'
import { useDeleteNote }      from '../features/notes/useNotes'
import { useSections }        from '../features/sections/useSections'
import { usePlayback }        from '../features/editor/hooks/usePlayback'
import { Tabs } from '../components/ui'
import { PianoRoll } from '../features/editor/components/PianoRoll'
import { HistoryPanel } from '../features/editor/components/HistoryPanel'
import { ValidationPanel } from '../features/editor/components/ValidationPanel'
import { ShortcutLegend } from '../features/editor/components/ShortcutLegend'
import { useSocket } from '../features/collaboration/useSocket'
import { useEditorStore } from '../store/editor.store'
import { useUndo } from '../features/notes/useNotes'
import { useCanEdit } from '../hooks/useCanEdit'
import { useKeyboardShortcuts } from '../hooks/useKeyboardShortcuts'
import { useAuthStore } from '../store/auth.store'
import { apiClient } from '../features/auth/api'
import { formatTime } from '../lib/utils'
import type { Note, Song } from '@ama-midi/shared'

interface ValidationResult {
  summary: { errors: number; warnings: number }
}

export function EditorPage() {
  const { songId } = useParams<{ songId: string }>()
  const navigate = useNavigate()
  const {
    viewMode,
    rightPanelTab, setRightPanelTab,
    leftCollapsed, rightCollapsed,
    toggleLeftPanel, toggleRightPanel,
    playheadTime, selectNote, triggerAiSuggest,
    selectedNoteIds, clearSelection,
  } = useEditorStore()

  usePlayback()

  const songTour = useSongTour()
  const undo       = useUndo(songId!)
  const deleteNote = useDeleteNote(songId!)
  const { data: allNotes = [] } = useNotes(songId!)
  const { data: sections = [] } = useSections(songId!)
  const { presenceList, cursors, emitCursorMove } = useSocket(songId!)
  const canEdit = useCanEdit()
  const token = useAuthStore((s) => s.token)

  const { data: song } = useQuery<Song>({
    queryKey: ['song', songId],
    queryFn:  () => apiClient(token)<Song>(`/songs/${songId}`),
    enabled:  !!token && !!songId,
  })

  const [selectedNote,        setSelectedNote]        = useState<Note | null>(null)
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
    setSelectedNote(note)
    selectNote(note?.id ?? null)
  }

  useKeyboardShortcuts({
    canEdit,
    onUndo: () => undo.mutate(),
    onDeleteNote: () => {},
    onEditNote: () => {},
    onJumpToStart: () => jumpToRef.current?.(0),
    onToggleShortcuts: () => setShowShortcuts((v) => !v),
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
      onBack={() => navigate('/')}
    />
  )

  const maxNoteCount = Math.max(
    1,
    ...Array.from({ length: 8 }, (_, i) => allNotes.filter(n => n.track === i + 1).length),
  )

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
            onToggleMute={() => toggleMute(track, false)}
          />
        ))}
      </div>
      <SectionJumpList songId={songId!} sections={sections} />
      <PatternPanel songId={songId!} />
    </>
  )

  const rightPanel = (
    <div className="flex flex-col flex-1 min-h-0">
      {/* Live context — always visible */}
      <LiveContextStrip playheadTime={playheadTime} notes={allNotes} />

      {/* Tabs */}
      <Tabs.Root
        value={rightPanelTab}
        onValueChange={(v) => setRightPanelTab(v as typeof rightPanelTab)}
        className="flex flex-col flex-1 min-h-0"
      >
        <Tabs.List>
          <Tabs.Trigger value="details">details</Tabs.Trigger>
          <Tabs.Trigger value="validation">
            val
            {(errCount > 0 || warnCount > 0) && (
              <span className={`ml-1 text-[10px] ${errCount > 0 ? 'text-red-400' : 'text-yellow-400'}`}>
                {errCount > 0 ? errCount : warnCount}
              </span>
            )}
          </Tabs.Trigger>
          <Tabs.Trigger value="history" data-tour="history-tab">history</Tabs.Trigger>
        </Tabs.List>
        <Tabs.Content value="details">
          <DetailsTab note={selectedNote} />
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

  const bottomBar = (
    <>
      <span className="text-xs font-mono text-shell-muted">{formatTime(playheadTime)}</span>
      <BottomBarStats notes={allNotes} />
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

  const selectedNoteObjects = allNotes.filter(n => selectedNoteIds.has(n.id))

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

function DetailsTab({ note }: { note: Note | null }) {
  if (!note) {
    return (
      <div className="flex-1 flex items-center justify-center p-4">
        <p className="text-xs text-shell-muted text-center">Select a note to view details</p>
      </div>
    )
  }

  return (
    <div className="p-4 space-y-3 overflow-y-auto">
      <div className="flex items-center gap-2">
        <div className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: note.color }} />
        <span className="text-sm font-medium text-shell-text truncate">{note.title}</span>
      </div>
      <div className="space-y-1.5 text-xs text-shell-muted">
        <div className="flex justify-between">
          <span>Track</span>
          <span className="text-shell-text">{note.track}</span>
        </div>
        <div className="flex justify-between">
          <span>Time</span>
          <span className="text-shell-text">{note.time}s</span>
        </div>
        <div className="flex justify-between">
          <span>Created by</span>
          <span className="text-shell-text truncate ml-2">{note.creatorName}</span>
        </div>
      </div>
      {note.description && (
        <p className="text-xs text-shell-muted border-t border-shell-border pt-2">{note.description}</p>
      )}
      <div className="text-[10px] font-mono text-shell-muted/60 break-all">{note.id}</div>
    </div>
  )
}
