// Package api is the HTTP API the WebGUI pages reach through a same-origin PHP
// proxy. It exposes read and orchestration verbs only, never Docker
// create, exec or build.
package api

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"log"
	"net/http"
	"regexp"
	"strconv"
	"strings"
	"sync"
	"time"

	"github.com/junkerderprovinz/towertorch/internal/bugreport"
	"github.com/junkerderprovinz/towertorch/internal/hostcpu"
	"github.com/junkerderprovinz/towertorch/internal/hostnet"
	"github.com/junkerderprovinz/towertorch/internal/iconsrc"
	"github.com/junkerderprovinz/towertorch/internal/model"
	"github.com/junkerderprovinz/towertorch/internal/netshape"
	"github.com/junkerderprovinz/towertorch/internal/orchestrator"
	"github.com/junkerderprovinz/towertorch/internal/store"
	"github.com/junkerderprovinz/towertorch/internal/unraidtmpl"
	"github.com/junkerderprovinz/towertorch/internal/vmctl"
)

// Docker is the part of the Docker API the handlers use: reads and the safe
// lifecycle verbs.
type Docker interface {
	List(ctx context.Context) ([]model.Container, error)
	Start(ctx context.Context, name string) error
	Stop(ctx context.Context, name string) error
	Restart(ctx context.Context, name string) error
	Pause(ctx context.Context, name string) error
	Unpause(ctx context.Context, name string) error
	Stats(ctx context.Context, name string) (model.Stats, error)
	Limits(ctx context.Context, name string) (model.Limits, error)
	UpdateResources(ctx context.Context, name string, l model.Limits) error
	SetRestartPolicy(ctx context.Context, name, policy string) error
	HostMemTotal(ctx context.Context) int64
}

// hostMem returns the host's total RAM in bytes from /proc/meminfo, falling back
// to the Docker daemon's figure. Removing a RAM limit sets it to this value, so a
// 0 here would turn the removal into a no-op.
func (s *Server) hostMem(ctx context.Context) int64 {
	if m := hostcpu.MemTotal(); m > 0 {
		return m
	}
	return s.Docker.HostMemTotal(ctx)
}

// Store persists the plan and the automation config.
type Store interface {
	Load() (model.Plan, error)
	Save(model.Plan) error
	LoadConfig() (model.Config, error)
	SaveConfig(model.Config) error
	MergeUISettings(map[string]*string) error
}

// Runner orchestrates a plan.
type Runner interface {
	Run(ctx context.Context, plan model.Plan) model.RunResult
}

// IconSource is the icon pipeline's cache.
type IconSource interface {
	// Resolve answers from the cache and does not block on the network.
	Resolve(names []string) map[string]iconsrc.Result
	// SVG returns the cached artwork for a name, its kind, and whether it exists.
	SVG(name string) ([]byte, string, bool)
}

// VMController manages libvirt VM limits.
type VMController interface {
	List(ctx context.Context) ([]vmctl.VM, error)
	Apply(ctx context.Context, name string, lim vmctl.Limits) error
	Disks(ctx context.Context, name string) ([]vmctl.Disk, error)
	ResizeDisk(ctx context.Context, name, target string, newBytes int64) error
}

// Server holds the handlers' dependencies. VMs, BwLast, Kicker and Icons may be
// nil; an empty TemplatesDir skips writing limits into the Unraid templates.
type Server struct {
	Docker       Docker
	Store        Store
	Runner       Runner
	VMs          VMController
	Pidder       Pidder
	BwLast       BwLaster
	Kicker       Kicker
	Icons        IconSource
	TemplatesDir string
	Version      string
	// Diag names the host files the bug report reads.
	Diag bugreport.Sources

	mu      sync.Mutex
	lastRun model.RunResult
}

// Handler returns the HTTP router.
func (s *Server) Handler() http.Handler {
	mux := http.NewServeMux()
	mux.HandleFunc("GET /api/health", func(w http.ResponseWriter, _ *http.Request) {
		_, _ = w.Write([]byte("ok"))
	})
	mux.HandleFunc("GET /api/state", s.handleState)
	mux.HandleFunc("GET /api/plan", s.handleGetPlan)
	mux.HandleFunc("PUT /api/plan", s.handlePutPlan)
	mux.HandleFunc("POST /api/apply", s.handleApply)
	mux.HandleFunc("POST /api/action", s.handleAction)
	mux.HandleFunc("GET /api/stats", s.handleStats)
	// The status island polls host CPU and network here because reverse proxies
	// often break the GraphQL websocket the native Dashboard uses (#12, #13).
	mux.HandleFunc("GET /api/hostcpu", func(w http.ResponseWriter, _ *http.Request) {
		writeJSON(w, http.StatusOK, map[string]int{"pct": hostcpu.Percent()})
	})
	mux.HandleFunc("GET /api/hostnet", func(w http.ResponseWriter, _ *http.Request) {
		rx, tx := hostnet.Rate()
		writeJSON(w, http.StatusOK, map[string]uint64{"rx": rx, "tx": tx})
	})
	mux.HandleFunc("GET /api/limits", s.handleGetLimits)
	mux.HandleFunc("GET /api/bwstatus", s.handleBwStatus)
	mux.HandleFunc("POST /api/limits", s.handleSetLimits)
	mux.HandleFunc("POST /api/restartpolicy", s.handleSetRestartPolicy)
	mux.HandleFunc("GET /api/config", s.handleGetConfig)
	mux.HandleFunc("PUT /api/config", s.handlePutConfig)
	mux.HandleFunc("PUT /api/uisettings", s.handlePutUISettings)
	mux.HandleFunc("GET /api/vms", s.handleGetVMs)
	mux.HandleFunc("POST /api/vmlimits", s.handleSetVMLimits)
	mux.HandleFunc("GET /api/vmdisks", s.handleGetVMDisks)
	mux.HandleFunc("POST /api/vmdiskresize", s.handleResizeVMDisk)
	mux.HandleFunc("POST /api/icons", s.handleIcons)
	mux.HandleFunc("GET /api/iconsvg", s.handleIconSVG)
	mux.HandleFunc("GET /api/bugreport", s.handleBugReport)
	return mux
}

