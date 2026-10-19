// Package monitor is the supervisor's automation loop: schedules, watchdog
// restarts, bandwidth and VM limits, idle-stop and failure notifications. It
// reads the config on every tick, so changes take effect without a restart.
package monitor

import (
	"context"
	"log"
	"strconv"
	"strings"
	"sync"
	"time"

	"github.com/junkerderprovinz/towertorch/internal/model"
)

// Docker is the part of the Docker API the monitor uses.
type Docker interface {
	List(ctx context.Context) ([]model.Container, error)
	Start(ctx context.Context, name string) error
	Stop(ctx context.Context, name string) error
	Restart(ctx context.Context, name string) error
}

// ConfigSource yields the current automation config.
type ConfigSource interface {
	LoadConfig() (model.Config, error)
}

// Pidder returns a container's host PID.
type Pidder interface {
	PID(ctx context.Context, name string) (int, error)
}

// Shaper sets upload and download limits in kbit/s on iface inside the network
// namespace of pid. A direction <= 0 is cleared. DetectIface returns the
// container's default-route device, or "" if unknown.
type Shaper interface {
	Apply(iface string, pid, egressKbit, ingressKbit int) error
	DetectIface(pid int) string
}

// Notifier delivers an alert through Unraid's notifications or a webhook.
type Notifier interface {
	Notify(ctx context.Context, cfg model.Notify, subject, desc, importance string)
}

// Statter samples a container's current resource usage. The CPU% has to come
// from two reads rather than a one-shot lifetime average, since idle-stop
// depends on it.
type Statter interface {
	StatsLive(ctx context.Context, name string) (model.Stats, error)
}

// VMShaper applies a libvirt VM's bandwidth caps and CPU cap. Both calls are
// idempotent, and zero values clear the limit.
type VMShaper interface {
	ApplyBandwidth(ctx context.Context, name string, inKbit, outKbit int) error
	SetCPUCap(ctx context.Context, name string, capPct int) error
}

// Monitor runs the automation loop. Without Pidder and Shaper there is no
// container bandwidth shaping, without Statter no idle-stop and without
// VMShaper no VM limits.
type Monitor struct {
	Docker   Docker
	Config   ConfigSource
	Notifier Notifier
	Pidder   Pidder
	Shaper   Shaper
	Statter  Statter
	VMShaper VMShaper
	Interval time.Duration // default 30s
	Now      func() time.Time

	mu         sync.Mutex
	firedAt    map[string]string      // schedule key to the "YYYY-MM-DD HH:MM" it last fired
	restarts   map[string][]time.Time // watchdog restarts per container, for the hourly cap
	notifiedAt map[string]time.Time   // throttle key to the last time it was sent
	shaped     map[string]string      // container to the iface its limit was applied on
	vmShaped   map[string]bool
	bwLast     map[string]string // last shaping attempt per container, for /api/bwstatus
	idle       map[string]*idleTrack
	kickCh     chan struct{}
}

// idleTrack is idle-stop's state for one container: when it last looked busy
// and its last network byte count.
type idleTrack struct {
	busyAt   time.Time // last busy sample or first observation; idle time counts from here
	netBytes uint64    // RX+TX at netAt
	netAt    time.Time
	hasNet   bool
}

// notifyThrottle is how long the same alert for the same container is held back.
const notifyThrottle = 55 * time.Minute

// Run ticks until the context is cancelled.
func (m *Monitor) Run(ctx context.Context) {
	if m.Interval <= 0 {
		m.Interval = 30 * time.Second
	}
	if m.Now == nil {
		m.Now = time.Now
	}
	m.mu.Lock()
	if m.kickCh == nil {
		m.kickCh = make(chan struct{}, 1)
	}
	kick := m.kickCh
	m.mu.Unlock()
	t := time.NewTicker(m.Interval)
	defer t.Stop()
	for {
		select {
		case <-ctx.Done():
			return
		case <-t.C:
			m.Tick(ctx)
		case <-kick:
			m.Tick(ctx)
		}
	}
}

// Kick asks the running loop for an immediate tick without blocking.
func (m *Monitor) Kick() {
	m.mu.Lock()
	if m.kickCh == nil {
		m.kickCh = make(chan struct{}, 1)
	}
	ch := m.kickCh
	m.mu.Unlock()
	select {
	case ch <- struct{}{}:
	default:
	}
}

