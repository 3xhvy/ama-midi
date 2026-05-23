import { beatDuration } from '../snap'
import type { AnalyzeNote } from './types'

const SIMULTANEOUS_EPS = 0.05

export function computeNpsOverTime(
  notes: AnalyzeNote[], windowSeconds = 2, resolution = 0.5, maxTime = 300,
): Array<{ time: number; nps: number }> {
  const result: Array<{ time: number; nps: number }> = []
  for (let t = 0; t <= maxTime; t = +(t + resolution).toFixed(3)) {
    const count = notes.filter(
      n => n.time >= t - windowSeconds / 2 && n.time < t + windowSeconds / 2,
    ).length
    result.push({ time: t, nps: count / windowSeconds })
  }
  return result
}

export function maxCombo(notes: AnalyzeNote[]): number {
  const sorted = [...notes].sort((a, b) => a.time - b.time)
  let max = 0, streak = 0, last = -Infinity
  for (const n of sorted) {
    if (n.time - last <= 2) streak++
    else streak = 1
    max = Math.max(max, streak)
    last = n.time
  }
  return max
}

function beatPhase(time: number, bpm: number): number {
  const bd = beatDuration(bpm)
  return (time % bd) / bd
}

export function syncopationWeight(time: number, bpm: number): number {
  const phase = beatPhase(time, bpm)
  const dist = Math.min(
    Math.abs(phase), Math.abs(phase - 0.5),
    Math.abs(phase - 0.25), Math.abs(phase - 0.75),
  )
  if (dist < 0.05 / beatDuration(bpm)) return 0
  if (dist < 0.08) return 0.5
  return 1
}

export function laneJumps(notes: AnalyzeNote[]): number[] {
  const sorted = [...notes].sort((a, b) => a.time - b.time || a.track - b.track)
  const jumps: number[] = []
  for (let i = 1; i < sorted.length; i++) {
    jumps.push(Math.abs(sorted[i].track - sorted[i - 1].track))
  }
  return jumps
}

export function simultaneousGroups(notes: AnalyzeNote[]): number[] {
  const sorted = [...notes].sort((a, b) => a.time - b.time)
  const sizes: number[] = []
  let i = 0
  while (i < sorted.length) {
    let j = i + 1
    while (j < sorted.length && Math.abs(sorted[j].time - sorted[i].time) <= SIMULTANEOUS_EPS) j++
    const size = j - i
    if (size > 1) sizes.push(size)
    i = j
  }
  return sizes
}

export function patternEntropy(notes: AnalyzeNote[]): number {
  const sorted = [...notes].sort((a, b) => a.time - b.time)
  if (sorted.length < 2) return 0
  const counts = new Map<string, number>()
  for (let i = 1; i < sorted.length; i++) {
    const key = `${sorted[i - 1].track}->${sorted[i].track}`
    counts.set(key, (counts.get(key) ?? 0) + 1)
  }
  const total = [...counts.values()].reduce((a, b) => a + b, 0)
  let entropy = 0
  for (const c of counts.values()) {
    const p = c / total
    entropy -= p * Math.log2(p)
  }
  const maxEntropy = Math.log2(Math.max(counts.size, 2))
  return maxEntropy > 0 ? entropy / maxEntropy : 0
}

export function surpriseScore(notes: AnalyzeNote[]): number {
  if (notes.length < 16) return 0
  const sorted = [...notes].sort((a, b) => a.time - b.time)
  const windowTracks = sorted.slice(0, 8).map(n => n.track)
  let matches = 0, total = 0
  for (let start = 8; start + 8 <= sorted.length; start += 4) {
    const next = sorted.slice(start, start + 8).map(n => n.track)
    for (let k = 0; k < 8; k++) {
      total++
      if (windowTracks[k] === next[k]) matches++
    }
  }
  return total > 0 ? 1 - matches / total : 0
}

export function holdOverlapStress(notes: AnalyzeNote[]): number {
  const holds = notes.filter(n => n.noteType === 'HOLD' && n.duration)
  if (!holds.length) return 0
  let stress = 0
  for (const h of holds) {
    const end = h.time + (h.duration ?? 0)
    const overlaps = notes.filter(
      n => n !== h && n.time >= h.time && n.time <= end && n.track !== h.track,
    )
    if (overlaps.length >= 2) stress++
  }
  return stress / holds.length
}

export function segmentMetrics(
  notes: AnalyzeNote[], startSec: number, endSec: number, bpm: number,
) {
  const seg = notes.filter(n => n.time >= startSec && n.time < endSec)
  const duration = endSec - startSec
  const nps = duration > 0 ? seg.length / duration : 0
  const jumps = laneJumps(seg)
  const avgJump = jumps.length ? jumps.reduce((a, b) => a + b, 0) / jumps.length : 0
  const offbeat = seg.length
    ? seg.reduce((s, n) => s + syncopationWeight(n.time, bpm), 0) / seg.length
    : 0
  const holdRatio = seg.length ? seg.filter(n => n.noteType === 'HOLD').length / seg.length : 0
  const simGroups = simultaneousGroups(seg)
  const simRatio = seg.length ? simGroups.length / seg.length : 0
  const complexity = patternEntropy(seg)
  return { nps, avgJump, offbeat, holdRatio, simRatio, complexity, noteCount: seg.length }
}

export function computeSegmentScore(
  m: ReturnType<typeof segmentMetrics>,
  speedMultiplier: number,
  surprise: number,
): number {
  return (
    m.nps * 2.0
    + m.avgJump * 1.5
    + m.offbeat * 3.0
    + m.holdRatio * 2.0
    + m.simRatio * 3.0
    + m.complexity * 2.5
    + speedMultiplier * 2.0
    + surprise * 1.5
  )
}

export function peakNpsInRange(
  notes: AnalyzeNote[], startSec: number, endSec: number, windowSeconds = 2,
): number {
  let peak = 0
  for (let t = startSec; t < endSec; t += 0.5) {
    const count = notes.filter(
      n => n.time >= t - windowSeconds / 2 && n.time < t + windowSeconds / 2,
    ).length
    peak = Math.max(peak, count / windowSeconds)
  }
  return peak
}

export function countSimultaneousPairsInRange(
  notes: AnalyzeNote[], startSec: number, endSec: number,
): number {
  const seg = notes.filter(n => n.time >= startSec && n.time < endSec)
  return simultaneousGroups(seg).filter(s => s === 2).length
}

export function countTriplePlusInRange(
  notes: AnalyzeNote[], startSec: number, endSec: number,
): number {
  const seg = notes.filter(n => n.time >= startSec && n.time < endSec)
  return simultaneousGroups(seg).filter(s => s >= 3).length
}
