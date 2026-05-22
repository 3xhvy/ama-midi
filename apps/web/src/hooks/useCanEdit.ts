import { useAuthStore } from '../store/auth.store'
import { useMe } from '../features/auth/useMe'

export function useCanEdit(): boolean {
  const token = useAuthStore(s => s.token)
  const { data: user } = useMe()
  if (!token) return false
  if (!user) return true // optimistic — allow until user data loads
  return user.role !== 'VIEWER'
}
