// Package dockercli is a small client for the Docker Engine API over the host's
// unix socket. It reads and changes container state but has no create or build,
// and Exec serves only the readiness prober's exec probe.
package dockercli

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"log"
	"net"
	"net/http"
	"net/url"
	"sort"
	"strconv"
	"strings"
	"time"

	"github.com/junkerderprovinz/towertorch/internal/model"
)

// apiVersion is pinned because Engine 29 rejects versions older than v1.44.
const apiVersion = "v1.44"

// Client talks to a Docker daemon.
type Client struct {
	hc   *http.Client
	base string
}

// New builds a client over an explicit http.Client and base URL.
func New(hc *http.Client, base string) *Client {
	return &Client{hc: hc, base: strings.TrimRight(base, "/")}
}

// NewUnix builds a client that dials the Docker daemon over its unix socket.
func NewUnix(socket string) *Client {
	hc := &http.Client{
		Timeout: 30 * time.Second,
		Transport: &http.Transport{
			DialContext: func(ctx context.Context, _, _ string) (net.Conn, error) {
				var d net.Dialer
				return d.DialContext(ctx, "unix", socket)
			},
		},
	}
	return &Client{hc: hc, base: "http://docker"}
}

func (c *Client) do(ctx context.Context, method, path string) (*http.Response, error) {
	req, err := http.NewRequestWithContext(ctx, method, c.base+"/"+apiVersion+path, nil)
	if err != nil {
		return nil, err
	}
	return c.hc.Do(req)
}

func apiError(resp *http.Response) error {
	body, _ := io.ReadAll(io.LimitReader(resp.Body, 2048))
	msg := strings.TrimSpace(string(body))
	if msg == "" {
		return fmt.Errorf("docker api: %s", resp.Status)
	}
	return fmt.Errorf("docker api: %s: %s", resp.Status, msg)
}

type apiPort struct {
	PrivatePort int    `json:"PrivatePort"`
	PublicPort  int    `json:"PublicPort"`
	Type        string `json:"Type"`
}

type apiNetwork struct {
	IPAddress  string `json:"IPAddress"` // empty while the container is stopped
	IPAMConfig *struct {
		IPv4Address string `json:"IPv4Address"` // configured static IP, kept while stopped
	} `json:"IPAMConfig"`
}

type apiMount struct {
	Type        string `json:"Type"`
	Source      string `json:"Source"`
	Destination string `json:"Destination"`
	RW          bool   `json:"RW"`
}

type apiContainer struct {
	ID              string     `json:"Id"`
	Names           []string   `json:"Names"`
	Image           string     `json:"Image"`
	State           string     `json:"State"`
	Status          string     `json:"Status"`
	Ports           []apiPort  `json:"Ports"`
	Mounts          []apiMount `json:"Mounts"`
	NetworkSettings struct {
		Networks map[string]apiNetwork `json:"Networks"`
	} `json:"NetworkSettings"`
}

// List returns every container on the host (running or not).
func (c *Client) List(ctx context.Context) ([]model.Container, error) {
	resp, err := c.do(ctx, "GET", "/containers/json?all=1")
	if err != nil {
		return nil, err
	}
	defer func() { _ = resp.Body.Close() }()
	if resp.StatusCode != http.StatusOK {
		return nil, apiError(resp)
	}
	var raw []apiContainer
	if err := json.NewDecoder(resp.Body).Decode(&raw); err != nil {
		return nil, fmt.Errorf("decode containers: %w", err)
	}
	out := make([]model.Container, 0, len(raw))
	for _, r := range raw {
		net, ip := firstNetwork(r.NetworkSettings.Networks)
		ports := formatPorts(r.Ports)
		// The list has no ports for a stopped container, so those get an inspect (#10).
		if len(ports) == 0 && r.State != "running" {
			ports = c.portsFor(ctx, r.ID)
		}
		out = append(out, model.Container{
			ID:       r.ID,
			Name:     firstName(r.Names),
			Image:    r.Image,
			State:    r.State,
			ExitCode: exitCodeFromStatus(r.Status),
			Health:   healthFromStatus(r.Status),
			Network:  net,
			IP:       ip,
			Ports:    ports,
			Mounts:   formatMounts(r.Mounts),
		})
	}
	return out, nil
}

