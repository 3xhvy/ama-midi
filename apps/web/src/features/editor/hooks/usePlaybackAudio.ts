import { useEffect, useRef } from 'react'
import type { Note } from '@ama-midi/shared'
import { useEditorStore } from '../../../store/editor.store'
import { NoteSynth } from '../audio/note-synth'
import { getSharedNoteSynth, setChartSoundVolume, stopChartSounds } from '../audio/chart-audio'
import { notesCrossedByPlayhead } from '../audio/playback-notes'

interface Options {
  notes: Note[]
  mutedTracks: Set<number>
  enabled?: boolean
  volume?: number
}

export function usePlaybackAudio({ notes, mutedTracks, enabled = true, volume = 0.75 }: Options) {
  const isPlaying = useEditorStore((s) => s.isPlaying)
  const playheadTime = useEditorStore((s) => s.playheadTime)
  const synthRef = useRef<NoteSynth | null>(null)
  const prevTimeRef = useRef(0)
  const wasPlayingRef = useRef(false)

  useEffect(() => {
    synthRef.current = getSharedNoteSynth()
  }, [])

  useEffect(() => {
    setChartSoundVolume(enabled ? volume : 0)
  }, [enabled, volume])

  useEffect(() => {
    if (isPlaying) {
      setChartSoundVolume(enabled ? volume : 0)
      return
    }
    stopChartSounds()
  }, [isPlaying, enabled, volume])

  useEffect(() => {
    if (!enabled || !isPlaying) {
      if (!isPlaying) prevTimeRef.current = playheadTime
      wasPlayingRef.current = isPlaying
      return
    }

    const synth = synthRef.current
    if (!synth) return

    if (isPlaying && !wasPlayingRef.current) {
      prevTimeRef.current = playheadTime
    }

    const crossed = notesCrossedByPlayhead(notes, prevTimeRef.current, playheadTime, mutedTracks)
    for (const note of crossed) {
      void synth.playNote({
        track: note.track,
        noteType: note.noteType,
        duration: note.duration,
      })
    }

    prevTimeRef.current = playheadTime
    wasPlayingRef.current = isPlaying
  }, [enabled, isPlaying, playheadTime, notes, mutedTracks])
}
