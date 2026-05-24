import { useCallback, useRef, useState } from 'react'
import { AI_STREAM_STEPS, type AiStreamEvent, type AiStreamRequest, type AiStreamStepStatus } from '@ama-midi/shared'
import { streamAiRequest } from '../../ai-stream'

type StepState = AiStreamStepStatus | 'pending'

export function useAiStreamRun(songId: string, token: string | null) {
  const [steps, setSteps] = useState<Record<string, StepState>>({})
  const [details, setDetails] = useState<Record<string, string>>({})
  const [stepStartTimes, setStepStartTimes] = useState<Record<string, number>>({})
  const [processing, setProcessing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const abortRef = useRef<AbortController | null>(null)
  const runIdRef = useRef<string | null>(null)

  const resetSteps = useCallback((action: AiStreamRequest['action']) => {
    const initial: Record<string, StepState> = {}
    for (const s of AI_STREAM_STEPS[action]) initial[s.stepId] = 'pending'
    setSteps(initial)
    setDetails({})
    setStepStartTimes({})
  }, [])

  const start = useCallback(async (body: AiStreamRequest) => {
    abortRef.current?.abort()
    const controller = new AbortController()
    abortRef.current = controller
    setProcessing(true)
    setError(null)
    resetSteps(body.action)

    try {
      const result = await streamAiRequest(token, songId, body, {
        signal: controller.signal,
        onEvent: (event: AiStreamEvent) => {
          if (event.type === 'run') {
            runIdRef.current = event.runId
            return
          }
          if (event.type === 'step') {
            if (runIdRef.current && event.runId !== runIdRef.current) return
            setSteps((prev) => ({ ...prev, [event.stepId]: event.status }))
            if (event.detail) {
              setDetails((prev) => ({ ...prev, [event.stepId]: event.detail! }))
            }
            if (event.status === 'active') {
              setStepStartTimes((prev) => ({
                ...prev,
                [event.stepId]: prev[event.stepId] ?? Date.now(),
              }))
            }
            return
          }
        },
      })
      return result
    } catch (e) {
      if ((e as Error).name !== 'AbortError') {
        setError(e instanceof Error ? e.message : 'AI request failed')
      }
      throw e
    } finally {
      setProcessing(false)
    }
  }, [token, songId, resetSteps])

  const cancel = useCallback(() => {
    abortRef.current?.abort()
    setProcessing(false)
  }, [])

  return { steps, details, stepStartTimes, processing, error, start, cancel }
}
