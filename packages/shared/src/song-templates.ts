import type { NoteType, SongCategory, SongDifficulty } from './enums'
import type { PatternNote } from './types'

export interface SongTemplateSection {
  time: number
  label: string
  color?: string
}

export interface SongTemplatePattern {
  name: string
  notes: PatternNote[]
}

export interface SongTemplateNote {
  track: number
  time: number
  noteType: NoteType
  duration?: number
  title?: string
}

export interface SongTemplateDefinition {
  id: string
  name: string
  description: string
  category: SongCategory
  difficulty: SongDifficulty
  bpm: number
  timeSignature: string
  suggestedName: string
  createsLabel: string
  sections?: SongTemplateSection[]
  patterns?: SongTemplatePattern[]
  notes?: SongTemplateNote[]
}

export const SONG_TEMPLATES: SongTemplateDefinition[] = [
  {
    id: 'empty-draft',
    name: 'Empty Draft',
    description: 'Blank chart with default song settings only.',
    category: 'PROTOTYPE',
    difficulty: 'NORMAL',
    bpm: 120,
    timeSignature: '4/4',
    suggestedName: 'Untitled Draft',
    createsLabel: 'Settings only',
  },
  {
    id: 'tap-starter',
    name: 'Tap Starter',
    description: 'Simple TAP examples to learn basic charting.',
    category: 'PROTOTYPE',
    difficulty: 'EASY',
    bpm: 120,
    timeSignature: '4/4',
    suggestedName: 'Tap Starter',
    createsLabel: 'Starter notes',
    notes: Array.from({ length: 8 }, (_, i) => ({
      track: 1,
      time: 1 + i * 0.5,
      noteType: 'TAP' as const,
    })),
  },
  {
    id: 'mixed-mechanics',
    name: 'Mixed Mechanics',
    description: 'TAP, HOLD, and SWIPE examples on one chart.',
    category: 'PROTOTYPE',
    difficulty: 'NORMAL',
    bpm: 128,
    timeSignature: '4/4',
    suggestedName: 'Mixed Mechanics',
    createsLabel: 'Mechanic examples',
    notes: [
      { track: 1, time: 1, noteType: 'TAP' },
      { track: 2, time: 2, noteType: 'HOLD', duration: 1 },
      { track: 3, time: 4, noteType: 'SWIPE' },
    ],
  },
  {
    id: 'qa-validation',
    name: 'QA Validation',
    description: 'Sections plus overlapping notes for validation testing.',
    category: 'QA_TEST',
    difficulty: 'NORMAL',
    bpm: 100,
    timeSignature: '4/4',
    suggestedName: 'QA Validation',
    createsLabel: 'Sections + edge cases',
    sections: [
      { time: 0, label: 'Intro' },
      { time: 8, label: 'Verse' },
      { time: 16, label: 'Chorus' },
    ],
    notes: [
      { track: 1, time: 4, noteType: 'TAP', title: 'Edge A' },
      { track: 1, time: 4.05, noteType: 'TAP', title: 'Edge B' },
    ],
  },
  {
    id: 'sectioned-layout',
    name: 'Sectioned Layout',
    description: 'Campaign-style Intro / Verse / Chorus / Outro markers.',
    category: 'MAIN_CAMPAIGN',
    difficulty: 'NORMAL',
    bpm: 120,
    timeSignature: '4/4',
    suggestedName: 'Sectioned Layout',
    createsLabel: 'Section markers',
    sections: [
      { time: 0, label: 'Intro' },
      { time: 8, label: 'Verse' },
      { time: 16, label: 'Chorus' },
      { time: 24, label: 'Outro' },
    ],
  },
  {
    id: 'pattern-lab',
    name: 'Pattern Lab',
    description: 'Reusable note patterns for rapid iteration.',
    category: 'TEMPLATE',
    difficulty: 'NORMAL',
    bpm: 120,
    timeSignature: '4/4',
    suggestedName: 'Pattern Lab',
    createsLabel: 'Note patterns',
    patterns: [
      {
        name: 'Basic 4-step',
        notes: [
          { track: 1, timeOffset: 0, noteType: 'TAP' },
          { track: 1, timeOffset: 0.5, noteType: 'TAP' },
          { track: 1, timeOffset: 1, noteType: 'TAP' },
          { track: 1, timeOffset: 1.5, noteType: 'TAP' },
        ],
      },
      {
        name: 'Hold swell',
        notes: [{ track: 2, timeOffset: 0, noteType: 'HOLD', duration: 2 }],
      },
    ],
  },
]

export function getSongTemplate(id: string): SongTemplateDefinition | undefined {
  return SONG_TEMPLATES.find((t) => t.id === id)
}
