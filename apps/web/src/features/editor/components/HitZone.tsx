import { useEffect, useRef } from 'react'
import { timeToY } from '../engine'

interface Props {
  pxPerSecond: number
  playheadTime: number
  width:        number
  containerRef: React.RefObject<HTMLDivElement>
  windowSeconds?: number
}

export function HitZone({ pxPerSecond, playheadTime, width, containerRef, windowSeconds = 0.1 }: Props) {
  const ref = useRef<HTMLDivElement>(null)
  const halfPx = windowSeconds * pxPerSecond * 0.5

  useEffect(() => {
    let raf: number
    function tick() {
      if (ref.current && containerRef.current) {
        const y = timeToY(playheadTime, pxPerSecond) - containerRef.current.scrollTop
        ref.current.style.transform = `translateY(${y - halfPx}px)`
        ref.current.style.height = `${halfPx * 2}px`
      }
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [pxPerSecond, playheadTime, containerRef, halfPx])

  return (
    <div
      ref={ref}
      className="absolute left-0 pointer-events-none"
      style={{
        top:       0,
        width,
        background: 'linear-gradient(to bottom, transparent, rgba(99,102,241,0.2), transparent)',
        zIndex:    6,
      }}
    />
  )
}
