// Package orchestrator turns a start plan into ordered, health-gated container
// starts. It computes parallel start stages from the dependency graph, then for
// each stage starts its containers and waits for each to become ready before
// releasing the next stage, honouring each node's failure policy.
package orchestrator

import (
	"context"
	"fmt"
	"sort"
	"sync"
	"time"

	"github.com/junkerderprovinz/towertorch/internal/model"
)

// withImplicitDeps appends a ready-when-running, never-blocking node for every
// dependency on a container outside the plan, so such a dependency works without
// the UI having to persist the container as a managed node.
func withImplicitDeps(plan model.Plan) model.Plan {
	known := make(map[string]bool, len(plan.Nodes))
	for _, n := range plan.Nodes {
		known[n.Name] = true
	}
	out := plan
	out.Nodes = append([]model.Node{}, plan.Nodes...)
	for _, n := range plan.Nodes {
		for _, d := range n.After {
			if d != "" && !known[d] {
				known[d] = true
				out.Nodes = append(out.Nodes, model.Node{Name: d, Probe: model.Probe{Kind: "running", GraceSeconds: 3}, Policy: "continue"})
			}
		}
	}
	return out
}

// TopoStages groups a plan's nodes into ordered start stages via Kahn's
// algorithm. Every node in a stage has all its dependencies satisfied by an
// earlier stage, so the stage can be started in parallel. Within a stage, plan
// order is preserved for stable output. It returns an error if a node lists an
// unknown dependency, a name is duplicated, or the graph contains a cycle.
func TopoStages(plan model.Plan) ([][]string, error) {
	plan = withImplicitDeps(plan)
	known := make(map[string]bool, len(plan.Nodes))
	for _, n := range plan.Nodes {
		if known[n.Name] {
			return nil, fmt.Errorf("duplicate node %q", n.Name)
		}
		known[n.Name] = true
	}

	indeg := make(map[string]int, len(plan.Nodes))
	dependents := make(map[string][]string, len(plan.Nodes))
	for _, n := range plan.Nodes {
		for _, d := range n.After {
			if !known[d] {
				return nil, fmt.Errorf("node %q depends on unknown node %q", n.Name, d)
			}
			indeg[n.Name]++
			dependents[d] = append(dependents[d], n.Name)
		}
	}

	// StartOrder only reorders peers within a stage; the dependencies decide the
	// stage itself, so a numbered node can never jump ahead of a dependency.
	const unordered = 1 << 30
	orderOf := make(map[string]int, len(plan.Nodes))
	for _, n := range plan.Nodes {
		if n.StartOrder > 0 {
			orderOf[n.Name] = n.StartOrder
		} else {
			orderOf[n.Name] = unordered
		}
	}

	done := make(map[string]bool, len(plan.Nodes))
	remaining := len(plan.Nodes)
	var stages [][]string
	for remaining > 0 {
		var stage []string
		for _, n := range plan.Nodes { // plan order gives the stage a stable base order
			if !done[n.Name] && indeg[n.Name] == 0 {
				stage = append(stage, n.Name)
			}
		}
		// A stable sort leaves plan order to break ties and to order the unnumbered.
		sort.SliceStable(stage, func(i, j int) bool { return orderOf[stage[i]] < orderOf[stage[j]] })
		if len(stage) == 0 {
			return nil, fmt.Errorf("dependency cycle detected among %d remaining node(s)", remaining)
		}
		for _, name := range stage {
			done[name] = true
			remaining--
			for _, dep := range dependents[name] {
				indeg[dep]--
			}
		}
		stages = append(stages, stage)
	}
	return stages, nil
}

// Starter starts a container by name. Starting an already-running container is
// expected to be a no-op / not an error.
type Starter interface {
	Start(ctx context.Context, name string) error
}

// ReadinessChecker blocks until a node is ready or its timeout elapses, and
// reports whether it became ready plus a short human-readable reason.
type ReadinessChecker interface {
	WaitReady(ctx context.Context, node model.Node) (ready bool, reason string)
}

