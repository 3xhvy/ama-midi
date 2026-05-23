import { useEffect, useMemo, useState } from 'react'
import { toast } from 'sonner'
import { SongStatusEnum, SUPPORTED_TIME_SIGNATURES, type Song, type SongStatus } from '@ama-midi/shared'
import { Button, Input, Modal } from '../../components/ui'
import { useUpdateSong } from './useSongs'
import { useSongWorkflow, useUpdateSongStatus } from './useSongWorkflow'

export function EditSongModal({
  song,
  projectId,
  open,
  onOpenChange,
}: {
  song: Song | null
  projectId: string
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const { data: workflow } = useSongWorkflow(open ? song?.id : undefined)
  const updateSong = useUpdateSong(song?.id, projectId)
  const updateStatus = useUpdateSongStatus(song?.id, projectId)

  const [name, setName] = useState('')
  const [status, setStatus] = useState<SongStatus>('DRAFT')
  const [bpm, setBpm] = useState('120')
  const [timeSignature, setTimeSignature] = useState('4/4')

  useEffect(() => {
    if (!song) return
    setName(song.name)
    setStatus(song.status)
    setBpm(String(song.bpm))
    setTimeSignature(song.timeSignature)
  }, [song])

  const statusOptions = useMemo(() => {
    if (!song) return []
    const options = new Set<SongStatus>([song.status, ...(workflow?.allowedTransitions ?? [])])
    return SongStatusEnum.keys.filter((key) => options.has(key))
  }, [song, workflow?.allowedTransitions])

  const pending = updateSong.isPending || updateStatus.isPending

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!song || !name.trim()) return

    const nextBpm = Math.max(40, Math.min(300, Number(bpm) || song.bpm))
    const metadataChanged =
      name.trim() !== song.name ||
      nextBpm !== song.bpm ||
      timeSignature !== song.timeSignature
    const statusChanged = status !== song.status

    if (!metadataChanged && !statusChanged) {
      onOpenChange(false)
      return
    }

    try {
      if (metadataChanged) {
        await updateSong.mutateAsync({
          name: name.trim(),
          bpm: nextBpm,
          timeSignature,
        })
      }
      if (statusChanged) {
        await updateStatus.mutateAsync({ status, silent: true })
      }
      toast.success('Song updated')
      onOpenChange(false)
    } catch {
      // Toasts handled in mutation hooks
    }
  }

  if (!song) return null

  return (
    <Modal.Root open={open} onOpenChange={onOpenChange}>
      <Modal.Content>
        <Modal.Header onClose={() => onOpenChange(false)}>Edit song</Modal.Header>
        <Modal.Body>
          <form id="edit-song-form" onSubmit={submit} className="space-y-4">
            <div>
              <label className="mb-1 block text-xs text-shell-muted">Name</label>
              <Input value={name} onChange={(e) => setName(e.target.value)} autoFocus />
            </div>

            <div>
              <label className="mb-1 block text-xs text-shell-muted">Status</label>
              {statusOptions.length > 1 ? (
                <select
                  value={status}
                  onChange={(e) => setStatus(e.target.value as SongStatus)}
                  className="w-full rounded-lg border border-shell-border bg-shell-surface px-3 py-2 text-sm text-shell-text focus:outline-none focus:ring-2 focus:ring-primary/30"
                >
                  {statusOptions.map((key) => (
                    <option key={key} value={key}>
                      {SongStatusEnum.label(key)}
                    </option>
                  ))}
                </select>
              ) : (
                <p className="rounded-lg border border-shell-border bg-shell-bg px-3 py-2 text-sm text-shell-text">
                  {SongStatusEnum.label(song.status)}
                </p>
              )}
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="mb-1 block text-xs text-shell-muted">BPM</label>
                <Input
                  type="number"
                  min={40}
                  max={300}
                  value={bpm}
                  onChange={(e) => setBpm(e.target.value)}
                />
              </div>
              <div>
                <label className="mb-1 block text-xs text-shell-muted">Time signature</label>
                <select
                  value={timeSignature}
                  onChange={(e) => setTimeSignature(e.target.value)}
                  className="w-full rounded-lg border border-shell-border bg-shell-surface px-3 py-2 text-sm text-shell-text focus:outline-none focus:ring-2 focus:ring-primary/30"
                >
                  {SUPPORTED_TIME_SIGNATURES.map((sig) => (
                    <option key={sig} value={sig}>{sig}</option>
                  ))}
                </select>
              </div>
            </div>
          </form>
        </Modal.Body>
        <Modal.Footer>
          <Button type="button" variant="secondary" size="sm" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button type="submit" form="edit-song-form" size="sm" disabled={!name.trim()} loading={pending}>
            Save
          </Button>
        </Modal.Footer>
      </Modal.Content>
    </Modal.Root>
  )
}
