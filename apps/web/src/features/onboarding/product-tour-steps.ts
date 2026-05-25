import type { TourStep } from './TourOverlay'
import { useProductTourStore } from './product-tour.store'
import {
  ANALYSIS_SETTLE_MS,
  analysisBoardRoute,
  delay,
  editorRoute,
  projectRoute,
  type TourContextData,
  type TourRuntimeContext,
} from './tour-context'

function openEditorPanels(ctx: TourRuntimeContext) {
  ctx.editorStore.setLeftCollapsed(false)
  ctx.editorStore.setRightCollapsed(false)
}

function openToolsTab(ctx: TourRuntimeContext) {
  openEditorPanels(ctx)
  ctx.editorStore.setRightPanelTab('tools')
}

function clearTourDemo() {
  useProductTourStore.getState().setDemoModal(null)
}

function setTourDemo(modal: NonNullable<import('./product-tour.store').ProductTourDemoModal>) {
  return (ctx: TourRuntimeContext) => {
    openEditorPanels(ctx)
    clearTourDemo()
    useProductTourStore.getState().setDemoModal(modal)
  }
}

function openAiPicker(ctx: TourRuntimeContext) {
  openEditorPanels(ctx)
  clearTourDemo()
  ctx.editorStore.closeAiAssistant()
  ctx.editorStore.openAiAssistant({
    open: true,
    feature: null,
    phase: 'picker',
    entry: 'toolbar',
  })
}

function closeTourOverlays(ctx: TourRuntimeContext) {
  clearTourDemo()
  ctx.editorStore.closeAiAssistant()
}

async function prepareAnalysisBoard(ctx: TourRuntimeContext) {
  closeTourOverlays(ctx)
  await delay(ANALYSIS_SETTLE_MS)
}