// handleBugReport answers the bug report file as a download. A plan or config
// that cannot be read goes into the report as a problem rather than failing it,
// since a broken install is when the report is wanted most.
func (s *Server) handleBugReport(w http.ResponseWriter, _ *http.Request) {
	r := bugreport.Report{Created: time.Now(), Engine: s.Version}
	var err error
	if r.Plan, err = s.Store.Load(); err != nil {
		r.Problems = append(r.Problems, "start plan: "+err.Error())
	}
	if r.Config, err = s.Store.LoadConfig(); err != nil {
		r.Problems = append(r.Problems, "settings: "+err.Error())
	}
	s.Diag.Collect(&r)
	w.Header().Set("Content-Type", "text/plain; charset=utf-8")
	w.Header().Set("Content-Disposition", `attachment; filename="`+r.FileName()+`"`)
	w.Header().Set("Cache-Control", "no-store")
	_, _ = w.Write(r.Render())
}

// handleIcons answers a batch of names from the icon cache. Unknown names come
// back as pending and are fetched in the background, so a slow CDN cannot hold
// up a Docker tab render. Without a resolver the answer is an empty map and the
// frontend keeps the native icons.
func (s *Server) handleIcons(w http.ResponseWriter, r *http.Request) {
	var req struct {
		Names []string `json:"names"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeErr(w, http.StatusBadRequest, err)
		return
	}
	if s.Icons == nil {
		writeJSON(w, http.StatusOK, map[string]iconsrc.Result{})
		return
	}
	// One request must not be able to queue thousands of lookups.
	if len(req.Names) > 512 {
		req.Names = req.Names[:512]
	}
	writeJSON(w, http.StatusOK, s.Icons.Resolve(req.Names))
}

// handleIconSVG serves one cached icon as image/svg+xml. Coming through the
// same-origin proxy keeps the frontend's canvas reads of it untainted. A cache
// miss is a 404, not a fetch.
func (s *Server) handleIconSVG(w http.ResponseWriter, r *http.Request) {
	if s.Icons == nil {
		http.NotFound(w, r)
		return
	}
	body, _, ok := s.Icons.SVG(r.URL.Query().Get("name"))
	if !ok {
		http.NotFound(w, r)
		return
	}
	w.Header().Set("Content-Type", "image/svg+xml")
	w.Header().Set("Cache-Control", "public, max-age=86400")
	_, _ = w.Write(body)
}

// handleGetVMs lists every libvirt domain with its limits. Without a working
// libvirt the list is empty rather than an error, so the VM tab shows no controls.
func (s *Server) handleGetVMs(w http.ResponseWriter, r *http.Request) {
	if s.VMs == nil {
		writeJSON(w, http.StatusOK, []vmctl.VM{})
		return
	}
	vms, err := s.VMs.List(r.Context())
	if err != nil {
		log.Printf("vms: list: %v", err)
		writeJSON(w, http.StatusOK, []vmctl.VM{})
		return
	}
	s.overlayVMLimits(vms)
	writeJSON(w, http.StatusOK, vms)
}

// overlayVMLimits fills each VM's CPU cap and bandwidth from the stored config,
// which is their source of truth: an Unraid VM form apply can wipe the live cap,
// and libvirt never holds the bandwidth.
func (s *Server) overlayVMLimits(vms []vmctl.VM) {
	cfg, err := s.Store.LoadConfig()
	if err != nil {
		return
	}
	by := make(map[string]model.VMLimit, len(cfg.VMLimits))
	for _, l := range cfg.VMLimits {
		by[l.Name] = l
	}
	for i := range vms {
		if l, ok := by[vms[i].Name]; ok {
			if l.CPUCap > 0 {
				vms[i].CPUCap = l.CPUCap
			}
			vms[i].InKbit = l.InKbit
			vms[i].OutKbit = l.OutKbit
		}
	}
}

// saveVMLimit stores a VM's CPU cap and bandwidth in the config. A nil field is
// left unchanged, 0 clears it, and an entry with nothing set is dropped.
func (s *Server) saveVMLimit(name string, cpuCap, inKbit, outKbit *int) error {
	cfg, err := s.Store.LoadConfig()
	if err != nil {
		return err
	}
	idx := -1
	for i := range cfg.VMLimits {
		if cfg.VMLimits[i].Name == name {
			idx = i
			break
		}
	}
	cur := model.VMLimit{Name: name}
	if idx >= 0 {
		cur = cfg.VMLimits[idx]
	}
	if cpuCap != nil {
		cur.CPUCap = *cpuCap
	}
	if inKbit != nil {
		cur.InKbit = *inKbit
	}
	if outKbit != nil {
		cur.OutKbit = *outKbit
	}
	empty := cur.CPUCap <= 0 && cur.InKbit <= 0 && cur.OutKbit <= 0
	switch {
	case empty && idx >= 0:
		cfg.VMLimits = append(cfg.VMLimits[:idx], cfg.VMLimits[idx+1:]...)
	case empty:
	case idx >= 0:
		cfg.VMLimits[idx] = cur
	default:
		cfg.VMLimits = append(cfg.VMLimits, cur)
	}
	return s.Store.SaveConfig(cfg)
}

// handleSetVMLimits applies CPU pinning, CPU cap, RAM and bandwidth to one domain.
// The name has to be a domain libvirt knows and the cpuset a cpu list before
// either reaches virsh.
func (s *Server) handleSetVMLimits(w http.ResponseWriter, r *http.Request) {
	if s.VMs == nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "vm backend disabled"})
		return
	}
	var req struct {
		Name     string  `json:"name"`
		CPUCores *string `json:"cpu_cores,omitempty"`
		CPUCap   *int    `json:"cpu_cap,omitempty"`
		MemMiB   *int    `json:"mem_mib,omitempty"`
		InKbit   *int    `json:"in_kbit,omitempty"`
		OutKbit  *int    `json:"out_kbit,omitempty"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeErr(w, http.StatusBadRequest, err)
		return
	}
	req.Name = strings.TrimSpace(req.Name)
	if req.Name == "" {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "name required"})
		return
	}
	vms, err := s.VMs.List(r.Context())
	if err != nil {
		writeErr(w, http.StatusInternalServerError, err)
		return
	}
	known := false
	for _, v := range vms {
		if v.Name == req.Name {
			known = true
			break
		}
	}
	if !known {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "unknown vm: " + req.Name})
		return
	}
	if req.CPUCores != nil && *req.CPUCores != "" && !validCpuset(*req.CPUCores) {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "bad cpuset (want a cpu list like 0-3,6): " + *req.CPUCores})
		return
	}
	if req.CPUCores != nil || req.CPUCap != nil || req.MemMiB != nil {
		lim := vmctl.Limits{CPUCores: req.CPUCores, CPUCap: req.CPUCap, MemMiB: req.MemMiB}
		if err := s.VMs.Apply(r.Context(), req.Name, lim); err != nil {
			log.Printf("vmlimits: %s: %v", req.Name, err)
			writeErr(w, http.StatusInternalServerError, err)
			return
		}
	}
	// The monitor reasserts the stored cap and bandwidth every tick, so the cap
	// survives an Unraid VM form Apply and the bandwidth a restart onto a new tap.
	if req.CPUCap != nil || req.InKbit != nil || req.OutKbit != nil {
		if err := s.saveVMLimit(req.Name, req.CPUCap, req.InKbit, req.OutKbit); err != nil {
			writeErr(w, http.StatusInternalServerError, err)
			return
		}
		if s.Kicker != nil {
			s.Kicker.Kick()
		}
	}
	log.Printf("vmlimits: %s applied", req.Name)
	fresh, _ := s.VMs.List(r.Context())
	s.overlayVMLimits(fresh)
	var out *vmctl.VM
	for i := range fresh {
		if fresh[i].Name == req.Name {
			out = &fresh[i]
		}
	}
	writeJSON(w, http.StatusOK, map[string]any{"ok": true, "vm": out})
}

