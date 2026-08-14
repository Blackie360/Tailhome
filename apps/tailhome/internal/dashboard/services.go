package dashboard

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net"
	"net/http"
	"os"
	"path/filepath"
	"strings"
	"time"
)

type dockerContainer struct {
	Names  []string `json:"Names"`
	State  string   `json:"State"`
	Status string   `json:"Status"`
}

func (s *Server) loadServices(ctx context.Context) (ServicesResponse, error) {
	response := ServicesResponse{
		Groups:    []ServiceGroup{},
		Bookmarks: []BookmarkGroup{},
	}

	config, err := readJSONFile[serviceFile](filepath.Join(s.opts.ConfigDir, "services.json"))
	if err != nil && !os.IsNotExist(err) {
		return response, err
	}
	states := map[string]string{}
	if socketExists(s.opts.DockerSocket) {
		states, _ = s.dockerStates(ctx)
	}
	for _, group := range config.Groups {
		items := make([]ServiceItem, 0, len(group.Services))
		for _, service := range group.Services {
			service.Status = states[service.Container]
			if service.Status == "" && service.Container != "" {
				service.Status = "unknown"
			}
			items = append(items, service)
		}
		response.Groups = append(response.Groups, ServiceGroup{Name: group.Name, Services: items})
	}

	bookmarks, err := readJSONFile[bookmarkFile](filepath.Join(s.opts.ConfigDir, "bookmarks.json"))
	if err != nil && !os.IsNotExist(err) {
		return response, err
	}
	if bookmarks.Groups != nil {
		response.Bookmarks = bookmarks.Groups
	}
	return response, nil
}

func (s *Server) dockerStates(ctx context.Context) (map[string]string, error) {
	body, err := s.getDocker(ctx, "/containers/json?all=true")
	if err != nil {
		return nil, err
	}
	var containers []dockerContainer
	if err := json.Unmarshal(body, &containers); err != nil {
		return nil, err
	}
	states := map[string]string{}
	for _, container := range containers {
		status := strings.ToUpper(container.State)
		if strings.Contains(strings.ToLower(container.Status), "healthy") {
			status = "HEALTHY"
		}
		for _, name := range container.Names {
			states[strings.TrimPrefix(name, "/")] = status
		}
	}
	return states, nil
}

func (s *Server) getDocker(ctx context.Context, path string) ([]byte, error) {
	client := &http.Client{
		Timeout: 3 * time.Second,
		Transport: &http.Transport{
			DialContext: func(ctx context.Context, _, _ string) (net.Conn, error) {
				var dialer net.Dialer
				return dialer.DialContext(ctx, "unix", s.opts.DockerSocket)
			},
		},
	}
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, "http://localhost"+path, nil)
	if err != nil {
		return nil, err
	}
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
		return body, fmt.Errorf("docker API returned %s", resp.Status)
	}
	return body, nil
}

func readJSONFile[T any](path string) (T, error) {
	var value T
	content, err := os.ReadFile(path)
	if err != nil {
		return value, err
	}
	if err := json.Unmarshal(content, &value); err != nil {
		return value, err
	}
	return value, nil
}
