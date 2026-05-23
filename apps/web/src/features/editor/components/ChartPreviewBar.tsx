import { useState } from 'react'
import { toast } from 'sonner'
import { useQueryClient } from '@tanstack/react-query'
import type { ApplyChartResponse } from '@ama-midi/shared'
import { Button } from '../../../components/ui'
import { useAuthStore } from '../../../store/auth.store'
import { useEditorStore } from '../../../store/editor.store'
import { apiClient } from '../../auth/api'

interface Props {
  songId: string
}

export function ChartPreviewBar({ songId }: Props) {
  const token = useAuthStore((s) => s.token)
  const qc = useQueryClient()
  const { chartPreview, clearChartPreview } = useEditorStore()
  const [applying, setApplying] = useState(false)

  if (!chartPreview) return null

  const { notes, sections, replaceExisting } = chartPreview

  async function acceptAll() {
    setApplying(true)
    const toastId = toast.loading('Applying chart…')
    try {
      const result = await apiClient(token)<ApplyChartResponse>(
        `/songs/${songId}/apply-chart`,
        {
          method: 'POST',
          body: JSON.stringify({
            notes,
            sections,
            replaceExisting,
          }),
        },
      )
      clearChartPreview()
      await qc.invalidateQueries({ queryKey: ['notes', songId] })
      await qc.invalidateQueries({ queryKey: ['sections', songId] })
      const skipped = result.skippedCount > 0 ? ` (${result.skippedCount} skipped)` : ''
      toast.success(`Added ${result.createdCount} notes${skipped}`)
    } catch {
      toast.error('Failed to apply chart')
    } finally {
      setApplying(false)
      toast.dismiss(toastId)
    }
  }

  return (
    <div className="flex items-center justify-between gap-3 border-t border-primary/30 bg-primary/10 px-4 py-2">
      <div className="min-w-0 text-xs text-shell-text">
        <span className="font-medium">AI chart preview</span>
        <span className="ml-2 text-shell-muted">
          {notes.length} notes
          {sections.length > 0 ? ` · ${sections.length} sections` : ''}
          {replaceExisting ? ' · will replace existing' : ''}
        </span>
      </div>
      <div className="flex shrink-0 items-center gap-2">
        <Button size="sm" variant="ghost" onClick={clearChartPreview} disabled={applying}>
          Dismiss
        </Button>
        <Button size="sm" variant="primary" onClick={() => void acceptAll()} disabled={applying}>
          {applying ? 'Applying…' : 'Accept all'}
        </Button>
      </div>
    </div>
  )
}
