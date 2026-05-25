import { useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { cn, timeAgo } from '../../lib/utils'
import { Button, StatusBadge, Avatar } from '../../components/ui'
import { NOTE_PRESET_COLORS } from '@ama-midi/shared'
import type { Song } from '@ama-midi/shared'
import { songEditorPath } from '../navigation/song-editor-path'
import { useAuthStore } from '../../store/auth.store'
import { toast } from 'sonner'

const API_BASE = import.meta.env.VITE_API_URL ?? ''

function TrackDots({ noteCount }: { noteCount: number }) {
  const filled = Math.min(8, Math.round((noteCount / 50) * 8))
  return (
    <div className="flex gap-1.5">
      {Array.from({ length: 8 }).map((_, i) => (
        <div
          key={i}
          className="w-2 h-2 rounded-full transition-colors"
          style={{
            backgroundColor:
              i < filled
                ? NOTE_PRESET_COLORS[i % NOTE_PRESET_COLORS.length]
                : 'var(--shell-border)',
          }}
        />
      ))}
    </div>
  )
}

function MidiMenu({ songId }: { songId: string }) {
  const token = useAuthStore((s) => s.token)
  const [open, setOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)
  const importRef = useRef<HTMLInputElement>(null)

  function close() {
    setOpen(false)
  }

  function handleClickOutside(e: MouseEvent) {
    if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
      close()
    }
  }

  function toggle(e: React.MouseEvent) {
    e.stopPropagation()
    if (!open) {
      document.addEventListener('mousedown', handleClickOutside, { once: true })
    }
    setOpen((v) => !v)
  }

  async function callMidiEndpoint(method: 'POST' | 'GET', path: string) {
    setBusy(true)
    try {
      const res = await fetch(`${API_BASE}/songs/${songId}/${path}`, {
        method,
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      })
      if (res.status === 501) {
        const body = await res.json().catch(() => ({}))
        toast.info(body.message ?? 'Coming soon')
      } else if (!res.ok) {
        toast.error('Something went wrong')
      }
    } catch {
      toast.error('Network error')
    } finally {
      setBusy(false)
      close()
    }
  }

  function handleImportFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    e.stopPropagation()
    if (!e.target.files?.length) return
    e.target.value = ''
    callMidiEndpoint('POST', 'midi/import')
  }

  return (
    <div ref={menuRef} className="relative" onClick={(e) => e.stopPropagation()}>
      <button
        className="text-xs text-shell-muted hover:text-shell-text px-1.5 py-0.5 rounded transition-colors"
        onClick={toggle}
        title="MIDI options"
        aria-label="MIDI options"
        disabled={busy}
      >
        ···
      </button>

      {open && (
        <div className="absolute right-0 top-6 z-50 min-w-[140px] rounded-lg border border-shell-border bg-shell-surface shadow-lg py-1">
          <button
            className="w-full text-left px-3 py-1.5 text-sm text-shell-text hover:bg-shell-bg transition-colors"
            onClick={() => importRef.current?.click()}
            disabled={busy}
          >
            Import MIDI
          </button>
          <button
            className="w-full text-left px-3 py-1.5 text-sm text-shell-text hover:bg-shell-bg transition-colors"
            onClick={() => callMidiEndpoint('GET', 'midi/export')}
            disabled={busy}
          >
            Export MIDI
          </button>
        </div>
      )}

      <input
        ref={importRef}
        type="file"
        accept=".mid,.midi"
        className="hidden"
        onChange={handleImportFileChange}
      />
    </div>
  )
}

export function SongCard({ song, className }: { song: Song; className?: string }) {
  const navigate = useNavigate()
  return (
    <div
      className={cn(
        'bg-shell-surface rounded-xl shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all p-5 border border-shell-border cursor-pointer group',
        className,
      )}
      onClick={() => navigate(songEditorPath(song.projectId, song.id))}
    >
      <div className="flex items-start justify-between mb-3">
        <h3 className="font-semibold text-shell-text text-[15px] truncate">{song.name}</h3>
        <div className="flex items-center gap-1 shrink-0 ml-2">
          <MidiMenu songId={song.id} />
          <StatusBadge status="draft" />
        </div>
      </div>
      <TrackDots noteCount={song.noteCount ?? 0} />
      <div className="flex items-center gap-1.5 mt-3">
        <Avatar name={song.creatorName ?? 'Unknown'} src={song.creatorAvatarUrl} size="xs" />
        <span className="text-xs text-shell-muted truncate">{song.creatorName ?? 'Unknown'}</span>
        <span className="text-xs text-shell-muted ml-auto">{timeAgo(song.updatedAt)}</span>
      </div>
      <div className="mt-3 opacity-0 group-hover:opacity-100 transition-opacity">
        <Button
          variant="primary"
          size="sm"
          rounded
          className="w-full"
          onClick={(e) => {
            e.stopPropagation()
            navigate(songEditorPath(song.projectId, song.id))
          }}
        >
          Open Editor
        </Button>
      </div>
    </div>
  )
}
