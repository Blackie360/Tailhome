export type TailnetPeer = {
  hostname: string
  dnsName: string
  online: boolean
  os: string
  ips: string[]
  lastSeen: string
}

export type TailnetStatus = {
  state: string
  available: boolean
  message: string
  tailnet: {
    name: string
    magicDNSSuffix: string
    magicDNSEnabled: boolean
  }
  self: {
    hostname: string
    dnsName: string
    online: boolean
    os: string
    ips: string[]
  }
  peers: TailnetPeer[]
  counts: {
    total: number
    online: number
    offline: number
  }
}

export type ServiceItem = {
  name: string
  href: string
  description: string
  icon: string
  container: string
  status: string
}

export type ServiceGroup = {
  name: string
  services: ServiceItem[]
}

export type BookmarkLink = {
  name: string
  url: string
  subtitle: string
}

export type BookmarkGroup = {
  name: string
  links: BookmarkLink[]
}

export type ServicesResponse = {
  groups: ServiceGroup[]
  bookmarks: BookmarkGroup[]
}

export type MetricsSnapshot = {
  cpuPercent: number
  memoryTotalBytes: number
  memoryAvailableBytes: number
  diskTotalBytes: number
  diskAvailableBytes: number
  uptimeSeconds: number
}

export type HistoryPoint = {
  timestamp: number
  cpuPercent: number
  memoryPercent: number
  diskPercent: number
}

export type MetricsHistory = {
  source: 'prometheus' | 'local'
  points: HistoryPoint[]
}