// vmKnown reports whether libvirt knows a domain called name.
func (s *Server) vmKnown(ctx context.Context, name string) (bool, error) {
	vms, err := s.VMs.List(ctx)
	if err != nil {
		return false, err
	}
	for _, v := range vms {
		if v.Name == name {
			return true, nil
		}
	}
	return false, nil
}

// handleGetVMDisks lists one domain's resizable disks for the VM tab's resize editor.
func (s *Server) handleGetVMDisks(w http.ResponseWriter, r *http.Request) {
	if s.VMs == nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "vm backend disabled"})
		return
	}
	name := strings.TrimSpace(r.URL.Query().Get("name"))
	if name == "" {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "name required"})
		return
	}
	ok, err := s.vmKnown(r.Context(), name)
	if err != nil {
		writeErr(w, http.StatusInternalServerError, err)
		return
	}
	if !ok {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "unknown vm: " + name})
		return
	}
	disks, err := s.VMs.Disks(r.Context(), name)
	if err != nil {
		writeErr(w, http.StatusInternalServerError, err)
		return
	}
	if disks == nil {
		disks = []vmctl.Disk{}
	}
	writeJSON(w, http.StatusOK, disks)
}

// handleResizeVMDisk grows one disk of a domain to size_gib and answers with the
// refreshed disk list. vmctl refuses to shrink.
func (s *Server) handleResizeVMDisk(w http.ResponseWriter, r *http.Request) {
	if s.VMs == nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "vm backend disabled"})
		return
	}
	var req struct {
		Name    string  `json:"name"`
		Target  string  `json:"target"`
		SizeGiB float64 `json:"size_gib"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeErr(w, http.StatusBadRequest, err)
		return
	}
	req.Name = strings.TrimSpace(req.Name)
	req.Target = strings.TrimSpace(req.Target)
	if req.Name == "" || req.Target == "" {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "name and target required"})
		return
	}
	if req.SizeGiB <= 0 {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "size_gib must be > 0"})
		return
	}
	ok, err := s.vmKnown(r.Context(), req.Name)
	if err != nil {
		writeErr(w, http.StatusInternalServerError, err)
		return
	}
	if !ok {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "unknown vm: " + req.Name})
		return
	}
	newBytes := int64(req.SizeGiB * 1024 * 1024 * 1024)
	if err := s.VMs.ResizeDisk(r.Context(), req.Name, req.Target, newBytes); err != nil {
		log.Printf("vmdiskresize: %s %s: %v", req.Name, req.Target, err)
		writeErr(w, http.StatusInternalServerError, err)
		return
	}
	log.Printf("vmdiskresize: %s %s -> %.1f GiB", req.Name, req.Target, req.SizeGiB)
	disks, _ := s.VMs.Disks(r.Context(), req.Name)
	if disks == nil {
		disks = []vmctl.Disk{}
	}
	writeJSON(w, http.StatusOK, map[string]any{"ok": true, "disks": disks})
}

// known reports whether name is an existing container.
func (s *Server) known(ctx context.Context, name string) (bool, error) {
	containers, err := s.Docker.List(ctx)
	if err != nil {
		return false, err
	}
	for _, c := range containers {
		if c.Name == name {
			return true, nil
		}
	}
	return false, nil
}

type stateResp struct {
	Plan        model.Plan        `json:"plan"`
	Containers  []model.Container `json:"containers"`
	LastRun     model.RunResult   `json:"last_run"`
	DockerError string            `json:"docker_error,omitempty"`
	HostCPUs    int               `json:"host_cpus"`              // logical CPUs
	HostCoreOf  []int             `json:"host_core_of,omitempty"` // physical core id per logical CPU
	HostPCores  []int             `json:"host_pcores,omitempty"`  // Intel hybrid P-core CPUs
	HostECores  []int             `json:"host_ecores,omitempty"`  // Intel hybrid E-core CPUs
	HostMem     int64             `json:"host_mem,omitempty"`     // total RAM in bytes
	Version     string            `json:"version,omitempty"`
}

func (s *Server) handleState(w http.ResponseWriter, r *http.Request) {
	plan, err := s.Store.Load()
	if err != nil {
		writeErr(w, http.StatusInternalServerError, err)
		return
	}
	resp := stateResp{Plan: plan, HostCPUs: hostcpu.Count(), HostCoreOf: hostcpu.CoreOf(), HostMem: s.hostMem(r.Context()), Version: s.Version}
	resp.HostPCores, resp.HostECores = hostcpu.HybridPE()
	containers, derr := s.Docker.List(r.Context())
	if derr != nil {
		// The panel still shows the plan and the last run when Docker hiccups.
		resp.DockerError = derr.Error()
	} else {
		resp.Containers = containers
	}
	s.mu.Lock()
	resp.LastRun = s.lastRun
	s.mu.Unlock()
	writeJSON(w, http.StatusOK, resp)
}

func (s *Server) handleGetPlan(w http.ResponseWriter, _ *http.Request) {
	plan, err := s.Store.Load()
	if err != nil {
		writeErr(w, http.StatusInternalServerError, err)
		return
	}
	writeJSON(w, http.StatusOK, plan)
}

func (s *Server) handlePutPlan(w http.ResponseWriter, r *http.Request) {
	var plan model.Plan
	if err := json.NewDecoder(r.Body).Decode(&plan); err != nil {
		writeErr(w, http.StatusBadRequest, err)
		return
	}
	if _, err := orchestrator.TopoStages(plan); err != nil {
		writeErr(w, http.StatusBadRequest, err)
		return
	}
	if err := s.Store.Save(plan); err != nil {
		writeErr(w, http.StatusInternalServerError, err)
		return
	}
	writeJSON(w, http.StatusOK, map[string]string{"status": "saved"})
}

func (s *Server) handleApply(w http.ResponseWriter, r *http.Request) {
	plan, err := s.Store.Load()
	if err != nil {
		writeErr(w, http.StatusInternalServerError, err)
		return
	}
	res := s.Runner.Run(r.Context(), plan)
	s.mu.Lock()
	s.lastRun = res
	s.mu.Unlock()
	writeJSON(w, http.StatusOK, res)
}

// handleAction performs a single lifecycle verb on one container. The container
// name is validated against the live list before anything is sent to the socket.
func (s *Server) handleAction(w http.ResponseWriter, r *http.Request) {
	var req struct {
		Name   string `json:"name"`
		Action string `json:"action"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeErr(w, http.StatusBadRequest, err)
		return
	}
	containers, err := s.Docker.List(r.Context())
	if err != nil {
		writeErr(w, http.StatusInternalServerError, err)
		return
	}
	known := false
	for _, c := range containers {
		if c.Name == req.Name {
			known = true
			break
		}
	}
	if !known {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "unknown container: " + req.Name})
		return
	}

	var aerr error
	switch req.Action {
	case "start":
		aerr = s.Docker.Start(r.Context(), req.Name)
	case "stop":
		aerr = s.Docker.Stop(r.Context(), req.Name)
	case "restart":
		aerr = s.Docker.Restart(r.Context(), req.Name)
	case "pause":
		aerr = s.Docker.Pause(r.Context(), req.Name)
	case "unpause":
		aerr = s.Docker.Unpause(r.Context(), req.Name)
	default:
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "unknown action: " + req.Action})
		return
	}
	if aerr != nil {
		writeErr(w, http.StatusInternalServerError, aerr)
		return
	}
	writeJSON(w, http.StatusOK, map[string]string{"status": "ok"})
}

