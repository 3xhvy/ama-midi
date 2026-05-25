import { useEffect, useRef } from 'react'
import { useEditorStore } from '../../../store/editor.store'
import { snapTime } from '../engine/beat-calculator'

const TAP_THRESHOLD_S = 0.15
const VALID_TRACKS    = new Set(['1', '2', '3', '4', '5', '6', '7', '8'])

interface InFlight {
  startTime: number
}

interface Props {
  bpm: number
}

export function useTapInput({ bpm }: Props) {
  const { tapMode, isPlaying, snapMode, addTapDraftNote } = useEditorStore()
  const inFlightRef = useRef<Map<number, InFlight>>(new Map())

  // Force-close all in-flight keys at a given time
  function flushInFlight(atTime: number) {
    const map = inFlightRef.current
    if (map.size === 0) return
    const state = useEditorStore.getState()
    map.forEach(({ startTime }, track) => {
      const duration = atTime - startTime
      if (duration >= TAP_THRESHOLD_S) {
        state.addTapDraftNote({
          track,
          time:     startTime,
          duration: Math.round(duration * 100) / 100,
        })
      } else {
        state.addTapDraftNote({ track, time: startTime })
      }
    })
    map.clear()
  }

  // Watch for playhead jumping backward (loop reset) — flush in-flight keys
  const prevPlayheadRef = useRef<number>(0)
  useEffect(() => {
    return useEditorStore.subscribe((state) => {
      const current = state.playheadTime
      const prev    = prevPlayheadRef.current
      prevPlayheadRef.current = current
      // Playhead jumped backward by more than 0.3s → loop reset
      if (current < prev - 0.3) {
        flushInFlight(prev)
      }
    })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Attach keydown/keyup listeners when tap mode is active and playing
  useEffect(() => {
    if (!tapMode || !isPlaying) return

    function onKeyDown(e: KeyboardEvent) {
      if (!VALID_TRACKS.has(e.key)) return
      if (e.repeat) return
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return
      const track = parseInt(e.key)
      if (inFlightRef.current.has(track)) return
      const { playheadTime, snapMode: sm } = useEditorStore.getState()
      const startTime = snapTime(playheadTime, sm, bpm)
      inFlightRef.current.set(track, { startTime })
    }

    function onKeyUp(e: KeyboardEvent) {
      if (!VALID_TRACKS.has(e.key)) return
      const track = parseInt(e.key)
      const entry = inFlightRef.current.get(track)
      if (!entry) return
      inFlightRef.current.delete(track)
      const { playheadTime, snapMode: sm } = useEditorStore.getState()
      const endTime  = snapTime(playheadTime, sm, bpm)
      const duration = endTime - entry.startTime
      if (duration >= TAP_THRESHOLD_S) {
        addTapDraftNote({
          track,
          time:     entry.startTime,
          duration: Math.round(duration * 100) / 100,
        })
      } else {
        addTapDraftNote({ track, time: entry.startTime })
      }
    }

    window.addEventListener('keydown', onKeyDown)
    window.addEventListener('keyup',   onKeyUp)
    return () => {
      window.removeEventListener('keydown', onKeyDown)
      window.removeEventListener('keyup',   onKeyUp)
    }
  }, [tapMode, isPlaying, bpm, snapMode, addTapDraftNote])

  // Flush all in-flight keys when playback stops
  useEffect(() => {
    if (!isPlaying && inFlightRef.current.size > 0) {
      const { playheadTime } = useEditorStore.getState()
      flushInFlight(playheadTime)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isPlaying])

  return { inFlightTracks: inFlightRef.current }
}