// formatMounts keeps the mounts that map to a path inside the container.
func formatMounts(mounts []apiMount) []model.Mount {
	out := make([]model.Mount, 0, len(mounts))
	for _, m := range mounts {
		if m.Destination == "" {
			continue
		}
		out = append(out, model.Mount{Source: m.Source, Dest: m.Destination, RW: m.RW})
	}
	return out
}

// firstNetwork returns the alphabetically first network and its IP, falling back
// to the configured static IP while the container is stopped.
func firstNetwork(nets map[string]apiNetwork) (string, string) {
	if len(nets) == 0 {
		return "", ""
	}
	names := make([]string, 0, len(nets))
	for k := range nets {
		names = append(names, k)
	}
	sort.Strings(names)
	n := nets[names[0]]
	ip := n.IPAddress
	if ip == "" && n.IPAMConfig != nil {
		ip = n.IPAMConfig.IPv4Address
	}
	return names[0], ip
}

// formatPorts renders published ports as "public:private/proto" (or just
// "private/proto" when unpublished), de-duplicated.
func formatPorts(ports []apiPort) []string {
	out := make([]string, 0, len(ports))
	seen := map[string]bool{}
	for _, p := range ports {
		var s string
		if p.PublicPort != 0 {
			s = fmt.Sprintf("%d:%d/%s", p.PublicPort, p.PrivatePort, p.Type)
		} else {
			s = fmt.Sprintf("%d/%s", p.PrivatePort, p.Type)
		}
		if s != "" && !seen[s] {
			seen[s] = true
			out = append(out, s)
		}
	}
	return out
}

// portsFor reads a stopped container's port mappings from HostConfig.PortBindings,
// which survive a stop, formatted and sorted like formatPorts. Without bindings it
// returns the exposed ports, and on any error nil.
func (c *Client) portsFor(ctx context.Context, ref string) []string {
	resp, err := c.do(ctx, "GET", "/containers/"+url.PathEscape(ref)+"/json")
	if err != nil {
		return nil
	}
	defer func() { _ = resp.Body.Close() }()
	if resp.StatusCode != http.StatusOK {
		return nil
	}
	var raw struct {
		HostConfig struct {
			PortBindings map[string][]struct {
				HostPort string `json:"HostPort"`
			} `json:"PortBindings"`
		} `json:"HostConfig"`
		Config struct {
			ExposedPorts map[string]struct{} `json:"ExposedPorts"`
		} `json:"Config"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&raw); err != nil {
		return nil
	}
	out := make([]string, 0, len(raw.HostConfig.PortBindings))
	seen := map[string]bool{}
	keys := make([]string, 0, len(raw.HostConfig.PortBindings))
	for k := range raw.HostConfig.PortBindings {
		keys = append(keys, k)
	}
	sort.Strings(keys)
	for _, k := range keys {
		binds := raw.HostConfig.PortBindings[k]
		if len(binds) == 0 {
			if !seen[k] {
				seen[k] = true
				out = append(out, k)
			}
			continue
		}
		for _, b := range binds {
			s := k
			if b.HostPort != "" {
				s = b.HostPort + ":" + k
			}
			if !seen[s] {
				seen[s] = true
				out = append(out, s)
			}
		}
	}
	if len(out) == 0 {
		ek := make([]string, 0, len(raw.Config.ExposedPorts))
		for k := range raw.Config.ExposedPorts {
			ek = append(ek, k)
		}
		sort.Strings(ek)
		for _, k := range ek {
			if !seen[k] {
				seen[k] = true
				out = append(out, k)
			}
		}
	}
	return out
}

// Inspect is the live state of one container.
type Inspect struct {
	Running bool
	Health  string // "healthy" / "unhealthy" / "starting" / "none"
	IP      string
}

func (c *Client) Inspect(ctx context.Context, ref string) (Inspect, error) {
	resp, err := c.do(ctx, "GET", "/containers/"+url.PathEscape(ref)+"/json")
	if err != nil {
		return Inspect{}, err
	}
	defer func() { _ = resp.Body.Close() }()
	if resp.StatusCode != http.StatusOK {
		return Inspect{}, apiError(resp)
	}
	var raw struct {
		State struct {
			Running bool `json:"Running"`
			Health  *struct {
				Status string `json:"Status"`
			} `json:"Health"`
		} `json:"State"`
		NetworkSettings struct {
			IPAddress string `json:"IPAddress"`
		} `json:"NetworkSettings"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&raw); err != nil {
		return Inspect{}, fmt.Errorf("decode inspect: %w", err)
	}
	ins := Inspect{Running: raw.State.Running, IP: raw.NetworkSettings.IPAddress, Health: "none"}
	if raw.State.Health != nil && raw.State.Health.Status != "" {
		ins.Health = raw.State.Health.Status
	}
	return ins, nil
}

