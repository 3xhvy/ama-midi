import { useQuery } from '@tanstack/react-query'
import { useAuthStore } from '../../store/auth.store'
import { apiClient } from '../auth/api'
import { summariseIssues, type ValidationIssue, type ValidationSummary } from './validation-summary'

interface ValidationResult {
  summary: { errors: number; warnings: number }
  issues: ValidationIssue[]
}

export function useValidation(songId: string | undefined) {
  const token = useAuthStore((s) => s.token)

  const query = useQuery<ValidationResult>({
    queryKey: ['validation', songId],
    queryFn: () => apiClient(token)<ValidationResult>(`/songs/${songId}/validation`),
    staleTime: 30_000,
    enabled: !!token && !!songId,
  })

  const issues = query.data?.issues ?? []
  const summary: ValidationSummary = summariseIssues(issues)

  return { ...query, issues, summary }
}
