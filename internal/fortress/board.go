// Package fortress keeps what TowerTorch tells the other apps of its fortress:
// how the start plan's runs went, which containers the watchdog could not keep
// up, and a log of both, served through the status contract.
package fortress

import (
	"context"
	"strconv"
	"sync"
	"time"

	"github.com/junkerderprovinz/parleyport/kit/status"

	"github.com/junkerderprovinz/towertorch/internal/model"
)

// maxLog is how many log entries the board keeps. The log lives in memory
// only, so it starts empty with every engine start.
const maxLog = 500

// Containers lists the containers as Docker sees them.
type Containers interface {
	List(ctx context.Context) ([]model.Container, error)
}

// Board collects the events and answers the status contract. App and Instance
// go into every report as they are. Docker is optional and lets a failed start
// drop out once its container runs after all.
type Board struct {
	App      status.App
	Instance status.Instance
	Docker   Containers
	Now      func() time.Time

	mu       sync.Mutex
	runs     int       // plan runs in progress
	runSince time.Time // start of the oldest run in progress
	last     model.RunResult
	lastAt   time.Time
	watchdog map[string]trouble
	log      []entry
	nextID   int64
}

// trouble is a container the watchdog could not keep up.
type trouble struct {
	code  string
	args  []string
	since time.Time
}

// entry is a log line kept as a code and its values, so it reads in the
// language each reader asks for.
type entry struct {
	id    int64
	at    time.Time
	level status.Severity
	code  string
	args  []string
}

func (b *Board) now() time.Time {
	if b.Now != nil {
		return b.Now()
	}
	return time.Now()
}

// RunStarted marks a run of the start plan as going.
func (b *Board) RunStarted() {
	b.mu.Lock()
	defer b.mu.Unlock()
	if b.runs == 0 {
		b.runSince = b.now()
	}
	b.runs++
}

// RunFinished records how a run went. Its failures replace those of the run
// before.
func (b *Board) RunFinished(res model.RunResult) {
	b.mu.Lock()
	defer b.mu.Unlock()
	if b.runs > 0 {
		b.runs--
	}
	b.last, b.lastAt = res, b.now()
	ready, failed, degraded := 0, 0, 0
	for _, n := range res.Nodes {
		switch n.State {
		case model.StateReady:
			ready++
		case model.StateFailed:
			failed++
			b.add(status.SeverityError, "start.failed", n.Name, n.Reason)
		case model.StateDegraded:
			degraded++
			b.add(status.SeverityWarn, "start.degraded", n.Name, n.Reason)
		}
	}
	switch {
	case failed > 0:
		b.add(status.SeverityError, "plan.failed", strconv.Itoa(failed), strconv.Itoa(degraded))
	case degraded > 0:
		b.add(status.SeverityWarn, "plan.degraded", strconv.Itoa(degraded))
	case res.Error != "":
		b.add(status.SeverityError, "plan.invalid", res.Error)
	default:
		b.add(status.SeverityInfo, "plan.done", strconv.Itoa(ready))
	}
}

// WatchdogRestarted logs a restart. exitCode is the crash's exit code, or 0
// when the container had gone unhealthy, since a clean exit is never
// restarted.
func (b *Board) WatchdogRestarted(name string, exitCode int) {
	b.mu.Lock()
	defer b.mu.Unlock()
	if exitCode == 0 {
		b.add(status.SeverityWarn, "watchdog.restarted_unhealthy", name)
		return
	}
	b.add(status.SeverityWarn, "watchdog.restarted", name, strconv.Itoa(exitCode))
}

// WatchdogGaveUp records that the watchdog stopped restarting a container
// after max restarts within an hour.
func (b *Board) WatchdogGaveUp(name string, max int) {
	b.fail(name, "watchdog.gave_up", strconv.Itoa(max))
}

// WatchdogRestartFailed records a restart that Docker refused.
func (b *Board) WatchdogRestartFailed(name string, err error) {
	b.fail(name, "watchdog.restart_failed", err.Error())
}

func (b *Board) fail(name, code, detail string) {
	b.mu.Lock()
	defer b.mu.Unlock()
	if b.watchdog == nil {
		b.watchdog = map[string]trouble{}
	}
	t, seen := b.watchdog[name]
	if !seen || t.code != code {
		t.since = b.now()
		b.add(status.SeverityError, code, name, detail)
	}
	t.code, t.args = code, []string{name, detail}
	b.watchdog[name] = t
}

