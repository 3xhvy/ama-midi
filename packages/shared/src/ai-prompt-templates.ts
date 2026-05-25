export type AiPromptFlow =
  | 'generate-chart'
  | 'scale-chart'
  | 'fill-track'
  | 'improve-pattern'

export interface AiPromptTemplate {
  id: string
  flow: AiPromptFlow
  label: string
  prompt: string
  hint?: string
  improveSubMode?: 'extend' | 'refine'
}

export const AI_PROMPT_TEMPLATES: AiPromptTemplate[] = [
  {
    id: 'gen-edm-drop',
    flow: 'generate-chart',
    label: 'EDM drop',
    hint: 'Try target tier: Hard',
    prompt:
      'Upbeat EDM drop — sparse intro, building hi-hats on tracks 2–3, hold notes on vocals/bass in the verse, dense doubles and syncopation in the chorus. Match four-on-the-floor energy.',
  },
  {
    id: 'gen-sparse-intro',
    flow: 'generate-chart',
    label: 'Sparse intro',
    prompt:
      'Very sparse intro for the first 8–16 bars — single-lane taps, gradual density build. Clear section markers for intro, verse, and chorus.',
  },
  {
    id: 'gen-vocal-holds',
    flow: 'generate-chart',
    label: 'Vocal holds',
    hint: 'Mix TAP and HOLD notes',
    prompt:
      'Chart with sustained HOLD notes on vocal phrases (tracks 2–4) and TAP accents on drums/percussion lanes. Aim for 20–30% holds.',
  },
  {
    id: 'gen-syncopated',
    flow: 'generate-chart',
    label: 'Syncopated groove',
    prompt:
      'Syncopated groove with off-beat accents, lane alternation, and occasional doubles. Keep intro simpler than the main groove.',
  },
  {
    id: 'gen-chill-ballad',
    flow: 'generate-chart',
    label: 'Chill ballad',
    hint: 'Try target tier: Easy',
    prompt:
      'Slow ballad feel — wide spacing, minimal simultaneous notes, gentle holds on melody lanes. Low density throughout.',
  },
  {
    id: 'gen-dense-chorus',
    flow: 'generate-chart',
    label: 'Dense chorus',
    hint: 'Try target tier: Expert',
    prompt:
      'High-energy chorus with dense note clusters, multi-lane doubles, and short holds. Contrast with a sparser verse.',
  },
  {
    id: 'scale-thin-density',
    flow: 'scale-chart',
    label: 'Thin density',
    hint: 'Try target tier: Easy',
    prompt:
      'Reduce overall note count. Fewer simultaneous notes, wider spacing, simpler lane changes. Keep the song structure recognizable.',
  },
  {
    id: 'scale-more-doubles',
    flow: 'scale-chart',
    label: 'More doubles',
    hint: 'Try target tier: Hard',
    prompt:
      'Add controlled doubles and syncopation. Increase density in choruses while keeping verses readable.',
  },
  {
    id: 'scale-simplify-holds',
    flow: 'scale-chart',
    label: 'Simplify holds',
    hint: 'Try target tier: Normal',
    prompt:
      'Shorten or remove long holds. Prefer TAP notes with occasional short holds for accents.',
  },
  {
    id: 'scale-keep-chorus',
    flow: 'scale-chart',
    label: 'Keep chorus energy',
    prompt:
      'Preserve chorus intensity and lane patterns. Adjust difficulty mainly in verses and transitions.',
  },
  {
    id: 'fill-hihat-groove',
    flow: 'fill-track',
    label: 'Hi-hat groove',
    hint: 'Pick the hi-hat lane',
    prompt:
      'Match the existing hi-hat groove near the playhead. Same rhythmic feel, slight variation every 2 bars.',
  },
  {
    id: 'fill-sparse',
    flow: 'fill-track',
    label: 'Sparse fills',
    prompt:
      'Add sparse filler notes on this lane — every 1–2 bars, avoid cluttering existing patterns.',
  },
  {
    id: 'fill-double-time',
    flow: 'fill-track',
    label: 'Double-time burst',
    prompt:
      'Short double-time burst for 1–2 bars near the playhead, then return to the prevailing rhythm.',
  },
  {
    id: 'fill-mirror-lane',
    flow: 'fill-track',
    label: 'Mirror lane 1',
    hint: 'Pick the destination lane',
    prompt:
      'Mirror the rhythmic pattern from track 1 onto this lane with complementary lane spacing.',
  },
  {
    id: 'improve-ext-continue',
    flow: 'improve-pattern',
    label: 'Continue groove',
    improveSubMode: 'extend',
    prompt:
      'Continue the same rhythmic feel forward. Keep lane choices consistent with the selection.',
  },
  {
    id: 'improve-ext-mirror',
    flow: 'improve-pattern',
    label: 'Mirror lanes',
    improveSubMode: 'extend',
    prompt:
      'Extend the pattern with mirrored lane alternation — same timing feel, complementary tracks.',
  },
  {
    id: 'improve-ext-tension',
    flow: 'improve-pattern',
    label: 'Build tension',
    improveSubMode: 'extend',
    prompt:
      'Extend forward with gradually denser notes to build tension before the next section.',
  },
  {
    id: 'improve-ref-spacing',
    flow: 'improve-pattern',
    label: 'Fix spacing',
    improveSubMode: 'refine',
    prompt:
      'Fix uneven spacing in the selection. Keep the same general pattern but snap to a cleaner grid.',
  },
  {
    id: 'improve-ref-simplify',
    flow: 'improve-pattern',
    label: 'Simplify',
    improveSubMode: 'refine',
    prompt:
      'Simplify the selection — remove redundant notes, keep the core rhythm readable.',
  },
  {
    id: 'improve-ref-doubles',
    flow: 'improve-pattern',
    label: 'Add doubles',
    improveSubMode: 'refine',
    prompt:
      'Add tasteful doubles to the selection without changing the overall timing structure.',
  },
]

export function templatesForFlow(
  flow: AiPromptFlow,
  improveSubMode?: 'extend' | 'refine',
): AiPromptTemplate[] {
  return AI_PROMPT_TEMPLATES.filter((template) => {
    if (template.flow !== flow) return false
    if (flow !== 'improve-pattern') return true
    if (!improveSubMode) return false
    return template.improveSubMode === improveSubMode
  })
}
