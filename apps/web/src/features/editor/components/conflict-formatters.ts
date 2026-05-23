export function formatTime(seconds: number): string {
  return `${seconds.toFixed(1)}s`
}

export function formatOffset(seconds: number): string {
  const rounded = Math.round(seconds * 10) / 10
  return `${rounded >= 0 ? '+' : ''}${rounded.toFixed(1)}s`
}
