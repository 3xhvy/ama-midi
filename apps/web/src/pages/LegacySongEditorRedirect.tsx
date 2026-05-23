import { useEffect } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import type { Song } from '@ama-midi/shared'
import { useAuthStore } from '../store/auth.store'
import { apiClient } from '../features/auth/api'
import { songEditorPath } from '../features/navigation/song-editor-path'

export function LegacySongEditorRedirect() {
  const { songId } = useParams<{ songId: string }>()
  const navigate = useNavigate()
  const token = useAuthStore((s) => s.token)

  const { data: song, isError } = useQuery<Song>({
    queryKey: ['song', songId],
    queryFn: () => apiClient(token)<Song>(`/songs/${songId}`),
    enabled: !!token && !!songId,
    retry: false,
  })

  useEffect(() => {
    if (!songId) {
      navigate('/projects', { replace: true })
      return
    }
    if (song?.projectId) {
      navigate(songEditorPath(song.projectId, song.id), { replace: true })
    }
    if (isError) navigate('/projects', { replace: true })
  }, [song, songId, isError, navigate])

  return (
    <div className="min-h-screen bg-shell-bg flex items-center justify-center text-sm text-shell-muted">
      Redirecting…
    </div>
  )
}
