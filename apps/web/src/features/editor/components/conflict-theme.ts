import type { CSSProperties } from 'react'

const TYPE_PILL_STYLE: Record<string, CSSProperties> = {
  TAP:   { backgroundColor: 'var(--conflict-type-tap-bg)', color: 'var(--conflict-type-tap-text)' },
  HOLD:  { backgroundColor: 'var(--conflict-type-hold-bg)', color: 'var(--conflict-type-hold-text)' },
  SWIPE: { backgroundColor: 'var(--conflict-type-swipe-bg)', color: 'var(--conflict-type-swipe-text)' },
}

const FALLBACK_PILL: CSSProperties = {
  backgroundColor: 'var(--conflict-type-fallback-bg)',
  color: 'var(--conflict-type-fallback-text)',
}

export function typePillStyle(type: string): CSSProperties {
  return TYPE_PILL_STYLE[type] ?? FALLBACK_PILL
}

export function conflictChipStyle(variant: 'emerald' | 'red' | 'amber'): CSSProperties {
  return {
    backgroundColor: `var(--conflict-chip-${variant}-bg)`,
    color: `var(--conflict-chip-${variant}-text)`,
  }
}
