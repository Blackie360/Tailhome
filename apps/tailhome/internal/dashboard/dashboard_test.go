package dashboard

import (
	"encoding/json"
	"testing"
)

func TestParseBackendState(t *testing.T) {
	if got := ParseBackendState([]byte(`{"BackendState":"Running"}`)); got != "Running" {
		t.Fatalf("got %q", got)
	}
	if got := ParseBackendState([]byte(`not json`)); got != "" {
		t.Fatalf("expected empty state, got %q", got)
	}
}

func TestBuildTailnetResponse(t *testing.T) {
	raw := `{
		"BackendState":"Running",
		"CurrentTailnet":{"Name":"example.com","MagicDNSSuffix":"tailnet.example","MagicDNSEnabled":true},
		"Self":{"HostName":"tailhome","DNSName":"tailhome.tailnet.example.","Online":true,"OS":"linux","TailscaleIPs":["100.64.0.1"]},
		"Peer":{
			"key1":{"HostName":"phone","DNSName":"phone.tailnet.example.","Online":true,"OS":"iOS","TailscaleIPs":["100.64.0.2"]},
			"key2":{"HostName":"laptop","DNSName":"laptop.tailnet.example.","Online":false,"OS":"macOS","TailscaleIPs":["100.64.0.3"]}
		}
	}`
	got := BuildTailnetResponse([]byte(raw), nil)
	if !got.Available || got.State != "Running" {
		t.Fatalf("expected running tailnet, got %#v", got)
	}
	if got.Tailnet.Name != "example.com" || got.Self.Hostname != "tailhome" {
		t.Fatalf("unexpected identity: %#v %#v", got.Tailnet, got.Self)
	}
	if got.Self.DNSName != "tailhome.tailnet.example" {
		t.Fatalf("expected trimmed DNS name, got %q", got.Self.DNSName)
	}
	if got.Counts.Total != 3 || got.Counts.Online != 2 {
		t.Fatalf("unexpected counts: %#v", got.Counts)
	}
	if len(got.Peers) != 2 || !got.Peers[0].Online {
		t.Fatalf("expected online peers first, got %#v", got.Peers)
	}

	pending := BuildTailnetResponse([]byte(`{"BackendState":"NeedsLogin"}`), nil)
	if pending.Available || pending.State != "NeedsLogin" || pending.Message == "" {
		t.Fatalf("expected needs-login empty state, got %#v", pending)
	}
}

func TestMemoryAndDiskPercent(t *testing.T) {
	snap := MetricsSnapshot{MemoryTotalBytes: 100, MemoryAvailableBytes: 40, DiskTotalBytes: 50, DiskAvailableBytes: 10}
	if got := memoryPercent(snap); got != 60 {
		t.Fatalf("memory percent %v", got)
	}
	if got := diskPercent(snap); got != 80 {
		t.Fatalf("disk percent %v", got)
	}
}

func TestMergeSeries(t *testing.T) {
	points := mergeSeries(
		map[int64]float64{2: 20, 1: 10},
		map[int64]float64{1: 30},
		map[int64]float64{2: 40},
	)
	if len(points) != 2 || points[0].Timestamp != 1 || points[1].CPUPercent != 20 {
		encoded, _ := json.Marshal(points)
		t.Fatalf("unexpected merge %s", encoded)
	}
}
