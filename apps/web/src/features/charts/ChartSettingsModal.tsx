import { useState } from 'react'
import type { SongChart } from '@ama-midi/shared'
import { Button, Input, Modal } from '../../components/ui'
import { useUpdateChart } from './useCharts'

interface Props {
  chart: SongChart
  songId: string
  onClose: () => void
}

export function ChartSettingsModal({ chart, songId, onClose }: Props) {
  const updateChart = useUpdateChart(chart.id, songId)
  const [name, setName] = useState(chart.name)
  const [speed, setSpeed] = useState(chart.speedMultiplier)

  function save() {
    const trimmed = name.trim()
    if (!trimmed) return
    updateChart.mutate(
      { name: trimmed, speedMultiplier: speed },
      { onSuccess: () => onClose() },
    )
  }

  return (
    <Modal.Root open onOpenChange={(open) => !open && onClose()}>
      <Modal.Content className="max-w-sm">
        <Modal.Header onClose={onClose}>Chart settings</Modal.Header>
        <Modal.Body className="space-y-4">
          <div>
            <label className="mb-1 block text-xs text-shell-muted">Name</label>
            <Input value={name} onChange={(e) => setName(e.target.value)} autoFocus />
          </div>
          <div>
            <div className="mb-1 flex items-center justify-between text-xs text-shell-muted">
              <span>Speed multiplier</span>
              <span className="font-mono text-shell-text">{speed.toFixed(1)}×</span>
            </div>
            <input
              type="range"
              min={0.8}
              max={2.0}
              step={0.1}
              value={speed}
              onChange={(e) => setSpeed(Number(e.target.value))}
              className="w-full accent-primary"
            />
            <div className="mt-1 flex justify-between text-[10px] text-shell-muted">
              <span>0.8×</span>
              <span>2.0×</span>
            </div>
          </div>
        </Modal.Body>
        <Modal.Footer>
          <Button variant="ghost" size="sm" onClick={onClose}>
            Cancel
          </Button>
          <Button
            size="sm"
            onClick={save}
            loading={updateChart.isPending}
            disabled={!name.trim()}
          >
            Save
          </Button>
        </Modal.Footer>
      </Modal.Content>
    </Modal.Root>
  )
}
