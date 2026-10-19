package monitor

import (
	"context"
	"errors"
	"fmt"
	"testing"
	"time"

	"github.com/junkerderprovinz/towertorch/internal/model"
)

type fakeDocker struct {
	list       []model.Container
	actions    []string
	restartErr error
	stopErr    error
	cpu        map[string]float64
	net        map[string]uint64
	statErr    map[string]error
}

func (f *fakeDocker) List(context.Context) ([]model.Container, error) { return f.list, nil }
func (f *fakeDocker) Start(_ context.Context, n string) error {
	f.actions = append(f.actions, "start:"+n)
	return nil
}
func (f *fakeDocker) Stop(_ context.Context, n string) error {
	f.actions = append(f.actions, "stop:"+n)
	return f.stopErr
}
func (f *fakeDocker) Restart(_ context.Context, n string) error {
	f.actions = append(f.actions, "restart:"+n)
	return f.restartErr
}
func (f *fakeDocker) StatsLive(_ context.Context, n string) (model.Stats, error) {
	if f.statErr != nil {
		if e, ok := f.statErr[n]; ok {
			return model.Stats{}, e
		}
	}
	return model.Stats{CPUPercent: f.cpu[n], NetRx: f.net[n]}, nil
}

func countAction(actions []string, want string) int {
	n := 0
	for _, a := range actions {
		if a == want {
			n++
		}
	}
	return n
}

type fakeCfg struct{ c model.Config }

func (f fakeCfg) LoadConfig() (model.Config, error) { return f.c, nil }

type fakeNotifier struct{ n []string }

func (f *fakeNotifier) Notify(_ context.Context, _ model.Notify, subject, _, _ string) {
	f.n = append(f.n, subject)
}

type fakePidder struct{ pids map[string]int }

func (f fakePidder) PID(_ context.Context, name string) (int, error) {
	if p, ok := f.pids[name]; ok {
		return p, nil
	}
	return 0, errors.New("no pid")
}

type fakeShaper struct {
	applied map[int]int // last egress kbit per pid
	ingress map[int]int
	ifaces  map[int]string
	calls   []string // "iface:pid:egress:ingress"
	err     error
}

func (f *fakeShaper) DetectIface(pid int) string { return "" }
func (f *fakeShaper) Apply(iface string, pid, egressKbit, ingressKbit int) error {
	if f.applied == nil {
		f.applied = map[int]int{}
		f.ingress = map[int]int{}
		f.ifaces = map[int]string{}
	}
	f.applied[pid] = egressKbit
	f.ingress[pid] = ingressKbit
	f.ifaces[pid] = iface
	f.calls = append(f.calls, fmt.Sprintf("%s:%d:%d:%d", iface, pid, egressKbit, ingressKbit))
	return f.err
}

func hasCall(calls []string, want string) bool {
	for _, c := range calls {
		if c == want {
			return true
		}
	}
	return false
}

func TestBandwidthAppliedToRunningOnly(t *testing.T) {
	fd := &fakeDocker{list: []model.Container{
		{Name: "up", State: "running", Network: "br0.20"},
		{Name: "down", State: "exited"},
		{Name: "hostnet", State: "running", Network: "host"},
	}}
	sh := &fakeShaper{}
	nt := &fakeNotifier{}
	m := &Monitor{
		Docker: fd,
		Config: fakeCfg{c: model.Config{ShapeIface: "br0.20", Bandwidths: []model.Bandwidth{
			{Name: "up", EgressKbit: 5000, IngressKbit: 2000},
			{Name: "down", EgressKbit: 3000},
			{Name: "hostnet", EgressKbit: 2000},
		}}},
		Pidder:   fakePidder{pids: map[string]int{"up": 4242, "down": 99, "hostnet": 7}},
		Shaper:   sh,
		Notifier: nt,
		Now:      time.Now,
	}
	m.Tick(context.Background())
	if len(sh.applied) != 1 || sh.applied[4242] != 5000 || sh.ingress[4242] != 2000 {
		t.Fatalf("only the running bridge container should be shaped (egress 5000 + ingress 2000), got eg=%v in=%v", sh.applied, sh.ingress)
	}
	if sh.ifaces[4242] != "br0.20" {
		t.Fatalf("configured ShapeIface must be threaded to the shaper, got %q", sh.ifaces[4242])
	}
	if len(nt.n) != 1 {
		t.Fatalf("host-network container should notify once, got %v", nt.n)
	}
}