// PID returns the container's main process id on the host, or 0 when it is not
// running.
func (c *Client) PID(ctx context.Context, ref string) (int, error) {
	resp, err := c.do(ctx, "GET", "/containers/"+url.PathEscape(ref)+"/json")
	if err != nil {
		return 0, err
	}
	defer func() { _ = resp.Body.Close() }()
	if resp.StatusCode != http.StatusOK {
		return 0, apiError(resp)
	}
	var raw struct {
		State struct {
			Pid int `json:"Pid"`
		} `json:"State"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&raw); err != nil {
		return 0, fmt.Errorf("decode pid: %w", err)
	}
	return raw.State.Pid, nil
}

// Start starts a container. An already-running container (304) is not an error.
func (c *Client) Start(ctx context.Context, ref string) error {
	return c.post(ctx, "/containers/"+url.PathEscape(ref)+"/start")
}

// Stop stops a container. An already-stopped container (304) is not an error.
func (c *Client) Stop(ctx context.Context, ref string) error {
	return c.post(ctx, "/containers/"+url.PathEscape(ref)+"/stop")
}

// Restart restarts a container.
func (c *Client) Restart(ctx context.Context, ref string) error {
	return c.post(ctx, "/containers/"+url.PathEscape(ref)+"/restart")
}

// Pause pauses a running container.
func (c *Client) Pause(ctx context.Context, ref string) error {
	return c.post(ctx, "/containers/"+url.PathEscape(ref)+"/pause")
}

// Unpause resumes a paused container.
func (c *Client) Unpause(ctx context.Context, ref string) error {
	return c.post(ctx, "/containers/"+url.PathEscape(ref)+"/unpause")
}

func (c *Client) post(ctx context.Context, path string) error {
	resp, err := c.do(ctx, "POST", path)
	if err != nil {
		return err
	}
	defer func() { _ = resp.Body.Close() }()
	// 304 means the container is already in that state.
	if resp.StatusCode == http.StatusNoContent || resp.StatusCode == http.StatusNotModified {
		return nil
	}
	return apiError(resp)
}

// doBody issues a request with a JSON body.
func (c *Client) doBody(ctx context.Context, method, path string, body any) (*http.Response, error) {
	var r io.Reader
	if body != nil {
		b, err := json.Marshal(body)
		if err != nil {
			return nil, err
		}
		r = bytes.NewReader(b)
	}
	req, err := http.NewRequestWithContext(ctx, method, c.base+"/"+apiVersion+path, r)
	if err != nil {
		return nil, err
	}
	req.Header.Set("Content-Type", "application/json")
	return c.hc.Do(req)
}

// Limits reads a container's configured resource caps and restart policy.
func (c *Client) Limits(ctx context.Context, ref string) (model.Limits, error) {
	resp, err := c.do(ctx, "GET", "/containers/"+url.PathEscape(ref)+"/json")
	if err != nil {
		return model.Limits{}, err
	}
	defer func() { _ = resp.Body.Close() }()
	if resp.StatusCode != http.StatusOK {
		return model.Limits{}, apiError(resp)
	}
	var raw struct {
		HostConfig struct {
			Memory        int64  `json:"Memory"`
			NanoCpus      int64  `json:"NanoCpus"`
			CpuQuota      int64  `json:"CpuQuota"`
			CpuPeriod     int64  `json:"CpuPeriod"`
			CpusetCpus    string `json:"CpusetCpus"`
			RestartPolicy struct {
				Name string `json:"Name"`
			} `json:"RestartPolicy"`
		} `json:"HostConfig"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&raw); err != nil {
		return model.Limits{}, fmt.Errorf("decode limits: %w", err)
	}
	// A container capped with --cpu-quota and --cpu-period has NanoCpus 0, so the
	// effective CPU count is derived from those.
	nano := raw.HostConfig.NanoCpus
	if nano == 0 && raw.HostConfig.CpuQuota > 0 && raw.HostConfig.CpuPeriod > 0 {
		nano = raw.HostConfig.CpuQuota * 1_000_000_000 / raw.HostConfig.CpuPeriod
	}
	// Depending on the engine version an unset policy reads "no" or "".
	policy := raw.HostConfig.RestartPolicy.Name
	if policy == "" {
		policy = "no"
	}
	return model.Limits{MemBytes: raw.HostConfig.Memory, NanoCPUs: nano, CpusetCPUs: raw.HostConfig.CpusetCpus, RestartPolicy: policy}, nil
}