// Tick runs a single automation pass.
func (m *Monitor) Tick(ctx context.Context) {
	if m.Now == nil {
		m.Now = time.Now
	}
	cfg, err := m.Config.LoadConfig()
	if err != nil {
		return
	}
	m.tickSchedules(ctx, cfg)
	m.tickWatchdogs(ctx, cfg)
	m.tickBandwidths(ctx, cfg)
	m.tickVMLimits(ctx, cfg)
	m.tickIdleStop(ctx, cfg)
}

// tickVMLimits reasserts each configured VM's CPU cap and bandwidth and clears
// them from VMs whose entry was removed. An Unraid VM form Apply wipes the cap
// from the domain XML, and the bandwidth rules follow a tap that changes on
// every VM restart.
func (m *Monitor) tickVMLimits(ctx context.Context, cfg model.Config) {
	if m.VMShaper == nil {
		return
	}
	desired := make(map[string]model.VMLimit, len(cfg.VMLimits))
	for _, l := range cfg.VMLimits {
		if l.CPUCap > 0 || l.InKbit > 0 || l.OutKbit > 0 {
			desired[l.Name] = l
		}
	}
	m.mu.Lock()
	if m.vmShaped == nil {
		m.vmShaped = map[string]bool{}
	}
	prev := make([]string, 0, len(m.vmShaped))
	for n := range m.vmShaped {
		prev = append(prev, n)
	}
	m.mu.Unlock()
	for _, name := range prev {
		if _, want := desired[name]; !want {
			_ = m.VMShaper.ApplyBandwidth(ctx, name, 0, 0)
			_ = m.VMShaper.SetCPUCap(ctx, name, 0)
			m.mu.Lock()
			delete(m.vmShaped, name)
			m.mu.Unlock()
		}
	}
	for name, l := range desired {
		if err := m.VMShaper.ApplyBandwidth(ctx, name, l.InKbit, l.OutKbit); err != nil {
			log.Printf("vm bandwidth: %s: %v", name, err)
		}
		if l.CPUCap > 0 {
			if err := m.VMShaper.SetCPUCap(ctx, name, l.CPUCap); err != nil {
				log.Printf("vm cpu-cap: %s: %v", name, err)
			}
		}
		m.mu.Lock()
		m.vmShaped[name] = true
		m.mu.Unlock()
	}
}

// defaultIdleCPUPct is the idle threshold when an IdleStop leaves
// CPUThresholdPct at 0.
const defaultIdleCPUPct = 5.0

// idleNetFloorBytesPerSec keeps a low-CPU container that is still serving a
// download or a stream from being stopped. Heartbeats and DNS stay below it.
const idleNetFloorBytesPerSec = 8 * 1024

