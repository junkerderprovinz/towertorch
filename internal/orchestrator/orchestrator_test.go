package orchestrator

import (
	"context"
	"errors"
	"reflect"
	"sync"
	"testing"

	"github.com/junkerderprovinz/towertorch/internal/model"
)

// fakeStarter records the order in which containers were started and can be told
// to fail specific ones.
type fakeStarter struct {
	mu      sync.Mutex
	started []string
	failOn  map[string]bool
}

func (f *fakeStarter) Start(_ context.Context, name string) error {
	f.mu.Lock()
	defer f.mu.Unlock()
	f.started = append(f.started, name)
	if f.failOn[name] {
		return errors.New("boom")
	}
	return nil
}

func (f *fakeStarter) index(name string) int {
	f.mu.Lock()
	defer f.mu.Unlock()
	for i, n := range f.started {
		if n == name {
			return i
		}
	}
	return -1
}

// fakeReady reports every node ready except those in notReady.
type fakeReady struct{ notReady map[string]bool }

func (f fakeReady) WaitReady(_ context.Context, node model.Node) (bool, string) {
	if f.notReady[node.Name] {
		return false, "timeout"
	}
	return true, "ok"
}

func node(name string, after ...string) model.Node {
	return model.Node{Name: name, After: after, Policy: model.PolicyAbort}
}

func TestTopoStages(t *testing.T) {
	tests := []struct {
		name    string
		plan    model.Plan
		want    [][]string
		wantErr bool
	}{
		{
			name: "linear chain",
			plan: model.Plan{Nodes: []model.Node{node("a"), node("b", "a"), node("c", "b")}},
			want: [][]string{{"a"}, {"b"}, {"c"}},
		},
		{
			name: "parallel roots then join",
			plan: model.Plan{Nodes: []model.Node{node("db"), node("cache"), node("app", "db", "cache")}},
			want: [][]string{{"db", "cache"}, {"app"}},
		},
		{
			name: "diamond",
			plan: model.Plan{Nodes: []model.Node{node("a"), node("b", "a"), node("c", "a"), node("d", "b", "c")}},
			want: [][]string{{"a"}, {"b", "c"}, {"d"}},
		},
		{
			name:    "cycle",
			plan:    model.Plan{Nodes: []model.Node{node("a", "b"), node("b", "a")}},
			wantErr: true,
		},
		{
			name: "unknown dependency becomes an implicit node",
			plan: model.Plan{Nodes: []model.Node{node("a", "ghost")}},
			want: [][]string{{"ghost"}, {"a"}},
		},
		{
			name:    "duplicate node",
			plan:    model.Plan{Nodes: []model.Node{node("a"), node("a")}},
			wantErr: true,
		},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got, err := TopoStages(tt.plan)
			if tt.wantErr {
				if err == nil {
					t.Fatalf("expected an error, got stages %v", got)
				}
				return
			}
			if err != nil {
				t.Fatalf("unexpected error: %v", err)
			}
			if !reflect.DeepEqual(got, tt.want) {
				t.Fatalf("stages = %v, want %v", got, tt.want)
			}
		})
	}
}

func TestTopoStages_StartOrder(t *testing.T) {
	p := model.Plan{Nodes: []model.Node{
		{Name: "a", Policy: model.PolicyAbort},
		{Name: "b", StartOrder: 20, Policy: model.PolicyAbort},
		{Name: "c", StartOrder: 10, Policy: model.PolicyAbort},
		{Name: "d", Policy: model.PolicyAbort},
		{Name: "e", StartOrder: 10, Policy: model.PolicyAbort}, // ties with c, so plan order decides
	}}
	stages, err := TopoStages(p)
	if err != nil {
		t.Fatal(err)
	}
	if len(stages) != 1 {
		t.Fatalf("no deps → 1 stage, got %d: %v", len(stages), stages)
	}
	want := []string{"c", "e", "b", "a", "d"} // 10, 10, 20, then the unnumbered in plan order
	if !reflect.DeepEqual(stages[0], want) {
		t.Errorf("StartOrder within stage = %v, want %v", stages[0], want)
	}
}

func TestTopoStages_StartOrderRespectsDeps(t *testing.T) {
	p := model.Plan{Nodes: []model.Node{
		{Name: "app", StartOrder: 1, After: []string{"db"}, Policy: model.PolicyAbort},
		{Name: "db", Policy: model.PolicyAbort},
	}}
	stages, err := TopoStages(p)
	if err != nil {
		t.Fatal(err)
	}
	if len(stages) != 2 || len(stages[0]) != 1 || stages[0][0] != "db" || stages[1][0] != "app" {
		t.Errorf("deps must bound StartOrder: stages = %v, want [[db] [app]]", stages)
	}
}

func TestRun_HealthGatedOrder(t *testing.T) {
	plan := model.Plan{Nodes: []model.Node{
		node("gluetun"),
		node("postgres"),
		node("qbittorrent", "gluetun"),
		node("nextcloud", "postgres"),
	}}
	fs := &fakeStarter{}
	o := Orchestrator{Starter: fs, Ready: fakeReady{}}

	res := o.Run(context.Background(), plan)
	if res.Error != "" {
		t.Fatalf("unexpected plan error: %s", res.Error)
	}
	for _, n := range res.Nodes {
		if n.State != model.StateReady {
			t.Fatalf("node %s state = %s, want ready", n.Name, n.State)
		}
	}
	if fs.index("gluetun") >= fs.index("qbittorrent") {
		t.Fatalf("qbittorrent started before gluetun was ready")
	}
	if fs.index("postgres") >= fs.index("nextcloud") {
		t.Fatalf("nextcloud started before postgres was ready")
	}
}

