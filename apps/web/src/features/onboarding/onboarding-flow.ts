export const ONBOARDING_STEP_IDS = [
  'welcome',
  'features',
  'notes',
  'profile',
  'ready',
] as const

export type OnboardingStepId = typeof ONBOARDING_STEP_IDS[number]

export interface OnboardingStepDefinition {
  id: OnboardingStepId
  eyebrow: string
  title: string
  body: string
  bullets: string[]
  cta: string
}

export const ONBOARDING_STEPS: Record<OnboardingStepId, OnboardingStepDefinition> = {
  welcome: {
    id: 'welcome',
    eyebrow: 'Welcome',
    title: 'Build playable MIDI charts with the whole team.',
    body: 'AMA-MIDI keeps projects, songs, charts, QA, and collaboration in one production workspace.',
    bullets: [
      'Organize every song inside a project workspace.',
      'Compose on an eight-track piano roll built for game music.',
      'Keep review, validation, and AI assistance close to the chart.',
    ],
    cta: 'Continue',
  },
  features: {
    id: 'features',
    eyebrow: 'Feature highlights',
    title: 'Everything important stays connected.',
    body: 'Move from project planning to chart editing, validation, analysis, and AI-assisted iteration without switching tools.',
    bullets: [
      'Live collaboration shows who is editing now.',
      'Validation catches density spikes and chart issues early.',
      'AI flows help generate, scale, fill, and improve patterns.',
    ],
    cta: 'Continue',
  },
  notes: {
    id: 'notes',
    eyebrow: 'Notes and tracks',
    title: 'Notes are the building blocks of every chart.',
    body: 'Tap notes, hold notes, track colors, and density all shape how the chart feels in play.',
    bullets: [
      'Tap notes mark quick beats on a lane.',
      'Hold notes stretch over time for sustained actions.',
      'Density and lane movement drive difficulty analysis.',
    ],
    cta: 'Continue',
  },
  profile: {
    id: 'profile',
    eyebrow: 'Profile',
    title: 'Complete your profile.',
    body: 'Your title and department help teammates understand your role in each project.',
    bullets: [
      'Your Google account provides email and avatar.',
      'Your display name can be adjusted here.',
      'Title and department are required for team context.',
    ],
    cta: 'Save & continue',
  },
  ready: {
    id: 'ready',
    eyebrow: 'You are set up',
    title: 'Your workspace is ready.',
    body: 'Start the guided product tour to see projects, songs, collaboration, editor tools, AI, validation, and analysis in context.',
    bullets: [
      'Take the tour for a guided walkthrough.',
      'Go to the dashboard if you already know where to start.',
      'You can relaunch the tour later from the app menu.',
    ],
    cta: 'Take a tour',
  },
}

export function parseOnboardingStep(value: string | undefined): OnboardingStepId {
  return ONBOARDING_STEP_IDS.includes(value as OnboardingStepId)
    ? value as OnboardingStepId
    : 'welcome'
}

export function getNextOnboardingStep(step: OnboardingStepId): OnboardingStepId | null {
  const index = ONBOARDING_STEP_IDS.indexOf(step)
  return ONBOARDING_STEP_IDS[index + 1] ?? null
}

export function getPreviousOnboardingStep(step: OnboardingStepId): OnboardingStepId | null {
  const index = ONBOARDING_STEP_IDS.indexOf(step)
  return ONBOARDING_STEP_IDS[index - 1] ?? null
}

export function onboardingPath(step: OnboardingStepId): string {
  return `/onboarding/${step}`
}