// tickIdleStop stops each configured container that has had low CPU and low
// network traffic for its whole IdleMinutes window. A busy or unreadable sample
// resets the clock, the first observation starts it, and a container that is not
// running is forgotten, so nothing is stopped before it was watched for a full
// window.
func (m *Monitor) tickIdleStop(ctx context.Context, cfg model.Config) {
	if m.Statter == nil {
		return
	}
	desired := make(map[string]model.IdleStop, len(cfg.IdleStops))
	for _, is := range cfg.IdleStops {
		if is.Enabled && is.IdleMinutes > 0 {
			desired[is.Name] = is
		}
	}
	if len(desired) == 0 {
		m.mu.Lock()
		m.idle = nil
		m.mu.Unlock()
		return
	}
	list, err := m.Docker.List(ctx)
	if err != nil {
		return
	}
	byName := make(map[string]model.Container, len(list))
	for _, c := range list {
		byName[c.Name] = c
	}
	now := m.Now()
	// A stale busyAt would otherwise stop a container the moment its entry is
	// enabled again.
	m.mu.Lock()
	for n := range m.idle {
		if _, ok := desired[n]; !ok {
			delete(m.idle, n)
		}
	}
	m.mu.Unlock()
	// A container on host or container networking has no network counters of its
	// own, and CPU alone cannot tell idle from a low-CPU transfer, so it is skipped
	// with a notification.
	type cand struct {
		name string
		is   model.IdleStop
	}
	var cands []cand
	for name, is := range desired {
		c, ok := byName[name]
		if !ok || c.State != "running" {
			m.mu.Lock()
			delete(m.idle, name)
			m.mu.Unlock()
			continue
		}
		if sharedNetns(c) {
			m.mu.Lock()
			delete(m.idle, name)
			m.mu.Unlock()
			if m.throttle(name+"|idlenetns", now) {
				m.notify(ctx, cfg.Notify, "Idle-stop skipped: "+name,
					name+" uses host/container networking, so per-container idle can't be measured and it is not auto-stopped.", "warning")
			}
			continue
		}
		cands = append(cands, cand{name, is})
	}
	if len(cands) == 0 {
		return
	}
	// Each StatsLive takes about a second, so up to six run at once.
	samples := make([]model.Stats, len(cands))
	serrs := make([]error, len(cands))
	sem := make(chan struct{}, 6)
	var wg sync.WaitGroup
	for i := range cands {
		wg.Add(1)
		go func(i int) {
			defer wg.Done()
			sem <- struct{}{}
			defer func() { <-sem }()
			samples[i], serrs[i] = m.Statter.StatsLive(ctx, cands[i].name)
		}(i)
	}
	wg.Wait()
	for i := range cands {
		name, is := cands[i].name, cands[i].is
		threshold := is.CPUThresholdPct
		if threshold <= 0 {
			threshold = defaultIdleCPUPct
		}
		st, serr := samples[i], serrs[i]
		busy := serr != nil || st.CPUPercent > threshold
		m.mu.Lock()
		if m.idle == nil {
			m.idle = map[string]*idleTrack{}
		}
		tr := m.idle[name]
		if tr == nil {
			tr = &idleTrack{}
			m.idle[name] = tr
		}
		// A counter that went backwards means the container restarted, which also
		// counts as activity.
		if serr == nil {
			netBytes := st.NetRx + st.NetTx
			if tr.hasNet {
				if elapsed := now.Sub(tr.netAt).Seconds(); elapsed > 0 {
					if netBytes < tr.netBytes || float64(netBytes-tr.netBytes)/elapsed > idleNetFloorBytesPerSec {
						busy = true
					}
				}
			}
			tr.netBytes, tr.netAt, tr.hasNet = netBytes, now, true
		}
		if busy || tr.busyAt.IsZero() {
			tr.busyAt = now
			m.mu.Unlock()
			continue
		}
		idleFor := now.Sub(tr.busyAt)
		m.mu.Unlock()
		if idleFor < time.Duration(is.IdleMinutes)*time.Minute {
			continue
		}
		if err := m.Docker.Stop(ctx, name); err != nil {
			if m.throttle(name+"|idlestopfail", now) {
				m.notify(ctx, cfg.Notify, "Idle-stop failed", name+": "+err.Error(), "warning")
			}
			continue
		}
		m.mu.Lock()
		delete(m.idle, name)
		m.mu.Unlock()
		if m.throttle(name+"|idlestopped", now) {
			m.notify(ctx, cfg.Notify, "Idle-stopped "+name,
				name+" was idle (CPU <= "+strconv.Itoa(int(threshold))+"%, low network) for "+strconv.Itoa(is.IdleMinutes)+" min and was stopped", "normal")
		}
	}
}

