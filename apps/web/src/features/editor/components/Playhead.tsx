import { useEffect, useRef } from 'react'
import { useEditorStore } from '../../../store/editor.store'
import { timeToY } from '../engine'

export interface PlayheadProps {
  pxPerSecond: number
  containerRef: React.RefObject<HTMLDivElement>
}

export function Playhead({ pxPerSecond, containerRef }: PlayheadProps) {
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    let raf: number
    function tick() {
      if (ref.current && containerRef.current) {
        const t = useEditorStore.getState().playheadTime
        const y = timeToY(t, pxPerSecond) - containerRef.current.scrollTop
        ref.current.style.transform = `translateY(${y}px)`
      }
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [pxPerSecond, containerRef])

  return (
    <div
      ref={ref}
      className="absolute left-0 right-0 top-0 pointer-events-none z-10"
    >
      <div
        className="absolute -left-0 -top-[4px] w-0 h-0"
        style={{
          borderTop:    '4px solid transparent',
          borderBottom: '4px solid transparent',
          borderLeft:   '6px solid #6C63FF',
        }}
      />
      <div className="h-[2px] bg-primary w-full" />
    </div>
  )
}
