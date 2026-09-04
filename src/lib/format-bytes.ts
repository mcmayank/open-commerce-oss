/** "1.5 GB"-style human size. Lives here (not in plans.ts) because core admin meters need it and plans are hosted-only. */
export function formatBytes(n: number): string {
  if (!Number.isFinite(n)) return 'unlimited'
  const units = ['B', 'KB', 'MB', 'GB', 'TB']
  let value = n
  let i = 0
  while (value >= 1024 && i < units.length - 1) {
    value /= 1024
    i++
  }
  const rounded = Math.round(value * 10) / 10
  return `${Number.isInteger(rounded) ? rounded : rounded.toFixed(1)} ${units[i]}`
}
