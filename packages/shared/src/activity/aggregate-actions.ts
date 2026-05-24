import type { ActivityActor, EditorEventType } from '../events'

const BURST_THRESHOLD = 4
const WINDOW_MS = 30_000

export interface ActivityAction {
  type: EditorEventType
  at: number
  weight: number
  label: string
}

export interface ActivityBurst {
  actor: ActivityActor
  actions: ActivityAction[]
  windowStartedAt: number
  total: number
}

export type ActivityPushResult =
  | { kind: 'individual'; action: ActivityAction; actor: ActivityActor; toastId: string }
  | { kind: 'burst'; burst: ActivityBurst; replacedToastIds: string[] }
  | { kind: 'burst-update'; burst: ActivityBurst }
  | { kind: 'ignored' }

interface ActorWindow {
  actor: ActivityActor
  actions: ActivityAction[]
  windowStartedAt: number
  total: number
  burstStarted: boolean
  individualToastIds: string[]
}

export class ActivityAggregator {
  private windows = new Map<string, ActorWindow>()

  push(actor: ActivityActor, action: ActivityAction): ActivityPushResult {
    const current = this.windows.get(actor.id)
    const window =
      current && action.at - current.windowStartedAt <= WINDOW_MS
        ? current
        : {
            actor,
            actions: [],
            windowStartedAt: action.at,
            total: 0,
            burstStarted: false,
            individualToastIds: [],
          }

    window.actor = actor
    window.actions.push(action)
    window.total += Math.max(1, action.weight)
    this.windows.set(actor.id, window)

    const burst: ActivityBurst = {
      actor,
      actions: [...window.actions],
      windowStartedAt: window.windowStartedAt,
      total: window.total,
    }

    if (window.total >= BURST_THRESHOLD) {
      if (!window.burstStarted) {
        window.burstStarted = true
        const replacedToastIds = [...window.individualToastIds]
        window.individualToastIds = []
        return { kind: 'burst', burst, replacedToastIds }
      }
      return { kind: 'burst-update', burst }
    }

    const toastId = `activity-${actor.id}-${window.windowStartedAt}-${window.individualToastIds.length}`
    window.individualToastIds.push(toastId)
    return { kind: 'individual', action, actor, toastId }
  }

  clear(actorId?: string) {
    if (actorId) this.windows.delete(actorId)
    else this.windows.clear()
  }
}