func TestBandwidthClearedOnRemoval(t *testing.T) {
	fd := &fakeDocker{list: []model.Container{{Name: "up", State: "running", Network: "br0.20"}}}
	sh := &fakeShaper{}
	m := &Monitor{
		Docker: fd,
		Config: fakeCfg{c: model.Config{Bandwidths: []model.Bandwidth{{Name: "up", EgressKbit: 5000}}}},
		Pidder: fakePidder{pids: map[string]int{"up": 4242}},
		Shaper: sh,
		Now:    time.Now,
	}
	m.Tick(context.Background())
	if sh.applied[4242] != 5000 {
		t.Fatalf("expected 5000 applied, got %v", sh.applied)
	}
	m.Config = fakeCfg{c: model.Config{}}
	m.Tick(context.Background())
	if sh.applied[4242] != 0 {
		t.Fatalf("removing the entry must clear the rule (apply 0), got %v", sh.applied)
	}
}

// Apply may fail after one direction was already set, so that direction still has
// to be cleared on removal.
func TestBandwidthClearedEvenAfterApplyError(t *testing.T) {
	fd := &fakeDocker{list: []model.Container{{Name: "up", State: "running", Network: "br0.20"}}}
	sh := &fakeShaper{err: errors.New("ingress filter: act_police missing")}
	m := &Monitor{
		Docker: fd,
		Config: fakeCfg{c: model.Config{ShapeIface: "eth0", Bandwidths: []model.Bandwidth{{Name: "up", EgressKbit: 5000}}}},
		Pidder: fakePidder{pids: map[string]int{"up": 4242}},
		Shaper: sh,
		Now:    time.Now,
	}
	m.Tick(context.Background())
	sh.err = nil
	m.Config = fakeCfg{c: model.Config{}}
	m.Tick(context.Background())
	if !hasCall(sh.calls, "eth0:4242:0:0") {
		t.Fatalf("a container whose apply errored must still be cleared on removal, calls=%v", sh.calls)
	}
}

// The clear has to hit the interface the limit was applied on, not the new setting.
func TestBandwidthReshapedOnInterfaceChange(t *testing.T) {
	fd := &fakeDocker{list: []model.Container{{Name: "up", State: "running", Network: "br0.20"}}}
	sh := &fakeShaper{}
	m := &Monitor{
		Docker: fd,
		Config: fakeCfg{c: model.Config{ShapeIface: "eth0", Bandwidths: []model.Bandwidth{{Name: "up", EgressKbit: 5000}}}},
		Pidder: fakePidder{pids: map[string]int{"up": 4242}},
		Shaper: sh,
		Now:    time.Now,
	}
	m.Tick(context.Background())
	if sh.ifaces[4242] != "eth0" || sh.applied[4242] != 5000 {
		t.Fatalf("expected shape on eth0 @5000, got iface=%q kbit=%d", sh.ifaces[4242], sh.applied[4242])
	}
	m.Config = fakeCfg{c: model.Config{ShapeIface: "eth1", Bandwidths: []model.Bandwidth{{Name: "up", EgressKbit: 5000}}}}
	m.Tick(context.Background())
	if !hasCall(sh.calls, "eth0:4242:0:0") {
		t.Fatalf("changing the interface must clear the old iface (eth0:4242:0:0), calls=%v", sh.calls)
	}
	if sh.ifaces[4242] != "eth1" || sh.applied[4242] != 5000 {
		t.Fatalf("expected reshape on eth1 @5000, got iface=%q kbit=%d", sh.ifaces[4242], sh.applied[4242])
	}
}

func TestScheduleFiresOncePerMinute(t *testing.T) {
	fd := &fakeDocker{}
	clock := time.Date(2026, 7, 3, 3, 0, 0, 0, time.Local)
	m := &Monitor{
		Docker: fd,
		Config: fakeCfg{c: model.Config{Schedules: []model.Schedule{
			{Name: "db", Action: "restart", Time: "03:00", Enabled: true},
			{Name: "off", Action: "start", Time: "03:00", Enabled: false},
			{Name: "later", Action: "stop", Time: "04:00", Enabled: true},
		}}},
		Now: func() time.Time { return clock },
	}
	m.Tick(context.Background())
	clock = clock.Add(30 * time.Second)
	m.Tick(context.Background())
	if len(fd.actions) != 1 || fd.actions[0] != "restart:db" {
		t.Fatalf("expected exactly [restart:db], got %v", fd.actions)
	}
	clock = clock.Add(24 * time.Hour)
	m.Tick(context.Background())
	if len(fd.actions) != 2 {
		t.Fatalf("expected a second fire the next day, got %v", fd.actions)
	}
}

