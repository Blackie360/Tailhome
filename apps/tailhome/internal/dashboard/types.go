package dashboard

import "time"

type Options struct {
	Listen          string
	ConfigDir       string
	DockerSocket    string
	TailscaleSocket string
	ProcRoot        string
	HostRoot        string
	PrometheusURL   string
	Hostname        string
}

type TailnetResponse struct {
	State     string        `json:"state"`
	Available bool          `json:"available"`
	Message   string        `json:"message"`
	Tailnet   TailnetInfo   `json:"tailnet"`
	Self      PeerInfo      `json:"self"`
	Peers     []PeerInfo    `json:"peers"`
	Counts    TailnetCounts `json:"counts"`
}

type TailnetInfo struct {
	Name            string `json:"name"`
	MagicDNSSuffix  string `json:"magicDNSSuffix"`
	MagicDNSEnabled bool   `json:"magicDNSEnabled"`
}

type PeerInfo struct {
	Hostname string   `json:"hostname"`
	DNSName  string   `json:"dnsName"`
	Online   bool     `json:"online"`
	OS       string   `json:"os"`
	IPs      []string `json:"ips"`
	LastSeen string   `json:"lastSeen,omitempty"`
}

type TailnetCounts struct {
	Total   int `json:"total"`
	Online  int `json:"online"`
	Offline int `json:"offline"`
}

type ServiceItem struct {
	Name        string `json:"name"`
	Href        string `json:"href"`
	Description string `json:"description"`
	Icon        string `json:"icon"`
	Container   string `json:"container"`
	Status      string `json:"status"`
}

type ServiceGroup struct {
	Name     string        `json:"name"`
	Services []ServiceItem `json:"services"`
}

type BookmarkLink struct {
	Name     string `json:"name"`
	URL      string `json:"url"`
	Subtitle string `json:"subtitle"`
}

type BookmarkGroup struct {
	Name  string         `json:"name"`
	Links []BookmarkLink `json:"links"`
}

type ServicesResponse struct {
	Groups    []ServiceGroup  `json:"groups"`
	Bookmarks []BookmarkGroup `json:"bookmarks"`
}

type MetricsSnapshot struct {
	CPUPercent           float64 `json:"cpuPercent"`
	MemoryTotalBytes     uint64  `json:"memoryTotalBytes"`
	MemoryAvailableBytes uint64  `json:"memoryAvailableBytes"`
	DiskTotalBytes       uint64  `json:"diskTotalBytes"`
	DiskAvailableBytes   uint64  `json:"diskAvailableBytes"`
	UptimeSeconds        float64 `json:"uptimeSeconds"`
}

type HistoryPoint struct {
	Timestamp     int64   `json:"timestamp"`
	CPUPercent    float64 `json:"cpuPercent"`
	MemoryPercent float64 `json:"memoryPercent"`
	DiskPercent   float64 `json:"diskPercent"`
}

type MetricsHistory struct {
	Source string         `json:"source"`
	Points []HistoryPoint `json:"points"`
}

type ipnStatus struct {
	BackendState   string              `json:"BackendState"`
	AuthURL        string              `json:"AuthURL"`
	CurrentTailnet *ipnTailnet         `json:"CurrentTailnet"`
	Self           *ipnPeer            `json:"Self"`
	Peer           map[string]*ipnPeer `json:"Peer"`
}

type ipnTailnet struct {
	Name            string `json:"Name"`
	MagicDNSSuffix  string `json:"MagicDNSSuffix"`
	MagicDNSEnabled bool   `json:"MagicDNSEnabled"`
}

type ipnPeer struct {
	HostName     string     `json:"HostName"`
	DNSName      string     `json:"DNSName"`
	Online       bool       `json:"Online"`
	OS           string     `json:"OS"`
	TailscaleIPs []string   `json:"TailscaleIPs"`
	LastSeen     *time.Time `json:"LastSeen"`
}

type serviceFile struct {
	Groups []struct {
		Name     string        `json:"name"`
		Services []ServiceItem `json:"services"`
	} `json:"groups"`
}

type bookmarkFile struct {
	Groups []BookmarkGroup `json:"groups"`
}
