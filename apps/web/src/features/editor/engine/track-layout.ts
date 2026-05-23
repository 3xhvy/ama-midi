import { TRACK_MAX, TRACK_MIN } from '@ama-midi/shared'

export interface TrackLayoutInput {
  editorWidth:   number
  timeAxisWidth: number
  zoom?:         number
}

export interface TrackLayout {
  trackAreaWidth: number
  trackWidth:     number
  trackLeft:      (track: number) => number
  trackRight:     (track: number) => number
}

export function getTrackLayout({ editorWidth, timeAxisWidth }: TrackLayoutInput): TrackLayout {
  const trackAreaWidth = Math.max(0, editorWidth - timeAxisWidth)
  const trackWidth = trackAreaWidth / TRACK_MAX

  function clampedTrack(track: number) {
    return Math.max(TRACK_MIN, Math.min(TRACK_MAX, track))
  }

  return {
    trackAreaWidth,
    trackWidth,
    trackLeft:  (track) => timeAxisWidth + (clampedTrack(track) - TRACK_MIN) * trackWidth,
    trackRight: (track) => timeAxisWidth + clampedTrack(track) * trackWidth,
  }
}
