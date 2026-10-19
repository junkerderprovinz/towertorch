package api

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"strings"
	"testing"

	"github.com/junkerderprovinz/towertorch/internal/hostcpu"
	"github.com/junkerderprovinz/towertorch/internal/model"
)

// fakeHostMem is what the fake daemon reports, used where /proc/meminfo is
// unreadable.
const fakeHostMem = int64(8) << 30

type fakeDocker struct {
	containers []model.Container
	actions    []string
	limits     model.Limits
}

func (f *fakeDocker) HostMemTotal(context.Context) int64 { return fakeHostMem }

func (f *fakeDocker) List(context.Context) ([]model.Container, error) { return f.containers, nil }
func (f *fakeDocker) Start(_ context.Context, n string) error {
	f.actions = append(f.actions, "start:"+n)
	return nil
}
func (f *fakeDocker) Stop(_ context.Context, n string) error {
	f.actions = append(f.actions, "stop:"+n)
	return nil
}
func (f *fakeDocker) Restart(_ context.Context, n string) error {
	f.actions = append(f.actions, "restart:"+n)
	return nil
}
func (f *fakeDocker) Pause(_ context.Context, n string) error {
	f.actions = append(f.actions, "pause:"+n)
	return nil
}
func (f *fakeDocker) Unpause(_ context.Context, n string) error {
	f.actions = append(f.actions, "unpause:"+n)
	return nil
}
func (f *fakeDocker) Stats(_ context.Context, _ string) (model.Stats, error) {
	return model.Stats{CPUPercent: 12, MemUsed: 100, MemLimit: 1000, MemPercent: 10}, nil
}
func (f *fakeDocker) Limits(_ context.Context, _ string) (model.Limits, error) { return f.limits, nil }
func (f *fakeDocker) UpdateResources(_ context.Context, n string, l model.Limits) error {
	f.actions = append(f.actions, fmt.Sprintf("limits:%s:%d:%d", n, l.MemBytes, l.NanoCPUs))
	f.limits = l
	return nil
}
func (f *fakeDocker) SetRestartPolicy(_ context.Context, n, policy string) error {
	f.actions = append(f.actions, "restart:"+n+":"+policy)
	f.limits.RestartPolicy = policy
	return nil
}

type memStore struct {
	plan model.Plan
	cfg  model.Config
}

func (m *memStore) Load() (model.Plan, error)         { return m.plan, nil }
func (m *memStore) Save(p model.Plan) error           { m.plan = p; return nil }
func (m *memStore) LoadConfig() (model.Config, error) { return m.cfg, nil }
func (m *memStore) SaveConfig(c model.Config) error   { m.cfg = c; return nil }
func (m *memStore) MergeUISettings(ch map[string]*string) error {
	if m.cfg.UISettings == nil {
		m.cfg.UISettings = map[string]string{}
	}
	for k, v := range ch {
		if v == nil {
			delete(m.cfg.UISettings, k)
		} else {
			m.cfg.UISettings[k] = *v
		}
	}
	return nil
}

type fakeRunner struct{ ran bool }

func (f *fakeRunner) Run(context.Context, model.Plan) model.RunResult {
	f.ran = true
	return model.RunResult{Nodes: []model.NodeResult{{Name: "gluetun", State: model.StateReady}}}
}

func newServer() (*Server, http.Handler) {
	s := &Server{
		Docker: &fakeDocker{containers: []model.Container{{Name: "gluetun", State: "running"}}},
		Store:  &memStore{},
		Runner: &fakeRunner{},
	}
	return s, s.Handler()
}

func TestState(t *testing.T) {
	_, h := newServer()
	req := httptest.NewRequest("GET", "/api/state", nil)
	rec := httptest.NewRecorder()
	h.ServeHTTP(rec, req)
	if rec.Code != 200 {
		t.Fatalf("state code = %d", rec.Code)
	}
	var resp stateResp
	if err := json.Unmarshal(rec.Body.Bytes(), &resp); err != nil {
		t.Fatalf("decode: %v", err)
	}
	if len(resp.Containers) != 1 || resp.Containers[0].Name != "gluetun" {
		t.Fatalf("containers wrong: %+v", resp.Containers)
	}
}