func TestScheduleRespectsDays(t *testing.T) {
	fd := &fakeDocker{}
	clock := time.Date(2026, 7, 3, 3, 0, 0, 0, time.Local) // a Friday
	m := &Monitor{
		Docker: fd,
		Config: fakeCfg{c: model.Config{Schedules: []model.Schedule{
			{Name: "db", Action: "start", Time: "03:00", Days: []int{1, 2, 3}, Enabled: true},
		}}},
		Now: func() time.Time { return clock },
	}
	m.Tick(context.Background())
	if len(fd.actions) != 0 {
		t.Fatalf("Friday should not fire a Mon-Wed schedule, got %v", fd.actions)
	}
}

func TestWatchdogRestartsAndCaps(t *testing.T) {
	fd := &fakeDocker{list: []model.Container{{Name: "gluetun", State: "running", Health: "unhealthy"}}}
	fn := &fakeNotifier{}
	clock := time.Date(2026, 7, 3, 3, 0, 0, 0, time.Local)
	m := &Monitor{
		Docker:   fd,
		Notifier: fn,
		Config: fakeCfg{c: model.Config{
			Watchdogs: []model.Watchdog{{Name: "gluetun", Enabled: true, OnUnhealthy: true, MaxRestarts: 2}},
			Notify:    model.Notify{Unraid: true},
		}},
		Now: func() time.Time { return clock },
	}
	for i := 0; i < 4; i++ {
		m.Tick(context.Background())
		clock = clock.Add(30 * time.Second)
	}
	restarts := 0
	for _, a := range fd.actions {
		if a == "restart:gluetun" {
			restarts++
		}
	}
	if restarts != 2 {
		t.Fatalf("watchdog should restart exactly MaxRestarts=2 times, got %d (%v)", restarts, fd.actions)
	}
	var restarted, gaveUp bool
	for _, s := range fn.n {
		if s == "Watchdog restarted gluetun" {
			restarted = true
		}
		if s == "Watchdog gave up" {
			gaveUp = true
		}
	}
	if !restarted || !gaveUp {
		t.Fatalf("expected restart + gave-up notifications, got %v", fn.n)
	}
}

func TestWatchdogOnExitOnlyOnCrash(t *testing.T) {
	fd := &fakeDocker{list: []model.Container{
		{Name: "crashed", State: "exited", ExitCode: 1},
		{Name: "stopped", State: "exited", ExitCode: 0},
		{Name: "sigterm", State: "exited", ExitCode: 143},
		{Name: "sigkill", State: "exited", ExitCode: 137},
	}}
	clock := time.Date(2026, 7, 3, 3, 0, 0, 0, time.Local)
	m := &Monitor{
		Docker: fd,
		Config: fakeCfg{c: model.Config{Watchdogs: []model.Watchdog{
			{Name: "crashed", Enabled: true, OnExit: true, MaxRestarts: 5},
			{Name: "stopped", Enabled: true, OnExit: true, MaxRestarts: 5},
			{Name: "sigterm", Enabled: true, OnExit: true, MaxRestarts: 5},
			{Name: "sigkill", Enabled: true, OnExit: true, MaxRestarts: 5},
		}}},
		Now: func() time.Time { return clock },
	}
	m.Tick(context.Background())
	if len(fd.actions) != 1 || fd.actions[0] != "restart:crashed" {
		t.Fatalf("only the crashed (exit 1) container should restart; signal stops (0/137/143) must be left alone, got %v", fd.actions)
	}
}

