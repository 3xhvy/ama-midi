import { create } from 'zustand'

export type ProductTourProjectTab = 'songs' | 'members' | null

interface StartOptions {
  force?: boolean
}

export type ProductTourDemoModal =
  | null
  | 'save-pattern'
  | 'repeat'
  | 'paste-pattern'
  | 'conflict-review'

interface ProductTourStore {
  active: boolean
  stepIndex: number
  stepReady: boolean
  projectTab: ProductTourProjectTab
  demoModal: ProductTourDemoModal
  startNonce: number
  startOptions: StartOptions | null
  requestStart: (options?: StartOptions) => void
  consumeStartRequest: () => StartOptions | null
  setActive: (active: boolean) => void
  setStepIndex: (stepIndex: number) => void
  setStepReady: (stepReady: boolean) => void
  setProjectTab: (tab: ProductTourProjectTab) => void
  setDemoModal: (demoModal: ProductTourDemoModal) => void
  reset: () => void
}

export const useProductTourStore = create<ProductTourStore>((set, get) => ({
  active: false,
  stepIndex: 0,
  stepReady: false,
  projectTab: null,
  demoModal: null,
  startNonce: 0,
  startOptions: null,

  requestStart: (options) => {
    set({ startNonce: get().startNonce + 1, startOptions: options ?? {} })
  },

  consumeStartRequest: () => {
    const options = get().startOptions
    set({ startOptions: null })
    return options
  },

  setActive: (active) => set({ active }),
  setStepIndex: (stepIndex) => set({ stepIndex }),
  setStepReady: (stepReady) => set({ stepReady }),
  setProjectTab: (projectTab) => set({ projectTab }),
  setDemoModal: (demoModal) => set({ demoModal }),

  reset: () => set({
    active: false,
    stepIndex: 0,
    stepReady: false,
    projectTab: null,
    demoModal: null,
  }),
}))

export function requestProductTour(options?: StartOptions): void {
  useProductTourStore.getState().requestStart(options)
}
