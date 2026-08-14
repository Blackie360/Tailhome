package dashboard

import (
	"encoding/json"
	"io/fs"
	"log"
	"net/http"
	"strings"
	"time"

	"github.com/Blackie360/Tailhome/apps/tailhome/internal/dashboard/web"
)

type Server struct {
	opts    Options
	sampler *sampler
}

func New(opts Options) *Server {
	if opts.Listen == "" {
		opts.Listen = ":3000"
	}
	if opts.ConfigDir == "" {
		opts.ConfigDir = "/app/config"
	}
	if opts.DockerSocket == "" {
		opts.DockerSocket = "/var/run/docker.sock"
	}
	if opts.TailscaleSocket == "" {
		opts.TailscaleSocket = "/var/run/tailscale/tailscaled.sock"
	}
	if opts.ProcRoot == "" {
		opts.ProcRoot = "/proc"
	}
	if opts.HostRoot == "" {
		opts.HostRoot = "/"
	}
	return &Server{
		opts:    opts,
		sampler: newSampler(opts.ProcRoot, opts.HostRoot),
	}
}

func ListenAndServe(opts Options) error {
	server := New(opts)
	go server.sampleLoop()
	mux := http.NewServeMux()
	mux.HandleFunc("/api/tailnet", server.handleTailnet)
	mux.HandleFunc("/api/services", server.handleServices)
	mux.HandleFunc("/api/metrics/history", server.handleHistory)
	mux.HandleFunc("/api/metrics", server.handleMetrics)
	mux.Handle("/", spaHandler())
	log.Printf("TailHome dashboard listening on %s", server.opts.Listen)
	return http.ListenAndServe(server.opts.Listen, mux)
}

func (s *Server) sampleLoop() {
	s.sampler.tick()
	ticker := time.NewTicker(5 * time.Second)
	defer ticker.Stop()
	for range ticker.C {
		s.sampler.tick()
	}
}

func (s *Server) handleTailnet(w http.ResponseWriter, r *http.Request) {
	body, err := s.fetchTailnetStatus(r.Context())
	writeJSON(w, http.StatusOK, BuildTailnetResponse(body, err))
}

func (s *Server) handleServices(w http.ResponseWriter, r *http.Request) {
	response, err := s.loadServices(r.Context())
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
		return
	}
	writeJSON(w, http.StatusOK, response)
}

func (s *Server) handleMetrics(w http.ResponseWriter, r *http.Request) {
	writeJSON(w, http.StatusOK, s.sampler.snapshot())
}

func (s *Server) handleHistory(w http.ResponseWriter, r *http.Request) {
	if points, ok := s.prometheusHistory(); ok {
		writeJSON(w, http.StatusOK, MetricsHistory{Source: "prometheus", Points: points})
		return
	}
	writeJSON(w, http.StatusOK, MetricsHistory{Source: "local", Points: s.sampler.history()})
}

func writeJSON(w http.ResponseWriter, status int, value any) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(value)
}

func spaHandler() http.Handler {
	dist, err := fs.Sub(web.Static, "static")
	if err != nil {
		return http.NotFoundHandler()
	}
	fileServer := http.FileServer(http.FS(dist))
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		path := strings.TrimPrefix(r.URL.Path, "/")
		if path == "" {
			path = "index.html"
		}
		f, err := dist.Open(path)
		if err != nil {
			r = r.Clone(r.Context())
			r.URL.Path = "/"
			fileServer.ServeHTTP(w, r)
			return
		}
		_ = f.Close()
		fileServer.ServeHTTP(w, r)
	})
}
