import { useEffect, useRef, useState } from 'react'
import type { Song } from '@ama-midi/shared'
import { useEditorStore } from '../../../store/editor.store'
import { useAuthStore } from '../../../store/auth.store'

const API_BASE = import.meta.env.VITE_API_URL ?? ''

/** Max playhead delta per frame from usePlayback — larger jumps are user seeks. */
const SEEK_JUMP_THRESHOLD = 0.2

function hasBackingTrack(song: Song | undefined): boolean {
  if (!song) return false
  return Boolean(song.backingTrackFileName || song.backingTrackUrl)
}

export function useBackingTrack(
  songId: string | undefined,
  song: Song | undefined,
  volume = 0.75,
) {
  const isPlaying = useEditorStore((s) => s.isPlaying)
  const playheadTime = useEditorStore((s) => s.playheadTime)
  const token = useAuthStore((s) => s.token)
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const prevPlayheadRef = useRef(playheadTime)
  const [muted, setMuted] = useState(false)
  const [ready, setReady] = useState(false)

  useEffect(() => {
    setReady(false)
    if (audioRef.current) {
      audioRef.current.pause()
      audioRef.current = null
    }

    if (!songId || !hasBackingTrack(song)) return

    const audio = new Audio()
    audio.preload = 'auto'
    audioRef.current = audio

    let cancelled = false

    async function loadSource() {
      try {
        if (song!.backingTrackFileName) {
          // Fetch presigned URL from API (JWT-authenticated), then set audio.src directly.
          // No crossOrigin attribute — browser plays cross-origin audio without CORS restriction.
          const res = await fetch(`${API_BASE}/songs/${songId}/backing-track`, {
            headers: token ? { Authorization: `Bearer ${token}` } : {},
          })
          if (!res.ok) throw new Error('Failed to load backing track')
          const { redirectUrl } = await res.json() as { redirectUrl: string }
          if (cancelled) return
          audio.src = redirectUrl
        } else if (song!.backingTrackUrl) {
          audio.src = song!.backingTrackUrl
        }
        await audio.load()
        if (!cancelled) {
          audio.currentTime = useEditorStore.getState().playheadTime
          prevPlayheadRef.current = useEditorStore.getState().playheadTime
          setReady(true)
        }
      } catch {
        if (!cancelled) setReady(false)
      }
    }

    void loadSource()

    return () => {
      cancelled = true
      audio.pause()
      audioRef.current = null
    }
  }, [songId, song?.backingTrackUrl, song?.backingTrackFileName, token])

  useEffect(() => {
    const audio = audioRef.current
    if (!audio || !ready) return
    audio.volume = muted ? 0 : volume
  }, [ready, muted, volume])

  // Play / pause when transport or load state changes — never call play() every frame.
  useEffect(() => {
    const audio = audioRef.current
    if (!audio || !ready || muted) return

    if (isPlaying) {
      const t = useEditorStore.getState().playheadTime
      audio.currentTime = t
      prevPlayheadRef.current = t
      void audio.play().catch(() => {})
    } else {
      audio.pause()
    }
  }, [isPlaying, ready, muted])

  // Sync position on seek/scrub only — not on every playback tick.
  useEffect(() => {
    const audio = audioRef.current
    if (!audio || !ready) return

    const prev = prevPlayheadRef.current
    prevPlayheadRef.current = playheadTime

    if (!isPlaying) {
      audio.currentTime = playheadTime
      return
    }

    if (Math.abs(playheadTime - prev) > SEEK_JUMP_THRESHOLD) {
      audio.currentTime = playheadTime
    }
  }, [playheadTime, isPlaying, ready])

  return {
    hasBackingTrack: hasBackingTrack(song),
    ready,
    muted,
    setMuted,
  }
}
