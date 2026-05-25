import { create } from 'zustand'
import type { ChartApplyPreview, NoteSuggestion, SnapMode } from '@ama-midi/shared'

export interface LoopRange {
  start: number
  end: number
}

export interface DraftTapNote {
  track: number
  time: number       // snapped start time (seconds)
  duration?: number  // HOLD notes only
}

export type TapSessionPhase = 'recording' | 'review' | 'apply'

export interface TapModeState {
  loopRange: LoopRange  // locked at session start
  draftNotes: DraftTapNote[]
  phase: TapSessionPhase
}

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
  createAsNewChart?: boolean
  useReferenceChart?: boolean
  previewOnClearGrid?: boolean
  suggestedChartName?: string
  placement: ChartApplyPreview | null
}

interface EditorStore {
  validationRingsEnabled: boolean
  setValidationRingsEnabled: (v: boolean) => void
  zoom: Zoom
  pxPerSecond: number
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
  loopRange:          LoopRange | null
  tapMode:            TapModeState | null
  setCreateMode:        (mode: 'fast' | 'popup') => void
  setEditorMode:        (mode: 'fast' | 'popup') => void
  selectNote:           (id: string | null) => void
  focusNote:            (id: string | null) => void
  toggleNoteSelection:  (id: string) => void
  addNoteSelection:     (ids: string[]) => void
  selectNotes:          (ids: string[]) => void
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
  setLoopRange:        (range: LoopRange | null) => void
  setTapMode:          (state: TapModeState | null) => void
  setTapPhase:         (phase: TapSessionPhase) => void
  resetTapDraft:       () => void
  addTapDraftNote:     (note: DraftTapNote) => void
}

function calcPxPerSecond(zoom: Zoom) {
  return 30 * zoom
}

export const useEditorStore = create<EditorStore>((set) => ({
  validationRingsEnabled: false,
  setValidationRingsEnabled: (v) => set({ validationRingsEnabled: v }),
  zoom: 1,
  pxPerSecond: calcPxPerSecond(1),
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
  loopRange:        null,
  tapMode:          null,
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
  selectNotes:          (ids) => set({
    selectedNoteIds: new Set(ids),
    selectedNoteId: ids.length === 1 ? ids[0] : null,
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
  setLoopRange:        (loopRange) => set({ loopRange }),
  setTapMode:          (tapMode) => set((s) => ({
    tapMode,
    loopRange: tapMode === null ? null : s.loopRange,
  })),
  setTapPhase:         (phase) => set((s) =>
    s.tapMode ? { tapMode: { ...s.tapMode, phase } } : s,
  ),
  resetTapDraft:       () => set((s) =>
    s.tapMode ? { tapMode: { ...s.tapMode, draftNotes: [], phase: 'recording' } } : s,
  ),
  addTapDraftNote:     (note) => set((s) => {
    if (!s.tapMode) return s
    // Same track + snapped time → replace (loop re-taps must not stack)
    const draftNotes = s.tapMode.draftNotes.filter(
      (d) => !(d.track === note.track && d.time === note.time),
    )
    return { tapMode: { ...s.tapMode, draftNotes: [...draftNotes, note] } }
  }),
}))
