import { useEffect, useRef } from 'react'
import type { OnboardingStepId } from './onboarding-flow'

interface Props {
  step: OnboardingStepId
}

const TRACK_COLORS = ['#ff3177', '#8b5cf6', '#38bdf8', '#22c55e', '#f59e0b', '#f472b6', '#14b8a6', '#a3e635']

function prefersReducedMotion(): boolean {
  return window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false
}

function drawScene(ctx: CanvasRenderingContext2D, width: number, height: number, step: OnboardingStepId, time: number) {
  ctx.clearRect(0, 0, width, height)

  const cx = width / 2
  const cy = height / 2
  const pulse = Math.sin(time / 700) * 0.5 + 0.5

  const gradient = ctx.createRadialGradient(cx, cy, 20, cx, cy, Math.max(width, height) * 0.72)
  gradient.addColorStop(0, 'rgba(91, 0, 227, 0.28)')
  gradient.addColorStop(0.5, 'rgba(20, 184, 166, 0.12)')
  gradient.addColorStop(1, 'rgba(5, 8, 22, 0)')
  ctx.fillStyle = gradient
  ctx.fillRect(0, 0, width, height)

  if (step === 'features') {
    drawFeatureOrbit(ctx, cx, cy, width, time)
  } else if (step === 'notes') {
    drawNoteLanes(ctx, width, height, time)
  } else if (step === 'profile') {
    drawProfileConstellation(ctx, cx, cy, time)
  } else if (step === 'ready') {
    drawLaunchTunnel(ctx, cx, cy, width, height, time)
  } else {
    drawTimeline(ctx, width, height, time, pulse)
  }
}

function drawTimeline(ctx: CanvasRenderingContext2D, width: number, height: number, time: number, pulse: number) {
  const top = height * 0.25
  const left = width * 0.12
  const laneHeight = height * 0.075
  const depth = height * 0.035

  for (let lane = 0; lane < 8; lane += 1) {
    const y = top + lane * laneHeight
    ctx.strokeStyle = `rgba(148, 163, 184, ${0.16 + lane * 0.015})`
    ctx.beginPath()
    ctx.moveTo(left, y)
    ctx.lineTo(width - left, y - depth * lane)
    ctx.stroke()

    const x = left + ((time / (18 + lane * 3)) % (width * 0.7))
    ctx.fillStyle = TRACK_COLORS[lane]
    ctx.shadowColor = TRACK_COLORS[lane]
    ctx.shadowBlur = 14 + pulse * 10
    ctx.fillRect(x, y - 7, 22 + lane * 2, 14)
  }
  ctx.shadowBlur = 0
}

function drawFeatureOrbit(ctx: CanvasRenderingContext2D, cx: number, cy: number, width: number, time: number) {
  const labels = ['Edit', 'Sync', 'QA', 'AI', 'Analyze']
  const radius = Math.min(width * 0.28, 150)
  ctx.strokeStyle = 'rgba(148, 163, 184, 0.22)'
  ctx.beginPath()
  ctx.ellipse(cx, cy, radius * 1.35, radius * 0.55, -0.18, 0, Math.PI * 2)
  ctx.stroke()

  ctx.fillStyle = 'rgba(255, 255, 255, 0.92)'
  ctx.font = '700 18px system-ui'
  ctx.textAlign = 'center'
  ctx.fillText('AMA-MIDI', cx, cy + 6)

  labels.forEach((label, index) => {
    const angle = time / 1500 + index * (Math.PI * 2 / labels.length)
    const x = cx + Math.cos(angle) * radius * 1.35
    const y = cy + Math.sin(angle) * radius * 0.55
    ctx.fillStyle = TRACK_COLORS[index]
    ctx.shadowColor = TRACK_COLORS[index]
    ctx.shadowBlur = 18
    ctx.beginPath()
    ctx.roundRect(x - 34, y - 17, 68, 34, 10)
    ctx.fill()
    ctx.shadowBlur = 0
    ctx.fillStyle = '#ffffff'
    ctx.font = '600 12px system-ui'
    ctx.fillText(label, x, y + 4)
  })
}

