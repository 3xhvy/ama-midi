import { create } from 'zustand'

type ViewMode = 'composer' | 'developer' | 'qa'
type Zoom = 1 | 2 | 4

interface EditorStore {
  viewMode: ViewMode
  zoom: Zoom
  pxPerSecond: number
  setViewMode: (mode: ViewMode) => void
  setZoom: (zoom: Zoom) => void
  editorMode:     'fast' | 'popup'
  selectedNoteId: string | null
  rightPanelTab:  'details' | 'validation' | 'history'
  leftCollapsed:  boolean
  rightCollapsed: boolean
  playheadTime:   number
  isPlaying:      boolean
  triggerAiSuggest: (() => void) | null
  setEditorMode:     (mode: 'fast' | 'popup') => void
  selectNote:        (id: string | null) => void
  setRightPanelTab:  (tab: 'details' | 'validation' | 'history') => void
  toggleLeftPanel:   () => void
  toggleRightPanel:  () => void
  setPlayheadTime:   (time: number) => void
  setPlaying:        (playing: boolean) => void
  setTriggerAiSuggest: (fn: (() => void) | null) => void
}

function calcPxPerSecond(zoom: Zoom) {
  return 3 * zoom
}

export const useEditorStore = create<EditorStore>((set) => ({
  viewMode: 'composer',
  zoom: 1,
  pxPerSecond: calcPxPerSecond(1),
  setViewMode: (viewMode) => set({ viewMode }),
  setZoom: (zoom) => set({ zoom, pxPerSecond: calcPxPerSecond(zoom) }),
  editorMode:       'fast',
  selectedNoteId:   null,
  rightPanelTab:    'details',
  leftCollapsed:    false,
  rightCollapsed:   false,
  playheadTime:     0,
  isPlaying:        false,
  triggerAiSuggest: null,
  setEditorMode:    (editorMode) => set({ editorMode }),
  selectNote:       (selectedNoteId) => set({ selectedNoteId }),
  setRightPanelTab: (rightPanelTab) => set({ rightPanelTab }),
  toggleLeftPanel:  () => set((s) => ({ leftCollapsed: !s.leftCollapsed })),
  toggleRightPanel: () => set((s) => ({ rightCollapsed: !s.rightCollapsed })),
  setPlayheadTime:  (playheadTime) => set({ playheadTime }),
  setPlaying:       (isPlaying) => set({ isPlaying }),
  setTriggerAiSuggest: (triggerAiSuggest) => set({ triggerAiSuggest }),
}))
