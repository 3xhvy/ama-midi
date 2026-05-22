import { TRACK_MIN, TRACK_MAX, TIME_MIN, TIME_MAX } from '@ama-midi/shared'
import { snapTime, type SnapMode } from './beat-calculator'

export function xToTrack(x: number, gridWidth: number): number {
  const tw = gridWidth / TRACK_MAX
  const raw = Math.floor(x / tw) + TRACK_MIN
  return Math.max(TRACK_MIN, Math.min(TRACK_MAX, raw))
}

export function trackToX(track: number, gridWidth: number): number {
  const tw = gridWidth / TRACK_MAX
  return (track - TRACK_MIN) * tw
}

export function yToTime(
  y: number, pxPerSecond: number,
  snapMode: SnapMode = '0.1s', bpm = 120,
): number {
  const raw     = y / pxPerSecond
  const clamped = Math.max(TIME_MIN, Math.min(TIME_MAX, raw))
  const snapped = snapTime(clamped, snapMode, bpm)
  return Math.max(TIME_MIN, Math.min(TIME_MAX, snapped))
}

export function timeToY(time: number, pxPerSecond: number): number {
  return time * pxPerSecond
}

export function trackWidth(gridWidth: number): number {
  return gridWidth / TRACK_MAX
}
