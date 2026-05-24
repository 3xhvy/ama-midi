import { useState, useCallback } from 'react'
import { useAuthStore } from '../../store/auth.store'
import { apiClient }   from '../auth/api'
import type { TourStep } from './TourOverlay'
import type { AuthUser } from '@ama-midi/shared'

const APP_TOUR_STEPS: TourStep[] = [
  { target: 'piano-roll',    message: 'This is your piano roll. 8 tracks × 300 seconds of musical timeline.' },
  { target: 'fast-mode',     message: 'Fast mode: click to place a note instantly. Toggle to Popup for full control.' },
  { target: 'ai-suggest',           message: 'Open the AI Assistant to generate charts, scale difficulty, fill tracks, or improve patterns.' },
  { target: 'ai-improve-pattern',   message: 'Select 2+ notes, then use Improve pattern to extend or refine that rhythm with AI.' },
  { target: 'view-mode',     message: 'Switch views: Composer (create), Developer (debug), QA (validate).' },
  { target: 'history-tab',   message: 'Every change is recorded here. Undo any action at any time.' },
  { target: 'shortcut-help', message: 'Press ? anytime to see all keyboard shortcuts.' },
]

export function useAppTour() {
  const { user, token, setAuth } = useAuthStore()
  const [active, setActive] = useState(false)

  const start = useCallback(() => setActive(true), [])

  const complete = useCallback(async () => {
    setActive(false)
    if (!token) return
    try {
      const updated = await apiClient(token)<AuthUser>('/users/me', {
        method: 'PATCH',
        body: JSON.stringify({ tourComplete: true }),
      })
      setAuth(updated, token)
    } catch { /* non-critical */ }
  }, [token, setAuth])

  const skip = useCallback(() => setActive(false), [])

  const shouldAutoStart = !!(user?.profileComplete && !user?.tourComplete)

  return { active, steps: APP_TOUR_STEPS, start, complete, skip, shouldAutoStart }
}
