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
