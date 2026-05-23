import { useState } from 'react'
import { toast } from 'sonner'
import {
  SONG_DIFFICULTY_OPTIONS,
  SongDifficultyEnum,
  type GenerateChartResponse,
  type Song,
  type SongDifficulty,
} from '@ama-midi/shared'
import { Button, Modal, Textarea } from '../../../components/ui'
import { useAuthStore } from '../../../store/auth.store'
import { useEditorStore } from '../../../store/editor.store'
import { apiClient } from '../../auth/api'

interface Props {
  songId: string
  song: Song | undefined
  noteCount: number
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function AiGenerateChartModal({ songId, song, noteCount, open, onOpenChange }: Props) {
  const token = useAuthStore((s) => s.token)
  const { snapMode, setChartPreview } = useEditorStore()
  const [description, setDescription] = useState('')
  const [targetTier, setTargetTier] = useState<SongDifficulty | ''>('')
  const [replaceExisting, setReplaceExisting] = useState(false)
  const [loading, setLoading] = useState(false)

  async function generate() {
    const brief = description.trim()
    if (!brief) {
      toast.error('Describe the chart you want first')
      return
    }

    setLoading(true)
    const toastId = toast.loading('Generating chart…')
    try {
      const result = await apiClient(token)<GenerateChartResponse>(
        `/songs/${songId}/generate-chart`,
        {
          method: 'POST',
          body: JSON.stringify({
            description: brief,
            snapMode,
            ...(targetTier ? { targetTier } : {}),
          }),
        },
      )
      if (result.notes.length === 0) {
        toast.error('AI returned no notes — try a more specific description')
        return
      }
      setChartPreview({
        notes: result.notes,
        sections: result.sections,
        replaceExisting,
      })
      toast.success(`Preview ready — ${result.notes.length} notes`)
      onOpenChange(false)
      setDescription('')
    } catch {
      toast.error('Failed to generate chart')
    } finally {
      setLoading(false)
      toast.dismiss(toastId)
    }
  }

  const selectClassName =
    'w-full rounded-lg border border-shell-border bg-shell-surface px-3 py-2 text-sm text-shell-text'

  return (
    <Modal.Root open={open} onOpenChange={onOpenChange}>
      <Modal.Content className="max-w-lg">
        <Modal.Header>
          <h2 className="text-sm font-semibold text-shell-text">Generate chart from description</h2>
        </Modal.Header>
        <Modal.Body className="space-y-3">
          <p className="text-xs text-shell-muted">
            Describe mood, genre, structure, and density. AI builds a full starter chart for{' '}
            <span className="text-shell-text">{song?.name ?? 'this song'}</span>
            {song ? ` (${song.bpm} BPM)` : ''}.
          </p>
          <div>
            <label className="mb-1 block text-xs text-shell-muted">
              Target tier hint <span className="text-shell-muted/70">(optional, not saved)</span>
            </label>
            <select
              value={targetTier}
              onChange={(e) => setTargetTier(e.target.value as SongDifficulty | '')}
              className={selectClassName}
              disabled={loading}
            >
              <option value="">No preference</option>
              {SONG_DIFFICULTY_OPTIONS.map((key) => (
                <option key={key} value={key}>
                  {SongDifficultyEnum.label(key)}
                </option>
              ))}
            </select>
          </div>
          <Textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="e.g. Upbeat EDM drop at 128 BPM feel — sparse intro 0–30s, building hi-hats on tracks 2–3, dense doubles in chorus 60–90s, calm outro"
            rows={5}
            maxLength={2000}
            disabled={loading}
          />
          {noteCount > 0 && (
            <label className="flex items-start gap-2 text-xs text-shell-text">
              <input
                type="checkbox"
                checked={replaceExisting}
                onChange={(e) => setReplaceExisting(e.target.checked)}
                className="mt-0.5"
                disabled={loading}
              />
              <span>
                Replace existing chart ({noteCount} notes)
                <span className="mt-0.5 block text-[10px] text-shell-muted">
                  Removes current notes and section markers before applying the preview.
                </span>
              </span>
            </label>
          )}
        </Modal.Body>
        <Modal.Footer>
          <Button variant="ghost" size="sm" onClick={() => onOpenChange(false)} disabled={loading}>
            Cancel
          </Button>
          <Button variant="primary" size="sm" onClick={() => void generate()} disabled={loading || !description.trim()}>
            {loading ? 'Generating…' : 'Generate preview'}
          </Button>
        </Modal.Footer>
      </Modal.Content>
    </Modal.Root>
  )
}