func TestRun_OutOfPlanDepIsRunAndReported(t *testing.T) {
	plan := model.Plan{Nodes: []model.Node{node("app", "ext")}}
	fs := &fakeStarter{}
	o := Orchestrator{Starter: fs, Ready: fakeReady{}}

	res := o.Run(context.Background(), plan)
	if res.Error != "" {
		t.Fatalf("unexpected plan error: %s", res.Error)
	}
	if fs.index("") != -1 {
		t.Fatalf("started a zero-value (empty-name) node: %v", fs.started)
	}
	if fs.index("ext") == -1 {
		t.Fatalf("implicit out-of-plan dep 'ext' was never started: %v", fs.started)
	}
	if fs.index("ext") >= fs.index("app") {
		t.Fatalf("app started before its implicit dep 'ext' was ready: %v", fs.started)
	}
	var extResult *model.NodeResult
	for i := range res.Nodes {
		if res.Nodes[i].Name == "ext" {
			extResult = &res.Nodes[i]
		}
	}
	if extResult == nil {
		t.Fatalf("implicit dep 'ext' missing from the run report: %+v", res.Nodes)
	}
	if extResult.State != model.StateReady {
		t.Fatalf("implicit dep 'ext' state = %s, want ready", extResult.State)
	}
}

func TestRun_AbortSkipsDependents(t *testing.T) {
	plan := model.Plan{Nodes: []model.Node{
		node("gluetun"), // fails readiness under the abort policy
		node("qbittorrent", "gluetun"),
		node("sonarr", "qbittorrent"),
	}}
	fs := &fakeStarter{}
	o := Orchestrator{Starter: fs, Ready: fakeReady{notReady: map[string]bool{"gluetun": true}}}

	res := o.Run(context.Background(), plan)
	want := map[string]model.NodeState{
		"gluetun":     model.StateFailed,
		"qbittorrent": model.StateSkipped,
		"sonarr":      model.StateSkipped,
	}
	for _, n := range res.Nodes {
		if n.State != want[n.Name] {
			t.Fatalf("node %s state = %s, want %s (reason %q)", n.Name, n.State, want[n.Name], n.Reason)
		}
	}
	// A skipped container must never have been started.
	if fs.index("qbittorrent") != -1 || fs.index("sonarr") != -1 {
		t.Fatalf("a skipped dependent was started: %v", fs.started)
	}
}

func TestRun_ContinuePastFailure(t *testing.T) {
	a := node("a")
	a.Policy = model.PolicyContinue
	plan := model.Plan{Nodes: []model.Node{a, node("b", "a")}}
	fs := &fakeStarter{}
	o := Orchestrator{Starter: fs, Ready: fakeReady{notReady: map[string]bool{"a": true}}}

	res := o.Run(context.Background(), plan)
	states := map[string]model.NodeState{}
	for _, n := range res.Nodes {
		states[n.Name] = n.State
	}
	if states["a"] != model.StateFailed {
		t.Fatalf("a state = %s, want failed", states["a"])
	}
	if states["b"] != model.StateReady {
		t.Fatalf("b state = %s, want ready (continue must not block dependents)", states["b"])
	}
	if fs.index("b") == -1 {
		t.Fatalf("b was never started despite continue policy")
	}
}

func TestRun_DegradeMarksDegraded(t *testing.T) {
	a := node("a")
	a.Policy = model.PolicyDegrade
	plan := model.Plan{Nodes: []model.Node{a, node("b", "a")}}
	o := Orchestrator{Starter: &fakeStarter{}, Ready: fakeReady{notReady: map[string]bool{"a": true}}}

	res := o.Run(context.Background(), plan)
	states := map[string]model.NodeState{}
	for _, n := range res.Nodes {
		states[n.Name] = n.State
	}
	if states["a"] != model.StateDegraded {
		t.Fatalf("a state = %s, want degraded", states["a"])
	}
	if states["b"] != model.StateReady {
		t.Fatalf("b state = %s, want ready (degrade must not block dependents)", states["b"])
	}
}

func TestRun_StartErrorAborts(t *testing.T) {
	plan := model.Plan{Nodes: []model.Node{node("a"), node("b", "a")}}
	fs := &fakeStarter{failOn: map[string]bool{"a": true}}
	o := Orchestrator{Starter: fs, Ready: fakeReady{}}

	res := o.Run(context.Background(), plan)
	states := map[string]model.NodeState{}
	for _, n := range res.Nodes {
		states[n.Name] = n.State
	}
	if states["a"] != model.StateFailed {
		t.Fatalf("a state = %s, want failed on start error", states["a"])
	}
	if states["b"] != model.StateSkipped {
		t.Fatalf("b state = %s, want skipped", states["b"])
	}
}

func TestRun_InvalidPlan(t *testing.T) {
	plan := model.Plan{Nodes: []model.Node{node("a", "b"), node("b", "a")}}
	o := Orchestrator{Starter: &fakeStarter{}, Ready: fakeReady{}}
	res := o.Run(context.Background(), plan)
	if res.Error == "" {
		t.Fatalf("expected a plan error for a cycle")
	}
}