func TestWatchdogFailedRestartIsCappedAndThrottled(t *testing.T) {
	fd := &fakeDocker{
		list:       []model.Container{{Name: "web", State: "running", Health: "unhealthy"}},
		restartErr: errors.New("no such container"),
	}
	fn := &fakeNotifier{}
	clock := time.Date(2026, 7, 3, 3, 0, 0, 0, time.Local)
	m := &Monitor{
		Docker:   fd,
		Notifier: fn,
		Config: fakeCfg{c: model.Config{
			Watchdogs: []model.Watchdog{{Name: "web", Enabled: true, OnUnhealthy: true, MaxRestarts: 2}},
			Notify:    model.Notify{Unraid: true},
		}},
		Now: func() time.Time { return clock },
	}
	for i := 0; i < 6; i++ {
		m.Tick(context.Background())
		clock = clock.Add(30 * time.Second)
	}
	attempts := 0
	for _, a := range fd.actions {
		if a == "restart:web" {
			attempts++
		}
	}
	if attempts != 2 {
		t.Fatalf("failed restarts must still be capped at MaxRestarts=2, got %d (%v)", attempts, fd.actions)
	}
	var failed, gaveUp int
	for _, s := range fn.n {
		switch s {
		case "Watchdog restart failed":
			failed++
		case "Watchdog gave up":
			gaveUp++
		}
	}
	if failed != 1 || gaveUp != 1 {
		t.Fatalf("expected exactly one 'restart failed' and one 'gave up' (throttled), got failed=%d gaveUp=%d (%v)", failed, gaveUp, fn.n)
	}
}

func TestIdleStopStopsAfterIdleWindow(t *testing.T) {
	fd := &fakeDocker{
		list: []model.Container{{Name: "jelly", State: "running"}},
		cpu:  map[string]float64{"jelly": 1.0},
	}
	clock := time.Date(2026, 7, 3, 3, 0, 0, 0, time.Local)
	m := &Monitor{Docker: fd, Statter: fd, Now: func() time.Time { return clock },
		Config: fakeCfg{c: model.Config{IdleStops: []model.IdleStop{
			{Name: "jelly", Enabled: true, IdleMinutes: 2, CPUThresholdPct: 5},
		}}}}
	m.Tick(context.Background())
	if countAction(fd.actions, "stop:jelly") != 0 {
		t.Fatalf("must not stop on the first observation, got %v", fd.actions)
	}
	clock = clock.Add(1 * time.Minute)
	m.Tick(context.Background())
	if countAction(fd.actions, "stop:jelly") != 0 {
		t.Fatalf("must not stop before the full idle window, got %v", fd.actions)
	}
	clock = clock.Add(90 * time.Second)
	m.Tick(context.Background())
	if countAction(fd.actions, "stop:jelly") != 1 {
		t.Fatalf("should idle-stop after the window, got %v", fd.actions)
	}
	fd.list = []model.Container{{Name: "jelly", State: "exited"}}
	clock = clock.Add(1 * time.Minute)
	m.Tick(context.Background())
	if countAction(fd.actions, "stop:jelly") != 1 {
		t.Fatalf("must not re-stop a container that is no longer running, got %v", fd.actions)
	}
}

func TestIdleStopBusyNeverStops(t *testing.T) {
	fd := &fakeDocker{
		list: []model.Container{{Name: "build", State: "running"}},
		cpu:  map[string]float64{"build": 80.0},
	}
	clock := time.Date(2026, 7, 3, 3, 0, 0, 0, time.Local)
	m := &Monitor{Docker: fd, Statter: fd, Now: func() time.Time { return clock },
		Config: fakeCfg{c: model.Config{IdleStops: []model.IdleStop{
			{Name: "build", Enabled: true, IdleMinutes: 1, CPUThresholdPct: 5},
		}}}}
	for i := 0; i < 10; i++ {
		m.Tick(context.Background())
		clock = clock.Add(30 * time.Second)
	}
	if countAction(fd.actions, "stop:build") != 0 {
		t.Fatalf("a busy container must never be idle-stopped, got %v", fd.actions)
	}
}

