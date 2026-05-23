export const BREAKPOINTS = {
  mobile: 768,
  tablet: 1280,
} as const

export const PANEL_WIDTHS = {
  left: 240,
  leftCollapsed: 48,
  right: 280,
  historyOverlay: 320,
} as const

export const TOPBAR_HEIGHT = 52
export const BOTTOMBAR_HEIGHT = 48
export const TRACK_HEADER_HEIGHT = 40
export const TIME_AXIS_WIDTH = 40

/** Minimum lane width so 16px notes do not overlap adjacent tracks. */
export const MIN_TRACK_WIDTH_PX = 48