// perCallTimeout bounds each container's call in the handleStats and
// handleGetLimits fan-outs. Right after a container is recreated dockerd can take
// 30s or more to answer for it, and one straggler would otherwise hold up the
// whole response and the Docker tab's polling with it.
const perCallTimeout = 8 * time.Second

// handleStats returns a resource snapshot for every running container, keyed by
// name. At most six fetches run at once so a big host does not flood the socket.
func (s *Server) handleStats(w http.ResponseWriter, r *http.Request) {
	containers, err := s.Docker.List(r.Context())
	if err != nil {
		writeErr(w, http.StatusInternalServerError, err)
		return
	}
	out := map[string]model.Stats{}
	var mu sync.Mutex
	var wg sync.WaitGroup
	sem := make(chan struct{}, 6)
	for _, c := range containers {
		if c.State != "running" {
			continue
		}
		wg.Add(1)
		sem <- struct{}{}
		go func(name string) {
			defer wg.Done()
			defer func() { <-sem }()
			cctx, cancel := context.WithTimeout(r.Context(), perCallTimeout)
			defer cancel()
			st, serr := s.Docker.Stats(cctx, name)
			if serr != nil {
				return
			}
			mu.Lock()
			out[name] = st
			mu.Unlock()
		}(c.Name)
	}
	wg.Wait()
	writeJSON(w, http.StatusOK, out)
}