func TestPutPlanValid(t *testing.T) {
	_, h := newServer()
	plan := model.Plan{Nodes: []model.Node{{Name: "db"}, {Name: "app", After: []string{"db"}}}}
	body, _ := json.Marshal(plan)
	req := httptest.NewRequest("PUT", "/api/plan", bytes.NewReader(body))
	rec := httptest.NewRecorder()
	h.ServeHTTP(rec, req)
	if rec.Code != 200 {
		t.Fatalf("valid plan should save (200), got %d: %s", rec.Code, rec.Body)
	}
}

func TestPutPlanRejectsCycle(t *testing.T) {
	_, h := newServer()
	plan := model.Plan{Nodes: []model.Node{{Name: "a", After: []string{"b"}}, {Name: "b", After: []string{"a"}}}}
	body, _ := json.Marshal(plan)
	req := httptest.NewRequest("PUT", "/api/plan", bytes.NewReader(body))
	rec := httptest.NewRecorder()
	h.ServeHTTP(rec, req)
	if rec.Code != 400 {
		t.Fatalf("a cyclic plan must be rejected (400), got %d", rec.Code)
	}
}

func TestApply(t *testing.T) {
	s, h := newServer()
	s.Store.(*memStore).plan = model.Plan{Nodes: []model.Node{{Name: "gluetun"}}}
	req := httptest.NewRequest("POST", "/api/apply", nil)
	rec := httptest.NewRecorder()
	h.ServeHTTP(rec, req)
	if rec.Code != 200 {
		t.Fatalf("apply code = %d", rec.Code)
	}
	if !s.Runner.(*fakeRunner).ran {
		t.Fatal("apply did not invoke the runner")
	}
	req2 := httptest.NewRequest("GET", "/api/state", nil)
	rec2 := httptest.NewRecorder()
	h.ServeHTTP(rec2, req2)
	var resp stateResp
	_ = json.Unmarshal(rec2.Body.Bytes(), &resp)
	if len(resp.LastRun.Nodes) != 1 || resp.LastRun.Nodes[0].State != model.StateReady {
		t.Fatalf("last_run not surfaced after apply: %+v", resp.LastRun)
	}
}

func TestAction(t *testing.T) {
	s, h := newServer()
	body, _ := json.Marshal(map[string]string{"name": "gluetun", "action": "restart"})
	req := httptest.NewRequest("POST", "/api/action", bytes.NewReader(body))
	rec := httptest.NewRecorder()
	h.ServeHTTP(rec, req)
	if rec.Code != 200 {
		t.Fatalf("action code = %d: %s", rec.Code, rec.Body)
	}
	acts := s.Docker.(*fakeDocker).actions
	if len(acts) != 1 || acts[0] != "restart:gluetun" {
		t.Fatalf("expected [restart:gluetun], got %v", acts)
	}
}

func TestActionUnknownContainer(t *testing.T) {
	_, h := newServer()
	body, _ := json.Marshal(map[string]string{"name": "ghost", "action": "stop"})
	req := httptest.NewRequest("POST", "/api/action", bytes.NewReader(body))
	rec := httptest.NewRecorder()
	h.ServeHTTP(rec, req)
	if rec.Code != 400 {
		t.Fatalf("an unknown container must be rejected (400), got %d", rec.Code)
	}
}

func TestActionUnknownVerb(t *testing.T) {
	_, h := newServer()
	body, _ := json.Marshal(map[string]string{"name": "gluetun", "action": "explode"})
	req := httptest.NewRequest("POST", "/api/action", bytes.NewReader(body))
	rec := httptest.NewRecorder()
	h.ServeHTTP(rec, req)
	if rec.Code != 400 {
		t.Fatalf("an unknown verb must be rejected (400), got %d", rec.Code)
	}
}

func TestStatsEndpoint(t *testing.T) {
	_, h := newServer()
	req := httptest.NewRequest("GET", "/api/stats", nil)
	rec := httptest.NewRecorder()
	h.ServeHTTP(rec, req)
	if rec.Code != 200 {
		t.Fatalf("stats code = %d", rec.Code)
	}
	var m map[string]model.Stats
	if err := json.Unmarshal(rec.Body.Bytes(), &m); err != nil {
		t.Fatalf("decode: %v", err)
	}
	if st, ok := m["gluetun"]; !ok || st.CPUPercent != 12 {
		t.Fatalf("stats for the running container missing/wrong: %+v", m)
	}
}