// HostMemTotal returns the host's total RAM in bytes as the daemon reports it, or
// 0 on any error. It backs up /proc/meminfo.
func (c *Client) HostMemTotal(ctx context.Context) int64 {
	resp, err := c.do(ctx, "GET", "/info")
	if err != nil {
		return 0
	}
	defer func() { _ = resp.Body.Close() }()
	if resp.StatusCode != http.StatusOK {
		return 0
	}
	var info struct {
		MemTotal int64 `json:"MemTotal"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&info); err != nil {
		return 0
	}
	return info.MemTotal
}

// UpdateResources sets a container's memory and CPU caps through Docker's
// container update, without a restart. A zero field leaves that cap unchanged.
func (c *Client) UpdateResources(ctx context.Context, ref string, l model.Limits) error {
	// moby validates an update against the stored HostConfig before merging
	// (UpdateContainer in container_unix.go), so the body depends on it.
	cur, err := c.hostCaps(ctx, ref)
	if err != nil {
		return fmt.Errorf("inspect %s before update: %w", ref, err)
	}
	body := map[string]any{}
	if l.MemBytes > 0 {
		body["Memory"] = l.MemBytes
		// moby rejects a Memory above the stored MemorySwap unless the body carries
		// a MemorySwap too. The comparison is on raw int64s, so a stored 0 or -1
		// fails for any positive Memory. Swap equal to memory means swap is off and
		// stays off; a Memory under a finite stored swap needs nothing; anything
		// else gets docker's create-time default of twice the memory, because
		// dockerd refuses -1 on an update.
		switch {
		case cur.Memory > 0 && cur.MemorySwap == cur.Memory:
			body["MemorySwap"] = l.MemBytes
		case cur.MemorySwap > 0 && l.MemBytes <= cur.MemorySwap:
		default:
			body["MemorySwap"] = 2 * l.MemBytes
		}
	}
	if l.NanoCPUs > 0 {
		// moby refuses NanoCpus while the stored HostConfig has a CFS quota or
		// period, and a stored period cannot be cleared, so such a container gets
		// the limit in its own scheme: CpuQuota = cpus * period.
		if cur.CpuQuota > 0 || cur.CpuPeriod > 0 {
			period := cur.CpuPeriod
			if period <= 0 {
				period = 100000 // Docker's default CFS period, 100ms
			}
			quota := l.NanoCPUs * period / 1_000_000_000
			if quota < 1000 {
				quota = 1000 // moby's minimum, 1ms
			}
			body["CpuQuota"] = quota
			body["CpuPeriod"] = period
		} else {
			body["NanoCpus"] = l.NanoCPUs
		}
	}
	if l.CpusetCPUs != "" {
		body["CpusetCpus"] = l.CpusetCPUs
	}
	if len(body) == 0 {
		return nil
	}
	err = c.postUpdate(ctx, ref, body)
	if err != nil && body["MemorySwap"] != nil && mentionsSwap(err) {
		// Daemons without the cgroup v1 memsw controller reject the swap field. The
		// first error is logged because the retry's error would hide it.
		log.Printf("dockercli: update %s with MemorySwap failed (%v), retrying without", ref, err)
		delete(body, "MemorySwap")
		err = c.postUpdate(ctx, ref, body)
	}
	return err
}

// SetRestartPolicy sets a container's restart policy through a container update.
// MaximumRetryCount stays 0, which Docker requires for every policy but
// on-failure and reads there as retry forever.
func (c *Client) SetRestartPolicy(ctx context.Context, ref, policy string) error {
	return c.postUpdate(ctx, ref, map[string]any{"RestartPolicy": map[string]any{"Name": policy}})
}

func (c *Client) postUpdate(ctx context.Context, ref string, body map[string]any) error {
	resp, err := c.doBody(ctx, "POST", "/containers/"+url.PathEscape(ref)+"/update", body)
	if err != nil {
		return err
	}
	defer func() { _ = resp.Body.Close() }()
	if resp.StatusCode != http.StatusOK {
		return apiError(resp)
	}
	return nil
}

// mentionsSwap reports whether a docker error is about the swap/memsw cgroup write.
func mentionsSwap(err error) bool {
	m := strings.ToLower(err.Error())
	return strings.Contains(m, "memsw") || strings.Contains(m, "swap")
}

// hostCaps are the stored HostConfig caps an update is built against.
type hostCaps struct {
	Memory, MemorySwap, NanoCpus, CpuQuota, CpuPeriod int64
}

func (c *Client) hostCaps(ctx context.Context, ref string) (hostCaps, error) {
	resp, err := c.do(ctx, "GET", "/containers/"+url.PathEscape(ref)+"/json")
	if err != nil {
		return hostCaps{}, err
	}
	defer func() { _ = resp.Body.Close() }()
	if resp.StatusCode != http.StatusOK {
		return hostCaps{}, apiError(resp)
	}
	var raw struct {
		HostConfig hostCaps `json:"HostConfig"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&raw); err != nil {
		return hostCaps{}, fmt.Errorf("decode hostcaps: %w", err)
	}
	return raw.HostConfig, nil
}