// handleGetLimits returns configured resource caps (0 means none): one
// container's with ?name=, otherwise a map of every container's, so the panel can
// mark the limited ones in a single round trip.
func (s *Server) handleGetLimits(w http.ResponseWriter, r *http.Request) {
	name := r.URL.Query().Get("name")
	if name == "" {
		containers, err := s.Docker.List(r.Context())
		if err != nil {
			writeErr(w, http.StatusInternalServerError, err)
			return
		}
		out := map[string]model.Limits{}
		var mu sync.Mutex
		var wg sync.WaitGroup
		sem := make(chan struct{}, 6)
		for _, c := range containers {
			wg.Add(1)
			sem <- struct{}{}
			go func(nm string) {
				defer wg.Done()
				defer func() { <-sem }()
				cctx, cancel := context.WithTimeout(r.Context(), perCallTimeout)
				defer cancel()
				lim, lerr := s.Docker.Limits(cctx, nm)
				if lerr != nil {
					return
				}
				mu.Lock()
				out[nm] = lim
				mu.Unlock()
			}(c.Name)
		}
		wg.Wait()
		writeJSON(w, http.StatusOK, out)
		return
	}
	ok, err := s.known(r.Context(), name)
	if err != nil {
		writeErr(w, http.StatusInternalServerError, err)
		return
	}
	if !ok {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "unknown container: " + name})
		return
	}
	lim, err := s.Docker.Limits(r.Context(), name)
	if err != nil {
		writeErr(w, http.StatusInternalServerError, err)
		return
	}
	writeJSON(w, http.StatusOK, lim)
}

