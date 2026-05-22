import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuthStore } from '../store/auth.store'
import { apiClient } from '../features/auth/api'
import type { AuthUser } from '@ama-midi/shared'

export function AuthCallbackPage() {
  const navigate = useNavigate()
  const setAuth = useAuthStore((s) => s.setAuth)

  useEffect(() => {
    const token = new URLSearchParams(window.location.search).get('token')
    if (!token) { navigate('/'); return }

    apiClient(token)<AuthUser>('/auth/me')
      .then((user) => {
        setAuth(user, token)
        navigate('/')
      })
      .catch(() => navigate('/'))
  }, [navigate, setAuth])

  return (
    <div className="flex items-center justify-center h-screen bg-bg">
      <p className="text-text-secondary">Signing in…</p>
    </div>
  )
}