export const PRODUCT_TOUR_STEPS: TourStep[] = [
  {
    phase: 'project',
    target: 'nav-projects',
    route: '/',
    message: 'Projects — every song belongs to a project. Open Projects to browse workspaces.',
  },
  {
    phase: 'project',
    target: 'my-projects',
    route: '/',
    message: 'Your active projects appear here on the dashboard. Pick one to see its songs.',
  },
  {
    phase: 'project',
    target: 'projects-header',
    route: '/projects',
    message: 'Project directory — search, filter, and create production workspaces.',
  },
  {
    phase: 'project',
    target: 'project-card',
    route: '/projects',
    message: 'Open a project — each card is a workspace with songs, members, and settings.',
  },
  {
    phase: 'song',
    target: 'project-header',
    route: (ctx) => projectRoute(ctx) ?? '/projects',
    message: 'Project home — song count, status, and quick actions for this workspace.',
  },
  {
    phase: 'song',
    target: 'song-table-row',
    route: (ctx) => projectRoute(ctx) ?? '/projects',
    message: 'Song list — each row is a chartable song. Open one to enter the piano roll editor.',
  },
  {
    phase: 'song',
    target: 'quick-create-song',
    route: (ctx) => projectRoute(ctx) ?? '/projects',
    message: 'Quick Create spins up an untitled song instantly, or use New Song for the full wizard.',
  },
  {
    phase: 'user',
    target: 'project-members-tab',
    route: (ctx) => projectRoute(ctx) ?? '/projects',
    prepare: () => {
      useProductTourStore.getState().setProjectTab('members')
    },
    message: 'Invite composers and QA with permissions and song scope. Control who can edit which charts.',
  },
  {
    phase: 'user',
    target: 'session-presence',
    route: (ctx) => editorRoute(ctx) ?? '/',
    prepare: () => {
      useProductTourStore.getState().setProjectTab(null)
    },
    message: 'See who is in the song right now. Cursors and edits sync live across the team.',
  },
  {
    phase: 'editor',
    target: 'piano-roll',
    route: (ctx) => editorRoute(ctx) ?? '/',
    prepare: (ctx) => openEditorPanels(ctx),
    message: 'Piano roll — 8 tracks × 300 seconds. Click to place notes; drag for holds.',
  },
  {
    phase: 'editor',
    target: 'track-list',
    route: (ctx) => editorRoute(ctx) ?? '/',
    prepare: (ctx) => openEditorPanels(ctx),
    message: 'Tracks — eight lanes, each with a fixed color (T1–T8). Mute a track to focus; bars show note density.',
  },
  {
    phase: 'editor',
    target: 'transport-bar',
    route: (ctx) => editorRoute(ctx) ?? '/',
    message: 'Transport — play, pause, scrub. Click the BPM badge to change tempo.',
  },
  {
    phase: 'editor',
    target: 'chart-difficulty',
    route: (ctx) => editorRoute(ctx) ?? '/',
    message: 'Charts & difficulty — one song can have multiple charts. Badge shows tier (Easy → Master) and speed.',
  },
  {
    phase: 'editor',
    target: 'song-difficulty-stats',
    route: (ctx) => editorRoute(ctx) ?? '/',
    prepare: (ctx) => openEditorPanels(ctx),
    message: 'Live difficulty — notes, combo, peak NPS, and tier update as you compose.',
  },
  {
    phase: 'editor',
    target: 'tools-tab',
    route: (ctx) => editorRoute(ctx) ?? '/',
    prepare: (ctx) => openToolsTab(ctx),
    message: 'Tools panel — zoom, snap, create mode, validation rings, and selection tools.',
  },
  {
    phase: 'editor',
    target: 'zoom',
    route: (ctx) => editorRoute(ctx) ?? '/',
    prepare: (ctx) => openToolsTab(ctx),
    message: 'Zoom — 1× to 8× timeline magnification for detail work.',
  },
  {
    phase: 'editor',
    target: 'fast-mode',
    route: (ctx) => editorRoute(ctx) ?? '/',
    prepare: (ctx) => openToolsTab(ctx),
    message: 'Create mode — Fast places notes on click; Popup opens the full note editor.',
  },
  {
    phase: 'editor',
    target: 'validation-tab',
    route: (ctx) => editorRoute(ctx) ?? '/',
    prepare: (ctx) => {
      openEditorPanels(ctx)
      ctx.editorStore.setRightPanelTab('validation')
    },
    message: 'Validation — errors and warnings (density spikes, speed mismatch, QA rules). Click an issue to jump to it.',
  },
  {
    phase: 'editor',
    target: 'history-tab',
    route: (ctx) => editorRoute(ctx) ?? '/',
    prepare: (ctx) => {
      openEditorPanels(ctx)
      ctx.editorStore.setRightPanelTab('history')
    },
    message: 'History — every edit is logged. Undo any action; changes sync to collaborators.',
  },
  {
    phase: 'editor',
    target: 'selection-actions',
    route: (ctx) => editorRoute(ctx) ?? '/',
    prepare: (ctx) => {
      closeTourOverlays(ctx)
      openToolsTab(ctx)
    },
    message: 'Select 2+ notes to open the floating action bar — save, repeat, copy, and AI shortcuts appear above the grid.',
  },
  {
    phase: 'editor',
    target: 'multi-select-bar',
    route: (ctx) => editorRoute(ctx) ?? '/',
    prepare: setTourDemo('multi-select-actions'),
    message: 'Multi-select actions — choose multiple notes to unlock Improve pattern, Repeat, Save as Pattern, Copy to, Delete, and quick deselect actions.',
  },
  {
    phase: 'editor',
    target: 'save-pattern-modal',
    route: (ctx) => editorRoute(ctx) ?? '/',
    prepare: setTourDemo('save-pattern'),
    message: 'Save pattern — turn a selection into a reusable rhythm. Name it and save to this song or your shared library.',
  },
  {
    phase: 'editor',
    target: 'repeat-modal',
    route: (ctx) => editorRoute(ctx) ?? '/',
    prepare: setTourDemo('repeat'),
    message: 'Repeat — stamp copies of the selection across the timeline at a beat interval or custom spacing.',
  },
  {
    phase: 'editor',
    target: 'pattern-panel',
    route: (ctx) => editorRoute(ctx) ?? '/',
    prepare: (ctx) => {
      closeTourOverlays(ctx)
      openEditorPanels(ctx)
    },
    message: 'Pattern library — saved patterns live in the left panel. Reuse fills and motifs across charts.',
  },
  {
    phase: 'editor',
    target: 'paste-pattern-modal',
    route: (ctx) => editorRoute(ctx) ?? '/',
    prepare: setTourDemo('paste-pattern'),
    message: 'Paste pattern — pick a start time on the timeline, validate, then drop the pattern onto the chart.',
  },
  {
    phase: 'editor',
    target: 'conflict-review-modal',
    route: (ctx) => editorRoute(ctx) ?? '/',
    prepare: setTourDemo('conflict-review'),
    message: 'Conflict review — overlapping notes are resolved one-by-one: keep existing or replace with incoming notes.',
  },
  {
    phase: 'editor',
    target: 'ai-suggest',
    route: (ctx) => editorRoute(ctx) ?? '/',
    prepare: closeTourOverlays,
    message: 'AI Assistant — open the popup from the toolbar for chart generation and editing help.',
  },
  {
    phase: 'editor',
    target: 'ai-assistant-modal',
    route: (ctx) => editorRoute(ctx) ?? '/',
    prepare: openAiPicker,
    message: 'AI popup — pick an action. Each flow opens a focused form, then streams a preview you can apply.',
  },
  {
    phase: 'editor',
    target: 'ai-feature-generate-chart',
    route: (ctx) => editorRoute(ctx) ?? '/',
    prepare: openAiPicker,
    message: 'Generate chart — describe the vibe and target difficulty; AI builds a full chart preview.',
  },
  {
    phase: 'editor',
    target: 'ai-feature-scale-chart',
    route: (ctx) => editorRoute(ctx) ?? '/',
    prepare: openAiPicker,
    message: 'Scale difficulty — preview an easier or harder replacement chart while keeping the structure.',
  },
  {
    phase: 'editor',
    target: 'ai-feature-fill-track',
    route: (ctx) => editorRoute(ctx) ?? '/',
    prepare: openAiPicker,
    message: 'Fill track — add notes on one lane near the playhead to densify a section.',
  },
  {
    phase: 'editor',
    target: 'ai-feature-improve-pattern',
    route: (ctx) => editorRoute(ctx) ?? '/',
    prepare: openAiPicker,
    message: 'Improve pattern — with 2+ notes selected, extend or refine that rhythm with AI.',
  },
  {
    phase: 'editor',
    target: 'difficulty-heatmap',
    route: (ctx) => editorRoute(ctx) ?? '/',
    prepare: (ctx) => {
      closeTourOverlays(ctx)
      openToolsTab(ctx)
    },
    message: 'Difficulty heatmap — color overlay on the grid showing hard sections at a glance.',
  },
  {
    phase: 'editor',
    target: 'analysis-summary',
    route: (ctx) => editorRoute(ctx) ?? '/',
    prepare: (ctx) => {
      closeTourOverlays(ctx)
      openEditorPanels(ctx)
    },
    message: 'Analysis preview — tier, avg/peak scores, mini timeline, and top warnings update live as you edit.',
  },
  {
    phase: 'editor',
    target: 'open-analysis-board',
    route: (ctx) => editorRoute(ctx) ?? '/',
    prepare: (ctx) => openEditorPanels(ctx),
    message: 'Open Analysis Board — full breakdown of difficulty factors, sections, and QA warnings for this chart.',
  },
  {
    phase: 'analysis',
    target: 'analysis-board-header',
    route: (ctx) => analysisBoardRoute(ctx) ?? editorRoute(ctx) ?? '/',
    prepare: prepareAnalysisBoard,
    message: 'Analysis Board — dedicated view for one chart. Re-analyze after big edits to refresh scores.',
  },
  {
    phase: 'analysis',
    target: 'analysis-stat-cards',
    route: (ctx) => analysisBoardRoute(ctx) ?? editorRoute(ctx) ?? '/',
    prepare: prepareAnalysisBoard,
    message: 'Summary stats — average and peak difficulty scores, note count, warning totals, and segment count.',
  },
  {
    phase: 'analysis',
    target: 'analysis-section-timeline',
    route: (ctx) => analysisBoardRoute(ctx) ?? editorRoute(ctx) ?? '/',
    prepare: prepareAnalysisBoard,
    message: 'Section timeline — color bands show difficulty over time. Click a band to jump to that moment in the editor.',
  },
  {
    phase: 'analysis',
    target: 'analysis-factor-breakdown',
    route: (ctx) => analysisBoardRoute(ctx) ?? editorRoute(ctx) ?? '/',
    prepare: prepareAnalysisBoard,
    message: 'Factor breakdown — density, speed, lane jumps, syncopation, holds, simultaneous taps, and pattern complexity. Hover for tips; amber markers show tier limits.',
  },
  {
    phase: 'analysis',
    target: 'analysis-warnings',
    route: (ctx) => analysisBoardRoute(ctx) ?? editorRoute(ctx) ?? '/',
    prepare: prepareAnalysisBoard,
    message: 'Warnings table — filter by severity and click a row to jump to the problem in the editor. Errors can block publish approval.',
  },
  {
    phase: 'analysis',
    target: 'analysis-reanalyze',
    route: (ctx) => analysisBoardRoute(ctx) ?? editorRoute(ctx) ?? '/',
    prepare: prepareAnalysisBoard,
    message: 'Re-analyze — run the server analysis again after large chart changes to sync cached scores and warnings.',
  },
  {
    phase: 'editor',
    target: 'shortcut-help',
    route: (ctx) => editorRoute(ctx) ?? '/',
    prepare: closeTourOverlays,
    message: 'Shortcuts — press ? anytime for the full keyboard reference.',
  },
]

export function phaseLabel(steps: TourStep[], index: number): string | null {
  const step = steps[index]
  if (!step?.phase) return null
  const inPhase = steps.slice(0, index + 1).filter((s) => s.phase === step.phase).length
  const total = steps.filter((s) => s.phase === step.phase).length
  const label = step.phase.charAt(0).toUpperCase() + step.phase.slice(1)
  return `${label} · ${inPhase}/${total}`
}

export function resolveStepRoute(
  step: TourStep,
  ctx: TourContextData,
): string | undefined {
  if (!step.route) return undefined
  return typeof step.route === 'function' ? step.route(ctx) : step.route
}
