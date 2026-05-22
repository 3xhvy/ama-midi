import { useEffect, useRef } from 'react'
import { useEditorStore } from '../../../store/editor.store'
import { TIME_MAX } from '@ama-midi/shared'

export function usePlayback() {
  const { isPlaying, setPlayheadTime, setPlaying } = useEditorStore()
  const rafRef      = useRef<number | null>(null)
  const lastTimeRef = useRef<number | null>(null)

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
      }
      const delta = (timestamp - lastTimeRef.current) / 1000
      lastTimeRef.current = timestamp

      const next = useEditorStore.getState().playheadTime + delta
      if (next >= TIME_MAX) {
        setPlayheadTime(TIME_MAX)
        setPlaying(false)
        return
      }
      setPlayheadTime(Math.round(next * 10) / 10)
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
  }, [isPlaying, setPlayheadTime, setPlaying])
}