func TestLimitsSetGetAndValidate(t *testing.T) {
	s, h := newServer()
	body, _ := json.Marshal(map[string]any{"name": "gluetun", "mem_bytes": 1073741824, "nano_cpus": 1500000000})
	rec := httptest.NewRecorder()
	h.ServeHTTP(rec, httptest.NewRequest("POST", "/api/limits", bytes.NewReader(body)))
	if rec.Code != 200 {
		t.Fatalf("set limits code = %d: %s", rec.Code, rec.Body)
	}
	fd := s.Docker.(*fakeDocker)
	if len(fd.actions) != 1 || fd.actions[0] != "limits:gluetun:1073741824:1500000000" {
		t.Fatalf("update not recorded: %v", fd.actions)
	}
	bad, _ := json.Marshal(map[string]any{"name": "ghost", "mem_bytes": 1})
	rec2 := httptest.NewRecorder()
	h.ServeHTTP(rec2, httptest.NewRequest("POST", "/api/limits", bytes.NewReader(bad)))
	if rec2.Code != 400 {
		t.Fatalf("unknown container must be 400, got %d", rec2.Code)
	}
	rec3 := httptest.NewRecorder()
	h.ServeHTTP(rec3, httptest.NewRequest("GET", "/api/limits?name=gluetun", nil))
	if rec3.Code != 200 {
		t.Fatalf("get limits code = %d", rec3.Code)
	}
	var lim model.Limits
	if err := json.Unmarshal(rec3.Body.Bytes(), &lim); err != nil {
		t.Fatalf("decode: %v", err)
	}
	if lim.MemBytes != 1073741824 || lim.NanoCPUs != 1500000000 {
		t.Fatalf("limits wrong: %+v", lim)
	}
}

// The expected totals come from the same hostcpu functions the handler uses, so
// the test holds on any OS and on Linux proves the real host totals are sent.
func TestLimitsRemoveSendsHostTotals(t *testing.T) {
	s, h := newServer()
	body, _ := json.Marshal(map[string]any{"name": "gluetun", "remove_mem": true, "remove_cpu": true})
	rec := httptest.NewRecorder()
	h.ServeHTTP(rec, httptest.NewRequest("POST", "/api/limits", bytes.NewReader(body)))
	if rec.Code != 200 {
		t.Fatalf("remove limits code = %d: %s", rec.Code, rec.Body)
	}
	wantMem := hostcpu.MemTotal()
	if wantMem == 0 {
		wantMem = fakeHostMem
	}
	wantCPU := int64(hostcpu.Count()) * 1e9
	fd := s.Docker.(*fakeDocker)
	want := fmt.Sprintf("limits:gluetun:%d:%d", wantMem, wantCPU)
	if len(fd.actions) != 1 || fd.actions[0] != want {
		t.Fatalf("remove must send host totals %q, got %v", want, fd.actions)
	}
}

func TestLimitsDualWriteStripsTemplateConflicts(t *testing.T) {
	s, h := newServer()
	dir := t.TempDir()
	s.TemplatesDir = dir
	f := filepath.Join(dir, "my-gluetun.xml")
	tmpl := `<Container><Name>gluetun</Name><ExtraParams>--restart=always -m 1g --memory-swap=4g --cpu-shares 512 --cpuset-cpus 0-7</ExtraParams></Container>`
	if err := os.WriteFile(f, []byte(tmpl), 0o644); err != nil {
		t.Fatal(err)
	}
	body, _ := json.Marshal(map[string]any{"name": "gluetun", "mem_bytes": 1073741824, "nano_cpus": 2000000000})
	rec := httptest.NewRecorder()
	h.ServeHTTP(rec, httptest.NewRequest("POST", "/api/limits", bytes.NewReader(body)))
	if rec.Code != 200 {
		t.Fatalf("set limits code = %d: %s", rec.Code, rec.Body)
	}
	got, _ := os.ReadFile(f)
	for _, gone := range []string{"-m 1g", "--memory-swap", "--cpu-shares", "--cpuset-cpus", "0-7"} {
		if strings.Contains(string(got), gone) {
			t.Fatalf("conflicting template flag %q must be stripped:\n%s", gone, got)
		}
	}
	for _, want := range []string{"--restart=always", "--memory=1G", "--cpus=2"} {
		if !strings.Contains(string(got), want) {
			t.Fatalf("missing %q in rewritten template:\n%s", want, got)
		}
	}
}

