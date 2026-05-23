import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { useAuthStore } from '../../store/auth.store'
import { apiClient } from '../auth/api'
import type { CreateProjectSongInput, Song } from '@ama-midi/shared'

export type UpdateSongInput = {
  name?: string
  bpm?: number
  timeSignature?: string
}

export function useUpdateSong(songId?: string, projectId?: string) {
  const token = useAuthStore((s) => s.token)
  const qc = useQueryClient()

  return useMutation({
    mutationFn: (body: UpdateSongInput) =>
      apiClient(token)<Song>(`/songs/${songId}`, {
        method: 'PATCH',
        body: JSON.stringify(body),
      }),
    onSuccess: (song) => {
      qc.setQueryData(['song', songId], song)
      qc.invalidateQueries({ queryKey: ['project-songs', projectId] })
      qc.invalidateQueries({ queryKey: ['dashboard'] })
    },
    onError: () => {
      toast.error('Could not update song details')
    },
  })
}

export function useSongs() {
  const token = useAuthStore((s) => s.token)
  const client = apiClient(token)

  return useQuery<Song[]>({
    queryKey: ['songs'],
    queryFn: () => client<Song[]>('/songs'),
    enabled: !!token,
  })
}

export function useProjectSongs(projectId?: string) {
  const token = useAuthStore((s) => s.token)
  return useQuery<Song[]>({
    queryKey: ['project-songs', projectId],
    queryFn: () => apiClient(token)<Song[]>(`/projects/${projectId}/songs`),
    enabled: !!token && !!projectId,
  })
}

export function useCreateSong() {
  const token = useAuthStore((s) => s.token)
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (name: string) =>
      apiClient(token)<Song>('/songs', { method: 'POST', body: JSON.stringify({ name }) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['songs'] }),
  })
}

export function useCreateProjectSong(projectId?: string) {
  const token = useAuthStore((s) => s.token)
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (body: CreateProjectSongInput) =>
      apiClient(token)<Song>(`/projects/${projectId}/songs`, {
        method: 'POST',
        body: JSON.stringify(body),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['project-songs', projectId] })
      qc.invalidateQueries({ queryKey: ['projects'] })
    },
    onError: () => {
      toast.error('Could not create song')
    },
  })
}
