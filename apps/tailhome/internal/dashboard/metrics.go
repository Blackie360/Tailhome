package dashboard

import (
	"bufio"
	"encoding/json"
	"net/http"
	"net/url"
	"os"
	"path/filepath"
	"sort"
	"strconv"
	"strings"
	"sync"
	"time"
)

const historyLimit = 60

type cpuSample struct {
	idle  uint64
	total uint64
}

type sampler struct {
	mu       sync.Mutex
	procRoot string
	hostRoot string
	lastCPU  cpuSample
	hasCPU   bool
	last     MetricsSnapshot
	points   []HistoryPoint
}

func newSampler(procRoot, hostRoot string) *sampler {
	return &sampler{procRoot: procRoot, hostRoot: hostRoot, points: []HistoryPoint{}}
}

func (s *sampler) tick() {
	snap, cpu := readSnapshot(s.procRoot, s.hostRoot)
	s.mu.Lock()
	defer s.mu.Unlock()
	if s.hasCPU && cpu.total > s.lastCPU.total {
		deltaTotal := cpu.total - s.lastCPU.total
		deltaIdle := cpu.idle - s.lastCPU.idle
		if deltaTotal > 0 {
			snap.CPUPercent = (1 - float64(deltaIdle)/float64(deltaTotal)) * 100
			if snap.CPUPercent < 0 {
				snap.CPUPercent = 0
			}
		}
	}
	s.lastCPU = cpu
	s.hasCPU = true
	s.last = snap
	point := HistoryPoint{
		Timestamp:     time.Now().Unix(),
		CPUPercent:    snap.CPUPercent,
		MemoryPercent: memoryPercent(snap),
		DiskPercent:   diskPercent(snap),
	}
	s.points = append(s.points, point)
	if len(s.points) > historyLimit {
		s.points = append([]HistoryPoint{}, s.points[len(s.points)-historyLimit:]...)
	}
}

func (s *sampler) snapshot() MetricsSnapshot {
	s.mu.Lock()
	defer s.mu.Unlock()
	return s.last
}

func (s *sampler) history() []HistoryPoint {
	s.mu.Lock()
	defer s.mu.Unlock()
	out := make([]HistoryPoint, len(s.points))
	copy(out, s.points)
	return out
}

func memoryPercent(snap MetricsSnapshot) float64 {
	if snap.MemoryTotalBytes == 0 {
		return 0
	}
	used := snap.MemoryTotalBytes - snap.MemoryAvailableBytes
	return float64(used) / float64(snap.MemoryTotalBytes) * 100
}

func diskPercent(snap MetricsSnapshot) float64 {
	if snap.DiskTotalBytes == 0 {
		return 0
	}
	used := snap.DiskTotalBytes - snap.DiskAvailableBytes
	return float64(used) / float64(snap.DiskTotalBytes) * 100
}

func readSnapshot(procRoot, hostRoot string) (MetricsSnapshot, cpuSample) {
	snap := MetricsSnapshot{}
	cpu := readCPU(filepath.Join(procRoot, "stat"))
	snap.MemoryTotalBytes, snap.MemoryAvailableBytes = readMemory(filepath.Join(procRoot, "meminfo"))
	snap.UptimeSeconds = readUptime(filepath.Join(procRoot, "uptime"))
	snap.DiskTotalBytes, snap.DiskAvailableBytes = diskUsage(hostRoot)
	return snap, cpu
}

func readCPU(path string) cpuSample {
	file, err := os.Open(path)
	if err != nil {
		return cpuSample{}
	}
	defer file.Close()
	scanner := bufio.NewScanner(file)
	if !scanner.Scan() {
		return cpuSample{}
	}
	fields := strings.Fields(scanner.Text())
	if len(fields) < 5 || fields[0] != "cpu" {
		return cpuSample{}
	}
	var total uint64
	values := make([]uint64, 0, len(fields)-1)
	for _, field := range fields[1:] {
		value, err := strconv.ParseUint(field, 10, 64)
		if err != nil {
			continue
		}
		values = append(values, value)
		total += value
	}
	idle := uint64(0)
	if len(values) > 3 {
		idle = values[3]
	}
	if len(values) > 4 {
		idle += values[4]
	}
	return cpuSample{idle: idle, total: total}
}

func readMemory(path string) (total, available uint64) {
	file, err := os.Open(path)
	if err != nil {
		return 0, 0
	}
	defer file.Close()
	scanner := bufio.NewScanner(file)
	for scanner.Scan() {
		line := scanner.Text()
		switch {
		case strings.HasPrefix(line, "MemTotal:"):
			total = parseMemKB(line) * 1024
		case strings.HasPrefix(line, "MemAvailable:"):
			available = parseMemKB(line) * 1024
		}
	}
	return total, available
}

