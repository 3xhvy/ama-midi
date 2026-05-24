import type { SongDifficulty } from '../enums'
import {
  countSimultaneousPairsIn10sWindow,
  countTriplePlusInRange,
  laneJumps,
  peakNpsInRange,
} from './factors'
import type { AnalysisWarningDraft, AnalyzeNote, ChartAnalysisResult } from './types'
import { difficultyToSpeedSuggestion, TIER_LIMITS } from './tier-thresholds'

export function validateChart(
  analysis: ChartAnalysisResult,
  tier: SongDifficulty,
  speedMultiplier: number,
  chartName = '',
  noteCount = 0,
): AnalysisWarningDraft[] {
  const warnings: AnalysisWarningDraft[] = []
  const limits = TIER_LIMITS[tier]
  const avg = analysis.averageDifficultyScore
  const skipSpikes = avg < 1 || analysis.segments.every(s => s.notesPerSecond === 0)

  for (const seg of analysis.segments) {
    const startSec = seg.startTimeMs / 1000
    const endSec = seg.endTimeMs / 1000

    if (!skipSpikes && seg.difficultyScore > avg * 3) {
      warnings.push({
        code: 'DIFFICULTY_SPIKE',
        severity: 'ERROR',
        startTimeMs: seg.startTimeMs,
        endTimeMs: seg.endTimeMs,
        message: `Difficulty spike at ${formatRange(startSec, endSec)}: score ${seg.difficultyScore.toFixed(1)} (>3× average).`,
        metadata: { score: seg.difficultyScore, average: avg },
      })
    } else if (!skipSpikes && seg.difficultyScore > avg * 2 && seg.difficultyScore > tierMaxSegmentScore(tier)) {
      warnings.push({
        code: 'DIFFICULTY_SPIKE',
        severity: 'WARN',
        startTimeMs: seg.startTimeMs,
        endTimeMs: seg.endTimeMs,
        message: `Difficulty spike at ${formatRange(startSec, endSec)}: score ${seg.difficultyScore.toFixed(1)}.`,
        metadata: { score: seg.difficultyScore, average: avg },
      })
    }

    if (seg.notesPerSecond > limits.maxNpsError) {
      warnings.push({
        code: 'HIGH_DENSITY',
        severity: 'ERROR',
        startTimeMs: seg.startTimeMs,
        endTimeMs: seg.endTimeMs,
        message: `High density ${seg.notesPerSecond.toFixed(1)} notes/sec (limit ${limits.maxNpsError}).`,
        metadata: { nps: seg.notesPerSecond, limit: limits.maxNpsError },
      })
    } else if (seg.notesPerSecond > limits.maxNpsWarn) {
      warnings.push({
        code: 'HIGH_DENSITY',
        severity: 'WARN',
        startTimeMs: seg.startTimeMs,
        endTimeMs: seg.endTimeMs,
        message: `Elevated density ${seg.notesPerSecond.toFixed(1)} notes/sec.`,
        metadata: { nps: seg.notesPerSecond, limit: limits.maxNpsWarn },
      })
    }

    if (seg.offbeatRatio > limits.maxOffbeatRatio) {
      warnings.push({
        code: 'EXCESSIVE_OFFBEAT',
        severity: 'WARN',
        startTimeMs: seg.startTimeMs,
        endTimeMs: seg.endTimeMs,
        message: `Off-beat ratio ${(seg.offbeatRatio * 100).toFixed(0)}% exceeds ${tier} limit.`,
      })
    }
  }

  const suggested = difficultyToSpeedSuggestion(tier)
  if (noteCount >= 20 && Math.abs(speedMultiplier - suggested) > 0.3) {
    warnings.push({
      code: 'SPEED_TIER_MISMATCH',
      severity: 'WARN',
      message: `Speed ${speedMultiplier.toFixed(1)}× differs from suggested ${suggested.toFixed(1)}× for ${tier}.`,
      metadata: { speedMultiplier, suggested },
    })
  }

  if (/hard|expert|master/i.test(chartName) && analysis.computedDifficulty === 'EASY') {
    warnings.push({
      code: 'CHART_TOO_EASY_FOR_TIER',
      severity: 'INFO',
      message: `Chart "${chartName}" is named hard but computed EASY.`,
    })
  }

  return dedupeWarnings(warnings)
}