func TestLimitsWriteMemoryToTemplateInHumanUnits(t *testing.T) {
	for _, tc := range []struct {
		name     string
		memBytes int64
		old      string
		want     string
		wantLive int64
	}{
		{"2 GB over the byte form", 2147483648, "--memory=2147483648", "--memory=2G", 2147483648},
		{"half a GB", 536870912, "--memory=4G", "--memory=512M", 536870912},
		{"1.33 GB rounds to a whole megabyte", 1428076954, "", "--memory=1362M", 1362 << 20},
	} {
		t.Run(tc.name, func(t *testing.T) {
			s, h := newServer()
			dir := t.TempDir()
			s.TemplatesDir = dir
			f := filepath.Join(dir, "my-gluetun.xml")
			tmpl := `<Container><Name>gluetun</Name><ExtraParams>--restart=always ` + tc.old + `</ExtraParams></Container>`
			if err := os.WriteFile(f, []byte(tmpl), 0o644); err != nil {
				t.Fatal(err)
			}
			body, _ := json.Marshal(map[string]any{"name": "gluetun", "mem_bytes": tc.memBytes})
			rec := httptest.NewRecorder()
			h.ServeHTTP(rec, httptest.NewRequest("POST", "/api/limits", bytes.NewReader(body)))
			if rec.Code != 200 {
				t.Fatalf("set limits code = %d: %s", rec.Code, rec.Body)
			}
			got, _ := os.ReadFile(f)
			if !strings.Contains(string(got), tc.want) || strings.Count(string(got), "--memory") != 1 {
				t.Fatalf("want a single %q in the template:\n%s", tc.want, got)
			}
			fd := s.Docker.(*fakeDocker)
			if live := fmt.Sprintf("limits:gluetun:%d:0", tc.wantLive); len(fd.actions) != 1 || fd.actions[0] != live {
				t.Fatalf("live update must match the template, want %q, got %v", live, fd.actions)
			}
		})
	}
}

func TestLimitsBulk(t *testing.T) {
	s, h := newServer()
	s.Docker.(*fakeDocker).limits = model.Limits{MemBytes: 2147483648, NanoCPUs: 2000000000, CpusetCPUs: "0-1"}
	rec := httptest.NewRecorder()
	h.ServeHTTP(rec, httptest.NewRequest("GET", "/api/limits", nil))
	if rec.Code != 200 {
		t.Fatalf("bulk limits code = %d: %s", rec.Code, rec.Body)
	}
	var all map[string]model.Limits
	if err := json.Unmarshal(rec.Body.Bytes(), &all); err != nil {
		t.Fatalf("decode bulk: %v", err)
	}
	g, ok := all["gluetun"]
	if !ok || g.MemBytes != 2147483648 || g.CpusetCPUs != "0-1" {
		t.Fatalf("bulk limits map wrong: %+v", all)
	}
}

func TestRestartPolicySetValidateAndTemplate(t *testing.T) {
	s, h := newServer()
	dir := t.TempDir()
	s.TemplatesDir = dir
	f := filepath.Join(dir, "my-gluetun.xml")
	tmpl := `<Container><Name>gluetun</Name><ExtraParams>--restart=no --memory=1073741824</ExtraParams></Container>`
	if err := os.WriteFile(f, []byte(tmpl), 0o644); err != nil {
		t.Fatal(err)
	}
	body, _ := json.Marshal(map[string]any{"name": "gluetun", "policy": "unless-stopped"})
	rec := httptest.NewRecorder()
	h.ServeHTTP(rec, httptest.NewRequest("POST", "/api/restartpolicy", bytes.NewReader(body)))
	if rec.Code != 200 {
		t.Fatalf("set restart policy code = %d: %s", rec.Code, rec.Body)
	}
	var resp map[string]any
	if err := json.Unmarshal(rec.Body.Bytes(), &resp); err != nil {
		t.Fatalf("decode: %v", err)
	}
	if resp["after_policy"] != "unless-stopped" {
		t.Fatalf("verify re-read wrong: %+v", resp)
	}
	fd := s.Docker.(*fakeDocker)
	if len(fd.actions) != 1 || fd.actions[0] != "restart:gluetun:unless-stopped" {
		t.Fatalf("live update not recorded: %v", fd.actions)
	}
	got, _ := os.ReadFile(f)
	if strings.Contains(string(got), "--restart=no") {
		t.Fatalf("old --restart must be replaced:\n%s", got)
	}
	for _, want := range []string{"--restart=unless-stopped", "--memory=1073741824"} {
		if !strings.Contains(string(got), want) {
			t.Fatalf("missing %q in rewritten template:\n%s", want, got)
		}
	}
	bad, _ := json.Marshal(map[string]any{"name": "gluetun", "policy": "sometimes"})
	rec2 := httptest.NewRecorder()
	h.ServeHTTP(rec2, httptest.NewRequest("POST", "/api/restartpolicy", bytes.NewReader(bad)))
	if rec2.Code != 400 {
		t.Fatalf("invalid policy must be 400, got %d", rec2.Code)
	}
	ghost, _ := json.Marshal(map[string]any{"name": "ghost", "policy": "always"})
	rec3 := httptest.NewRecorder()
	h.ServeHTTP(rec3, httptest.NewRequest("POST", "/api/restartpolicy", bytes.NewReader(ghost)))
	if rec3.Code != 400 {
		t.Fatalf("unknown container must be 400, got %d", rec3.Code)
	}
	if len(fd.actions) != 1 {
		t.Fatalf("invalid/unknown must not touch the socket: %v", fd.actions)
	}
}

