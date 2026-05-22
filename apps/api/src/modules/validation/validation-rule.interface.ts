import type { Note } from '@ama-midi/shared'

export interface ValidationIssue {
  ruleId: string
  severity: 'error' | 'warning'
  message: string
  track?: number
  time?: number
}

export interface ValidationRule {
  ruleId: string
  severity: 'error' | 'warning'
  run(notes: Note[]): ValidationIssue[]
}
