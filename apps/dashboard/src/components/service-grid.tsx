import type { LucideIcon } from 'lucide-react'
import {
  Activity,
  BarChart3,
  Database,
  Globe,
  LayoutGrid,
  Shield,
  Box
} from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Card, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Empty, EmptyDescription, EmptyTitle } from '@/components/ui/empty'
import { Skeleton } from '@/components/ui/skeleton'
import type { BookmarkGroup, ServiceGroup, ServiceItem } from '@/lib/types'

const serviceIcons: Record<string, LucideIcon> = {
  grafana: BarChart3,
  prometheus: Database,
  'uptime kuma': Activity,
  portainer: Box,
  caddy: Globe,
  'pi-hole': Shield
}

function initials (name: string) {
  return name
    .split(/\s+/)
    .map((part) => part[0])
    .join('')
    .slice(0, 2)
    .toUpperCase()
}

function statusVariant (status: string): 'success' | 'secondary' | 'destructive' {
  const normalized = status.toLowerCase()
  if (normalized === 'running' || normalized === 'healthy') {
    return 'success'
  }
  if (normalized === 'exited' || normalized === 'dead' || normalized === 'restarting') {
    return 'destructive'
  }
  return 'secondary'
}

function matchesQuery (value: string, query: string) {
  return value.toLowerCase().includes(query)
}

function ServiceCard ({ service }: { service: ServiceItem }) {
  const Icon = serviceIcons[service.name.toLowerCase()] ?? LayoutGrid
  return (
    <a href={service.href} className="block">
      <Card className="transition-colors hover:bg-accent">
        <CardHeader>
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="flex size-10 items-center justify-center rounded-lg bg-muted [&_svg]:size-4">
                <Icon aria-hidden="true" />
              </div>
              <div className="flex min-w-0 flex-col gap-1">
                <CardTitle className="truncate text-base">{service.name}</CardTitle>
                <CardDescription className="truncate">{service.description}</CardDescription>
              </div>
            </div>
            {service.status ? (
              <Badge variant={statusVariant(service.status)}>{service.status}</Badge>
            ) : null}
          </div>
        </CardHeader>
      </Card>
    </a>
  )
}

type ServiceGridProps = {
  groups: ServiceGroup[]
  bookmarks: BookmarkGroup[]
  query: string
  isLoading: boolean
}

export function ServiceGrid ({ groups, bookmarks, query, isLoading }: ServiceGridProps) {
  const normalizedQuery = query.trim().toLowerCase()
  const visibleGroups = groups
    .map((group) => ({
      ...group,
      services: group.services.filter((service) =>
        !normalizedQuery ||
        matchesQuery(service.name, normalizedQuery) ||
        matchesQuery(service.description, normalizedQuery)
      )
    }))
    .filter((group) => group.services.length > 0)

  const visibleBookmarks = bookmarks
    .map((group) => ({
      ...group,
      links: group.links.filter((link) =>
        !normalizedQuery ||
        matchesQuery(link.name, normalizedQuery) ||
        matchesQuery(link.url, normalizedQuery) ||
        matchesQuery(link.subtitle, normalizedQuery)
      )
    }))
    .filter((group) => group.links.length > 0)

  if (isLoading) {
    return (
      <div className="grid gap-6 lg:grid-cols-3">
        {['one', 'two', 'three'].map((key) => (
          <div key={key} className="flex flex-col gap-3">
            <Skeleton className="h-5 w-28" />
            <Skeleton className="h-24 w-full" />
          </div>
        ))}
      </div>
    )
  }

  if (visibleGroups.length === 0 && visibleBookmarks.length === 0) {
    return (
      <Empty>
        <EmptyTitle>No matching services</EmptyTitle>
        <EmptyDescription>Try a different search, or add bookmarks in configs/dashboard/bookmarks.json.</EmptyDescription>
      </Empty>
    )
  }

  return (
    <div className="flex flex-col gap-8">
      <div className="grid gap-8 lg:grid-cols-3">
        {visibleGroups.map((group) => (
          <section key={group.name} className="flex flex-col gap-3">
            <h2 className="text-sm font-semibold tracking-wide text-muted-foreground uppercase">{group.name}</h2>
            <div className="flex flex-col gap-3">
              {group.services.map((service) => (
                <ServiceCard key={service.name} service={service} />
              ))}
            </div>
          </section>
        ))}
      </div>
      {visibleBookmarks.length > 0 ? (
        <div className="grid gap-8 lg:grid-cols-3">
          {visibleBookmarks.map((group) => (
            <section key={group.name} className="flex flex-col gap-3">
              <h2 className="text-sm font-semibold tracking-wide text-muted-foreground uppercase">{group.name}</h2>
              <div className="flex flex-col gap-3">
                {group.links.map((link) => (
                  <a key={`${group.name}-${link.url}`} href={link.url} target="_blank" rel="noreferrer" className="block">
                    <Card className="transition-colors hover:bg-accent">
                      <CardHeader className="p-4">
                        <div className="flex items-center justify-between gap-3">
                          <div className="flex items-center gap-3">
                            <div className="flex size-10 items-center justify-center rounded-lg bg-muted text-xs font-bold">
                              {initials(link.name)}
                            </div>
                            <CardTitle className="text-base">{link.name}</CardTitle>
                          </div>
                          <CardDescription>{link.subtitle || link.url.replace(/^https?:\/\//, '')}</CardDescription>
                        </div>
                      </CardHeader>
                    </Card>
                  </a>
                ))}
              </div>
            </section>
          ))}
        </div>
      ) : null}
    </div>
  )
}