// WatchdogRecovered clears a watchdog failure once the container is fine.
func (b *Board) WatchdogRecovered(name string) {
	b.mu.Lock()
	defer b.mu.Unlock()
	if _, ok := b.watchdog[name]; !ok {
		return
	}
	delete(b.watchdog, name)
	b.add(status.SeverityInfo, "watchdog.recovered", name)
}

// add appends to the log. Called with mu held.
func (b *Board) add(level status.Severity, code string, args ...string) {
	at := b.now()
	// Ids start at the clock, so a cursor from before an engine restart still
	// sits below every new entry.
	if b.nextID == 0 {
		b.nextID = at.UnixNano()
	}
	b.nextID++
	b.log = append(b.log, entry{id: b.nextID, at: at, level: level, code: code, args: args})
	if len(b.log) > maxLog {
		b.log = append(b.log[:0:0], b.log[len(b.log)-maxLog:]...)
	}
}

// Report answers the status contract's report.
func (b *Board) Report(ctx context.Context, lang string) (status.Report, error) {
	b.mu.Lock()
	last, lastAt := b.last, b.lastAt
	runs, runSince := b.runs, b.runSince
	watchdog := make(map[string]trouble, len(b.watchdog))
	for k, v := range b.watchdog {
		watchdog[k] = v
	}
	b.mu.Unlock()

	r := status.Report{App: b.App, Instance: b.Instance, State: status.StateOK}
	t := texts(lang)
	if runs > 0 {
		r.Work = append(r.Work, status.Task{ID: "plan-run", Kind: status.KindOther, Title: t.say("plan.running"), StartedAt: runSince, BlocksRestart: true})
	}
	r.NeedsYou = b.startNeeds(ctx, last, lastAt, t)
	for _, name := range sortedKeys(watchdog) {
		tr := watchdog[name]
		r.NeedsYou = append(r.NeedsYou, status.Need{ID: "watchdog-" + name, Severity: status.SeverityError, Code: tr.code, Text: t.say(tr.code, tr.args...), Since: tr.since})
	}
	return r, nil
}

// startNeeds lists the containers the last run did not bring up. A skipped
// container counts only beside a failure, so a run cancelled at shutdown
// stays quiet. A failed or skipped container that runs by now is left out.
func (b *Board) startNeeds(ctx context.Context, last model.RunResult, at time.Time, t lang) []status.Need {
	failed := false
	for _, n := range last.Nodes {
		failed = failed || n.State == model.StateFailed
	}
	var up map[string]bool
	var needs []status.Need
	for _, n := range last.Nodes {
		sev, code := status.SeverityWarn, ""
		switch n.State {
		case model.StateFailed:
			sev, code = status.SeverityError, "start.failed"
		case model.StateDegraded:
			code = "start.degraded"
		case model.StateSkipped:
			if failed {
				code = "start.skipped"
			}
		}
		if code == "" {
			continue
		}
		if n.State != model.StateDegraded {
			if up == nil {
				up = b.running(ctx)
			}
			if up[n.Name] {
				continue
			}
		}
		needs = append(needs, status.Need{ID: "start-" + n.Name, Severity: sev, Code: code, Text: t.say(code, n.Name, n.Reason), Since: at})
	}
	return needs
}

// running names the containers that run and are not unhealthy, or none when
// Docker cannot tell.
func (b *Board) running(ctx context.Context) map[string]bool {
	up := map[string]bool{}
	if b.Docker == nil {
		return up
	}
	list, err := b.Docker.List(ctx)
	if err != nil {
		return up
	}
	for _, c := range list {
		if c.State == "running" && c.Health != "unhealthy" {
			up[c.Name] = true
		}
	}
	return up
}

// Log answers the status contract's log, oldest entry first.
func (b *Board) Log(_ context.Context, q status.LogQuery) (status.LogPage, error) {
	after, err := strconv.ParseInt(q.After, 10, 64)
	if err != nil {
		after = 0
	}
	b.mu.Lock()
	defer b.mu.Unlock()
	t := texts(q.Lang)
	page := status.LogPage{Next: q.After}
	for _, e := range b.log {
		if e.id <= after {
			continue
		}
		if len(page.Entries) == q.Limit {
			break
		}
		page.Entries = append(page.Entries, status.LogEntry{ID: strconv.FormatInt(e.id, 10), At: e.at, Level: e.level, Code: e.code, Text: t.say(e.code, e.args...)})
		page.Next = strconv.FormatInt(e.id, 10)
	}
	return page, nil
}
