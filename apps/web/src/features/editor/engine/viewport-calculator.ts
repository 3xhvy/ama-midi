import { TIME_MAX } from '@ama-midi/shared'

const PREFETCH_BUFFER = 5 // seconds
const QUERY_BUCKET_SECONDS = 20

export function getVisibleTimeRange(
  scrollTop: number,
  viewportHeight: number,
  pxPerSecond: number,
): { timeFrom: number; timeTo: number } {
  return {
    timeFrom: scrollTop / pxPerSecond,
    timeTo: (scrollTop + viewportHeight) / pxPerSecond,
  }
}

export function getPrefetchTimeRange(
  scrollTop: number,
  viewportHeight: number,
  pxPerSecond: number,
): { timeFrom: number; timeTo: number } {
  const visible = getVisibleTimeRange(scrollTop, viewportHeight, pxPerSecond)
  const timeFrom = Math.floor((visible.timeFrom - PREFETCH_BUFFER) / QUERY_BUCKET_SECONDS) * QUERY_BUCKET_SECONDS
  const timeTo = Math.ceil((visible.timeTo + PREFETCH_BUFFER) / QUERY_BUCKET_SECONDS) * QUERY_BUCKET_SECONDS

  return {
    timeFrom: Math.max(0, timeFrom),
    timeTo: Math.min(TIME_MAX, timeTo),
  }
}

export function getTotalHeight(pxPerSecond: number): number {
  return TIME_MAX * pxPerSecond
}
