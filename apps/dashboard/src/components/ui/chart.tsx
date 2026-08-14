import * as React from 'react'
import * as RechartsPrimitive from 'recharts'
import { cn } from '@/lib/utils'

export type ChartConfig = Record<
  string,
  {
    label?: React.ReactNode
    color?: string
  }
>

type ChartContextValue = {
  config: ChartConfig
}

const ChartContext = React.createContext<ChartContextValue | null>(null)

function useChart () {
  const context = React.useContext(ChartContext)
  if (!context) {
    throw new Error('useChart must be used within a ChartContainer')
  }
  return context
}

const ChartContainer = React.forwardRef<
  HTMLDivElement,
  React.ComponentProps<'div'> & {
    config: ChartConfig
    children: React.ComponentProps<typeof RechartsPrimitive.ResponsiveContainer>['children']
  }
>(({ id, className, children, config, ...props }, ref) => {
  const uniqueId = React.useId()
  const chartId = `chart-${id ?? uniqueId.replace(/:/g, '')}`

  return (
    <ChartContext.Provider value={{ config }}>
      <div
        data-chart={chartId}
        ref={ref}
        className={cn(
          'flex aspect-video justify-center text-xs [&_.recharts-cartesian-axis-tick_text]:fill-muted-foreground [&_.recharts-cartesian-grid_line[stroke="#ccc"]]:stroke-border/50 [&_.recharts-curve.recharts-tooltip-cursor]:stroke-border [&_.recharts-dot[stroke="#fff"]]:stroke-transparent [&_.recharts-layer]:outline-none [&_.recharts-polar-grid_[stroke="#ccc"]]:stroke-border [&_.recharts-radial-bar-background-sector]:fill-muted [&_.recharts-rectangle.recharts-tooltip-cursor]:fill-muted [&_.recharts-reference-line_[stroke="#ccc"]]:stroke-border [&_.recharts-sector[stroke="#fff"]]:stroke-transparent [&_.recharts-sector]:outline-none [&_.recharts-surface]:outline-none',
          className
        )}
        {...props}
      >
        <ChartStyle id={chartId} config={config} />
        <RechartsPrimitive.ResponsiveContainer>
          {children}
        </RechartsPrimitive.ResponsiveContainer>
      </div>
    </ChartContext.Provider>
  )
})
ChartContainer.displayName = 'Chart'

function ChartStyle ({ id, config }: { id: string, config: ChartConfig }) {
  const colorConfig = Object.entries(config).filter(([, item]) => item.color)
  if (!colorConfig.length) {
    return null
  }

  const rules = colorConfig
    .map(([key, item]) => `  --color-${key}: ${item.color};`)
    .join('\n')

  return (
    <style
      dangerouslySetInnerHTML={{
        __html: `[data-chart=${id}] {\n${rules}\n}`
      }}
    />
  )
}

const ChartTooltip = RechartsPrimitive.Tooltip

function ChartTooltipContent ({
  active,
  payload,
  className,
  hideLabel = false,
  valueFormatter,
  labelFormatter
}: {
  active?: boolean
  payload?: Array<{
    dataKey?: string | number
    name?: string
    value?: number | string
    payload?: { timestamp?: number }
  }>
  className?: string
  hideLabel?: boolean
  valueFormatter?: (value: number) => string
  labelFormatter?: (timestamp: number) => string
}) {
  const { config } = useChart()

  if (!active || !payload?.length) {
    return null
  }

  const timestamp = payload[0]?.payload?.timestamp
  const label = timestamp != null && labelFormatter
    ? labelFormatter(timestamp)
    : timestamp != null
      ? String(timestamp)
      : ''

  return (
    <div className={cn('grid min-w-32 items-start gap-1.5 rounded-lg border bg-background px-2.5 py-1.5 text-xs shadow-xl', className)}>
      {hideLabel || !label ? null : <div className="font-medium">{label}</div>}
      <div className="grid gap-1.5">
        {payload.map((item) => {
          const key = String(item.dataKey ?? item.name ?? 'value')
          const itemConfig = config[key]
          const numeric = Number(item.value)
          const value = valueFormatter && Number.isFinite(numeric) ? valueFormatter(numeric) : item.value
          return (
            <div key={key} className="flex items-center justify-between gap-4">
              <span className="text-muted-foreground">{itemConfig?.label ?? item.name}</span>
              <span className="font-mono font-medium tabular-nums text-foreground">{value}</span>
            </div>
          )
        })}
      </div>
    </div>
  )
}

export {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent
}
