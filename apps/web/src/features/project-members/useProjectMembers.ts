import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useAuthStore } from '../../store/auth.store'
import { apiClient } from '../auth/api'
import type { ProjectMember, ProjectPermission, SongScope } from '@ama-midi/shared'

export function useProjectMembers(projectId?: string) {
  const token = useAuthStore((s) => s.token)
  return useQuery<ProjectMember[]>({
    queryKey: ['project-members', projectId],
    queryFn: () => apiClient(token)<ProjectMember[]>(`/projects/${projectId}/members`),
    enabled: !!token && !!projectId,
  })
}

export function useAddProjectMember(projectId?: string) {
  const token = useAuthStore((s) => s.token)
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (body: { userId: string; permission: ProjectPermission; songScope: SongScope; songIds?: string[] }) =>
      apiClient(token)<ProjectMember>(`/projects/${projectId}/members`, {
        method: 'POST',
        body: JSON.stringify(body),
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['project-members', projectId] }),
  })
}
