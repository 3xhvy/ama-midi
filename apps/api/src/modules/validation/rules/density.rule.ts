import type { Note } from '@ama-midi/shared'
import type { ValidationRule, ValidationIssue } from '../validation-rule.interface'

export class DensityRule implements ValidationRule {
  ruleId = 'density'
  severity = 'warning' as const

  run(notes: Note[]): ValidationIssue[] {
    const issues: ValidationIssue[] = []
    const sorted = [...notes].sort((a, b) => a.time - b.time)

    for (let i = 0; i < sorted.length; i++) {
      const windowEnd = sorted[i].time + 10
      const count = sorted.filter((n) => n.time >= sorted[i].time && n.time < windowEnd).length
      if (count > 50) {
        issues.push({
          ruleId: this.ruleId,
          severity: this.severity,
          message: `High density: ${count} notes in 10s window at ${sorted[i].time}s`,
          time: sorted[i].time,
        })
        while (i < sorted.length - 1 && sorted[i + 1].time < windowEnd) i++
      }
    }

    return issues
  }
}
