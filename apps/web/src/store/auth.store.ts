import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { AuthUser } from '@ama-midi/shared'

interface AuthStore {
  user: AuthUser | null
  token: string | null
  setAuth: (user: AuthUser, token: string) => void
  clearAuth: () => void
}

export const useAuthStore = create<AuthStore>()(
  persist(
    (set) => ({
      user: null,
      token: null,
      setAuth: (user, token) => set({ user, token }),
      clearAuth: () => set({ user: null, token: null }),
    }),
    { name: 'ama-auth' },
  ),
)
