import { useCallback, useEffect, useState } from 'react'
import { RefreshCw } from 'lucide-react'
import { HeaderMetrics } from '@/components/header-metrics'
import { MetricsCharts } from '@/components/metrics-charts'
import { ServiceGrid } from '@/components/service-grid'
import { TailnetPanel } from '@/components/tailnet-panel'
import { ThemeToggle } from '@/components/theme-toggle'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { TooltipProvider } from '@/components/ui/tooltip'
import { getMetrics, getMetricsHistory, getServices, getTailnet } from '@/lib/api'
import type { MetricsHistory, MetricsSnapshot, ServicesResponse, TailnetStatus } from '@/lib/types'

const emptyTailnet: TailnetStatus = {
  state: '',
  available: false,
  message: 'Could not reach the Tailscale API.',
  tailnet: { name: '', magicDNSSuffix: '', magicDNSEnabled: false },
  self: { hostname: '', dnsName: '', online: false, os: '', ips: [] },
  peers: [],
  counts: { total: 0, online: 0, offline: 0 }
}

const emptyServices: ServicesResponse = { groups: [], bookmarks: [] }
const pollMs = 5000
const themeStorageKey = 'tailhome-theme'

function readTheme () {
  if (typeof window === 'undefined') {
    return true
  }
  const stored = window.localStorage.getItem(themeStorageKey)
  if (stored === 'light') {
    return false
  }
  if (stored === 'dark') {
    return true
  }
  return true
}

export function App () {
  const [isDark, setIsDark] = useState(readTheme)
  const [query, setQuery] = useState('')
  const [tailnet, setTailnet] = useState<TailnetStatus | null>(null)
  const [services, setServices] = useState<ServicesResponse | null>(null)
  const [metrics, setMetrics] = useState<MetricsSnapshot | null>(null)
  const [history, setHistory] = useState<MetricsHistory | null>(null)

  useEffect(() => {
    document.documentElement.classList.toggle('dark', isDark)
    window.localStorage.setItem(themeStorageKey, isDark ? 'dark' : 'light')
  }, [isDark])

  const refresh = useCallback(async (signal?: AbortSignal) => {
    const [nextTailnet, nextServices, nextMetrics, nextHistory] = await Promise.all([
      getTailnet(signal).catch(() => emptyTailnet),
      getServices(signal).catch(() => emptyServices),
      getMetrics(signal).catch(() => null),
      getMetricsHistory(signal).catch(() => ({ source: 'local' as const, points: [] }))
    ])
    if (signal?.aborted) {
      return
    }
    setTailnet(nextTailnet)
    setServices(nextServices)
    setMetrics(nextMetrics)
    setHistory(nextHistory)
  }, [])

  useEffect(() => {
    const controller = new AbortController()
    void refresh(controller.signal)
    const timer = window.setInterval(() => {
      void refresh()
    }, pollMs)
    return () => {
      controller.abort()
      window.clearInterval(timer)
    }
  }, [refresh])

  return (
    <TooltipProvider>
      <div className="min-h-svh bg-background text-foreground">
        <header className="border-b">
          <div className="mx-auto flex w-full max-w-6xl flex-col gap-4 px-4 py-4 lg:flex-row lg:items-center">
            <div className="flex items-center gap-3">
              <div className="flex size-9 items-center justify-center rounded-lg border text-sm font-bold">
                TH
              </div>
              <div>
                <p className="text-sm font-semibold">TailHome</p>
                <p className="text-xs text-muted-foreground">Private homelab</p>
              </div>
            </div>
            <HeaderMetrics metrics={metrics} />
            <div className="flex flex-1 items-center gap-3 lg:justify-end">
              <Input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search..."
                aria-label="Search services"
                className="max-w-md"
              />
              <Button variant="ghost" size="icon" onClick={() => { void refresh() }} aria-label="Refresh">
                <RefreshCw />
              </Button>
              <ThemeToggle isDark={isDark} onCheckedChange={setIsDark} />
            </div>
          </div>
        </header>
        <main className="mx-auto flex w-full max-w-6xl flex-col gap-8 px-4 py-6">
          <TailnetPanel tailnet={tailnet} />
          <MetricsCharts history={history} />
          <ServiceGrid
            groups={services?.groups ?? []}
            bookmarks={services?.bookmarks ?? []}
            query={query}
            isLoading={services === null}
          />
        </main>
      </div>
    </TooltipProvider>
  )
}
