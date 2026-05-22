import { useEffect, useState } from 'react'
import { Button } from '../../components/ui'

export interface TourStep {
  target:  string
  message: string
  side?:   'top' | 'bottom' | 'left' | 'right'
}

interface Props {
  steps:      TourStep[]
  onComplete: () => void
  onSkip:     () => void
}

interface Rect { top: number; left: number; width: number; height: number }

function getTargetRect(target: string): Rect | null {
  const el = document.querySelector(`[data-tour="${target}"]`)
  if (!el) return null
  const r = el.getBoundingClientRect()
  return { top: r.top, left: r.left, width: r.width, height: r.height }
}

const PADDING = 8

export function TourOverlay({ steps, onComplete, onSkip }: Props) {
  const [step, setStep] = useState(0)
  const [rect, setRect] = useState<Rect | null>(null)

  const current = steps[step]

  useEffect(() => {
    const update = () => setRect(getTargetRect(current.target))
    update()
    window.addEventListener('resize', update)
    return () => window.removeEventListener('resize', update)
  }, [current.target])

  function next() {
    if (step + 1 >= steps.length) onComplete()
    else setStep(s => s + 1)
  }

  function back() {
    if (step > 0) setStep(s => s - 1)
  }

  const tooltipLeft = rect
    ? Math.max(8, Math.min(rect.left, window.innerWidth - 296))
    : 8
  const tooltipTop = rect
    ? rect.top + rect.height + PADDING + 8
    : window.innerHeight / 2

  return (
    <div className="fixed inset-0 z-50 pointer-events-none">
      <div
        className="absolute inset-0 bg-black/60 pointer-events-auto"
        onClick={onSkip}
      />

      {rect && (
        <div
          className="absolute rounded-lg pointer-events-none"
          style={{
            top:       rect.top    - PADDING,
            left:      rect.left   - PADDING,
            width:     rect.width  + PADDING * 2,
            height:    rect.height + PADDING * 2,
            boxShadow: '0 0 0 9999px rgba(0,0,0,0.6)',
            outline:   '2px solid var(--color-primary)',
            outlineOffset: 2,
            zIndex: 51,
          }}
        />
      )}

      <div
        className="absolute z-[52] bg-shell-surface border border-shell-border rounded-xl shadow-lg p-4 w-72 pointer-events-auto"
        style={{ top: tooltipTop, left: tooltipLeft }}
      >
        <p className="text-sm text-shell-text mb-3">{current.message}</p>
        <div className="flex items-center justify-between">
          <span className="text-xs text-shell-muted">{step + 1} / {steps.length}</span>
          <div className="flex gap-2">
            <Button variant="ghost" size="sm" onClick={onSkip}>Skip</Button>
            {step > 0 && <Button variant="secondary" size="sm" onClick={back}>Back</Button>}
            <Button variant="primary" size="sm" onClick={next}>
              {step + 1 >= steps.length ? 'Done' : 'Next'}
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}