// tickBandwidths applies each configured rate limit to its running container and
// clears it from containers whose entry was removed. The rules live in the
// container's network namespace and vanish on restart, so they are reapplied
// every tick. Containers on host or container networking are skipped, since the
// rules would land on the host's or another container's interface.
func (m *Monitor) tickBandwidths(ctx context.Context, cfg model.Config) {
	if m.Shaper == nil || m.Pidder == nil {
		return
	}
	if len(cfg.Bandwidths) == 0 {
		m.mu.Lock()
		empty := len(m.shaped) == 0
		m.mu.Unlock()
		if empty {
			return
		}
	}
	containers, err := m.Docker.List(ctx)
	if err != nil {
		return
	}
	state := make(map[string]model.Container, len(containers))
	for _, c := range containers {
		state[c.Name] = c
	}
	desired := make(map[string]model.Bandwidth, len(cfg.Bandwidths))
	for _, b := range cfg.Bandwidths {
		if b.EgressKbit > 0 || b.IngressKbit > 0 {
			desired[b.Name] = b
		}
	}
	iface := cfg.ShapeIface
	m.mu.Lock()
	if m.shaped == nil {
		m.shaped = map[string]string{}
	}
	prev := make(map[string]string, len(m.shaped))
	for n, ifc := range m.shaped {
		prev[n] = ifc
	}
	m.mu.Unlock()
	// A limit is cleared when its entry is gone or the interface setting changed,
	// and always on the interface it was applied on, or the old NIC would stay
	// throttled. With a blank setting each container's interface is detected, so
	// any stored interface counts as current.
	autoIface := strings.TrimSpace(iface) == ""
	for name, oldIface := range prev {
		if _, want := desired[name]; want && (oldIface == iface || autoIface) {
			continue
		}
		// A running container whose PID cannot be read this tick stays tracked, so
		// the clear is retried instead of leaking the rule.
		cleared := true
		if c, ok := state[name]; ok && c.State == "running" && !sharedNetns(c) {
			if pid, e := m.Pidder.PID(ctx, name); e == nil && pid > 0 {
				_ = m.Shaper.Apply(oldIface, pid, 0, 0)
			} else {
				cleared = false
			}
		}
		if cleared {
			m.mu.Lock()
			delete(m.shaped, name)
			m.mu.Unlock()
		}
	}
	now := m.Now()
	for name, bw := range desired {
		c, ok := state[name]
		if !ok || c.State != "running" {
			continue
		}
		if sharedNetns(c) {
			if m.throttle(name+"|bwshared", now) && m.Notifier != nil {
				m.Notifier.Notify(ctx, cfg.Notify, "Bandwidth not applied: "+name,
					"Shaping is skipped for a host/container-network container (it would shape the host or another container).", "warning")
			}
			continue
		}
		pid, perr := m.Pidder.PID(ctx, name)
		if perr != nil || pid <= 0 {
			continue
		}
		ifc := iface
		if autoIface {
			ifc = m.Shaper.DetectIface(pid) // "" means the netshape default, eth0
		}
		err := m.Shaper.Apply(ifc, pid, bw.EgressKbit, bw.IngressKbit)
		// Tracked even on error: one direction may have been applied before the
		// other failed, and it has to be cleared later.
		m.mu.Lock()
		m.shaped[name] = ifc
		if m.bwLast == nil {
			m.bwLast = map[string]string{}
		}
		lbl := ifc
		if lbl == "" {
			lbl = "auto(eth0)"
		}
		if err != nil {
			m.bwLast[name] = now.Format("15:04:05") + " iface=" + lbl + " FEHLER: " + err.Error()
		} else {
			m.bwLast[name] = now.Format("15:04:05") + " iface=" + lbl + " ok"
		}
		m.mu.Unlock()
		if err != nil {
			if m.throttle(name+"|bwfail", now) && m.Notifier != nil {
				m.Notifier.Notify(ctx, cfg.Notify, "Bandwidth shaping failed: "+name, err.Error(), "warning")
			}
			continue
		}
	}
}

// LastBwApply returns the most recent shaping attempt for the container, or ""
// if there was none since the daemon started.
func (m *Monitor) LastBwApply(name string) string {
	m.mu.Lock()
	defer m.mu.Unlock()
	return m.bwLast[name]
}

// sharedNetns reports whether a container uses the host's or another container's
// network namespace.
func sharedNetns(c model.Container) bool {
	n := c.Network
	return n == "host" || strings.HasPrefix(n, "container:")
}

func (m *Monitor) tickSchedules(ctx context.Context, cfg model.Config) {
	if len(cfg.Schedules) == 0 {
		return
	}
	now := m.Now()
	hm := now.Format("15:04")
	minuteKey := now.Format("2006-01-02 15:04")
	wd := int(now.Weekday())
	for _, s := range cfg.Schedules {
		if !s.Enabled || s.Time != hm {
			continue
		}
		if len(s.Days) > 0 && !containsInt(s.Days, wd) {
			continue
		}
		key := s.Name + "|" + s.Action + "|" + s.Time
		m.mu.Lock()
		if m.firedAt == nil {
			m.firedAt = map[string]string{}
		}
		already := m.firedAt[key] == minuteKey
		m.mu.Unlock()
		if already {
			continue
		}
		if err := m.act(ctx, s.Name, s.Action); err != nil {
			// Not marked as fired, so the next tick in the same minute retries it.
			if m.throttle(s.Name+"|schedfail|"+s.Action+"|"+s.Time, now) {
				m.notify(ctx, cfg.Notify, "Schedule failed", s.Name+": "+s.Action+": "+err.Error(), "warning")
			}
			continue
		}
		m.mu.Lock()
		m.firedAt[key] = minuteKey
		m.mu.Unlock()
	}
}

