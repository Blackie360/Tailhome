import { Network } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Empty, EmptyDescription, EmptyTitle } from '@/components/ui/empty'
import { Skeleton } from '@/components/ui/skeleton'
import { stripDNSName } from '@/lib/format'
import type { TailnetStatus } from '@/lib/types'

type TailnetPanelProps = {
  tailnet: TailnetStatus | null
}

function stateVariant (state: string): 'success' | 'secondary' | 'destructive' {
  switch (state) {
    case 'Running':
      return 'success'
    case 'NeedsLogin':
    case 'Stopped':
    case 'NoState':
      return 'secondary'
    default:
      return 'destructive'
  }
}

export function TailnetPanel ({ tailnet }: TailnetPanelProps) {
  if (!tailnet) {
    return (
      <Card>
        <CardHeader>
          <Skeleton className="h-5 w-32" />
          <Skeleton className="h-4 w-48" />
        </CardHeader>
        <CardContent>
          <Skeleton className="h-16 w-full" />
        </CardContent>
      </Card>
    )
  }

  if (!tailnet.available || tailnet.state !== 'Running') {
    return (
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3 [&_svg]:size-4">
              <Network aria-hidden="true" />
              <CardTitle>Tailnet</CardTitle>
            </div>
            <Badge variant={stateVariant(tailnet.state)}>{tailnet.state || 'Unavailable'}</Badge>
          </div>
        </CardHeader>
        <CardContent>
          <Empty>
            <EmptyTitle>Tailscale is not connected</EmptyTitle>
            <EmptyDescription>
              {tailnet.message || 'Needs login — run `tailhome connect` to join this host to your tailnet.'}
            </EmptyDescription>
          </Empty>
        </CardContent>
      </Card>
    )
  }

  const onlinePeers = tailnet.peers.filter((peer) => peer.online)
  const offlinePeers = tailnet.peers.filter((peer) => !peer.online)
  const orderedPeers = [...onlinePeers, ...offlinePeers].slice(0, 8)

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex items-center gap-3 [&_svg]:size-4">
            <Network aria-hidden="true" />
            <div className="flex flex-col gap-1">
              <CardTitle>{tailnet.tailnet.name || 'Tailnet'}</CardTitle>
              <CardDescription>
                {tailnet.tailnet.magicDNSSuffix
                  ? `MagicDNS ${tailnet.tailnet.magicDNSSuffix}`
                  : 'MagicDNS unavailable'}
              </CardDescription>
            </div>
          </div>
          <Badge variant="success">{tailnet.counts.online} online / {tailnet.counts.total} devices</Badge>
        </div>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <div className="rounded-lg bg-muted px-3 py-2 text-sm">
          <p className="font-medium">{tailnet.self.hostname || 'this node'}</p>
          <p className="truncate text-muted-foreground">
            {stripDNSName(tailnet.self.dnsName) || tailnet.self.ips.join(', ') || 'no address'}
          </p>
        </div>
        {orderedPeers.length > 0 ? (
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
            {orderedPeers.map((peer) => (
              <div key={`${peer.hostname}-${peer.dnsName}`} className="flex items-center justify-between gap-2 rounded-lg border px-3 py-2">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">{peer.hostname}</p>
                  <p className="truncate text-xs text-muted-foreground">{peer.os || stripDNSName(peer.dnsName)}</p>
                </div>
                <Badge variant={peer.online ? 'success' : 'secondary'}>
                  {peer.online ? 'Online' : 'Offline'}
                </Badge>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">No other devices are visible on this tailnet yet.</p>
        )}
      </CardContent>
    </Card>
  )
}
