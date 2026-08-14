const units = ['B', 'KiB', 'MiB', 'GiB', 'TiB'] as const

export function formatBytes (bytes: number) {
  if (!Number.isFinite(bytes) || bytes < 0) {
    return '—'
  }
  let value = bytes
  let unit = 0
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024
    unit += 1
  }
  const digits = value >= 100 || unit === 0 ? 0 : 1
  return `${value.toFixed(digits)} ${units[unit]}`
}

export function formatUptime (seconds: number) {
  if (!Number.isFinite(seconds) || seconds < 0) {
    return '—'
  }
  const total = Math.floor(seconds)
  const days = Math.floor(total / 86400)
  const hours = Math.floor((total % 86400) / 3600)
  const minutes = Math.floor((total % 3600) / 60)
  if (days > 0) {
    return `${days}d ${hours}h`
  }
  if (hours > 0) {
    return `${hours}h ${minutes}m`
  }
  return `${minutes}m`
}

export function formatPercent (value: number) {
  if (!Number.isFinite(value)) {
    return '—'
  }
  return `${Math.round(value)}%`
}

export function stripDNSName (value: string) {
  return value.replace(/\.$/, '')
}