func (m *Monitor) tickWatchdogs(ctx context.Context, cfg model.Config) {
	if len(cfg.Watchdogs) == 0 {
		return
	}
	list, err := m.Docker.List(ctx)
	if err != nil {
		return
	}
	byName := make(map[string]model.Container, len(list))
	for _, c := range list {
		byName[c.Name] = c
	}
	now := m.Now()
	for _, w := range cfg.Watchdogs {
		if !w.Enabled {
			continue
		}
		c, ok := byName[w.Name]
		if !ok {
			continue
		}
		trigger := ""
		if w.OnUnhealthy && c.Health == "unhealthy" {
			trigger = "unhealthy"
		} else if w.OnExit && c.State == "exited" && isCrashExit(c.ExitCode) {
			trigger = "crashed (exit " + strconv.Itoa(c.ExitCode) + ")"
		}
		if trigger == "" {
			continue
		}
		if !m.allowRestart(w, now) {
			if m.throttle(w.Name+"|gaveup", now) {
				m.notify(ctx, cfg.Notify, "Watchdog gave up", w.Name+": too many restarts (>"+strconv.Itoa(w.MaxRestarts)+"/h)", "alert")
			}
			continue
		}
		// Counted before the attempt, so a restart that keeps failing still reaches
		// the cap. Without a cap nothing is recorded and the history stays empty.
		if w.MaxRestarts > 0 {
			m.recordRestart(w.Name, now)
		}
		if err := m.Docker.Restart(ctx, w.Name); err != nil {
			if m.throttle(w.Name+"|failed", now) {
				m.notify(ctx, cfg.Notify, "Watchdog restart failed", w.Name+": "+err.Error(), "alert")
			}
			continue
		}
		// A flapping container would otherwise notify on every cycle.
		if m.throttle(w.Name+"|restarted", now) {
			m.notify(ctx, cfg.Notify, "Watchdog restarted "+w.Name, w.Name+" was "+trigger+" and was restarted", "warning")
		}
	}
}

// isCrashExit reports whether an exit code looks like a crash rather than a stop.
// docker stop and docker kill end with 128+signal: 130 (SIGINT), 137 (SIGKILL)
// or 143 (SIGTERM). An OOM kill also exits with 137 and is therefore not
// restarted, because only a full inspect reveals OOMKilled.
func isCrashExit(code int) bool {
	switch code {
	case 0, 130, 137, 143:
		return false
	}
	return true
}

func (m *Monitor) act(ctx context.Context, name, action string) error {
	switch action {
	case "start":
		return m.Docker.Start(ctx, name)
	case "stop":
		return m.Docker.Stop(ctx, name)
	case "restart":
		return m.Docker.Restart(ctx, name)
	}
	return nil
}

// allowRestart reports whether another restart fits the hourly cap and prunes
// the container's restart history to the last hour.
func (m *Monitor) allowRestart(w model.Watchdog, now time.Time) bool {
	if w.MaxRestarts <= 0 {
		return true
	}
	m.mu.Lock()
	defer m.mu.Unlock()
	if m.restarts == nil {
		m.restarts = map[string][]time.Time{}
	}
	cutoff := now.Add(-time.Hour)
	recent := m.restarts[w.Name][:0]
	for _, t := range m.restarts[w.Name] {
		if t.After(cutoff) {
			recent = append(recent, t)
		}
	}
	m.restarts[w.Name] = recent
	return len(recent) < w.MaxRestarts
}

func (m *Monitor) recordRestart(name string, now time.Time) {
	m.mu.Lock()
	defer m.mu.Unlock()
	if m.restarts == nil {
		m.restarts = map[string][]time.Time{}
	}
	m.restarts[name] = append(m.restarts[name], now)
}

// throttle returns true at most once per notifyThrottle window for a key such
// as "<name>|gaveup".
func (m *Monitor) throttle(key string, now time.Time) bool {
	m.mu.Lock()
	defer m.mu.Unlock()
	if m.notifiedAt == nil {
		m.notifiedAt = map[string]time.Time{}
	}
	if last, ok := m.notifiedAt[key]; ok && now.Sub(last) < notifyThrottle {
		return false
	}
	m.notifiedAt[key] = now
	return true
}

func (m *Monitor) notify(ctx context.Context, n model.Notify, subject, desc, importance string) {
	if m.Notifier == nil || (!n.Unraid && n.Webhook == "") {
		return
	}
	m.Notifier.Notify(ctx, n, subject, desc, importance)
}

func containsInt(xs []int, x int) bool {
	for _, v := range xs {
		if v == x {
			return true
		}
	}
	return false
}
