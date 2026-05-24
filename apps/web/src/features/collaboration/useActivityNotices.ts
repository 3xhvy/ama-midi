import { useCallback, useEffect, useRef } from 'react'
import { toast } from 'sonner'
import { ActivityAggregator } from '@ama-midi/shared'
import type { ActivityNoticeEvent } from './useSocket'

function formatCount(total: number) {
  return total >= 1000 ? '999+' : String(total)
}

export function useActivityNotices(currentUserId?: string | null) {
  const aggregatorRef = useRef(new ActivityAggregator())
  const timersRef = useRef(new Map<string, number>())

  const clearActor = useCallback((actorId: string) => {
    aggregatorRef.current.clear(actorId)
    toast.dismiss(`activity-${actorId}`)
    const timer = timersRef.current.get(actorId)
    if (timer) window.clearTimeout(timer)
    timersRef.current.delete(actorId)
  }, [])

  const onActivity = useCallback((event: ActivityNoticeEvent) => {
    if (event.actor.id === currentUserId) return
    const result = aggregatorRef.current.push(event.actor, {
      type: event.type,
      at: event.at,
      weight: event.weight,
      label: event.label,
    })

    if (result.kind === 'individual') {
      toast(result.action.label, {
        id: result.toastId,
        duration: 4000,
        className: 'ama-toast ama-toast--activity',
      })
    }

    if (result.kind === 'burst') {
      result.replacedToastIds.forEach(id => toast.dismiss(id))
      toast(`${result.burst.actor.name} did ${formatCount(result.burst.total)} actions`, {
        id: `activity-${result.burst.actor.id}`,
        duration: Infinity,
        className: 'ama-toast ama-toast--activity',
      })
    }

    if (result.kind === 'burst-update') {
      toast(`${result.burst.actor.name} did ${formatCount(result.burst.total)} actions`, {
        id: `activity-${result.burst.actor.id}`,
        duration: Infinity,
        className: 'ama-toast ama-toast--activity',
      })
    }

    if (result.kind === 'burst' || result.kind === 'burst-update') {
      const actorId = result.burst.actor.id
      const existing = timersRef.current.get(actorId)
      if (existing) window.clearTimeout(existing)
      timersRef.current.set(actorId, window.setTimeout(() => {
        toast.dismiss(`activity-${actorId}`)
        timersRef.current.delete(actorId)
      }, 5000))
    }
  }, [currentUserId])

  const clearAll = useCallback(() => {
    aggregatorRef.current.clear()
    timersRef.current.forEach(timer => window.clearTimeout(timer))
    timersRef.current.clear()
  }, [])

  useEffect(() => clearAll, [clearAll])

  return { onActivity, clearActor, clearAll }
}
