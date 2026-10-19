// Package model holds the types shared by the TowerTorch packages: the
// start plan, its run results and the automation config.
package model

// Container is a Docker container as discovered on the host (read-only view).
type Container struct {
	ID        string   `json:"id"`
	Name      string   `json:"name"`
	Image     string   `json:"image"`
	State     string   `json:"state"`               // "running" / "exited" / "created" / ...
	ExitCode  int      `json:"exit_code,omitempty"` // last exit code when State=="exited" (0 = clean stop)
	Health    string   `json:"health"`              // "healthy" / "unhealthy" / "starting" / "none" / ""
	Network   string   `json:"network"`             // primary docker network name, e.g. "bridge" / "br0.20"
	IP        string   `json:"ip"`                  // container IP on that network
	Ports     []string `json:"ports"`               // published ports, e.g. "8080:80/tcp"
	Mounts    []Mount  `json:"mounts,omitempty"`    // volume/bind mounts (present even when stopped)
	Autostart bool     `json:"autostart"`           // whether Unraid's native autostart owns it
}

// Mount is one volume/bind mount on a container. /containers/json carries Mounts
// regardless of run state, so these show even for a stopped container.
type Mount struct {
	Source string `json:"source"` // host path (bind) or volume location
	Dest   string `json:"dest"`   // path inside the container
	RW     bool   `json:"rw"`     // read-write (false = read-only)
}

// Limits are a container's configured resource caps from HostConfig (0 means no
// limit). Docker's container update applies them without a restart and keeps
// them across restarts. NanoCPUs is CPUs*1e9.
type Limits struct {
	MemBytes      int64  `json:"mem_bytes"`
	NanoCPUs      int64  `json:"nano_cpus"`
	CpusetCPUs    string `json:"cpuset_cpus,omitempty"`    // CPU pinning, e.g. "0-3,6" (empty = all cores)
	RestartPolicy string `json:"restart_policy,omitempty"` // Docker restart policy: no | unless-stopped | always | on-failure
}

// ProbeKind is how the engine decides a container is ready so the next stage
// may start. Most Community Applications images ship without a HEALTHCHECK, so
// the TCP and running probes matter as much as the health probe.
type ProbeKind string

const (
	ProbeHealth  ProbeKind = "health"  // use the image's own HEALTHCHECK (State.Health)
	ProbeRunning ProbeKind = "running" // running + a grace period
	ProbeTCP     ProbeKind = "tcp"     // a TCP port accepts a connection
	ProbeHTTP    ProbeKind = "http"    // an HTTP GET returns a non-error status (2xx/3xx)
	ProbeExec    ProbeKind = "exec"    // a command run inside the container exits 0 (like a HEALTHCHECK)
	ProbeLog     ProbeKind = "log"     // the container's recent log output contains a marker string
)

// Probe is the readiness specification for one managed container.
type Probe struct {
	Kind           ProbeKind `json:"kind"`
	GraceSeconds   int       `json:"grace_seconds,omitempty"`   // ProbeRunning: wait this long after "running"
	Host           string    `json:"host,omitempty"`            // ProbeTCP/HTTP: host to reach (default the container IP / 127.0.0.1)
	Port           int       `json:"port,omitempty"`            // ProbeTCP/HTTP: port (HTTP default 80)
	Path           string    `json:"path,omitempty"`            // ProbeHTTP: request path (default "/")
	Command        string    `json:"command,omitempty"`         // ProbeExec: shell command run inside the container (ready when exit 0)
	Match          string    `json:"match,omitempty"`           // ProbeLog: substring to look for in the container's recent logs
	TimeoutSeconds int       `json:"timeout_seconds,omitempty"` // give up after this long (0 → engine default)
}

// Policy is what to do when a container fails to become ready in time.
type Policy string

const (
	PolicyAbort    Policy = "abort"    // stop the chain: skip everything that depends on it
	PolicyContinue Policy = "continue" // start dependents anyway (mark this one failed)
	PolicyDegrade  Policy = "degrade"  // start dependents anyway (mark this one degraded)
)

// Node is one managed container in the start plan.
type Node struct {
	Name         string   `json:"name"`                    // Unraid container name
	After        []string `json:"after"`                   // starts once these nodes are ready
	DelaySeconds int      `json:"delay_seconds,omitempty"` // wait this long before starting it
	Probe        Probe    `json:"probe"`                   // how to decide it's ready
	Policy       Policy   `json:"policy"`                  // what to do if it never becomes ready
	// StartOrder ranks nodes that become startable at the same moment: a lower
	// positive number starts first, 0 starts last in plan order. Duplicates keep
	// plan order, and dependencies always come first.
	StartOrder int `json:"start_order,omitempty"`
}

// Plan is the user's saved orchestration: which containers the engine manages
// and the dependencies between them.
type Plan struct {
	Nodes []Node `json:"nodes"`
}

// Names returns every managed container name in the plan.
func (p Plan) Names() []string {
	out := make([]string, 0, len(p.Nodes))
	for _, n := range p.Nodes {
		out = append(out, n.Name)
	}
	return out
}

// NodeState is the live state of a node during (and after) a run.
type NodeState string

