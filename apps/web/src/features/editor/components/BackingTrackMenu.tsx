import { useRef, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { UploadIcon } from '@radix-ui/react-icons'
import type { Song } from '@ama-midi/shared'
import { useAuthStore } from '../../../store/auth.store'
import { extractApiErrorMessage } from '../../auth/api'
import { toast } from 'sonner'
import { VolumeHoverControl } from './VolumeHoverControl'

const API_BASE = import.meta.env.VITE_API_URL ?? ''

interface Props {
  songId: string
  song: Song | undefined
  canEdit: boolean
  backingMuted: boolean
  backingVolume: number
  onBackingMutedChange: (muted: boolean) => void
  onBackingVolumeChange: (volume: number) => void
  hasBackingTrack: boolean
}

export function BackingTrackMenu({
  songId,
  song,
  canEdit,
  backingMuted,
  backingVolume,
  onBackingMutedChange,
  onBackingVolumeChange,
  hasBackingTrack,
}: Props) {
  const token = useAuthStore((s) => s.token)
  const queryClient = useQueryClient()
  const fileRef = useRef<HTMLInputElement>(null)
  const [open, setOpen] = useState(false)
  const [urlDraft, setUrlDraft] = useState(song?.backingTrackUrl ?? '')
  const [busy, setBusy] = useState(false)

  const label = song?.backingTrackFileName
    ?? (song?.backingTrackUrl ? 'Linked track' : null)

  async function invalidateSong() {
    await queryClient.invalidateQueries({ queryKey: ['song', songId] })
  }

  async function uploadFile(file: File) {
    setBusy(true)
    try {
      const body = new FormData()
      body.append('file', file)
      const res = await fetch(`${API_BASE}/songs/${songId}/backing-track/upload`, {
        method: 'POST',
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        body,
      })
      if (!res.ok) {
        const errBody = await res.json().catch(() => ({}))
        throw new Error(extractApiErrorMessage({ status: res.status, body: errBody }, 'Upload failed'))
      }
      await invalidateSong()
      onBackingMutedChange(false)
      toast.success('Backing track uploaded')
      setOpen(false)
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Upload failed')
    } finally {
      setBusy(false)
    }
  }

  async function saveUrl() {
    setBusy(true)
    try {
      const res = await fetch(`${API_BASE}/songs/${songId}/backing-track/url`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ url: urlDraft.trim() || null }),
      })
      if (!res.ok) {
        const errBody = await res.json().catch(() => ({}))
        throw new Error(extractApiErrorMessage({ status: res.status, body: errBody }, 'Failed to save URL'))
      }
      await invalidateSong()
      onBackingMutedChange(false)
      toast.success(urlDraft.trim() ? 'Backing track linked' : 'Backing track removed')
      setOpen(false)
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to save URL')
    } finally {
      setBusy(false)
    }
  }

  async function removeTrack() {
    setBusy(true)
    try {
      const res = await fetch(`${API_BASE}/songs/${songId}/backing-track`, {
        method: 'DELETE',
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      })
      if (!res.ok) throw new Error('Failed to remove backing track')
      await invalidateSong()
      setUrlDraft('')
      toast.success('Backing track removed')
      setOpen(false)
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to remove backing track')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="relative flex items-center gap-0.5">
      {hasBackingTrack && (
        <VolumeHoverControl
          muted={backingMuted}
          volume={backingVolume}
          onMutedChange={onBackingMutedChange}
          onVolumeChange={onBackingVolumeChange}
          title="Backing track"
        />
      )}

      <button
        type="button"
        onClick={() => {
          setUrlDraft(song?.backingTrackUrl ?? '')
          setOpen((v) => !v)
        }}
        title={label ? `Backing track: ${label}` : 'Add backing track'}
        aria-label="Backing track"
        className="editor-toolbar-transport-btn"
        data-active={hasBackingTrack ? 'true' : undefined}
      >
        <UploadIcon />
      </button>

      {open && (
        <>
          <button
            type="button"
            className="fixed inset-0 z-40 cursor-default"
            aria-label="Close backing track menu"
            onClick={() => setOpen(false)}
          />
          <div className="absolute right-full bottom-0 z-50 mr-2 w-72 rounded-lg border border-shell-border bg-shell-surface p-3 shadow-lg">
            <p className="mb-2 text-xs font-medium text-shell-text">Backing track</p>

            {canEdit && (
              <>
                <input
                  ref={fileRef}
                  type="file"
                  accept="audio/mpeg,audio/mp3,audio/wav,audio/ogg"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0]
                    if (file) void uploadFile(file)
                    e.target.value = ''
                  }}
                />
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => fileRef.current?.click()}
                  className="mb-2 w-full rounded-md border border-shell-border px-2 py-1.5 text-xs text-shell-text hover:bg-shell-bg disabled:opacity-50"
                >
                  Upload MP3 / WAV / OGG
                </button>

                <label className="mb-1 block text-[10px] uppercase tracking-wide text-shell-muted">
                  Or paste URL
                </label>
                <input
                  type="url"
                  value={urlDraft}
                  onChange={(e) => setUrlDraft(e.target.value)}
                  placeholder="https://…"
                  className="mb-2 w-full rounded-md border border-shell-border bg-shell-bg px-2 py-1.5 text-xs text-shell-text outline-none focus:border-primary/50"
                />
                <div className="flex gap-2">
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => void saveUrl()}
                    className="flex-1 rounded-md bg-primary px-2 py-1.5 text-xs font-medium text-white disabled:opacity-50"
                  >
                    Save link
                  </button>
                  {hasBackingTrack && (
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => void removeTrack()}
                      className="rounded-md border border-shell-border px-2 py-1.5 text-xs text-shell-muted hover:text-red-500 disabled:opacity-50"
                    >
                      Remove
                    </button>
                  )}
                </div>
              </>
            )}

            {!canEdit && label && (
              <p className="text-xs text-shell-muted truncate" title={label}>{label}</p>
            )}
          </div>
        </>
      )}
    </div>
  )
}
