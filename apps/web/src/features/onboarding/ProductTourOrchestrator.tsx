import { useCallback, useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import type { AuthUser } from '@ama-midi/shared'
import { useAuthStore } from '../../store/auth.store'
import { apiClient } from '../auth/api'
import { completeProductTour, hasSeenProductTour } from './product-tour-storage'
import { useProductTourStore } from './product-tour.store'
import { PRODUCT_TOUR_STEPS, resolveStepRoute } from './product-tour-steps'
import { TourOverlay } from './TourOverlay'
import {
  buildRuntimeContext,
  delay,
  PREPARE_SETTLE_MS,
  resolveTourContext,
  ROUTE_SETTLE_MS,
  type TourContextData,
} from './tour-context'

export function ProductTourOrchestrator() {
  const { user, token, setAuth } = useAuthStore()
  const navigate = useNavigate()

  const active = useProductTourStore((s) => s.active)
  const stepIndex = useProductTourStore((s) => s.stepIndex)
  const stepReady = useProductTourStore((s) => s.stepReady)
  const startNonce = useProductTourStore((s) => s.startNonce)

  const [tourData, setTourData] = useState<TourContextData | null>(null)
  const enteringRef = useRef(false)

  const finishTour = useCallback(async () => {
    completeProductTour(typeof window === 'undefined' ? undefined : window)
    useProductTourStore.getState().reset()

    if (token) {
      try {
        const updated = await apiClient(token)<AuthUser>('/users/me', {
          method: 'PATCH',
          body: JSON.stringify({ tourComplete: true }),
        })
        setAuth(updated, token)
      } catch { /* non-critical */ }
    }
  }, [token, setAuth])

  const runEnterStep = useCallback(async (index: number, data: TourContextData) => {
    if (enteringRef.current) return
    enteringRef.current = true

    const step = PRODUCT_TOUR_STEPS[index]
    const runtime = buildRuntimeContext(data, navigate)
    const route = resolveStepRoute(step, data)
    const needsNavigation = !!(route && window.location.pathname !== route)

    try {
      useProductTourStore.getState().setDemoModal(null)
      runtime.editorStore.closeAiAssistant()

      if (needsNavigation) {
        useProductTourStore.getState().setStepReady(false)
        navigate(route!)
        await delay(ROUTE_SETTLE_MS)
      } else if (step.prepare) {
        useProductTourStore.getState().setStepReady(false)
      }

      if (step.prepare) {
        await step.prepare(runtime)
        await delay(PREPARE_SETTLE_MS)
      }

      useProductTourStore.getState().setStepReady(true)
    } finally {
      enteringRef.current = false
    }
  }, [navigate])

  useEffect(() => {
    if (!startNonce || !user || !token) return

    const options = useProductTourStore.getState().consumeStartRequest() ?? {}
    if (user.tourComplete && !options.force) return
    if (!options.force && typeof window !== 'undefined' && hasSeenProductTour(window.localStorage)) return

    let cancelled = false

    ;(async () => {
      try {
        const data = await resolveTourContext(token)
        if (cancelled) return
        setTourData(data)
        useProductTourStore.getState().setActive(true)
        useProductTourStore.getState().setStepIndex(0)
      } catch {
        if (!cancelled) useProductTourStore.getState().reset()
      }
    })()

    return () => { cancelled = true }
  }, [startNonce, user, token])

  useEffect(() => {
    if (!user?.profileComplete || !token || user.tourComplete) return
    if (typeof window !== 'undefined' && hasSeenProductTour(window.localStorage)) return
    if (active || startNonce > 0) return

    useProductTourStore.getState().requestStart()
  }, [user?.profileComplete, user?.tourComplete, token, active, startNonce])

  useEffect(() => {
    if (!active || !tourData) return
    void runEnterStep(stepIndex, tourData)
  }, [active, tourData, stepIndex, runEnterStep])

  function goToStep(next: number) {
    useProductTourStore.getState().setStepIndex(next)
  }

  if (!active || !user) return null

  return (
    <TourOverlay
      steps={PRODUCT_TOUR_STEPS}
      stepIndex={stepIndex}
      stepReady={stepReady}
      onNext={() => goToStep(stepIndex + 1)}
      onBack={() => goToStep(stepIndex - 1)}
      onSkip={() => void finishTour()}
      onComplete={() => void finishTour()}
    />
  )
}