// Orchestrator runs a plan against a Starter and a ReadinessChecker.
type Orchestrator struct {
	Starter Starter
	Ready   ReadinessChecker
}

// Run executes the plan and returns per-node results. A node's failure is part of
// its result; only a structurally invalid plan is reported in RunResult.Error.
func (o *Orchestrator) Run(ctx context.Context, plan model.Plan) model.RunResult {
	// byName and the report below iterate plan.Nodes, so the implicit nodes have to
	// be in place before that, not only inside TopoStages. The call is idempotent.
	plan = withImplicitDeps(plan)
	stages, err := TopoStages(plan)
	if err != nil {
		return model.RunResult{Error: err.Error()}
	}

	byName := make(map[string]model.Node, len(plan.Nodes))
	for _, n := range plan.Nodes {
		byName[n.Name] = n
	}
	results := make(map[string]model.NodeResult, len(plan.Nodes))
	blocked := make(map[string]bool) // nodes that aborted the chain, or were skipped

	for stageIdx, stage := range stages {
		// A cancelled context stops the whole run, so the rest is skipped uniformly
		// rather than run through each node's failure policy.
		if ctx.Err() != nil {
			for _, rest := range stages[stageIdx:] {
				for _, name := range rest {
					if _, done := results[name]; !done {
						results[name] = model.NodeResult{Name: name, Stage: stageIdx, State: model.StateSkipped, Reason: "run cancelled"}
					}
				}
			}
			break
		}
		// A node's dependencies live in an earlier, finished stage, so blocked is
		// final for them and can be read here with no goroutines running.
		var toRun []model.Node
		for _, name := range stage {
			node := byName[name]
			if reason, skip := firstBlocked(node.After, blocked); skip {
				results[name] = model.NodeResult{Name: name, Stage: stageIdx, State: model.StateSkipped, Reason: reason}
				blocked[name] = true
				continue
			}
			toRun = append(toRun, node)
		}

		var wg sync.WaitGroup
		var mu sync.Mutex
		for _, node := range toRun {
			wg.Add(1)
			go func(node model.Node) {
				defer wg.Done()
				res := o.runNode(ctx, node, stageIdx)
				mu.Lock()
				results[node.Name] = res
				if res.State == model.StateFailed && node.Policy == model.PolicyAbort {
					blocked[node.Name] = true
				}
				mu.Unlock()
			}(node)
		}
		wg.Wait()
	}

	out := model.RunResult{Stages: stages}
	for _, n := range plan.Nodes {
		out.Nodes = append(out.Nodes, results[n.Name])
	}
	return out
}

func (o *Orchestrator) runNode(ctx context.Context, node model.Node, stage int) model.NodeResult {
	r := model.NodeResult{Name: node.Name, Stage: stage}
	if node.DelaySeconds > 0 {
		select {
		case <-time.After(time.Duration(node.DelaySeconds) * time.Second):
		case <-ctx.Done():
			r.State, r.Reason = model.StateSkipped, "run cancelled" // cancellation is a clean stop, not a policy failure
			return r
		}
	}
	if ctx.Err() != nil {
		r.State, r.Reason = model.StateSkipped, "run cancelled"
		return r
	}
	if err := o.Starter.Start(ctx, node.Name); err != nil {
		r.State = failState(node.Policy)
		r.Reason = "start failed: " + err.Error()
		return r
	}
	ready, reason := o.Ready.WaitReady(ctx, node)
	if ready {
		r.State, r.Reason = model.StateReady, reason
		return r
	}
	r.State = failState(node.Policy)
	if reason == "" {
		reason = "not ready within timeout"
	}
	r.Reason = reason
	return r
}

// failState maps a policy to the state a not-ready node lands in. Only
// PolicyAbort blocks dependents; that decision is made by the caller.
func failState(p model.Policy) model.NodeState {
	if p == model.PolicyDegrade {
		return model.StateDegraded
	}
	return model.StateFailed
}

func firstBlocked(after []string, blocked map[string]bool) (string, bool) {
	for _, d := range after {
		if blocked[d] {
			return "dependency " + d + " did not come up", true
		}
	}
	return "", false
}
