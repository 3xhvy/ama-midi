import { useDeleteSection } from '../../sections/useSections'
import { useEditorStore } from '../../../store/editor.store'
import type { SectionMarker } from '@ama-midi/shared'
import { PanelSectionHeader } from './PanelSectionHeader'
import { sectionsPanelHelp } from './panel-section-tooltips'
import { Skeleton } from '../../../components/ui'

interface Props {
  songId:    string
  sections:  SectionMarker[]
  isLoading?: boolean
}

export function SectionJumpList({ songId, sections, isLoading = false }: Props) {
  const playheadTime    = useEditorStore(s => s.playheadTime)
  const setPlayheadTime = useEditorStore(s => s.setPlayheadTime)
  const deleteSection   = useDeleteSection(songId)

  const currentIdx = sections.findIndex((s, i, arr) =>
    s.time <= playheadTime && (i === arr.length - 1 || arr[i + 1].time > playheadTime),
  )

  return (
    <div className="px-3 py-2 border-t border-shell-border">
      <PanelSectionHeader title="Sections" help={sectionsPanelHelp} className="mb-2" />
      {isLoading ? (
        <ul className="space-y-0.5">
          {[48, 36, 56].map((w, i) => (
            <li key={i} className="flex items-center justify-between px-1 py-0.5">
              <span className="flex items-center gap-1">
                <Skeleton width={8} height={8} rounded="sm" />
                <Skeleton width={w} height={10} />
              </span>
              <Skeleton width={28} height={10} />
            </li>
          ))}
        </ul>
      ) : sections.length === 0 ? (
        <p className="text-[10px] text-shell-muted">No sections yet. Alt+click the timeline to add one.</p>
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
