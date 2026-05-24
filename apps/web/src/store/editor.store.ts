import { create } from 'zustand'
import type { NoteSuggestion, SnapMode } from '@ama-midi/shared'

export type AiAssistantFeature =
  | 'generate-chart'
  | 'scale-chart'
  | 'fill-track'
  | 'improve-pattern'

export type AiAssistantPhase = 'picker' | 'configure' | 'processing' | 'result'

export interface AiAssistantState {
  open: boolean
  feature: AiAssistantFeature | null
  phase: AiAssistantPhase
  entry: 'toolbar' | 'selection'
  improveSubMode?: 'extend' | 'refine'
}

type ViewMode = 'composer' | 'developer' | 'qa' | 'preview'
type Zoom = 1 | 2 | 4 | 8
type RightPanelTab = 'tools' | 'validation' | 'history'

export interface ChartPreviewState {
  notes: Array<{
    track: number
    time: number
    noteType?: string
    duration?: number
    title?: string
  }>
  sections?: Array<{ time: number; label: string; color?: string }>
  replaceExisting: boolean
}

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
  aiAssistant:        AiAssistantState | null
  aiSuggestions:      NoteSuggestion[]
  snapMode:           SnapMode
  heatmapEnabled:     boolean
  activeTrack:        number | null
  activeChartId:      string | null
  chartPreview:       ChartPreviewState | null
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
  openAiAssistant:     (partial: Partial<AiAssistantState> & { open: true }) => void
  closeAiAssistant:    () => void
  setAiSuggestions:    (suggestions: NoteSuggestion[]) => void
  clearAiSuggestions:  () => void
  setSnapMode:         (mode: SnapMode) => void
  setHeatmapEnabled:   (enabled: boolean) => void
  setActiveTrack:      (track: number | null) => void
  setActiveChartId:    (id: string | null) => void
  setChartPreview:     (preview: ChartPreviewState | null) => void
  clearChartPreview:   () => void
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
  aiAssistant:      null,
  aiSuggestions:    [],
  snapMode:         '0.1s',
  heatmapEnabled:   false,
  activeTrack:      null,
  activeChartId:    null,
  chartPreview:     null,
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
  openAiAssistant:     (partial) => set({
    aiAssistant: {
      feature: null,
      phase: 'picker',
      entry: 'toolbar',
      ...partial,
    },
  }),
  closeAiAssistant:    () => set({ aiAssistant: null }),
  setAiSuggestions:    (aiSuggestions) => set({ aiSuggestions }),
  clearAiSuggestions:  () => set({ aiSuggestions: [] }),
  setSnapMode:         (snapMode) => set({ snapMode }),
  setHeatmapEnabled:   (heatmapEnabled) => set({ heatmapEnabled }),
  setActiveTrack:      (activeTrack) => set({ activeTrack }),
  setActiveChartId:    (activeChartId) => set({ activeChartId }),
  setChartPreview:     (chartPreview) => set({ chartPreview }),
  clearChartPreview:   () => set({ chartPreview: null }),
}))
