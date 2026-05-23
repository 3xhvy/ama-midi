import type { ImportSongOptions, Song } from '@ama-midi/shared'

export function ImportSongStep({
  songs,
  value,
  onChange,
}: {
  songs: Song[]
  value: ImportSongOptions
  onChange: (value: ImportSongOptions) => void
}) {
  function patch(next: Partial<ImportSongOptions>) {
    onChange({ ...value, ...next })
  }

  return (
    <div className="space-y-3">
      <select
        value={value.sourceSongId}
        onChange={(e) => patch({ sourceSongId: e.target.value })}
        className="w-full rounded-md border border-shell-border bg-shell-bg px-3 py-2 text-sm text-shell-text"
      >
        <option value="">Choose source song</option>
        {songs.map((song) => <option key={song.id} value={song.id}>{song.name}</option>)}
      </select>

      {[
        ['copySettings', 'Settings'],
        ['copySections', 'Sections'],
        ['copyPatterns', 'Patterns'],
        ['copyNotes', 'Notes'],
      ].map(([key, label]) => (
        <label key={key} className="flex items-center gap-2 text-sm text-shell-text">
          <input
            type="checkbox"
            checked={Boolean(value[key as keyof ImportSongOptions])}
            onChange={(e) => patch({ [key]: e.target.checked } as Partial<ImportSongOptions>)}
          />
          {label}
        </label>
      ))}

      {value.copyNotes && (
        <p className="rounded-md border border-warning/40 bg-warning/10 px-3 py-2 text-xs text-warning">
          This creates an independent copy of the source chart. Future edits will not sync with the original song.
        </p>
      )}
    </div>
  )
}