// Exec runs a command inside a container and returns its exit code.
func (c *Client) Exec(ctx context.Context, ref string, cmd []string) (int, error) {
	// The start below blocks until the attached output reaches EOF, which is when
	// the process exits. Without attached streams it returns at launch, and the
	// exit code read would race the command.
	resp, err := c.doBody(ctx, "POST", "/containers/"+url.PathEscape(ref)+"/exec",
		map[string]any{"AttachStdout": true, "AttachStderr": true, "Cmd": cmd})
	if err != nil {
		return -1, err
	}
	if resp.StatusCode != http.StatusCreated && resp.StatusCode != http.StatusOK {
		e := apiError(resp)
		_ = resp.Body.Close()
		return -1, e
	}
	var created struct {
		ID string `json:"Id"`
	}
	derr := json.NewDecoder(resp.Body).Decode(&created)
	_ = resp.Body.Close()
	if derr != nil {
		return -1, derr
	}
	if created.ID == "" {
		return -1, fmt.Errorf("exec create: no id")
	}
	startResp, err := c.doBody(ctx, "POST", "/exec/"+url.PathEscape(created.ID)+"/start",
		map[string]any{"Detach": false, "Tty": false})
	if err != nil {
		return -1, err
	}
	defer func() { _ = startResp.Body.Close() }()
	if startResp.StatusCode != http.StatusOK && startResp.StatusCode != http.StatusCreated {
		return -1, apiError(startResp)
	}
	_, _ = io.Copy(io.Discard, startResp.Body)
	insResp, err := c.do(ctx, "GET", "/exec/"+url.PathEscape(created.ID)+"/json")
	if err != nil {
		return -1, err
	}
	defer func() { _ = insResp.Body.Close() }()
	if insResp.StatusCode != http.StatusOK {
		return -1, apiError(insResp)
	}
	var ins struct {
		ExitCode int  `json:"ExitCode"`
		Running  bool `json:"Running"`
	}
	if err := json.NewDecoder(insResp.Body).Decode(&ins); err != nil {
		return -1, err
	}
	if ins.Running {
		return -1, fmt.Errorf("exec still running")
	}
	return ins.ExitCode, nil
}

