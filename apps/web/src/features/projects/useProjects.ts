import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useAuthStore } from '../../store/auth.store'
import { apiClient } from '../auth/api'
import type { Project } from '@ama-midi/shared'

export function useProjects() {
  const token = useAuthStore((s) => s.token)
  return useQuery<Project[]>({
    queryKey: ['projects'],
    queryFn: () => apiClient(token)<Project[]>('/projects'),
    enabled: !!token,
  })
}

export function useProject(projectId?: string) {
  const token = useAuthStore((s) => s.token)
  return useQuery<Project>({
    queryKey: ['project', projectId],
    queryFn: () => apiClient(token)<Project>(`/projects/${projectId}`),
    enabled: !!token && !!projectId,
  })
}

export function useCreateProject() {
  const token = useAuthStore((s) => s.token)
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (body: { name: string; description?: string }) =>
      apiClient(token)<Project>('/projects', { method: 'POST', body: JSON.stringify(body) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['projects'] }),
  })
}