// handleSetLimits sets a container's memory and CPU caps through a Docker update.
// A zero field is left unchanged, because Docker's update ignores 0.
//
// Docker cannot unset a cap on a running container, so remove_mem and remove_cpu
// raise the cap to all host RAM or all host CPUs and strip the flag from the
// template, and the next recreate starts without one. The host totals come from
// the server because the browser's copy can still be 0.
func (s *Server) handleSetLimits(w http.ResponseWriter, r *http.Request) {
	var req struct {
		Name       string `json:"name"`
		MemBytes   int64  `json:"mem_bytes"`
		NanoCPUs   int64  `json:"nano_cpus"`
		CpusetCPUs string `json:"cpuset_cpus"`
		RemoveMem  bool   `json:"remove_mem"`
		RemoveCPU  bool   `json:"remove_cpu"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeErr(w, http.StatusBadRequest, err)
		return
	}
	// If the host totals cannot be read, the live cap stays, but the template
	// strip below still drops it on the next recreate.
	if req.RemoveMem {
		if mt := s.hostMem(r.Context()); mt > 0 {
			req.MemBytes = mt
		}
	}
	// A GB figure with decimals lands between whole megabytes; rounding to one keeps
	// the template readable ("1362M") and the live cap equal to it.
	if !req.RemoveMem && req.MemBytes >= 1<<20 {
		req.MemBytes = (req.MemBytes + 1<<19) >> 20 << 20
	}
	if req.RemoveCPU {
		if n := hostcpu.Count(); n > 0 {
			req.NanoCPUs = int64(n) * 1e9
			req.CpusetCPUs = "0-" + strconv.Itoa(n-1)
		}
	}
	if req.CpusetCPUs != "" && !validCpuset(req.CpusetCPUs) {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "bad cpuset (want a cpu list like 0-3,6): " + req.CpusetCPUs})
		return
	}
	ok, err := s.known(r.Context(), req.Name)
	if err != nil {
		writeErr(w, http.StatusInternalServerError, err)
		return
	}
	if !ok {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "unknown container: " + req.Name})
		return
	}
	// The limit goes into the Unraid template too, or the next Apply recreates the
	// container without it. This runs before the live update and whatever its
	// result, so a removal still reaches the template when the update fails.
	tmplResult := "template: no change"
	if s.TemplatesDir != "" {
		// Every flag of the touched family is stripped (an empty value removes it)
		// and only CC's value added back, so a stale template cap cannot return on a
		// recreate. --memory-swap is never written: it needs the memsw cgroup, which
		// hosts without swap accounting lack.
		flags := map[string]string{}
		if req.RemoveMem || req.MemBytes > 0 {
			flags["--memory"] = ""
			flags["-m"] = ""
			flags["--memory-swap"] = ""
			flags["--memory-reservation"] = "" // a soft cap would fight the hard cap
			if !req.RemoveMem {
				flags["--memory"] = unraidtmpl.FormatMemory(req.MemBytes)
			}
		}
		if req.RemoveCPU || req.NanoCPUs > 0 || req.CpusetCPUs != "" {
			flags["--cpus"] = ""
			flags["--cpuset-cpus"] = ""
			flags["--cpu-shares"] = "" // a relative weight would fight the absolute cap
			if !req.RemoveCPU {
				if req.NanoCPUs > 0 {
					// 'f' because docker run --cpus rejects scientific notation such as 1e-06.
					flags["--cpus"] = strconv.FormatFloat(float64(req.NanoCPUs)/1e9, 'f', -1, 64)
				}
				if req.CpusetCPUs != "" {
					flags["--cpuset-cpus"] = req.CpusetCPUs
				}
			}
		}
		if len(flags) > 0 {
			// A failed template write means the next recreate loses the limit, so
			// the result goes into the diagnostics log.
			if merr := unraidtmpl.SetExtraParams(s.TemplatesDir, req.Name, flags); merr != nil {
				tmplResult = "template FAILED: " + merr.Error()
			} else {
				tmplResult = "template ok"
			}
		}
	}
	// Each operation is recorded and, on success, checked by reading the live caps
	// back, so the Settings diagnostics card can show whether it took effect.
	reqTxt := "mem=" + strconv.FormatInt(req.MemBytes, 10) + " nano=" + strconv.FormatInt(req.NanoCPUs, 10) + " cpuset=" + req.CpusetCPUs
	if req.RemoveMem {
		reqTxt += " remove_mem"
	}
	if req.RemoveCPU {
		reqTxt += " remove_cpu"
	}
	if err := s.Docker.UpdateResources(r.Context(), req.Name, model.Limits{MemBytes: req.MemBytes, NanoCPUs: req.NanoCPUs, CpusetCPUs: req.CpusetCPUs}); err != nil {
		s.recordOp(req.Name, reqTxt, err.Error(), tmplResult)
		writeErr(w, http.StatusInternalServerError, err)
		return
	}
	after := map[string]any{"status": "ok", "template": tmplResult}
	afterTxt := ""
	if l, e := s.Docker.Limits(r.Context(), req.Name); e == nil {
		after["after_mem"] = l.MemBytes
		after["after_nano"] = l.NanoCPUs
		after["after_cpuset"] = l.CpusetCPUs
		afterTxt = "mem=" + strconv.FormatInt(l.MemBytes, 10) + " nano=" + strconv.FormatInt(l.NanoCPUs, 10) + " cpuset=" + l.CpusetCPUs
	} else {
		after["after_error"] = e.Error()
		afterTxt = "verify FAILED: " + e.Error()
	}
	s.recordOp(req.Name, reqTxt, "ok", afterTxt+" · "+tmplResult)
	writeJSON(w, http.StatusOK, after)
}

// handleSetRestartPolicy sets a container's restart policy through a Docker
// update and writes it into the Unraid template, so a recreate keeps it. Like
// handleSetLimits it writes the template first, then updates, then reads back.
func (s *Server) handleSetRestartPolicy(w http.ResponseWriter, r *http.Request) {
	var req struct {
		Name   string `json:"name"`
		Policy string `json:"policy"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeErr(w, http.StatusBadRequest, err)
		return
	}
	req.Name = strings.TrimSpace(req.Name)
	req.Policy = strings.TrimSpace(req.Policy)
	if !validRestartPolicy(req.Policy) {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "bad restart policy (want no|unless-stopped|always|on-failure): " + req.Policy})
		return
	}
	ok, err := s.known(r.Context(), req.Name)
	if err != nil {
		writeErr(w, http.StatusInternalServerError, err)
		return
	}
	if !ok {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "unknown container: " + req.Name})
		return
	}
	// SetExtraParams replaces only --restart, so the CPU and RAM caps written by
	// handleSetLimits stay as they are.
	tmplResult := "template: no change"
	if s.TemplatesDir != "" {
		if merr := unraidtmpl.SetExtraParams(s.TemplatesDir, req.Name, map[string]string{"--restart": req.Policy}); merr != nil {
			tmplResult = "template FAILED: " + merr.Error()
		} else {
			tmplResult = "template ok"
		}
	}
	reqTxt := "restart=" + req.Policy
	if err := s.Docker.SetRestartPolicy(r.Context(), req.Name, req.Policy); err != nil {
		s.recordOp(req.Name, reqTxt, err.Error(), tmplResult)
		writeErr(w, http.StatusInternalServerError, err)
		return
	}
	after := map[string]any{"status": "ok", "template": tmplResult}
	afterTxt := ""
	if l, e := s.Docker.Limits(r.Context(), req.Name); e == nil {
		after["after_policy"] = l.RestartPolicy
		afterTxt = "restart=" + l.RestartPolicy
	} else {
		after["after_error"] = e.Error()
		afterTxt = "verify FAILED: " + e.Error()
	}
	s.recordOp(req.Name, reqTxt, "ok", afterTxt+" · "+tmplResult)
	writeJSON(w, http.StatusOK, after)
}

