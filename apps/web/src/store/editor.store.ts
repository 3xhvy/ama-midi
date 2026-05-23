import { create } from 'zustand'
import type { SnapMode } from '../features/editor/engine/beat-calculator'
import type { NoteType } from '@ama-midi/shared'

type ViewMode = 'composer' | 'developer' | 'qa' | 'preview'
type Zoom = 1 | 2 | 4 | 8
type RightPanelTab = 'tools' | 'validation' | 'history'

interface EditorStore {
  viewMode: ViewMode
  zoom: Zoom
  pxPerSecond: number
  setViewMode: (mode: ViewMode) => void
  setZoom: (zoom: Zoom) => void
  createMode:      'fast' | 'popup'
  editorMode:      'fast' | 'popup'
  selectedNoteId:  string | null
  selectedNoteIds: Set<string>
  rightPanelTab:   RightPanelTab
  leftCollapsed:  boolean
  rightCollapsed: boolean
  playheadTime:   number
  isPlaying:      boolean
  triggerAiSuggest: (() => void) | null
  snapMode:           SnapMode
  activeNoteType:     NoteType
  heatmapEnabled:     boolean
  activeTrack:        number | null
  setCreateMode:        (mode: 'fast' | 'popup') => void
  setEditorMode:        (mode: 'fast' | 'popup') => void
  selectNote:           (id: string | null) => void
  focusNote:            (id: string | null) => void
  toggleNoteSelection:  (id: string) => void
  addNoteSelection:     (ids: string[]) => void
  clearSelection:       () => void
  setRightPanelTab:     (tab: RightPanelTab) => void
  toggleLeftPanel:     () => void
  toggleRightPanel:    () => void
  setLeftCollapsed:    (collapsed: boolean) => void
  setRightCollapsed:   (collapsed: boolean) => void
  setPlayheadTime:     (time: number) => void
  setPlaying:          (playing: boolean) => void
  setTriggerAiSuggest: (fn: (() => void) | null) => void
  setSnapMode:         (mode: SnapMode) => void
  setActiveNoteType:   (type: NoteType) => void
  setHeatmapEnabled:   (enabled: boolean) => void
  setActiveTrack:      (track: number | null) => void
}

function calcPxPerSecond(zoom: Zoom) {
  return 30 * zoom
}

export const useEditorStore = create<EditorStore>((set) => ({
  viewMode: 'composer',
  zoom: 1,
  pxPerSecond: calcPxPerSecond(1),
  setViewMode: (viewMode) => set({ viewMode }),
  setZoom: (zoom) => set({ zoom, pxPerSecond: calcPxPerSecond(zoom) }),
  createMode:       'fast',
  editorMode:       'fast',
  selectedNoteId:   null,
  selectedNoteIds:  new Set<string>(),
  rightPanelTab:    'tools',
  leftCollapsed:    false,
  rightCollapsed:   false,
  playheadTime:     0,
  isPlaying:        false,
  triggerAiSuggest: null,
  snapMode:         '0.1s',
  activeNoteType:   'HOLD',
  heatmapEnabled:   false,
  activeTrack:      null,
  setCreateMode:        (createMode) => set({ createMode }),
  setEditorMode:        (editorMode) => set({ editorMode }),
  selectNote:           (id) => set({ selectedNoteId: id, selectedNoteIds: id ? new Set([id]) : new Set() }),
  focusNote:            (id) => set({ selectedNoteId: id }),
  toggleNoteSelection:  (id) => set((s) => {
    const next = new Set(s.selectedNoteIds)
    if (next.has(id)) next.delete(id)
    else next.add(id)
    return { selectedNoteIds: next, selectedNoteId: next.size === 1 ? [...next][0] : null }
  }),
  addNoteSelection:     (ids) => set((s) => {
    const next = new Set(s.selectedNoteIds)
    ids.forEach((id) => next.add(id))
    return { selectedNoteIds: next, selectedNoteId: next.size === 1 ? [...next][0] : null }
  }),
  clearSelection:       () => set({ selectedNoteIds: new Set(), selectedNoteId: null }),
  setRightPanelTab:     (rightPanelTab) => set({ rightPanelTab }),
  toggleLeftPanel:     () => set((s) => ({ leftCollapsed: !s.leftCollapsed })),
  toggleRightPanel:    () => set((s) => ({ rightCollapsed: !s.rightCollapsed })),
  setLeftCollapsed:    (leftCollapsed) => set({ leftCollapsed }),
  setRightCollapsed:   (rightCollapsed) => set({ rightCollapsed }),
  setPlayheadTime:     (playheadTime) => set({ playheadTime }),
  setPlaying:          (isPlaying) => set({ isPlaying }),
  setTriggerAiSuggest: (triggerAiSuggest) => set({ triggerAiSuggest }),
  setSnapMode:         (snapMode) => set({ snapMode }),
  setActiveNoteType:   (activeNoteType) => set({ activeNoteType }),
  setHeatmapEnabled:   (heatmapEnabled) => set({ heatmapEnabled }),
  setActiveTrack:      (activeTrack) => set({ activeTrack }),
}))
