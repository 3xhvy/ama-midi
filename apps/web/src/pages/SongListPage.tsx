import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useSongs, useCreateSong } from '../features/songs/useSongs'
import type { Song } from '@ama-midi/shared'

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  return `${Math.floor(hrs / 24)}d ago`
}

function TrackActivityDots({ noteCount }: { noteCount: number }) {
  // Proportionally fill 8 dots based on total note count (50 notes ≈ one full track)
  const filledTracks = Math.min(8, Math.round((noteCount / 50) * 8))
  return (
    <div className="flex gap-1.5">
      {Array.from({ length: 8 }).map((_, i) => (
        <div
          key={i}
          className={`w-2 h-2 rounded-full transition-colors ${
            i < filledTracks ? 'bg-primary' : 'bg-border'
          }`}
        />
      ))}
    </div>
  )
}

function SongCard({ song }: { song: Song }) {
  const navigate = useNavigate()
  return (
    <div
      className="bg-surface rounded-xl shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all p-5 border border-border cursor-pointer group"
      onClick={() => navigate(`/songs/${song.id}`)}
    >
      <div className="flex items-start justify-between mb-3">
        <h3 className="font-semibold text-text-primary text-base truncate">{song.name}</h3>
        <span className="px-2 py-0.5 text-xs bg-primary/10 text-primary rounded-full ml-2 shrink-0">Draft</span>
      </div>
      <TrackActivityDots noteCount={song.noteCount ?? 0} />
      <div className="flex items-center justify-between mt-3">
        <span className="text-xs text-text-secondary truncate">{song.creatorName ?? 'Unknown'}</span>
        <span className="text-xs text-text-secondary">{timeAgo(song.updatedAt)}</span>
      </div>
      <div className="mt-3 opacity-0 group-hover:opacity-100 transition-opacity">
        <button
          onClick={(e) => {
            e.stopPropagation()
            navigate(`/songs/${song.id}`)
          }}
          className="w-full text-xs py-1.5 bg-primary text-white rounded-lg hover:bg-primary-dark transition-colors"
        >
          Open Editor
        </button>
      </div>
    </div>
  )
}

export function SongListPage() {
  const { data: songs = [], isLoading } = useSongs()
  const createSong = useCreateSong()
  const [newName, setNewName] = useState('')

  function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    if (!newName.trim()) return
    createSong.mutate(newName.trim(), { onSuccess: () => setNewName('') })
  }

  return (
    <div className="max-w-3xl mx-auto py-10 px-4">
      <h1 className="text-2xl font-semibold text-text-primary mb-8">My Songs</h1>

      <form onSubmit={handleCreate} className="flex gap-2 mb-8">
        <input
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          placeholder="New song name…"
          className="flex-1 px-3 py-2 border border-border rounded-md text-sm bg-surface text-text-primary placeholder-text-tertiary focus:outline-none focus:ring-2 focus:ring-primary/30"
        />
        <button
          type="submit"
          disabled={createSong.isPending || !newName.trim()}
          className="px-4 py-2 bg-primary text-white text-sm rounded-md hover:bg-primary-dark disabled:opacity-50 transition-colors"
        >
          Create
        </button>
      </form>

      {isLoading && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="bg-surface rounded-xl border border-border p-5 animate-pulse">
              <div className="h-4 bg-border rounded w-3/4 mb-3" />
              <div className="flex gap-1.5 mb-3">
                {Array.from({ length: 8 }).map((_, j) => (
                  <div key={j} className="w-2 h-2 rounded-full bg-border" />
                ))}
              </div>
              <div className="h-3 bg-border rounded w-1/2" />
            </div>
          ))}
        </div>
      )}

      {!isLoading && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {songs.map((song) => (
            <SongCard key={song.id} song={song} />
          ))}
          {songs.length === 0 && (
            <p className="text-text-tertiary text-sm col-span-2">No songs yet. Create one above.</p>
          )}
        </div>
      )}
    </div>
  )
}
