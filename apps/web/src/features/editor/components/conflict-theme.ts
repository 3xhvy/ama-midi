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

const CONFLICT_BTN_IDLE: CSSProperties = {
  backgroundColor: 'var(--modal-input-bg)',
  borderColor: 'var(--modal-border)',
  color: 'var(--modal-muted)',
}

export function conflictKeepBtnStyle(active: boolean): CSSProperties {
  return active
    ? {
        backgroundColor: 'var(--conflict-keep-bg)',
        borderColor: 'var(--conflict-keep-border)',
        color: 'var(--conflict-success)',
      }
    : CONFLICT_BTN_IDLE
}

export function conflictReplaceBtnStyle(active: boolean): CSSProperties {
  return active
    ? {
        backgroundColor: 'var(--conflict-replace-bg)',
        borderColor: 'var(--conflict-replace-border)',
        color: 'var(--conflict-danger)',
      }
    : CONFLICT_BTN_IDLE
}

export function conflictKeepBulkStyle(): CSSProperties {
  return {
    backgroundColor: 'var(--conflict-keep-bg)',
    borderColor: 'var(--conflict-keep-border)',
    color: 'var(--conflict-success)',
  }
}

export function conflictReplaceBulkStyle(): CSSProperties {
  return {
    backgroundColor: 'var(--conflict-replace-bg)',
    borderColor: 'var(--conflict-replace-border)',
    color: 'var(--conflict-danger)',
  }
}
