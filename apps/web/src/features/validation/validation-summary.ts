export interface ValidationHoverIssue {
  time: number
  track?: number
  severity: 'error' | 'warning'
}

export interface ValidationIssue {
  ruleId: string
  severity: 'error' | 'warning'
  message: string
  track?: number
  time?: number
}

export interface ValidationSummary {
  errors: number
  warnings: number
  total: number
}

export function summariseIssues(issues: ValidationIssue[]): ValidationSummary {
  const errors = issues.filter((i) => i.severity === 'error').length
  const warnings = issues.filter((i) => i.severity === 'warning').length
  return { errors, warnings, total: errors + warnings }
}

export function validationIssueMatchesNote(
  issue: { time?: number; track?: number },
  note: { time: number; track: number },
): boolean {
  if (issue.time == null) return false
  return Math.abs(issue.time - note.time) < 0.15 && (issue.track == null || issue.track === note.track)
}