// Logs returns the last tail lines of a container's stdout and stderr.
func (c *Client) Logs(ctx context.Context, ref string, tail int) (string, error) {
	if tail <= 0 {
		tail = 100
	}
	resp, err := c.do(ctx, "GET", "/containers/"+url.PathEscape(ref)+"/logs?stdout=1&stderr=1&tail="+strconv.Itoa(tail))
	if err != nil {
		return "", err
	}
	defer func() { _ = resp.Body.Close() }()
	if resp.StatusCode != http.StatusOK {
		return "", apiError(resp)
	}
	raw, _ := io.ReadAll(io.LimitReader(resp.Body, 1<<20))
	return demuxLogs(raw), nil
}

// demuxLogs strips Docker's 8-byte stream headers (stream, 0, 0, 0, big-endian
// size). A TTY container's logs have no headers and come back unchanged.
func demuxLogs(b []byte) string {
	// The stream byte is 1 or 2, never 0, so a raw line that starts with NUL is
	// not taken for a frame.
	framed := len(b) >= 8 && (b[0] == 1 || b[0] == 2) && b[1] == 0 && b[2] == 0 && b[3] == 0
	if !framed {
		return string(b)
	}
	var out []byte
	for len(b) >= 8 {
		size := int(b[4])<<24 | int(b[5])<<16 | int(b[6])<<8 | int(b[7])
		b = b[8:]
		if size < 0 || size > len(b) {
			size = len(b)
		}
		out = append(out, b[:size]...)
		b = b[size:]
	}
	return string(out)
}

// dockerStats is the part of the /stats response computeStats reads.
type dockerStats struct {
	CPUStats struct {
		CPUUsage struct {
			TotalUsage uint64 `json:"total_usage"`
		} `json:"cpu_usage"`
		SystemUsage uint64 `json:"system_cpu_usage"`
		OnlineCPUs  uint64 `json:"online_cpus"`
	} `json:"cpu_stats"`
	PreCPUStats struct {
		CPUUsage struct {
			TotalUsage uint64 `json:"total_usage"`
		} `json:"cpu_usage"`
		SystemUsage uint64 `json:"system_cpu_usage"`
	} `json:"precpu_stats"`
	MemoryStats struct {
		Usage uint64 `json:"usage"`
		Limit uint64 `json:"limit"`
		Stats struct {
			Cache uint64 `json:"cache"`
		} `json:"stats"`
	} `json:"memory_stats"`
	Networks map[string]struct {
		RxBytes uint64 `json:"rx_bytes"`
		TxBytes uint64 `json:"tx_bytes"`
	} `json:"networks"`
}