// validRestartPolicy accepts Docker's four restart policy names. The value goes
// verbatim to Docker and into the template's --restart flag.
func validRestartPolicy(p string) bool {
	switch p {
	case "no", "unless-stopped", "always", "on-failure":
		return true
	}
	return false
}

func (s *Server) recordOp(name, req, result, after string) {
	log.Printf("limits: %s: %s -> %s %s", name, req, result, after)
}

// Pidder resolves a container's main process PID.
type Pidder interface {
	PID(ctx context.Context, ref string) (int, error)
}

// BwLaster reports the monitor's most recent shaping attempt for a container.
type BwLaster interface {
	LastBwApply(name string) string
}

// Kicker triggers an immediate monitor tick.
type Kicker interface {
	Kick()
}

// handleBwStatus reads the live qdisc and CC_DL netfilter chain inside the
// container's network namespace, so the UI can show whether the bandwidth limit
// is in place or why not.
func (s *Server) handleBwStatus(w http.ResponseWriter, r *http.Request) {
	name := r.URL.Query().Get("name")
	if ok, err := s.known(r.Context(), name); err != nil || !ok {
		writeErr(w, http.StatusBadRequest, fmt.Errorf("unknown container %q", name))
		return
	}
	if s.Pidder == nil {
		writeErr(w, http.StatusInternalServerError, fmt.Errorf("no pid resolver"))
		return
	}
	pid, err := s.Pidder.PID(r.Context(), name)
	if err != nil || pid <= 0 {
		writeJSON(w, http.StatusOK, map[string]any{"error": "container not running (no pid)"})
		return
	}
	iface := ""
	if cfg, cerr := s.Store.LoadConfig(); cerr == nil {
		iface = strings.TrimSpace(cfg.ShapeIface)
	}
	if iface == "" {
		iface = netshape.DetectIface(pid)
	}
	qdisc, filter := netshape.Show(iface, pid)
	last := ""
	if s.BwLast != nil {
		last = s.BwLast.LastBwApply(name)
	}
	writeJSON(w, http.StatusOK, map[string]any{"iface": iface, "pid": pid, "qdisc": qdisc, "filter": filter, "last_apply": last})
}

// handleGetConfig returns the automation config.
func (s *Server) handleGetConfig(w http.ResponseWriter, _ *http.Request) {
	cfg, err := s.Store.LoadConfig()
	if err != nil {
		writeErr(w, http.StatusInternalServerError, err)
		return
	}
	writeJSON(w, http.StatusOK, cfg)
}

// uiKey matches the browser-side settings the UI mirrors: cc., ccp., ccv. and the
// other per-area prefixes.
var uiKey = regexp.MustCompile(`^cc[a-z]*\.`)

// handlePutUISettings merges a few UI settings into the config, a null deleting
// one. A page that is closing sends its unsynced keys here in a single request,
// since it has no time left to read the config and write it back whole.
func (s *Server) handlePutUISettings(w http.ResponseWriter, r *http.Request) {
	var changes map[string]*string
	if err := json.NewDecoder(r.Body).Decode(&changes); err != nil {
		writeErr(w, http.StatusBadRequest, err)
		return
	}
	for k, v := range changes {
		if !uiKey.MatchString(k) || len(k) > 64 || (v != nil && len(*v) > 4096) {
			writeErr(w, http.StatusBadRequest, fmt.Errorf("bad ui setting: %s", k))
			return
		}
	}
	if err := s.Store.MergeUISettings(changes); err != nil {
		code := http.StatusInternalServerError
		if errors.Is(err, store.ErrTooManyUISettings) {
			code = http.StatusBadRequest
		}
		writeErr(w, code, err)
		return
	}
	writeJSON(w, http.StatusOK, map[string]string{"status": "saved"})
}

