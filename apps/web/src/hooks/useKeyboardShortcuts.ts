import { useEffect } from 'react'
import { useEditorStore } from '../store/editor.store'
import { unlockChartAudio } from '../features/editor/audio/chart-audio'

interface Options {
  canEdit:              boolean
  onUndo:               () => void
  onDeleteNote:         () => void
  onEditNote:           () => void
  onJumpToStart?:       () => void
  onToggleShortcuts?:   () => void
  onToggleLeftPanel?:   () => void
  onToggleRightPanel?:  () => void
}

function isTypingTarget(target: EventTarget | null) {
  if (!(target instanceof HTMLElement)) return false
  if (target.isContentEditable) return true
  return target instanceof HTMLInputElement
    || target instanceof HTMLTextAreaElement
    || target instanceof HTMLSelectElement
}

export function useKeyboardShortcuts({
  canEdit, onUndo, onDeleteNote, onEditNote, onJumpToStart, onToggleShortcuts,
  onToggleLeftPanel, onToggleRightPanel,
}: Options) {
  const { viewMode, selectedNoteId, setZoom, setPlaying } = useEditorStore()

  useEffect(() => {
    function handler(e: KeyboardEvent) {
      if (isTypingTarget(e.target)) return

      if (e.code === 'Space' && !e.metaKey && !e.ctrlKey && !e.altKey) {
        e.preventDefault()
        const playing = useEditorStore.getState().isPlaying
        if (!playing) unlockChartAudio()
        setPlaying(!playing)
        return
      }

      if ((e.key === 'e' || e.key === 'E') && selectedNoteId && canEdit) {
        e.preventDefault(); onEditNote()
      }
      if ((e.key === 'Delete' || e.key === 'Backspace') && selectedNoteId && canEdit) {
        e.preventDefault(); onDeleteNote()
      }
      if ((e.metaKey || e.ctrlKey) && e.key === 'z' && canEdit) {
        e.preventDefault(); onUndo()
      }
      if ((e.key === 'j' || e.key === 'J') && viewMode === 'qa') {
        e.preventDefault(); onJumpToStart?.()
      }
      if (e.key === '?' || (e.key === '/' && e.shiftKey)) {
        onToggleShortcuts?.()
      }
      if (e.key === '1') setZoom(1)
      if (e.key === '2') setZoom(2)
      if (e.key === '4') setZoom(4)
      if (e.key === '[') { e.preventDefault(); onToggleLeftPanel?.() }
      if (e.key === ']') { e.preventDefault(); onToggleRightPanel?.() }
    }

    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [canEdit, viewMode, selectedNoteId, setZoom, setPlaying, onUndo, onDeleteNote, onEditNote, onJumpToStart, onToggleShortcuts, onToggleLeftPanel, onToggleRightPanel])
}
