import { useAuthStore } from '../../store/auth.store'
import { OnboardingModal } from './OnboardingModal'
import { requestProductTour } from './product-tour.store'

export function OnboardingGate() {
  const user = useAuthStore((s) => s.user)
  const token = useAuthStore((s) => s.token)

  if (!user || !token) return null
  if (user.profileComplete) return null

  return (
    <OnboardingModal
      onComplete={() => {
        if (!useAuthStore.getState().user?.tourComplete) {
          requestProductTour()
        }
      }}
    />
  )
}
