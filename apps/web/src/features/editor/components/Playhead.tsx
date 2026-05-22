import { timeToY } from '../engine'

export interface PlayheadProps {
  time:        number
  pxPerSecond: number
  scrollTop:   number
}

export function Playhead({ time, pxPerSecond, scrollTop }: PlayheadProps) {
  const y = timeToY(time, pxPerSecond) - scrollTop
  return (
    <div
      className="absolute left-0 right-0 pointer-events-none z-10 transition-transform duration-100 ease-linear"
      style={{ top: y }}
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
