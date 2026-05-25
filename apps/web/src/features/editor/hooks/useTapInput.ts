import { useEffect, useRef, useState } from 'react'
import { useEditorStore } from '../../../store/editor.store'
import { snapTime } from '../engine/beat-calculator'
import { getTrackFromTapKey, isTapKey } from '../tap-keymap'

const TAP_THRESHOLD_S = 0.15

interface InFlight {
  startTime: number
}

interface Props {
  bpm: number
}

export function useTapInput({ bpm }: Props) {
  const { tapMode, isPlaying, snapMode, addTapDraftNote } = useEditorStore()
  const inFlightRef = useRef<Map<number, InFlight>>(new Map())
  const [inFlightVersion, setInFlightVersion] = useState(0)

  function bumpInFlight() {
    setInFlightVersion((v) => v + 1)
  }

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
    bumpInFlight()
  }

  const prevPlayheadRef = useRef<number>(0)
  useEffect(() => {
    return useEditorStore.subscribe((state) => {
      const current = state.playheadTime
      const prev    = prevPlayheadRef.current
      prevPlayheadRef.current = current
      if (current < prev - 0.3) {
        flushInFlight(prev)
      }
    })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    if (!tapMode || tapMode.phase !== 'recording' || !isPlaying) return

    function onKeyDown(e: KeyboardEvent) {
      if (!isTapKey(e.key)) return
      if (e.repeat) return
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return
      const track = getTrackFromTapKey(e.key)
      if (track == null) return
      e.preventDefault()
      if (inFlightRef.current.has(track)) return
      const { playheadTime, snapMode: sm } = useEditorStore.getState()
      const startTime = snapTime(playheadTime, sm, bpm)
      inFlightRef.current.set(track, { startTime })
      bumpInFlight()
    }

    function onKeyUp(e: KeyboardEvent) {
      if (!isTapKey(e.key)) return
      const track = getTrackFromTapKey(e.key)
      if (track == null) return
      e.preventDefault()
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
      bumpInFlight()
    }

    window.addEventListener('keydown', onKeyDown)
    window.addEventListener('keyup',   onKeyUp)
    return () => {
      window.removeEventListener('keydown', onKeyDown)
      window.removeEventListener('keyup',   onKeyUp)
    }
  }, [tapMode, isPlaying, bpm, snapMode, addTapDraftNote])

  useEffect(() => {
    if (!isPlaying && inFlightRef.current.size > 0) {
      const { playheadTime } = useEditorStore.getState()
      flushInFlight(playheadTime)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isPlaying])

  return { inFlightTracks: inFlightRef.current, inFlightVersion }
}
