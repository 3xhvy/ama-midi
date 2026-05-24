const CHART_VOLUME_KEY = 'ama-midi:chart-sound-volume'
const BACKING_VOLUME_KEY = 'ama-midi:backing-track-volume'

const DEFAULT = 0.75

function readVolume(key: string): number {
  try {
    const raw = localStorage.getItem(key)
    if (raw == null) return DEFAULT
    const n = Number(raw)
    if (!Number.isFinite(n)) return DEFAULT
    return Math.max(0, Math.min(1, n))
  } catch {
    return DEFAULT
  }
}

function writeVolume(key: string, value: number) {
  try {
    localStorage.setItem(key, String(Math.max(0, Math.min(1, value))))
  } catch {
    // ignore quota / private mode
  }
}

export function getChartSoundVolume(): number {
  return readVolume(CHART_VOLUME_KEY)
}

export function setChartSoundVolume(value: number) {
  writeVolume(CHART_VOLUME_KEY, value)
}

export function getBackingTrackVolume(): number {
  return readVolume(BACKING_VOLUME_KEY)
}

export function setBackingTrackVolume(value: number) {
  writeVolume(BACKING_VOLUME_KEY, value)
}

export function formatVolumePercent(value: number): string {
  return `${Math.round(value * 100)}%`
}
