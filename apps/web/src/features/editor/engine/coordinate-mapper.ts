import { TRACK_MIN, TRACK_MAX, TIME_MIN, TIME_MAX, SNAP_RESOLUTION } from '@ama-midi/shared'

export function xToTrack(x: number, gridWidth: number): number {
  const trackWidth = gridWidth / TRACK_MAX
  const raw = Math.floor(x / trackWidth) + TRACK_MIN
  return Math.max(TRACK_MIN, Math.min(TRACK_MAX, raw))
}

export function trackToX(track: number, gridWidth: number): number {
  const trackWidth = gridWidth / TRACK_MAX
  return (track - TRACK_MIN) * trackWidth
}

export function yToTime(y: number, pxPerSecond: number): number {
  const raw = y / pxPerSecond
  const snapped = Math.round(raw / SNAP_RESOLUTION) * SNAP_RESOLUTION
  return Math.max(TIME_MIN, Math.min(TIME_MAX, Math.round(snapped * 10) / 10))
}

export function timeToY(time: number, pxPerSecond: number): number {
  return time * pxPerSecond
}

export function trackWidth(gridWidth: number): number {
  return gridWidth / TRACK_MAX
}
