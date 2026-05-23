import { useMemo, useState } from 'react'
import { SearchSelect, ToggleGroup } from '../../../components/ui'
import type { ImportSongOptions, Song } from '@ama-midi/shared'
import {
  getImportModeFromOptions,
  importModeToOptions,
  type ImportMode,
} from './wizard-logic'

const MODES = [
  { value: 'structure', label: 'Structure' },
  { value: 'pattern', label: 'Patterns' },
  { value: 'full', label: 'Full' },
  { value: 'custom', label: 'Custom' },
]

export function ImportSongStep({
  songs,
  projectNames,
  value,
  onChange,
}: {
  songs: Song[]
  projectNames: Record<string, string>
  value: ImportSongOptions
  onChange: (value: ImportSongOptions) => void
}) {
  const [includeArchived, setIncludeArchived] = useState(false)
  const mode = getImportModeFromOptions(value)

  const options = useMemo(
    () =>
      songs
        .filter((s) => includeArchived || !s.archivedAt)
        .map((s) => ({
          value: s.id,
          label: s.name,
          description: projectNames[s.projectId] ?? s.projectId,
        })),
    [includeArchived, projectNames, songs],
  )

  function setMode(next: ImportMode) {
    onChange({ ...value, ...importModeToOptions(next) })
  }

  function patch(next: Partial<ImportSongOptions>) {
    onChange({ ...value, ...next })
  }

  return (
    <div className="space-y-4 rounded-lg border border-shell-border bg-shell-bg/50 p-4">
      <div className="space-y-1.5">
        <span className="text-xs text-shell-muted">Source song</span>
        <SearchSelect
          options={options}
          value={value.sourceSongId}
          onChange={(v) =>
            patch({ sourceSongId: typeof v === 'string' ? v : (v[0] ?? '') })
          }
          placeholder="Choose source song"
          searchPlaceholder="Search songs"
          emptyMessage="No songs available"
        />
      </div>

      <label className="flex items-center gap-2 text-xs text-shell-muted">
        <input
          type="checkbox"
          checked={includeArchived}
          onChange={(e) => setIncludeArchived(e.target.checked)}
        />
        Include archived
      </label>

      <div className="space-y-1.5">
        <span className="text-xs text-shell-muted">Import mode</span>
        <ToggleGroup
          items={MODES}
          value={mode}
          onValueChange={(v) => setMode(v as ImportMode)}
        />
      </div>

      {mode === 'custom' && (
        <div className="space-y-2">
          {(
            [
              ['copySettings', 'Settings'],
              ['copySections', 'Sections'],
              ['copyPatterns', 'Patterns'],
              ['copyNotes', 'Notes'],
            ] as const
          ).map(([key, label]) => (
            <label key={key} className="flex items-center gap-2 text-sm text-shell-text">
              <input
                type="checkbox"
                checked={value[key]}
                onChange={(e) => patch({ [key]: e.target.checked })}
              />
              {label}
            </label>
          ))}
        </div>
      )}

      {value.copyNotes && (
        <p className="rounded-md border border-warning/40 bg-warning/10 px-3 py-2 text-xs text-warning">
          This creates an independent copy of the source chart. Future edits will not sync with the original song.
        </p>
      )}
    </div>
  )
}