func TestConfigPutGetAndValidate(t *testing.T) {
	s, h := newServer()
	cfg := model.Config{
		Schedules: []model.Schedule{{Name: "gluetun", Action: "restart", Time: "03:00", Enabled: true}},
		Watchdogs: []model.Watchdog{{Name: "gluetun", Enabled: true, OnUnhealthy: true, MaxRestarts: 3}},
		Notify:    model.Notify{Unraid: true, Webhook: "https://example.test/hook"},
	}
	body, _ := json.Marshal(cfg)
	rec := httptest.NewRecorder()
	h.ServeHTTP(rec, httptest.NewRequest("PUT", "/api/config", bytes.NewReader(body)))
	if rec.Code != 200 {
		t.Fatalf("put config = %d: %s", rec.Code, rec.Body)
	}
	if len(s.Store.(*memStore).cfg.Schedules) != 1 {
		t.Fatalf("config not stored: %+v", s.Store.(*memStore).cfg)
	}
	bad, _ := json.Marshal(model.Config{Schedules: []model.Schedule{{Name: "x", Action: "explode", Time: "03:00"}}})
	rec2 := httptest.NewRecorder()
	h.ServeHTTP(rec2, httptest.NewRequest("PUT", "/api/config", bytes.NewReader(bad)))
	if rec2.Code != 400 {
		t.Fatalf("bad action should be 400, got %d", rec2.Code)
	}
	badTime, _ := json.Marshal(model.Config{Schedules: []model.Schedule{{Name: "x", Action: "start", Time: "9:00"}}})
	rec2b := httptest.NewRecorder()
	h.ServeHTTP(rec2b, httptest.NewRequest("PUT", "/api/config", bytes.NewReader(badTime)))
	if rec2b.Code != 400 {
		t.Fatalf("bad time should be 400, got %d", rec2b.Code)
	}
	rec3 := httptest.NewRecorder()
	h.ServeHTTP(rec3, httptest.NewRequest("GET", "/api/config", nil))
	var got model.Config
	_ = json.Unmarshal(rec3.Body.Bytes(), &got)
	if len(got.Watchdogs) != 1 || got.Notify.Webhook != "https://example.test/hook" {
		t.Fatalf("config get wrong: %+v", got)
	}
}

func TestConfigIdleStopValidation(t *testing.T) {
	s, h := newServer()
	put := func(cfg model.Config) int {
		body, _ := json.Marshal(cfg)
		rec := httptest.NewRecorder()
		h.ServeHTTP(rec, httptest.NewRequest("PUT", "/api/config", bytes.NewReader(body)))
		return rec.Code
	}
	if code := put(model.Config{IdleStops: []model.IdleStop{{Name: "jelly", Enabled: true, IdleMinutes: 30, CPUThresholdPct: 5}}}); code != 200 {
		t.Fatalf("valid idle-stop should be 200, got %d", code)
	}
	if len(s.Store.(*memStore).cfg.IdleStops) != 1 {
		t.Fatalf("idle-stop not stored: %+v", s.Store.(*memStore).cfg)
	}
	rec := httptest.NewRecorder()
	h.ServeHTTP(rec, httptest.NewRequest("GET", "/api/config", nil))
	var got model.Config
	_ = json.Unmarshal(rec.Body.Bytes(), &got)
	if len(got.IdleStops) != 1 || got.IdleStops[0].Name != "jelly" || got.IdleStops[0].IdleMinutes != 30 {
		t.Fatalf("idle-stop did not round-trip: %+v", got.IdleStops)
	}
	if code := put(model.Config{IdleStops: []model.IdleStop{{Name: "", Enabled: true, IdleMinutes: 30}}}); code != 400 {
		t.Fatalf("empty name should be 400, got %d", code)
	}
	if code := put(model.Config{IdleStops: []model.IdleStop{{Name: "x", IdleMinutes: 999999}}}); code != 400 {
		t.Fatalf("out-of-range minutes should be 400, got %d", code)
	}
	if code := put(model.Config{IdleStops: []model.IdleStop{{Name: "x", IdleMinutes: 30, CPUThresholdPct: 150}}}); code != 400 {
		t.Fatalf("threshold > 100 should be 400, got %d", code)
	}
	if code := put(model.Config{IdleStops: []model.IdleStop{{Name: "x", IdleMinutes: 30, CPUThresholdPct: -1}}}); code != 400 {
		t.Fatalf("negative threshold should be 400, got %d", code)
	}
}