// handlePutConfig validates and saves the automation config. Schedules may only
// start, stop or restart.
func (s *Server) handlePutConfig(w http.ResponseWriter, r *http.Request) {
	var cfg model.Config
	if err := json.NewDecoder(r.Body).Decode(&cfg); err != nil {
		writeErr(w, http.StatusBadRequest, err)
		return
	}
	// The per-area key prefixes (cc., ccp., ccv. and so on) push the UI settings
	// well past 64 keys, and the browser ignores a failed sync (#74). At 64+4096
	// bytes per entry, 512 entries stay around 2MB.
	if len(cfg.UISettings) > store.MaxUISettings {
		writeErr(w, http.StatusBadRequest, fmt.Errorf("too many ui settings"))
		return
	}
	for k, v := range cfg.UISettings {
		if len(k) > 64 || len(v) > 4096 {
			writeErr(w, http.StatusBadRequest, fmt.Errorf("ui setting too large: %s", k))
			return
		}
	}
	for _, sc := range cfg.Schedules {
		if sc.Action != "start" && sc.Action != "stop" && sc.Action != "restart" {
			writeJSON(w, http.StatusBadRequest, map[string]string{"error": "bad schedule action: " + sc.Action})
			return
		}
		if !validScheduleTime(sc.Time) {
			writeJSON(w, http.StatusBadRequest, map[string]string{"error": "bad schedule time (want HH:MM, zero-padded): " + sc.Time})
			return
		}
		for _, d := range sc.Days {
			if d < 0 || d > 6 {
				writeJSON(w, http.StatusBadRequest, map[string]string{"error": "bad schedule day (want 0-6)"})
				return
			}
		}
	}
	for _, b := range cfg.Bandwidths {
		if b.Name == "" {
			writeJSON(w, http.StatusBadRequest, map[string]string{"error": "bandwidth entry with no container name"})
			return
		}
		if b.EgressKbit < 0 || b.EgressKbit > 10_000_000 || b.IngressKbit < 0 || b.IngressKbit > 10_000_000 {
			writeJSON(w, http.StatusBadRequest, map[string]string{"error": "bad bandwidth rate (want 0-10000000 kbit)"})
			return
		}
	}
	if cfg.ShapeIface != "" && !validIface(cfg.ShapeIface) {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "bad shaping interface (want a name like eth0, br0.20)"})
		return
	}
	for _, is := range cfg.IdleStops {
		if is.Name == "" {
			writeJSON(w, http.StatusBadRequest, map[string]string{"error": "idle-stop entry with no container name"})
			return
		}
		if is.IdleMinutes < 0 || is.IdleMinutes > 44640 { // 31 days; 0 disables the entry
			writeJSON(w, http.StatusBadRequest, map[string]string{"error": "bad idle-stop minutes (want 0-44640)"})
			return
		}
		if is.CPUThresholdPct < 0 || is.CPUThresholdPct > 100 {
			writeJSON(w, http.StatusBadRequest, map[string]string{"error": "bad idle-stop CPU threshold (want 0-100)"})
			return
		}
	}
	if err := s.Store.SaveConfig(cfg); err != nil {
		writeErr(w, http.StatusInternalServerError, err)
		return
	}
	if s.Kicker != nil {
		s.Kicker.Kick()
	}
	writeJSON(w, http.StatusOK, map[string]string{"status": "saved"})
}

// validScheduleTime requires a zero-padded 24h "HH:MM". The monitor compares the
// string with now.Format("15:04"), so a time.Parse-accepted "9:00" would never fire.
func validScheduleTime(s string) bool {
	if len(s) != 5 || s[2] != ':' {
		return false
	}
	for i := 0; i < 5; i++ {
		if i == 2 {
			continue
		}
		if s[i] < '0' || s[i] > '9' {
			return false
		}
	}
	h := int(s[0]-'0')*10 + int(s[1]-'0')
	m := int(s[3]-'0')*10 + int(s[4]-'0')
	return h <= 23 && m <= 59
}

// validIface accepts a Linux interface name such as "eth0" or "br0.20": letters,
// digits and . _ : - within the kernel's 15-character limit.
func validIface(s string) bool {
	if len(s) == 0 || len(s) > 15 {
		return false
	}
	for i := 0; i < len(s); i++ {
		c := s[i]
		switch {
		case c >= 'a' && c <= 'z', c >= 'A' && c <= 'Z', c >= '0' && c <= '9',
			c == '.', c == '_', c == '-', c == ':':
			continue
		default:
			return false
		}
	}
	return true
}

// validCpuset accepts a Linux cpu list such as "0-3,6". The value goes verbatim
// to Docker's CpusetCpus.
func validCpuset(s string) bool {
	if len(s) == 0 || len(s) > 128 {
		return false
	}
	for i := 0; i < len(s); i++ {
		c := s[i]
		digit := c >= '0' && c <= '9'
		if !digit && c != ',' && c != '-' {
			return false
		}
	}
	return true
}

func writeJSON(w http.ResponseWriter, code int, v any) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(code)
	_ = json.NewEncoder(w).Encode(v)
}

func writeErr(w http.ResponseWriter, code int, err error) {
	writeJSON(w, code, map[string]string{"error": err.Error()})
}
