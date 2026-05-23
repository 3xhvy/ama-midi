import { useState } from 'react'
import { Button, Input } from '../../../components/ui'
import { useCreatePattern } from '../../patterns/usePatterns'
import { toast } from 'sonner'
import type { Note, PatternNote } from '@ama-midi/shared'

interface Props {
  songId:        string
  selectedNotes: Note[]
  onClose:       () => void
}

export function SavePatternModal({ songId, selectedNotes, onClose }: Props) {
  const [name,  setName]  = useState('')
  const [scope, setScope] = useState<'song' | 'library'>('library')
  const create = useCreatePattern()

  async function handleSave() {
    if (!name.trim()) return
    const earliest = Math.min(...selectedNotes.map(n => n.time))
    const notes: PatternNote[] = selectedNotes.map(n => ({
      track:      n.track,
      timeOffset: n.time - earliest,
      noteType:   n.noteType ?? 'TAP',
      duration:   n.duration,
    }))
    await create.mutateAsync({
      name:   name.trim(),
      notes,
      songId: scope === 'song' ? songId : undefined,
    })
    toast.success(`Pattern "${name.trim()}" saved`)
    onClose()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ backgroundColor: 'var(--modal-overlay)' }} onClick={onClose}>
      <div
        className="rounded-xl p-6 w-80 modal-body"
        style={{
          backgroundColor: 'var(--modal-bg)',
          boxShadow: 'var(--modal-shadow)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="text-sm font-semibold mb-4" style={{ color: 'var(--modal-text)' }}>Save selection as pattern</h2>
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
          <Button size="sm" variant="primary" onClick={handleSave} loading={create.isPending} disabled={!name.trim()}>
            Save
          </Button>
        </div>
      </div>
    </div>
  )
}