func TestPutUISettingsMergesAndDeletes(t *testing.T) {
	s, h := newServer()
	s.Store.(*memStore).cfg = model.Config{
		Schedules:  []model.Schedule{{Name: "db", Action: "start", Time: "06:00"}},
		UISettings: map[string]string{"cc.accent": "#FCC419", "cc.rainbow": "1", "cc.view": "grid"},
	}
	req := httptest.NewRequest("PUT", "/api/uisettings", strings.NewReader(`{"cc.accent":"#1D99F3","cc.rainbow":null,"ccp.badges":"0"}`))
	rec := httptest.NewRecorder()
	h.ServeHTTP(rec, req)
	if rec.Code != 200 {
		t.Fatalf("merge code = %d: %s", rec.Code, rec.Body)
	}
	cfg := s.Store.(*memStore).cfg
	want := map[string]string{"cc.accent": "#1D99F3", "cc.view": "grid", "ccp.badges": "0"}
	if len(cfg.UISettings) != len(want) {
		t.Fatalf("ui settings = %v, want %v", cfg.UISettings, want)
	}
	for k, v := range want {
		if cfg.UISettings[k] != v {
			t.Errorf("%s = %q, want %q", k, cfg.UISettings[k], v)
		}
	}
	if len(cfg.Schedules) != 1 {
		t.Errorf("the merge touched the schedules: %+v", cfg.Schedules)
	}
}

func TestPutUISettingsRejectsForeignKeys(t *testing.T) {
	_, h := newServer()
	for _, body := range []string{`{"schedules":"x"}`, `{"cc.x":"` + strings.Repeat("a", 4097) + `"}`, `not json`} {
		req := httptest.NewRequest("PUT", "/api/uisettings", strings.NewReader(body))
		rec := httptest.NewRecorder()
		h.ServeHTTP(rec, req)
		if rec.Code != 400 {
			t.Errorf("%.30s: code = %d, want 400", body, rec.Code)
		}
	}
}

func TestBugReportIsARedactedDownload(t *testing.T) {
	s, h := newServer()
	dir := t.TempDir()
	logFile := filepath.Join(dir, "cc.log")
	if err := os.WriteFile(logFile, []byte("webhook https://hooks.example/abc/SECRETPATH failed\n"), 0o644); err != nil {
		t.Fatal(err)
	}
	s.Version = "v1.2.0"
	s.Diag.LogFile = logFile
	s.Store.(*memStore).cfg.Notify.Webhook = "https://hooks.example/abc/SECRETPATH"
	s.Store.(*memStore).plan = model.Plan{Nodes: []model.Node{{Name: "db", Probe: model.Probe{Kind: model.ProbeExec, Command: "pg_isready --password=hunter2"}}}}

	rec := httptest.NewRecorder()
	h.ServeHTTP(rec, httptest.NewRequest("GET", "/api/bugreport", nil))
	if rec.Code != http.StatusOK {
		t.Fatalf("code = %d", rec.Code)
	}
	if cd := rec.Header().Get("Content-Disposition"); !strings.HasPrefix(cd, `attachment; filename="towertorch-bugreport-`) {
		t.Errorf("Content-Disposition = %q", cd)
	}
	body := rec.Body.String()
	if strings.Contains(body, "SECRETPATH") || strings.Contains(body, "hunter2") {
		t.Errorf("the report leaks a secret:\n%s", body)
	}
	if !strings.Contains(body, "Engine:  v1.2.0") || !strings.Contains(body, `"name": "db"`) {
		t.Errorf("the report lacks the version or the plan:\n%s", body)
	}
}