const (
	StatePending  NodeState = "pending"
	StateStarting NodeState = "starting"
	StateReady    NodeState = "ready"
	StateDegraded NodeState = "degraded"
	StateFailed   NodeState = "failed"
	StateSkipped  NodeState = "skipped" // a dependency aborted the chain
)

// NodeResult is the outcome for one node in a run.
type NodeResult struct {
	Name   string    `json:"name"`
	Stage  int       `json:"stage"`
	State  NodeState `json:"state"`
	Reason string    `json:"reason,omitempty"`
}

// RunResult is the outcome of orchestrating a whole plan.
type RunResult struct {
	Stages [][]string   `json:"stages"`
	Nodes  []NodeResult `json:"nodes"`
	Error  string       `json:"error,omitempty"` // set only when the plan itself is invalid
}

// Schedule fires a lifecycle action on a container at a wall-clock time.
type Schedule struct {
	Name    string `json:"name"`           // container name
	Action  string `json:"action"`         // start | stop | restart
	Time    string `json:"time"`           // "HH:MM" local time
	Days    []int  `json:"days,omitempty"` // 0=Sun..6=Sat; empty = every day
	Enabled bool   `json:"enabled"`
}

// Watchdog auto-restarts a container when it goes unhealthy or crashes.
type Watchdog struct {
	Name        string `json:"name"`
	Enabled     bool   `json:"enabled"`
	OnUnhealthy bool   `json:"on_unhealthy"` // restart when Docker health = unhealthy
	OnExit      bool   `json:"on_exit"`      // restart on a non-zero exit; a clean stop is left alone
	MaxRestarts int    `json:"max_restarts"` // cap per hour (0 = unlimited)
}

// Notify controls where the monitor sends alerts (a failed start, a watchdog
// restart, a schedule error).
type Notify struct {
	Unraid  bool   `json:"unraid"`            // use Unraid's own notification system
	Webhook string `json:"webhook,omitempty"` // POST a JSON body to this URL
}

// Bandwidth caps a container's network rate. Docker has no bandwidth API, so the
// monitor adds iptables hashlimit drops in the container's network namespace
// (upload on OUTPUT, download on INPUT); tc is out because Unraid's kernel ships
// no sch_tbf and sch_ingress crashes it. A field <= 0 means no cap.
type Bandwidth struct {
	Name        string `json:"name"`
	EgressKbit  int    `json:"egress_kbit"`            // upload cap (kbit/s)
	IngressKbit int    `json:"ingress_kbit,omitempty"` // download cap (kbit/s)
}

// VMLimit holds the VM limits the monitor reasserts every tick, because an Unraid
// VM form Apply regenerates the domain XML and drops them. Bandwidth is shaped
// host-side with an iptables physdev hashlimit on the VM's tap, since the kernel
// lacks the qdiscs libvirt's domiftune needs. CPU pinning and RAM belong to the
// Unraid form and are applied once instead.
type VMLimit struct {
	Name    string `json:"name"`
	CPUCap  int    `json:"cpu_cap,omitempty"`  // % of one core (0 = uncapped)
	InKbit  int    `json:"in_kbit,omitempty"`  // download cap (kbit/s)
	OutKbit int    `json:"out_kbit,omitempty"` // upload cap (kbit/s)
}

// IdleStop stops a container once its CPU has stayed at or below the threshold
// for IdleMinutes; any busier sample resets the timer. It only stops: starting
// again is left to the user, a schedule or Unraid autostart.
type IdleStop struct {
	Name            string  `json:"name"`
	Enabled         bool    `json:"enabled"`
	IdleMinutes     int     `json:"idle_minutes"`      // stop after this many continuous minutes at/below the CPU threshold
	CPUThresholdPct float64 `json:"cpu_threshold_pct"` // "idle" = live CPU% <= this; <=0 lets the monitor pick its default
}

// Config is the automation configuration the daemon acts on, persisted alongside
// the plan on the flash. Empty = nothing scheduled/watched, no notifications.
type Config struct {
	Schedules  []Schedule  `json:"schedules"`
	Watchdogs  []Watchdog  `json:"watchdogs"`
	Bandwidths []Bandwidth `json:"bandwidths,omitempty"`
	VMLimits   []VMLimit   `json:"vm_limits,omitempty"`
	IdleStops  []IdleStop  `json:"idle_stops,omitempty"`
	// ShapeIface is the in-container interface egress shaping is applied to (Settings).
	// Blank means the netshape default (eth0). Same for every shaped container.
	ShapeIface string `json:"shape_iface,omitempty"`
	// UISettings mirrors the browser-side cc.* settings so every origin (IP,
	// hostname, domain) sees the same UI configuration.
	UISettings map[string]string `json:"ui_settings,omitempty"`
	Notify     Notify            `json:"notify"`
}

// Stats is a one-shot resource snapshot for a container. NetRx and NetTx count
// bytes since container start over all interfaces; the frontend diffs two
// samples to get a rate.
type Stats struct {
	CPUPercent float64 `json:"cpu_percent"`
	MemUsed    uint64  `json:"mem_used"`
	MemLimit   uint64  `json:"mem_limit"`
	MemPercent float64 `json:"mem_percent"`
	NetRx      uint64  `json:"net_rx"` // cumulative bytes received (download)
	NetTx      uint64  `json:"net_tx"` // cumulative bytes transmitted (upload)
}