func TestIdleStopResetsOnActivity(t *testing.T) {
	fd := &fakeDocker{
		list: []model.Container{{Name: "app", State: "running"}},
		cpu:  map[string]float64{"app": 1.0},
	}
	clock := time.Date(2026, 7, 3, 3, 0, 0, 0, time.Local)
	m := &Monitor{Docker: fd, Statter: fd, Now: func() time.Time { return clock },
		Config: fakeCfg{c: model.Config{IdleStops: []model.IdleStop{
			{Name: "app", Enabled: true, IdleMinutes: 3, CPUThresholdPct: 5},
		}}}}
	m.Tick(context.Background())
	clock = clock.Add(2 * time.Minute)
	fd.cpu["app"] = 50
	m.Tick(context.Background())
	fd.cpu["app"] = 1
	clock = clock.Add(2 * time.Minute)
	m.Tick(context.Background())
	if countAction(fd.actions, "stop:app") != 0 {
		t.Fatalf("activity must reset the idle timer, got %v", fd.actions)
	}
	clock = clock.Add(90 * time.Second)
	m.Tick(context.Background())
	if countAction(fd.actions, "stop:app") != 1 {
		t.Fatalf("should stop a full window after the last activity, got %v", fd.actions)
	}
}

func TestIdleStopIgnoresDisabledAndNotRunning(t *testing.T) {
	fd := &fakeDocker{
		list: []model.Container{
			{Name: "off", State: "running"},
			{Name: "gone", State: "exited"},
		},
		cpu: map[string]float64{"off": 0, "gone": 0},
	}
	clock := time.Date(2026, 7, 3, 3, 0, 0, 0, time.Local)
	m := &Monitor{Docker: fd, Statter: fd, Now: func() time.Time { return clock },
		Config: fakeCfg{c: model.Config{IdleStops: []model.IdleStop{
			{Name: "off", Enabled: false, IdleMinutes: 1},
			{Name: "gone", Enabled: true, IdleMinutes: 1},
		}}}}
	for i := 0; i < 6; i++ {
		m.Tick(context.Background())
		clock = clock.Add(1 * time.Minute)
	}
	if len(fd.actions) != 0 {
		t.Fatalf("disabled + non-running idle-stops must do nothing, got %v", fd.actions)
	}
}

func TestIdleStopInertWithoutStatter(t *testing.T) {
	fd := &fakeDocker{list: []model.Container{{Name: "x", State: "running"}}}
	clock := time.Date(2026, 7, 3, 3, 0, 0, 0, time.Local)
	m := &Monitor{Docker: fd, Now: func() time.Time { return clock },
		Config: fakeCfg{c: model.Config{IdleStops: []model.IdleStop{
			{Name: "x", Enabled: true, IdleMinutes: 1},
		}}}}
	for i := 0; i < 5; i++ {
		m.Tick(context.Background())
		clock = clock.Add(1 * time.Minute)
	}
	if len(fd.actions) != 0 {
		t.Fatalf("without a Statter the idle-stop feature must be inert, got %v", fd.actions)
	}
}

func TestIdleStopSampleErrorNeverStops(t *testing.T) {
	fd := &fakeDocker{
		list:    []model.Container{{Name: "y", State: "running"}},
		cpu:     map[string]float64{"y": 0},
		statErr: map[string]error{"y": errors.New("stats unavailable")},
	}
	clock := time.Date(2026, 7, 3, 3, 0, 0, 0, time.Local)
	m := &Monitor{Docker: fd, Statter: fd, Now: func() time.Time { return clock },
		Config: fakeCfg{c: model.Config{IdleStops: []model.IdleStop{
			{Name: "y", Enabled: true, IdleMinutes: 1, CPUThresholdPct: 5},
		}}}}
	for i := 0; i < 6; i++ {
		m.Tick(context.Background())
		clock = clock.Add(1 * time.Minute)
	}
	if countAction(fd.actions, "stop:y") != 0 {
		t.Fatalf("an unreadable CPU sample must be treated as active, got %v", fd.actions)
	}
}

func TestIdleStopNetworkActivityKeepsAlive(t *testing.T) {
	fd := &fakeDocker{
		list: []model.Container{{Name: "dl", State: "running"}},
		cpu:  map[string]float64{"dl": 1.0},
		net:  map[string]uint64{"dl": 0},
	}
	clock := time.Date(2026, 7, 3, 3, 0, 0, 0, time.Local)
	m := &Monitor{Docker: fd, Statter: fd, Now: func() time.Time { return clock },
		Config: fakeCfg{c: model.Config{IdleStops: []model.IdleStop{
			{Name: "dl", Enabled: true, IdleMinutes: 2, CPUThresholdPct: 5},
		}}}}
	for i := 0; i < 8; i++ {
		fd.net["dl"] += 50 * 1024 * 30 // 50 KiB/s over a 30s tick
		m.Tick(context.Background())
		clock = clock.Add(30 * time.Second)
	}
	if countAction(fd.actions, "stop:dl") != 0 {
		t.Fatalf("a CPU-idle but network-active container must not be idle-stopped, got %v", fd.actions)
	}
}

