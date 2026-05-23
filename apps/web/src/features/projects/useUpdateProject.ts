import { useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import type { Project, ProjectStatus } from '@ama-midi/shared'
import { useAuthStore } from '../../store/auth.store'
import { apiClient } from '../auth/api'

export type UpdateProjectInput = {
  name?: string
  description?: string | null
  status?: ProjectStatus
}

export function useUpdateProject(projectId?: string) {
  const token = useAuthStore((s) => s.token)
  const qc = useQueryClient()

  return useMutation({
    mutationFn: (body: UpdateProjectInput) =>
      apiClient(token)<Project>(`/projects/${projectId}`, {
        method: 'PATCH',
        body: JSON.stringify(body),
      }),
    onSuccess: (project) => {
      qc.setQueryData(['project', projectId], project)
      qc.invalidateQueries({ queryKey: ['projects'] })
      toast.success('Project updated')
    },
    onError: () => {
      toast.error('Could not update project')
    },
  })
}
