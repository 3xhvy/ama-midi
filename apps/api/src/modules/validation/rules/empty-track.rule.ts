import type { Note } from '@ama-midi/shared'
import type { ValidationRule, ValidationIssue } from '../validation-rule.interface'

export class EmptyTrackRule implements ValidationRule {
  ruleId = 'empty-track'
  severity = 'warning' as const

  run(notes: Note[]): ValidationIssue[] {
    if (notes.length === 0) return []

    const usedTracks = new Set(notes.map((n) => n.track))
    const issues: ValidationIssue[] = []

    for (let t = 1; t <= 8; t++) {
      if (!usedTracks.has(t)) {
        issues.push({
          ruleId: this.ruleId,
          severity: this.severity,
          message: `Track ${t} has no notes`,
          track: t,
        })
      }
    }

    return issues
  }
}
