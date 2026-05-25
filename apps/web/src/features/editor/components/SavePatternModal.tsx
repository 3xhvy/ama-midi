import { useState } from 'react'
import { Button, Input } from '../../../components/ui'
import { EditorModalCompact, EditorModalOverlay } from './EditorModal'
import { useCreatePattern } from '../../patterns/usePatterns'
import { toast } from 'sonner'
import type { Note, PatternNote } from '@ama-midi/shared'

interface Props {
  songId:        string
  onClose:       () => void
  /** Chart notes — converted to relative offsets on save. */
  selectedNotes?: Note[]
  /** Pre-built pattern notes (e.g. from a tap session). */
  patternNotes?:  PatternNote[]
  title?:         string
  defaultName?:   string
  /** Called after a successful save (before onClose). */
  onSaved?:       () => void
}

function notesToPatternNotes(selectedNotes: Note[]): PatternNote[] {
  const earliest = Math.min(...selectedNotes.map((n) => n.time))
  return selectedNotes.map((n) => ({
    track:      n.track,
    timeOffset: Math.round((n.time - earliest) * 100) / 100,
    noteType:   n.noteType ?? 'TAP',
    duration:   n.duration,
  }))
}

export function SavePatternModal({
  songId,
  onClose,
  selectedNotes,
  patternNotes: patternNotesProp,
  title = 'Save selection as pattern',
  defaultName = '',
  onSaved,
}: Props) {
  const [name,  setName]  = useState(defaultName)
  const [scope, setScope] = useState<'song' | 'library'>('library')
  const create = useCreatePattern()

  const noteCount = patternNotesProp?.length ?? selectedNotes?.length ?? 0

  async function handleSave() {
    if (!name.trim()) return
    const notes = patternNotesProp ?? notesToPatternNotes(selectedNotes!)
    if (notes.length === 0) return
    await create.mutateAsync({
      name:   name.trim(),
      notes,
      songId: scope === 'song' ? songId : undefined,
    })
    toast.success(`Pattern "${name.trim()}" saved — paste from Patterns panel`)
    onSaved?.()
    onClose()
  }

  return (
    <EditorModalOverlay onClick={onClose}>
      <EditorModalCompact onClick={(e) => e.stopPropagation()}>
        <h2 className="mb-1 text-sm font-semibold" style={{ color: 'var(--modal-text)' }}>
          {title}
        </h2>
        <p className="mb-4 text-xs" style={{ color: 'var(--modal-muted)' }}>
          {noteCount} note{noteCount === 1 ? '' : 's'} · apply later from the Patterns panel
        </p>
        <label className="block text-xs mb-1" style={{ color: 'var(--modal-muted)' }}>Name</label>
        <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Verse Fill" autoFocus />
        <div className="flex flex-col gap-1 mt-4">
          <label className="text-xs" style={{ color: 'var(--modal-muted)' }}>Scope</label>
          <label className="flex items-center gap-2 text-xs" style={{ color: 'var(--modal-text)' }}>
            <input type="radio" checked={scope === 'song'}    onChange={() => setScope('song')} />
            This song only
          </label>
          <label className="flex items-center gap-2 text-xs" style={{ color: 'var(--modal-text)' }}>
            <input type="radio" checked={scope === 'library'} onChange={() => setScope('library')} />
            My library (all songs)
          </label>
        </div>
        <div className="flex justify-end gap-2 mt-6">
          <Button size="sm" variant="ghost"   onClick={onClose}>Cancel</Button>
          <Button size="sm" variant="primary" onClick={handleSave} loading={create.isPending} disabled={!name.trim() || noteCount === 0}>
            Save pattern
          </Button>
        </div>
      </EditorModalCompact>
    </EditorModalOverlay>
  )
}
