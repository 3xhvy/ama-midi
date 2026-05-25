import { useEffect, useRef } from 'react'
import { useEditorStore } from '../../../store/editor.store'
import { TIME_MAX } from '@ama-midi/shared'

export function usePlayback() {
  const { isPlaying, setPlayheadTime, setPlaying, setTapPhase } = useEditorStore()
  const rafRef      = useRef<number | null>(null)
  const lastTimeRef = useRef<number | null>(null)

  // Reset clock when tab regains focus — prevents playhead jumping forward
  useEffect(() => {
    function onVisibility() {
      if (document.visibilityState === 'visible') lastTimeRef.current = null
    }
    document.addEventListener('visibilitychange', onVisibility)
    return () => document.removeEventListener('visibilitychange', onVisibility)
  }, [])

  useEffect(() => {
    if (!isPlaying) {
      if (rafRef.current !== null) {
        cancelAnimationFrame(rafRef.current)
        rafRef.current = null
        lastTimeRef.current = null
      }
      return
    }

    function tick(timestamp: number) {
      if (lastTimeRef.current === null) {
        lastTimeRef.current = timestamp
        rafRef.current = requestAnimationFrame(tick)
        return
      }
      // Cap delta at 100ms to absorb any remaining stale frames
      const delta = Math.min((timestamp - lastTimeRef.current) / 1000, 0.1)
      lastTimeRef.current = timestamp

      const state     = useEditorStore.getState()
      const loopRange = state.loopRange
      const current   = state.playheadTime
      const next      = current + delta

      if (loopRange && next >= loopRange.end) {
        const tapMode = state.tapMode
        if (tapMode?.phase === 'recording') {
          // End of tap pass — pause and prompt to apply or re-record
          setPlayheadTime(loopRange.end)
          setPlaying(false)
          setTapPhase('review')
          return
        }
        // Normal loop playback (non-tap)
        setPlayheadTime(loopRange.start)
        rafRef.current = requestAnimationFrame(tick)
        return
      }

      if (next >= TIME_MAX) {
        setPlayheadTime(TIME_MAX)
        setPlaying(false)
        return
      }

      setPlayheadTime(Math.round(next * 100) / 100)
      rafRef.current = requestAnimationFrame(tick)
    }

    rafRef.current = requestAnimationFrame(tick)

    return () => {
      if (rafRef.current !== null) {
        cancelAnimationFrame(rafRef.current)
        rafRef.current = null
        lastTimeRef.current = null
      }
    }
  }, [isPlaying, setPlayheadTime, setPlaying, setTapPhase])
}
