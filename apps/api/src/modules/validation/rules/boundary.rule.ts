import type { Note } from '@ama-midi/shared'
import type { ValidationRule, ValidationIssue } from '../validation-rule.interface'

export class BoundaryRule implements ValidationRule {
  ruleId = 'boundary'
  severity = 'warning' as const

  run(notes: Note[]): ValidationIssue[] {
    return notes
      .filter((n) => n.time < 0.5 || n.time > 299.5)
      .map((n) => ({
        ruleId: this.ruleId,
        severity: this.severity,
        message: `Note near boundary at Track ${n.track}, ${n.time}s`,
        track: n.track,
        time: n.time,
      }))
  }
}
