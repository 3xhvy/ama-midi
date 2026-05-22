import { useState } from 'react'
import { SECTION_PRESETS } from '@ama-midi/shared'
import { useCreateSection } from '../../sections/useSections'
import { Button, Input } from '../../../components/ui'

interface Props {
  songId:  string
  time:    number
  pos:     { x: number; y: number }
  onClose: () => void
}

export function SectionCreatePopover({ songId, time, pos, onClose }: Props) {
  const [custom,      setCustom]      = useState('')
  const [customColor, setCustomColor] = useState('#6C63FF')
  const create = useCreateSection(songId)

  function add(label: string, color: string) {
    create.mutate({ time, label, color }, { onSuccess: onClose })
  }

  return (
    <div
      className="fixed z-50 bg-shell-surface border border-shell-border rounded-lg shadow-lg p-3 w-64"
      style={{ left: pos.x, top: pos.y }}
      onClick={(e) => e.stopPropagation()}
    >
      <p className="text-[10px] text-shell-muted mb-2">Add section at {time.toFixed(1)}s</p>
      <div className="flex flex-wrap gap-1 mb-2">
        {SECTION_PRESETS.map(p => (
          <button
            key={p.label}
            onClick={() => add(p.label, p.color)}
            className="px-2 py-1 text-[10px] rounded border text-shell-text hover:opacity-80"
            style={{ borderColor: p.color, backgroundColor: p.color + '22' }}
          >
            {p.label}
          </button>
        ))}
      </div>
      <div className="flex items-center gap-1">
        <Input value={custom} onChange={(e) => setCustom(e.target.value)} placeholder="Custom label" />
        <input
          type="color"
          value={customColor}
          onChange={(e) => setCustomColor(e.target.value)}
          className="w-6 h-6 rounded cursor-pointer"
        />
        <Button size="sm" variant="primary" onClick={() => custom.trim() && add(custom.trim(), customColor)}>Add</Button>
      </div>
      <button onClick={onClose} className="absolute top-1 right-2 text-shell-muted hover:text-shell-text">✕</button>
    </div>
  )
}