function drawNoteLanes(ctx: CanvasRenderingContext2D, width: number, height: number, time: number) {
  const left = width * 0.14
  const right = width * 0.86
  const top = height * 0.22
  const gap = height * 0.07

  for (let lane = 0; lane < 8; lane += 1) {
    const y = top + lane * gap
    ctx.strokeStyle = 'rgba(148, 163, 184, 0.18)'
    ctx.beginPath()
    ctx.moveTo(left, y)
    ctx.lineTo(right, y)
    ctx.stroke()

    const x = left + (((time / 16) + lane * 56) % (right - left))
    ctx.fillStyle = TRACK_COLORS[lane]
    ctx.shadowColor = TRACK_COLORS[lane]
    ctx.shadowBlur = 18
    ctx.beginPath()
    ctx.arc(x, y, 8, 0, Math.PI * 2)
    ctx.fill()

    if (lane % 3 === 1) {
      ctx.lineWidth = 8
      ctx.strokeStyle = TRACK_COLORS[lane]
      ctx.beginPath()
      ctx.moveTo(Math.max(left, x - 72), y)
      ctx.lineTo(x - 14, y)
      ctx.stroke()
      ctx.lineWidth = 1
    }
  }
  ctx.shadowBlur = 0
}

function drawProfileConstellation(ctx: CanvasRenderingContext2D, cx: number, cy: number, time: number) {
  const points = [
    [cx - 120, cy - 52],
    [cx - 54, cy + 60],
    [cx + 82, cy - 72],
    [cx + 128, cy + 50],
  ]
  ctx.strokeStyle = 'rgba(125, 211, 252, 0.28)'
  points.forEach(([x, y]) => {
    ctx.beginPath()
    ctx.moveTo(cx, cy)
    ctx.lineTo(x, y)
    ctx.stroke()
  })

  points.concat([[cx, cy]]).forEach(([x, y], index) => {
    const radius = index === 4 ? 34 : 18
    ctx.fillStyle = index === 4 ? '#ff3177' : TRACK_COLORS[index]
    ctx.shadowColor = ctx.fillStyle
    ctx.shadowBlur = 18 + Math.sin(time / 600 + index) * 5
    ctx.beginPath()
    ctx.arc(x, y, radius, 0, Math.PI * 2)
    ctx.fill()
  })
  ctx.shadowBlur = 0
}

function drawLaunchTunnel(ctx: CanvasRenderingContext2D, cx: number, cy: number, width: number, height: number, time: number) {
  for (let i = 0; i < 12; i += 1) {
    const scale = ((time / 1200 + i / 12) % 1)
    const w = width * (0.12 + scale * 0.82)
    const h = height * (0.08 + scale * 0.62)
    ctx.strokeStyle = `rgba(139, 92, 246, ${1 - scale})`
    ctx.lineWidth = 1 + (1 - scale) * 3
    ctx.strokeRect(cx - w / 2, cy - h / 2, w, h)
  }
  ctx.lineWidth = 1
}

export function OnboardingVisualCanvas({ step }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    let frame = 0
    const reduced = prefersReducedMotion()

    const resize = () => {
      const rect = canvas.getBoundingClientRect()
      const ratio = window.devicePixelRatio || 1
      canvas.width = Math.floor(rect.width * ratio)
      canvas.height = Math.floor(rect.height * ratio)
      ctx.setTransform(ratio, 0, 0, ratio, 0, 0)
      drawScene(ctx, rect.width, rect.height, step, reduced ? 900 : performance.now())
    }

    const tick = (now: number) => {
      const rect = canvas.getBoundingClientRect()
      drawScene(ctx, rect.width, rect.height, step, reduced ? 900 : now)
      if (!reduced) frame = requestAnimationFrame(tick)
    }

    resize()
    window.addEventListener('resize', resize)
    if (!reduced) frame = requestAnimationFrame(tick)

    return () => {
      window.removeEventListener('resize', resize)
      if (frame) cancelAnimationFrame(frame)
    }
  }, [step])

  return (
    <canvas
      ref={canvasRef}
      className="block h-full w-full rounded-lg"
      aria-hidden
    />
  )
}
