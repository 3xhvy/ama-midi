import { useAuthStore } from '../../store/auth.store'
import { useEffect } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { onboardingPath } from './onboarding-flow'

export function OnboardingGate() {
  const user = useAuthStore((s) => s.user)
  const token = useAuthStore((s) => s.token)
  const location = useLocation()
  const navigate = useNavigate()
  const inOnboarding = location.pathname.startsWith('/onboarding')

  useEffect(() => {
    if (!user || !token) return

    if (!user.profileComplete && !inOnboarding) {
      navigate(onboardingPath('welcome'), { replace: true })
      return
    }

  }, [inOnboarding, navigate, token, user])

  return null
}