// Stats returns a one-shot resource snapshot (no streaming).
func (c *Client) Stats(ctx context.Context, ref string) (model.Stats, error) {
	resp, err := c.do(ctx, "GET", "/containers/"+url.PathEscape(ref)+"/stats?stream=false&one-shot=true")
	if err != nil {
		return model.Stats{}, err
	}
	defer func() { _ = resp.Body.Close() }()
	if resp.StatusCode != http.StatusOK {
		return model.Stats{}, apiError(resp)
	}
	var raw dockerStats
	if err := json.NewDecoder(resp.Body).Decode(&raw); err != nil {
		return model.Stats{}, fmt.Errorf("decode stats: %w", err)
	}
	return computeStats(raw), nil
}

// StatsLive returns a snapshot with the current CPU%. Without one-shot, dockerd
// samples twice about a second apart and fills precpu_stats, where Stats gives a
// lifetime average. The second it costs is why only idle-stop uses it.
func (c *Client) StatsLive(ctx context.Context, ref string) (model.Stats, error) {
	resp, err := c.do(ctx, "GET", "/containers/"+url.PathEscape(ref)+"/stats?stream=false")
	if err != nil {
		return model.Stats{}, err
	}
	defer func() { _ = resp.Body.Close() }()
	if resp.StatusCode != http.StatusOK {
		return model.Stats{}, apiError(resp)
	}
	var raw dockerStats
	if err := json.NewDecoder(resp.Body).Decode(&raw); err != nil {
		return model.Stats{}, fmt.Errorf("decode stats: %w", err)
	}
	return computeStats(raw), nil
}

// computeStats follows the docker CLI's CPU and memory math.
func computeStats(s dockerStats) model.Stats {
	out := model.Stats{}
	cpuDelta := float64(s.CPUStats.CPUUsage.TotalUsage) - float64(s.PreCPUStats.CPUUsage.TotalUsage)
	sysDelta := float64(s.CPUStats.SystemUsage) - float64(s.PreCPUStats.SystemUsage)
	cpus := float64(s.CPUStats.OnlineCPUs)
	if cpus == 0 {
		cpus = 1
	}
	if cpuDelta > 0 && sysDelta > 0 {
		out.CPUPercent = round2((cpuDelta / sysDelta) * cpus * 100)
	}
	// Memory used excludes page cache, matching `docker stats`.
	used := s.MemoryStats.Usage
	if s.MemoryStats.Stats.Cache <= used {
		used -= s.MemoryStats.Stats.Cache
	}
	out.MemUsed = used
	out.MemLimit = s.MemoryStats.Limit
	if s.MemoryStats.Limit > 0 {
		out.MemPercent = round2(float64(used) / float64(s.MemoryStats.Limit) * 100)
	}
	for _, n := range s.Networks {
		out.NetRx += n.RxBytes
		out.NetTx += n.TxBytes
	}
	return out
}

func round2(f float64) float64 {
	return float64(int64(f*100+0.5)) / 100
}

func firstName(names []string) string {
	if len(names) > 0 {
		return strings.TrimPrefix(names[0], "/")
	}
	return ""
}

// exitCodeFromStatus reads the exit code from a list Status such as
// "Exited (137) 5 minutes ago", which saves an inspect per container. Any other
// status gives 0.
func exitCodeFromStatus(status string) int {
	i := strings.Index(status, "Exited (")
	if i < 0 {
		return 0
	}
	rest := status[i+len("Exited ("):]
	j := strings.IndexByte(rest, ')')
	if j < 0 {
		return 0
	}
	n, err := strconv.Atoi(rest[:j])
	if err != nil {
		return 0
	}
	return n
}

// healthFromStatus reads the health from a list Status such as
// "Up 2 hours (healthy)".
func healthFromStatus(status string) string {
	switch {
	case strings.Contains(status, "(healthy)"):
		return "healthy"
	case strings.Contains(status, "(unhealthy)"):
		return "unhealthy"
	case strings.Contains(status, "health: starting"):
		return "starting"
	default:
		return ""
	}
}