func parseMemKB(line string) uint64 {
	fields := strings.Fields(line)
	if len(fields) < 2 {
		return 0
	}
	value, _ := strconv.ParseUint(fields[1], 10, 64)
	return value
}

func readUptime(path string) float64 {
	content, err := os.ReadFile(path)
	if err != nil {
		return 0
	}
	fields := strings.Fields(string(content))
	if len(fields) == 0 {
		return 0
	}
	value, _ := strconv.ParseFloat(fields[0], 64)
	return value
}

type prometheusResponse struct {
	Status string `json:"status"`
	Data   struct {
		Result []struct {
			Values [][]any `json:"values"`
		} `json:"result"`
	} `json:"data"`
}

func (s *Server) prometheusHistory() ([]HistoryPoint, bool) {
	if s.opts.PrometheusURL == "" {
		return nil, false
	}
	end := time.Now()
	start := end.Add(-1 * time.Hour)
	cpu, okCPU := queryPrometheus(s.opts.PrometheusURL, `100 - (avg by (instance) (rate(node_cpu_seconds_total{mode="idle"}[5m])) * 100)`, start, end)
	mem, okMem := queryPrometheus(s.opts.PrometheusURL, `(1 - node_memory_MemAvailable_bytes / node_memory_MemTotal_bytes) * 100`, start, end)
	disk, okDisk := queryPrometheus(s.opts.PrometheusURL, `100 * (1 - node_filesystem_avail_bytes{mountpoint="/"} / node_filesystem_size_bytes{mountpoint="/"})`, start, end)
	if !okCPU && !okMem && !okDisk {
		return nil, false
	}
	points := mergeSeries(cpu, mem, disk)
	return points, len(points) > 1
}

func queryPrometheus(base, query string, start, end time.Time) (map[int64]float64, bool) {
	endpoint, err := url.Parse(strings.TrimRight(base, "/") + "/api/v1/query_range")
	if err != nil {
		return nil, false
	}
	params := endpoint.Query()
	params.Set("query", query)
	params.Set("start", strconv.FormatInt(start.Unix(), 10))
	params.Set("end", strconv.FormatInt(end.Unix(), 10))
	params.Set("step", "30")
	endpoint.RawQuery = params.Encode()

	client := &http.Client{Timeout: 3 * time.Second}
	resp, err := client.Get(endpoint.String())
	if err != nil {
		return nil, false
	}
	defer resp.Body.Close()
	if resp.StatusCode >= 300 {
		return nil, false
	}
	var parsed prometheusResponse
	if err := json.NewDecoder(resp.Body).Decode(&parsed); err != nil || parsed.Status != "success" {
		return nil, false
	}
	values := map[int64]float64{}
	for _, result := range parsed.Data.Result {
		for _, pair := range result.Values {
			if len(pair) < 2 {
				continue
			}
			ts, _ := toInt64(pair[0])
			raw, _ := pair[1].(string)
			value, err := strconv.ParseFloat(raw, 64)
			if err != nil {
				continue
			}
			values[ts] = value
		}
	}
	return values, len(values) > 0
}

func toInt64(value any) (int64, bool) {
	switch typed := value.(type) {
	case float64:
		return int64(typed), true
	case json.Number:
		n, err := typed.Int64()
		return n, err == nil
	case string:
		n, err := strconv.ParseInt(typed, 10, 64)
		return n, err == nil
	default:
		return 0, false
	}
}

func mergeSeries(cpu, mem, disk map[int64]float64) []HistoryPoint {
	seen := map[int64]struct{}{}
	for ts := range cpu {
		seen[ts] = struct{}{}
	}
	for ts := range mem {
		seen[ts] = struct{}{}
	}
	for ts := range disk {
		seen[ts] = struct{}{}
	}
	stamps := make([]int64, 0, len(seen))
	for ts := range seen {
		stamps = append(stamps, ts)
	}
	if len(stamps) == 0 {
		return nil
	}
	sort.Slice(stamps, func(i, j int) bool { return stamps[i] < stamps[j] })
	points := make([]HistoryPoint, 0, len(stamps))
	for _, ts := range stamps {
		points = append(points, HistoryPoint{
			Timestamp:     ts,
			CPUPercent:    cpu[ts],
			MemoryPercent: mem[ts],
			DiskPercent:   disk[ts],
		})
	}
	return points
}
