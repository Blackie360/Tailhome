import type {
  MetricsHistory,
  MetricsSnapshot,
  ServicesResponse,
  TailnetStatus
} from '@/lib/types'

async function fetchJSON<T> (path: string, signal?: AbortSignal): Promise<T> {
  const response = await fetch(path, { signal })
  if (!response.ok) {
    throw new Error(`${path} failed (${response.status})`)
  }
  return response.json() as Promise<T>
}

export function getTailnet (signal?: AbortSignal) {
  return fetchJSON<TailnetStatus>('/api/tailnet', signal)
}

export function getServices (signal?: AbortSignal) {
  return fetchJSON<ServicesResponse>('/api/services', signal)
}

export function getMetrics (signal?: AbortSignal) {
  return fetchJSON<MetricsSnapshot>('/api/metrics', signal)
}

export function getMetricsHistory (signal?: AbortSignal) {
  return fetchJSON<MetricsHistory>('/api/metrics/history', signal)
}
