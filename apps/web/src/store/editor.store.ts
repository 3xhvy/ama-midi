import { create } from 'zustand'

type ViewMode = 'composer' | 'developer' | 'qa'
type Zoom = 1 | 2 | 4

interface EditorStore {
  viewMode: ViewMode
  zoom: Zoom
  pxPerSecond: number
  setViewMode: (mode: ViewMode) => void
  setZoom: (zoom: Zoom) => void
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
}))