/** Extended validation requiring raw notes — called from analyzeChart wrapper */
export function validateChartWithNotes(
  analysis: ChartAnalysisResult,
  tier: SongDifficulty,
  speedMultiplier: number,
  notes: AnalyzeNote[],
  chartName = '',
): AnalysisWarningDraft[] {
  const warnings = validateChart(analysis, tier, speedMultiplier, chartName, notes.length)
  const limits = TIER_LIMITS[tier]

  const sorted = [...notes].sort((a, b) => a.time - b.time)
  const contentStart = sorted[0]?.time ?? 0
  const lastNote = sorted[sorted.length - 1]
  const contentEnd = lastNote
    ? lastNote.time + (lastNote.duration ?? 0)
    : 0

  for (const seg of analysis.segments) {
    const startSec = seg.startTimeMs / 1000
    const endSec = seg.endTimeMs / 1000
    const peakNps = peakNpsInRange(notes, startSec, endSec)
    if (peakNps > limits.maxNpsError) {
      warnings.push({
        code: 'HIGH_DENSITY',
        severity: 'ERROR',
        startTimeMs: seg.startTimeMs,
        endTimeMs: seg.endTimeMs,
        message: `Peak density ${peakNps.toFixed(1)} notes/sec in 2s window.`,
        metadata: { peakNps, limit: limits.maxNpsError },
      })
    }

    const doubles = countSimultaneousPairsIn10sWindow(notes, startSec)
    if (doubles > limits.maxDoublesPer10s) {
      warnings.push({
        code: 'TOO_MANY_DOUBLES',
        severity: 'WARN',
        startTimeMs: seg.startTimeMs,
        endTimeMs: seg.endTimeMs,
        message: `${doubles} double-note groups in 10s window (limit ${limits.maxDoublesPer10s}).`,
      })
    }

    const triplesInSegment = countTriplePlusInRange(notes, startSec, endSec)
    const triplesPerMinute = countTriplePlusInRange(notes, startSec, startSec + 60)
    if (tier === 'EASY' || tier === 'NORMAL') {
      if (triplesInSegment > 0) {
        warnings.push({
          code: 'TOO_MANY_TRIPLES',
          severity: 'ERROR',
          startTimeMs: seg.startTimeMs,
          endTimeMs: seg.endTimeMs,
          message: `Triple+ simultaneous notes not allowed on ${tier}.`,
        })
      }
    } else if (triplesPerMinute > 2) {
      warnings.push({
        code: 'TOO_MANY_TRIPLES',
        severity: 'WARN',
        startTimeMs: seg.startTimeMs,
        endTimeMs: Math.min(seg.endTimeMs, Math.round((startSec + 60) * 1000)),
        message: `${triplesPerMinute} triple+ groups in 60s window (limit 2/min on ${tier}).`,
      })
    }

    const segMid = (startSec + endSec) / 2
    if (seg.notesPerSecond === 0 && notes.length > 20 && segMid > contentStart && segMid < contentEnd) {
      warnings.push({
        code: 'EMPTY_SECTION',
        severity: 'INFO',
        startTimeMs: seg.startTimeMs,
        endTimeMs: seg.endTimeMs,
        message: `Empty section at ${formatRange(startSec, endSec)}.`,
      })
    }
  }

  for (const h of sorted.filter(n => n.noteType === 'HOLD' && n.duration)) {
    const holdEnd = h.time + (h.duration ?? 0)
    const overlaps = sorted.filter(
      n => n !== h && n.time >= h.time && n.time <= holdEnd && n.track !== h.track,
    )
    if (overlaps.length >= 2) {
      warnings.push({
        code: 'HOLD_OVERLAP_STRESS',
        severity: 'WARN',
        startTimeMs: Math.round(h.time * 1000),
        endTimeMs: Math.round(holdEnd * 1000),
        message: `Hold on lane ${h.track} overlaps ${overlaps.length} notes on other lanes.`,
        metadata: { holdTrack: h.track, overlapCount: overlaps.length },
      })
    }
  }

  let consecutiveBig = 0
  for (let i = 1; i < sorted.length; i++) {
    const jump = Math.abs(sorted[i].track - sorted[i - 1].track)
    if (jump >= 5) {
      consecutiveBig++
      if (consecutiveBig >= 3) {
        const atTime = sorted[i].time
        warnings.push({
          code: 'EXCESSIVE_LANE_JUMP',
          severity: 'WARN',
          startTimeMs: Math.round(atTime * 1000),
          endTimeMs: Math.round((atTime + 0.5) * 1000),
          message: `Three consecutive large lane jumps (≥5 lanes) ending at ${formatRange(atTime, atTime + 0.5)}.`,
        })
        break
      }
    } else {
      consecutiveBig = 0
    }
  }

  return dedupeWarnings(warnings)
}

function tierMaxSegmentScore(tier: SongDifficulty): number {
  const map: Record<SongDifficulty, number> = {
    EASY: 4, NORMAL: 7, HARD: 12, EXPERT: 18, MASTER: 24,
  }
  return map[tier]
}

function formatRange(startSec: number, endSec: number): string {
  const fmt = (s: number) => {
    const m = Math.floor(s / 60)
    const sec = Math.floor(s % 60)
    return `${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`
  }
  return `${fmt(startSec)}–${fmt(endSec)}`
}

function dedupeWarnings(warnings: AnalysisWarningDraft[]): AnalysisWarningDraft[] {
  const seen = new Set<string>()
  return warnings.filter(w => {
    const key = `${w.code}|${w.severity}|${w.startTimeMs ?? ''}|${w.message}`
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
}