func TestIdleStopSkipsHostNetworkedContainer(t *testing.T) {
	fd := &fakeDocker{
		list: []model.Container{{Name: "plex", State: "running", Network: "host"}},
		cpu:  map[string]float64{"plex": 1.0},
	}
	fn := &fakeNotifier{}
	clock := time.Date(2026, 7, 3, 3, 0, 0, 0, time.Local)
	m := &Monitor{Docker: fd, Statter: fd, Notifier: fn, Now: func() time.Time { return clock },
		Config: fakeCfg{c: model.Config{Notify: model.Notify{Unraid: true}, IdleStops: []model.IdleStop{
			{Name: "plex", Enabled: true, IdleMinutes: 1, CPUThresholdPct: 5},
		}}}}
	for i := 0; i < 6; i++ {
		m.Tick(context.Background())
		clock = clock.Add(1 * time.Minute)
	}
	if countAction(fd.actions, "stop:plex") != 0 {
		t.Fatalf("a host-networked container must never be idle-stopped (net idle unmeasurable), got %v", fd.actions)
	}
	skipped := false
	for _, s := range fn.n {
		if s == "Idle-stop skipped: plex" {
			skipped = true
		}
	}
	if !skipped {
		t.Fatalf("expected an 'idle-stop skipped' notification for the host-net container, got %v", fn.n)
	}
}

func TestIdleStopReEnableGetsFreshWindow(t *testing.T) {
	fd := &fakeDocker{
		list: []model.Container{{Name: "svc", State: "running", Network: "bridge"}},
		cpu:  map[string]float64{"svc": 1.0},
	}
	clock := time.Date(2026, 7, 3, 3, 0, 0, 0, time.Local)
	enabled := model.Config{IdleStops: []model.IdleStop{{Name: "svc", Enabled: true, IdleMinutes: 5, CPUThresholdPct: 5}}}
	disabled := model.Config{IdleStops: []model.IdleStop{{Name: "svc", Enabled: false, IdleMinutes: 5, CPUThresholdPct: 5}}}
	m := &Monitor{Docker: fd, Statter: fd, Now: func() time.Time { return clock }, Config: fakeCfg{c: enabled}}
	m.Tick(context.Background())
	clock = clock.Add(4 * time.Minute)
	m.Tick(context.Background())
	m.Config = fakeCfg{c: disabled}
	clock = clock.Add(10 * time.Minute)
	m.Tick(context.Background())
	m.Config = fakeCfg{c: enabled}
	m.Tick(context.Background())
	if countAction(fd.actions, "stop:svc") != 0 {
		t.Fatalf("re-enabling must start a fresh window, not stop off the stale clock, got %v", fd.actions)
	}
	clock = clock.Add(4 * time.Minute)
	m.Tick(context.Background())
	if countAction(fd.actions, "stop:svc") != 0 {
		t.Fatalf("still within the fresh window, got %v", fd.actions)
	}
	clock = clock.Add(2 * time.Minute)
	m.Tick(context.Background())
	if countAction(fd.actions, "stop:svc") != 1 {
		t.Fatalf("should stop after a full fresh window post-reenable, got %v", fd.actions)
	}
}

func TestIdleStopDefaultThreshold(t *testing.T) {
	fd := &fakeDocker{
		list: []model.Container{{Name: "z", State: "running"}},
		cpu:  map[string]float64{"z": 4.0},
	}
	clock := time.Date(2026, 7, 3, 3, 0, 0, 0, time.Local)
	m := &Monitor{Docker: fd, Statter: fd, Now: func() time.Time { return clock },
		Config: fakeCfg{c: model.Config{IdleStops: []model.IdleStop{
			{Name: "z", Enabled: true, IdleMinutes: 1},
		}}}}
	m.Tick(context.Background())
	clock = clock.Add(90 * time.Second)
	m.Tick(context.Background())
	if countAction(fd.actions, "stop:z") != 1 {
		t.Fatalf("CPU below the default threshold should idle-stop, got %v", fd.actions)
	}
}
