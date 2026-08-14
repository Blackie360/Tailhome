package dashboard

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net"
	"net/http"
	"os"
	"os/exec"
	"sort"
	"strings"
	"time"
)

func ParseBackendState(output []byte) string {
	var status ipnStatus
	if json.Unmarshal(output, &status) != nil {
		return ""
	}
	return status.BackendState
}

func BuildTailnetResponse(output []byte, fetchErr error) TailnetResponse {
	response := TailnetResponse{
		Peers: []PeerInfo{},
	}
	if fetchErr != nil {
		response.Message = fetchErr.Error()
		return response
	}

	var status ipnStatus
	if err := json.Unmarshal(output, &status); err != nil {
		response.Message = "could not parse Tailscale status"
		return response
	}

	response.State = status.BackendState
	if status.CurrentTailnet != nil {
		response.Tailnet = TailnetInfo{
			Name:            status.CurrentTailnet.Name,
			MagicDNSSuffix:  status.CurrentTailnet.MagicDNSSuffix,
			MagicDNSEnabled: status.CurrentTailnet.MagicDNSEnabled,
		}
	}
	if status.Self != nil {
		response.Self = peerInfo(status.Self)
	}

	for _, peer := range status.Peer {
		if peer == nil {
			continue
		}
		response.Peers = append(response.Peers, peerInfo(peer))
	}
	sort.Slice(response.Peers, func(i, j int) bool {
		if response.Peers[i].Online != response.Peers[j].Online {
			return response.Peers[i].Online
		}
		return strings.ToLower(response.Peers[i].Hostname) < strings.ToLower(response.Peers[j].Hostname)
	})

	response.Counts.Total = 1 + len(response.Peers)
	if response.Self.Online || status.BackendState == "Running" {
		response.Counts.Online++
	}
	for _, peer := range response.Peers {
		if peer.Online {
			response.Counts.Online++
		}
	}
	response.Counts.Offline = response.Counts.Total - response.Counts.Online
	response.Available = status.BackendState == "Running"
	if !response.Available {
		switch status.BackendState {
		case "NeedsLogin":
			response.Message = "Needs login — run `tailhome connect` to join this host to your tailnet."
		case "Stopped", "NoState", "":
			response.Message = "Tailscale is not running on this host."
		default:
			response.Message = "Tailscale backend state: " + status.BackendState
		}
	}
	return response
}

func peerInfo(peer *ipnPeer) PeerInfo {
	info := PeerInfo{
		Hostname: peer.HostName,
		DNSName:  strings.TrimSuffix(peer.DNSName, "."),
		Online:   peer.Online,
		OS:       peer.OS,
		IPs:      peer.TailscaleIPs,
	}
	if info.IPs == nil {
		info.IPs = []string{}
	}
	if peer.LastSeen != nil && !peer.LastSeen.IsZero() {
		info.LastSeen = peer.LastSeen.UTC().Format(time.RFC3339)
	}
	return info
}

func (s *Server) fetchTailnetStatus(ctx context.Context) ([]byte, error) {
	if s.opts.TailscaleSocket != "" {
		body, err := s.getUnix(ctx, s.opts.TailscaleSocket, "http://local-tailscaled.sock/localapi/v0/status")
		if err == nil {
			return body, nil
		}
	}
	if _, err := exec.LookPath("tailscale"); err != nil {
		return nil, fmt.Errorf("Tailscale is not available")
	}
	cmd := exec.CommandContext(ctx, "tailscale", "status", "--json")
	output, err := cmd.Output()
	if err != nil {
		return output, err
	}
	return output, nil
}

func (s *Server) getUnix(ctx context.Context, socket, url string) ([]byte, error) {
	client := &http.Client{
		Timeout: 3 * time.Second,
		Transport: &http.Transport{
			DialContext: func(ctx context.Context, _, _ string) (net.Conn, error) {
				var dialer net.Dialer
				return dialer.DialContext(ctx, "unix", socket)
			},
		},
	}
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, url, nil)
	if err != nil {
		return nil, err
	}
	req.Host = "local-tailscaled.sock"
	req.Header.Set("User-Agent", "TailHome")
	resp, err := client.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()
	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, err
	}
	if resp.StatusCode >= 300 {
		return body, fmt.Errorf("tailscale local API returned %s", resp.Status)
	}
	return body, nil
}

func socketExists(path string) bool {
	if path == "" {
		return false
	}
	info, err := os.Stat(path)
	return err == nil && !info.IsDir()
}
