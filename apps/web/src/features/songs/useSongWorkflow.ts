import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { SongStatusEnum, type Song, type SongStatus, type SongWorkflowInfo } from '@ama-midi/shared'
import { useAuthStore } from '../../store/auth.store'
import { apiClient } from '../auth/api'

export function useSongWorkflow(songId?: string) {
  const token = useAuthStore((s) => s.token)
  return useQuery<SongWorkflowInfo>({
    queryKey: ['song-workflow', songId],
    queryFn: () => apiClient(token)<SongWorkflowInfo>(`/songs/${songId}/workflow`),
    enabled: !!token && !!songId,
  })
}

export function useUpdateSongStatus(songId?: string, projectId?: string) {
  const token = useAuthStore((s) => s.token)
  const qc = useQueryClient()

  return useMutation({
    mutationFn: (input: SongStatus | { status: SongStatus; silent?: boolean }) => {
      const status = typeof input === 'string' ? input : input.status
      return apiClient(token)<Song>(`/songs/${songId}/status`, {
        method: 'PATCH',
        body: JSON.stringify({ status }),
      })
    },
    onSuccess: (song, input) => {
      const silent = typeof input === 'object' && input.silent
      qc.setQueryData(['song', songId], song)
      qc.invalidateQueries({ queryKey: ['song-workflow', songId] })
      qc.invalidateQueries({ queryKey: ['project-songs', projectId] })
      qc.invalidateQueries({ queryKey: ['dashboard'] })
      if (!silent) {
        toast.success(`Status updated to ${SongStatusEnum.label(song.status)}`)
      }
    },
    onError: () => {
      toast.error('Could not update song status')
    },
  })
}
