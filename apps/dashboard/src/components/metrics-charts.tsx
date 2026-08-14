import { Area, AreaChart, CartesianGrid, XAxis } from 'recharts'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from '@/components/ui/chart'
import { Empty, EmptyDescription, EmptyTitle } from '@/components/ui/empty'
import { Skeleton } from '@/components/ui/skeleton'
import { formatPercent } from '@/lib/format'
import type { MetricsHistory } from '@/lib/types'

type MetricsChartsProps = {
  history: MetricsHistory | null
}

const cpuConfig = {
  cpuPercent: { label: 'CPU', color: 'hsl(var(--chart-1))' }
} satisfies ChartConfig

const memoryConfig = {
  memoryPercent: { label: 'Memory', color: 'hsl(var(--chart-2))' }
} satisfies ChartConfig

const diskConfig = {
  diskPercent: { label: 'Disk', color: 'hsl(var(--chart-3))' }
} satisfies ChartConfig

function formatTick (timestamp: number) {
  return new Date(timestamp * 1000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
}

function MetricChart ({
  title,
  description,
  dataKey,
  config,
  points
}: {
  title: string
  description: string
  dataKey: 'cpuPercent' | 'memoryPercent' | 'diskPercent'
  config: ChartConfig
  points: MetricsHistory['points']
}) {
  const latest = points[points.length - 1]?.[dataKey] ?? 0

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between gap-3">
          <CardTitle>{title}</CardTitle>
          <span className="text-sm font-medium tabular-nums">{formatPercent(latest)}</span>
        </div>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent>
        <ChartContainer config={config} className="aspect-auto h-40 w-full">
          <AreaChart data={points} margin={{ left: 8, right: 8, top: 8 }}>
            <CartesianGrid vertical={false} />
            <XAxis
              dataKey="timestamp"
              tickLine={false}
              axisLine={false}
              tickMargin={8}
              minTickGap={24}
              tickFormatter={formatTick}
            />
            <ChartTooltip
              content={<ChartTooltipContent valueFormatter={formatPercent} labelFormatter={formatTick} />}
            />
            <Area
              type="monotone"
              dataKey={dataKey}
              stroke={`var(--color-${dataKey})`}
              fill={`var(--color-${dataKey})`}
              fillOpacity={0.18}
              strokeWidth={2}
            />
          </AreaChart>
        </ChartContainer>
      </CardContent>
    </Card>
  )
}

export function MetricsCharts ({ history }: MetricsChartsProps) {
  if (!history) {
    return (
      <div className="grid gap-4 lg:grid-cols-3">
        {['cpu', 'memory', 'disk'].map((key) => (
          <Card key={key}>
            <CardHeader>
              <Skeleton className="h-5 w-24" />
              <Skeleton className="h-4 w-40" />
            </CardHeader>
            <CardContent>
              <Skeleton className="h-40 w-full" />
            </CardContent>
          </Card>
        ))}
      </div>
    )
  }

  if (history.points.length < 2) {
    return (
      <Empty>
        <EmptyTitle>Collecting host metrics</EmptyTitle>
        <EmptyDescription>
          Graphs appear after a few samples. Enable the monitoring profile for a longer Prometheus history.
        </EmptyDescription>
      </Empty>
    )
  }

  const description = history.source === 'prometheus'
    ? 'Last hour from Prometheus'
    : 'Local samples from this host'

  return (
    <div className="grid gap-4 lg:grid-cols-3">
      <MetricChart title="CPU" description={description} dataKey="cpuPercent" config={cpuConfig} points={history.points} />
      <MetricChart title="Memory" description={description} dataKey="memoryPercent" config={memoryConfig} points={history.points} />
      <MetricChart title="Disk" description={description} dataKey="diskPercent" config={diskConfig} points={history.points} />
    </div>
  )
}
