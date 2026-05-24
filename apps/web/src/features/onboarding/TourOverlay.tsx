import { useEffect, useRef, useState } from 'react'
import { Button } from '../../components/ui'
import type { TourContextData, TourPhase, TourRuntimeContext } from './tour-context'
import { delay } from './tour-context'
import { phaseLabel } from './product-tour-steps'

export interface TourStep {
  target:  string
  message: string
  phase?:  TourPhase
  side?:   'top' | 'bottom' | 'left' | 'right'
  route?:  string | ((ctx: TourContextData) => string | undefined)
  prepare?: (ctx: TourRuntimeContext) => void | Promise<void>
}

interface Props {
  steps:       TourStep[]
  stepIndex:   number
  stepReady:   boolean
  onNext:      () => void
  onBack:      () => void
  onSkip:      () => void
  onComplete:  () => void
}

interface Rect { top: number; left: number; width: number; height: number }

const PADDING = 8
const TOOLTIP_WIDTH = 288
const TOOLTIP_EST_HEIGHT = 160
const VIEWPORT_MARGIN = 12
const SCROLL_WAIT_MS = 380
const SPOTLIGHT_EASE = 'cubic-bezier(0.4, 0, 0.2, 1)'
const SPOTLIGHT_TRANSITION = `top 320ms ${SPOTLIGHT_EASE}, left 320ms ${SPOTLIGHT_EASE}, width 320ms ${SPOTLIGHT_EASE}, height 320ms ${SPOTLIGHT_EASE}`

function getTargetElement(target: string): Element | null {
  return document.querySelector(`[data-tour="${target}"]`)
}

function measureTargetRect(target: string): Rect | null {
  const el = getTargetElement(target)
  if (!el) return null
  const r = el.getBoundingClientRect()
  if (r.width <= 0 || r.height <= 0) return null
  return { top: r.top, left: r.left, width: r.width, height: r.height }
}

function holeFromRect(rect: Rect) {
  return {
    top:    rect.top - PADDING,
    left:   rect.left - PADDING,
    width:  rect.width + PADDING * 2,
    height: rect.height + PADDING * 2,
  }
}

function computeTooltipPosition(rect: Rect | null): { top: number; left: number } {
  if (!rect) {
    return {
      top: Math.max(VIEWPORT_MARGIN, window.innerHeight / 2 - TOOLTIP_EST_HEIGHT / 2),
      left: Math.max(VIEWPORT_MARGIN, (window.innerWidth - TOOLTIP_WIDTH) / 2),
    }
  }

  const left = Math.max(
    VIEWPORT_MARGIN,
    Math.min(rect.left, window.innerWidth - TOOLTIP_WIDTH - VIEWPORT_MARGIN),
  )

  const spaceBelow = window.innerHeight - (rect.top + rect.height) - VIEWPORT_MARGIN
  const spaceAbove = rect.top - VIEWPORT_MARGIN

  if (spaceBelow >= TOOLTIP_EST_HEIGHT) {
    return { top: rect.top + rect.height + PADDING + VIEWPORT_MARGIN, left }
  }
  if (spaceAbove >= TOOLTIP_EST_HEIGHT) {
    return { top: rect.top - TOOLTIP_EST_HEIGHT - VIEWPORT_MARGIN, left }
  }
  return {
    top: Math.max(VIEWPORT_MARGIN, window.innerHeight - TOOLTIP_EST_HEIGHT - VIEWPORT_MARGIN),
    left,
  }
}

async function focusTarget(target: string, smooth: boolean): Promise<Rect | null> {
  getTargetElement(target)?.scrollIntoView({
    block: 'center',
    inline: 'nearest',
    behavior: smooth ? 'smooth' : 'auto',
  })

  if (smooth) {
    await delay(SCROLL_WAIT_MS)
  } else {
    await new Promise<void>((resolve) => {
      requestAnimationFrame(() => requestAnimationFrame(() => resolve()))
    })
  }

  return measureTargetRect(target)
}

