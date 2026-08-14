import { Cpu, HardDrive, MemoryStick, Timer } from 'lucide-react'
import { Skeleton } from '@/components/ui/skeleton'
import { formatBytes, formatPercent, formatUptime } from '@/lib/format'
import type { MetricsSnapshot } from '@/lib/types'

type HeaderMetricsProps = {
  metrics: MetricsSnapshot | null
}

function Metric ({
  icon: Icon,
  label,
  value
}: {
  icon: typeof Cpu
  label: string
  value: string
}) {
  return (
    <div className="flex items-center gap-2 text-xs text-muted-foreground [&_svg]:size-3.5">
      <Icon aria-hidden="true" />
      <span className="hidden sm:inline">{label}</span>
      <span className="font-medium text-foreground">{value}</span>
    </div>
  )
}

export function HeaderMetrics ({ metrics }: HeaderMetricsProps) {
  if (!metrics) {
    return (
      <div className="flex items-center gap-4">
        <Skeleton className="h-4 w-20" />
        <Skeleton className="h-4 w-24" />
        <Skeleton className="h-4 w-24" />
        <Skeleton className="h-4 w-16" />
      </div>
    )
  }

  return (
    <div className="flex flex-wrap items-center gap-4">
      <Metric icon={Cpu} label="CPU" value={formatPercent(metrics.cpuPercent)} />
      <Metric icon={MemoryStick} label="Free RAM" value={formatBytes(metrics.memoryAvailableBytes)} />
      <Metric icon={HardDrive} label="Free Disk" value={formatBytes(metrics.diskAvailableBytes)} />
      <Metric icon={Timer} label="Uptime" value={formatUptime(metrics.uptimeSeconds)} />
    </div>
  )
}
