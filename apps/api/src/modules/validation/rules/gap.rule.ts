import type { Note } from '@ama-midi/shared'
import type { ValidationRule, ValidationIssue } from '../validation-rule.interface'

export class GapRule implements ValidationRule {
  ruleId = 'gap'
  severity = 'error' as const

  run(notes: Note[]): ValidationIssue[] {
    const issues: ValidationIssue[] = []
    const byTrack = new Map<number, Note[]>()

    for (const n of notes) {
      if (!byTrack.has(n.track)) byTrack.set(n.track, [])
      byTrack.get(n.track)!.push(n)
    }

    for (const [, trackNotes] of byTrack) {
      const sorted = [...trackNotes].sort((a, b) => a.time - b.time)
      for (let i = 0; i < sorted.length - 1; i++) {
        if (sorted[i + 1].time - sorted[i].time < 0.1) {
          issues.push({
            ruleId: this.ruleId,
            severity: this.severity,
            message: `Notes too close at Track ${sorted[i].track}, ${sorted[i].time}s`,
            track: sorted[i].track,
            time: sorted[i].time,
          })
        }
      }
    }

    return issues
  }
}