export function TourOverlay({
  steps, stepIndex, stepReady, onNext, onBack, onSkip, onComplete,
}: Props) {
  const [displayRect, setDisplayRect] = useState<Rect | null>(null)
  const [contentVisible, setContentVisible] = useState(false)
  const firstStepRef = useRef(true)
  const current = steps[stepIndex]
  const label = phaseLabel(steps, stepIndex)

  useEffect(() => {
    if (!current) return

    if (!stepReady) {
      setContentVisible(false)
      return
    }

    let cancelled = false
    const smooth = !firstStepRef.current
    firstStepRef.current = false

    setContentVisible(false)

    void focusTarget(current.target, smooth).then((next) => {
      if (cancelled) return
      setDisplayRect(next)
      requestAnimationFrame(() => {
        if (!cancelled) setContentVisible(true)
      })
    })

    return () => { cancelled = true }
  }, [current?.target, stepIndex, stepReady])

  useEffect(() => {
    if (!stepReady || !current) return

    const update = () => setDisplayRect(measureTargetRect(current.target))
    window.addEventListener('resize', update)
    window.addEventListener('scroll', update, true)
    return () => {
      window.removeEventListener('resize', update)
      window.removeEventListener('scroll', update, true)
    }
  }, [stepReady, current?.target])

  if (!current) return null

  function next() {
    if (stepIndex + 1 >= steps.length) onComplete()
    else onNext()
  }

  const hasSpotlight = displayRect !== null
  const hole = displayRect ? holeFromRect(displayRect) : null
  const { top: tooltipTop, left: tooltipLeft } = computeTooltipPosition(displayRect)
  const chromeOpacity = stepReady ? 1 : 0.55

  return (
    <div
      className="fixed inset-0 z-[100] pointer-events-none"
      style={{ transition: 'opacity 220ms ease', opacity: chromeOpacity }}
    >
      {hasSpotlight && hole ? (
        <div
          className="absolute rounded-lg pointer-events-auto"
          style={{
            top:           hole.top,
            left:          hole.left,
            width:         hole.width,
            height:        hole.height,
            boxShadow:     '0 0 0 9999px rgba(0, 0, 0, 0.6)',
            outline:       '2px solid var(--color-primary)',
            outlineOffset: 2,
            zIndex:        101,
            transition:    SPOTLIGHT_TRANSITION,
          }}
        />
      ) : (
        <div className="fixed inset-0 bg-black/60 pointer-events-auto" aria-hidden />
      )}

      <div
        className="absolute z-[102] bg-shell-surface border border-shell-border rounded-xl shadow-lg p-4 pointer-events-auto"
        style={{
          top: tooltipTop,
          left: tooltipLeft,
          width: TOOLTIP_WIDTH,
          transition: SPOTLIGHT_TRANSITION,
          opacity: contentVisible && stepReady ? 1 : 0,
        }}
      >
        <div key={stepIndex} className="tour-step-content">
          {label && (
            <p className="mb-1 text-[10px] font-medium uppercase tracking-wide text-primary">{label}</p>
          )}
          <p className="text-sm text-shell-text mb-3">{current.message}</p>
        </div>
        {!contentVisible && stepReady && (
          <p className="mb-3 text-xs text-shell-muted">Loading…</p>
        )}
        <div className="flex items-center justify-between">
          <span className="text-xs text-shell-muted">{stepIndex + 1} / {steps.length}</span>
          <div className="flex gap-2">
            <Button variant="ghost" size="sm" onClick={onSkip}>Skip</Button>
            {stepIndex > 0 && (
              <Button variant="secondary" size="sm" onClick={onBack} disabled={!stepReady || !contentVisible}>Back</Button>
            )}
            <Button variant="primary" size="sm" onClick={next} disabled={!stepReady || !contentVisible}>
              {stepIndex + 1 >= steps.length ? 'Done' : 'Next'}
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}
