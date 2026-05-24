import { useDeleteSection } from '../../sections/useSections'
import { useEditorStore } from '../../../store/editor.store'
import type { SectionMarker } from '@ama-midi/shared'
import { PanelSectionHeader } from './PanelSectionHeader'
import { sectionsPanelHelp } from './panel-section-tooltips'

interface Props {
  songId:   string
  sections: SectionMarker[]
}

export function SectionJumpList({ songId, sections }: Props) {
  const playheadTime    = useEditorStore(s => s.playheadTime)
  const setPlayheadTime = useEditorStore(s => s.setPlayheadTime)
  const deleteSection   = useDeleteSection(songId)

  const currentIdx = sections.findIndex((s, i, arr) =>
    s.time <= playheadTime && (i === arr.length - 1 || arr[i + 1].time > playheadTime),
  )

  return (
    <div className="px-3 py-2 border-t border-shell-border">
      <PanelSectionHeader title="Sections" help={sectionsPanelHelp} className="mb-2" />
      {sections.length === 0 ? (
        <p className="text-[10px] text-shell-muted">No sections yet. Click the time axis to add one.</p>
      ) : (
        <ul className="space-y-0.5">
          {sections.map((s, i) => (
            <li
              key={s.id}
              className={
                'flex items-center justify-between text-xs px-1 py-0.5 rounded cursor-pointer ' +
                (i === currentIdx ? 'bg-shell-bg font-medium text-shell-text' : 'text-shell-muted hover:text-shell-text')
              }
              onClick={() => setPlayheadTime(s.time)}
              onContextMenu={(e) => {
                e.preventDefault()
                if (confirm(`Delete section "${s.label}"?`)) deleteSection.mutate(s.id)
              }}
            >
              <span className="flex items-center gap-1">
                <span className="w-2 h-2 rounded-sm" style={{ backgroundColor: s.color }} />
                {s.label}
              </span>
              <span className="font-mono text-[10px]">{s.time.toFixed(1)}s</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
