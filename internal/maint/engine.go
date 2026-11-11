package maint

import (
	"context"
	"errors"
	"fmt"
	"log"
	"slices"
	"sort"
	"strconv"
	"strings"
	"sync"
	"time"

	"github.com/junkerderprovinz/towertorch/internal/model"
)

var (
	// ErrBusy means a run is going already.
	ErrBusy = errors.New("a maintenance run is going already")
	// ErrNoPlan means no valid plan is saved.
	ErrNoPlan = errors.New("save a maintenance plan first")
)

// Jobber reaches the apps of the fortress that back up and update.
type Jobber interface {
	Find(action string) (Member, error)
	Backup(ctx context.Context, m Member, container string) (Snapshot, error)
	Update(ctx context.Context, m Member, containers, backedUp []string) ([]Updated, error)
}

// Checker asks whether the server may restart.
type Checker interface {
	Installed() bool
	Check(ctx context.Context) (Verdict, error)
}

// Containers lists the containers as Docker sees them.
type Containers interface {
	List(ctx context.Context) ([]model.Container, error)
}

// Reporter tells the fortress how a run goes. Progress is nil once no run is
// going.
type Reporter interface {
	MaintenanceProgress(p *Progress)
	MaintenanceFinished(r Report)
}

// Notifier sends a run's summary to the notification channels.
type Notifier interface {
	Notify(ctx context.Context, subject, desc, importance string)
}

// Engine runs the maintenance plan kept in Store. Jobs is nil while TowerTorch
// is in no fortress, SetJobs brings in a fortress joined later; Board and
// Notifier may be nil.
type Engine struct {
	Jobs     Jobber
	Check    Checker
	Reboot   func() error
	Docker   Containers
	Board    Reporter
	Notifier Notifier
	Store    *File
	Now      func() time.Time
	// Server is this server's name, for the panel to say.
	Server string

	mu       sync.Mutex
	device   string
	busy     bool
	stop     bool
	progress *Progress
	fired    string // the minute the schedule last started a run
	wg       sync.WaitGroup
}

// Overview is what the panel shows: the plan, the run going on, the last
// report, the next scheduled run and what the fortress offers.
type Overview struct {
	Server     string     `json:"server"`
	Plan       Plan       `json:"plan"`
	Containers []string   `json:"containers"`
	Running    *Progress  `json:"running"`
	Last       *Report    `json:"last"`
	Next       *time.Time `json:"next"`
	Ready      Ready      `json:"ready"`
}

// Ready says which steps have an app to do them. Device is this server's
// name in the fortress.
type Ready struct {
	Fortress bool   `json:"fortress"`
	Device   string `json:"device,omitempty"`
	Backup   Found  `json:"backup"`
	Update   Found  `json:"update"`
	Check    bool   `json:"check"`
}

// Found is the app on this server that does a step, or the servers that have
// one when this one has none.
type Found struct {
	Found     bool     `json:"found"`
	App       string   `json:"app,omitempty"`
	Device    string   `json:"device,omitempty"`
	Online    bool     `json:"online"`
	Elsewhere []string `json:"elsewhere,omitempty"`
}

func (e *Engine) now() time.Time {
	if e.Now != nil {
		return e.Now()
	}
	return time.Now()
}

// SavePlan keeps p as the plan once it is valid.
func (e *Engine) SavePlan(p Plan) error {
	if err := p.Validate(); err != nil {
		return err
	}
	return e.Store.SavePlan(p)
}

// State tells the panel how things stand.
func (e *Engine) State(ctx context.Context) Overview {
	var o Overview
	saved, err := e.Store.Load()
	if err != nil {
		log.Printf("towertorch: maintenance plan unreadable: %v", err)
	}
	o.Server, o.Plan, o.Last = e.Server, saved.Plan, saved.Last
	if e.Docker != nil {
		if list, err := e.Docker.List(ctx); err == nil {
			for _, c := range list {
				o.Containers = append(o.Containers, c.Name)
			}
			sort.Strings(o.Containers)
		}
	}
	if next, ok := saved.Plan.Schedule.Next(e.now()); ok {
		o.Next = &next
	}
	e.mu.Lock()
	if e.progress != nil {
		p := *e.progress
		o.Running = &p
	}
	e.mu.Unlock()
	if jobs, device := e.jobs(); jobs != nil {
		o.Ready.Fortress, o.Ready.Device = true, device
		o.Ready.Backup = found(jobs, BackupAction)
		o.Ready.Update = found(jobs, UpdateAction)
	}
	o.Ready.Check = e.Check != nil && e.Check.Installed()
	return o
}

// NextRun is the start of the next scheduled run, false when none is
// scheduled.
func (e *Engine) NextRun() (time.Time, bool) {
	saved, err := e.Store.Load()
	if err != nil {
		return time.Time{}, false
	}
	return saved.Plan.Schedule.Next(e.now())
}

// SetJobs takes the fortress TowerTorch joined as device for the runs to
// come.
func (e *Engine) SetJobs(j Jobber, device string) {
	e.mu.Lock()
	defer e.mu.Unlock()
	e.Jobs, e.device = j, device
}

func (e *Engine) jobs() (Jobber, string) {
	e.mu.Lock()
	defer e.mu.Unlock()
	return e.Jobs, e.device
}

func found(jobs Jobber, action string) Found {
	m, err := jobs.Find(action)
	var no *NoAppError
	if errors.As(err, &no) {
		return Found{Elsewhere: no.Elsewhere}
	}
	return Found{Found: true, App: m.App, Device: m.Device, Online: err == nil}
}

// Start runs the plan in the background. The run outlives ctx's
// cancellation, so a request can start it.
func (e *Engine) Start(ctx context.Context, trigger Trigger) error {
	if err := e.planned(); err != nil {
		return err
	}
	if err := e.begin(); err != nil {
		return err
	}
	e.wg.Add(1)
	go func() {
		defer e.wg.Done()
		defer e.end()
		e.run(context.WithoutCancel(ctx), trigger)
	}()
	return nil
}

// Run runs the plan and returns its report.
func (e *Engine) Run(ctx context.Context, trigger Trigger) (Report, error) {
	if err := e.planned(); err != nil {
		return Report{}, err
	}
	if err := e.begin(); err != nil {
		return Report{}, err
	}
	defer e.end()
	return e.run(ctx, trigger), nil
}

func (e *Engine) planned() error {
	saved, err := e.Store.Load()
	if err != nil {
		return err
	}
	if err := saved.Plan.Validate(); err != nil {
		return fmt.Errorf("%w: %w", ErrNoPlan, err)
	}
	return nil
}

// Wait returns once the run Start began is over.
func (e *Engine) Wait() { e.wg.Wait() }

// Stop ends the run after the container or step at work, and reports whether
// a run was going.
func (e *Engine) Stop() bool {
	e.mu.Lock()
	defer e.mu.Unlock()
	if e.busy {
		e.stop = true
	}
	return e.busy
}

func (e *Engine) begin() error {
	e.mu.Lock()
	defer e.mu.Unlock()
	if e.busy {
		return ErrBusy
	}
	e.busy, e.stop = true, false
	return nil
}

func (e *Engine) end() {
	e.mu.Lock()
	e.busy, e.progress = false, nil
	e.mu.Unlock()
	if e.Board != nil {
		e.Board.MaintenanceProgress(nil)
	}
}

func (e *Engine) stopping() bool {
	e.mu.Lock()
	defer e.mu.Unlock()
	return e.stop
}

func (e *Engine) at(p Progress) {
	e.mu.Lock()
	e.progress = &p
	e.mu.Unlock()
	if e.Board != nil {
		e.Board.MaintenanceProgress(&p)
	}
}

// run is one run, with the steps in their fixed order. A failed step ends the
// run; a check that does not say go holds the restart.
func (e *Engine) run(ctx context.Context, trigger Trigger) Report {
	saved, err := e.Store.Load()
	if err != nil {
		log.Printf("towertorch: maintenance plan unreadable: %v", err)
	}
	plan := saved.Plan
	start := e.now()
	rep := Report{ID: strconv.FormatInt(start.UnixNano(), 10), Trigger: trigger, Started: start, Outcome: StateRunning}
	chosen := map[Step]bool{StepBackup: plan.Steps.Backup, StepUpdate: plan.Steps.Update, StepCheck: plan.Steps.Check, StepRestart: plan.Steps.Restart}
	for _, s := range []Step{StepBackup, StepUpdate, StepCheck, StepRestart} {
		sr := StepReport{Step: s, State: StateWaiting}
		if !chosen[s] {
			sr.State, sr.Code = StateOff, "step.off"
		}
		rep.Steps = append(rep.Steps, sr)
	}
	e.save(rep)

	jobs, _ := e.jobs()
	r := runner{e: e, jobs: jobs, ctx: ctx, plan: plan, started: start}
	failed, stopped, reboot := false, false, false
	for i := range rep.Steps {
		s := &rep.Steps[i]
		switch {
		case s.State == StateOff:
			continue
		case !stopped && e.stopping():
			stopped = true
		}
		if stopped || failed {
			s.State, s.Code = StateNotRun, "run.after_failure"
			if stopped {
				s.Code = "run.after_stop"
			}
			continue
		}
		s.State, s.Started = StateRunning, e.now()
		e.save(rep)
		switch s.Step {
		case StepBackup:
			r.backup(s)
		case StepUpdate:
			r.update(s)
		case StepCheck:
			r.check(s)
		case StepRestart:
			if r.hold != "" {
				s.State, s.Code = StateHeld, r.hold
			} else {
				e.at(Progress{Started: start, Step: StepRestart})
				s.State, s.Code = StateDone, "restart.requested"
				reboot = true
			}
		}
		s.Finished = e.now()
		// A check that fails holds the restart instead of ending the run.
		failed = s.State == StateFailed && s.Step != StepCheck
		stopped = s.State == StateStopped
		e.save(rep)
	}
	e.finish(ctx, &rep)
	if reboot {
		err := errors.New("TowerTorch has no way to restart the server")
		if e.Reboot != nil {
			err = e.Reboot()
		}
		if err != nil {
			s := &rep.Steps[len(rep.Steps)-1]
			s.State, s.Code, s.Args = StateFailed, "restart.failed", []string{err.Error()}
			e.finish(ctx, &rep)
		}
	}
	return rep
}

func (e *Engine) finish(ctx context.Context, rep *Report) {
	rep.Outcome, rep.Finished = outcome(rep.Steps), e.now()
	e.save(*rep)
	if e.Board != nil {
		e.Board.MaintenanceFinished(*rep)
	}
	if e.Notifier != nil {
		subject, desc, importance := Summary(*rep, "en")
		e.Notifier.Notify(ctx, subject, desc, importance)
	}
}

func (e *Engine) save(r Report) {
	if err := e.Store.SaveReport(r); err != nil {
		log.Printf("towertorch: maintenance report not kept: %v", err)
	}
}

// runner carries what the steps of one run hand on to each other.
type runner struct {
	e        *Engine
	jobs     Jobber
	ctx      context.Context
	plan     Plan
	started  time.Time
	listed   bool
	have     []string // the chosen containers that exist, in the plan's order
	gone     []string
	listErr  error
	backedUp []string
	hold     string // why the restart waits
}

// containers resolves the plan's containers against Docker once per run.
func (r *runner) containers() ([]string, []string, error) {
	if r.listed {
		return r.have, r.gone, r.listErr
	}
	r.listed = true
	list, err := r.e.Docker.List(r.ctx)
	if err != nil {
		r.listErr = err
		return nil, nil, err
	}
	exists := map[string]bool{}
	for _, c := range list {
		exists[c.Name] = true
	}
	if len(r.plan.Containers) == 0 {
		for name := range exists {
			r.have = append(r.have, name)
		}
		sort.Strings(r.have)
		return r.have, nil, nil
	}
	for _, name := range r.plan.Containers {
		if exists[name] {
			r.have = append(r.have, name)
		} else {
			r.gone = append(r.gone, name)
		}
	}
	return r.have, r.gone, nil
}

// app finds the member for action, or fills s with why there is none.
func (r *runner) app(s *StepReport, action string) (Member, bool) {
	prefix := string(s.Step) + "."
	if r.jobs == nil {
		s.State, s.Code = StateSkipped, prefix+"no_fortress"
		return Member{}, false
	}
	m, err := r.jobs.Find(action)
	var no *NoAppError
	switch {
	case errors.As(err, &no) && len(no.Elsewhere) > 0:
		s.State, s.Code, s.Args = StateSkipped, prefix+"elsewhere", []string{strings.Join(no.Elsewhere, ", ")}
	case errors.As(err, &no):
		s.State, s.Code = StateSkipped, prefix+"no_app"
	case err != nil:
		s.State, s.Code, s.Args = StateFailed, prefix+"unreachable", []string{err.Error()}
	default:
		return m, true
	}
	return Member{}, false
}

func (r *runner) backup(s *StepReport) {
	m, ok := r.app(s, BackupAction)
	if !ok {
		return
	}
	have, gone, err := r.containers()
	if err != nil {
		s.State, s.Code, s.Args = StateFailed, "backup.docker", []string{err.Error()}
		return
	}
	at := map[string]int{}
	for _, name := range r.ordered(have) {
		at[name] = len(s.Items)
		item := Item{Name: name, State: StateWaiting}
		if !slices.Contains(have, name) {
			item.State, item.Code = StateSkipped, "container.gone"
		}
		s.Items = append(s.Items, item)
	}
	var failed []string
	stopped := false
	for i, name := range have {
		it := &s.Items[at[name]]
		if stopped || r.e.stopping() {
			stopped = true
			it.State = StateNotRun
			continue
		}
		r.e.at(Progress{Started: r.started, Step: StepBackup, Index: i + 1, Total: len(have), Item: name, BlocksRestart: true})
		snap, err := r.jobs.Backup(r.ctx, m, name)
		if err != nil {
			it.State, it.Code, it.Detail = StateFailed, "backup.failed", err.Error()
			failed = append(failed, name)
			continue
		}
		it.State, it.Code, it.Detail, it.Link = StateOK, "backup.ok", snap.ID, snap.Link
		r.backedUp = append(r.backedUp, name)
	}
	n := strconv.Itoa(len(r.backedUp))
	switch {
	case stopped:
		s.State, s.Code = StateStopped, "run.stopped"
	case len(failed) > 0:
		s.State, s.Code, s.Args = StateFailed, "backup.failed", []string{strings.Join(failed, ", ")}
	case len(gone) > 0:
		s.State, s.Code, s.Args = StateWarn, "backup.gone", []string{n, strings.Join(gone, ", ")}
	default:
		s.State, s.Code, s.Args = StateDone, "backup.done", []string{n}
	}
}

// ordered lists the containers the way the plan names them.
func (r *runner) ordered(have []string) []string {
	if len(r.plan.Containers) == 0 {
		return have
	}
	return append([]string(nil), r.plan.Containers...)
}

func (r *runner) update(s *StepReport) {
	m, ok := r.app(s, UpdateAction)
	if !ok {
		return
	}
	var list []string
	if len(r.plan.Containers) > 0 {
		have, _, err := r.containers()
		if err != nil {
			s.State, s.Code, s.Args = StateFailed, "update.docker", []string{err.Error()}
			return
		}
		if len(have) == 0 {
			s.State, s.Code = StateSkipped, "update.nothing"
			return
		}
		list = have
	}
	r.e.at(Progress{Started: r.started, Step: StepUpdate, BlocksRestart: true})
	results, err := r.jobs.Update(r.ctx, m, list, r.backedUp)
	if err != nil {
		s.State, s.Code, s.Args = StateFailed, "update.failed", []string{err.Error()}
		return
	}
	updated, current := 0, 0
	var notes, failed []string
	for _, u := range results {
		it := Item{Name: u.Name, Detail: u.Error}
		switch u.Result {
		case "updated":
			it.State, it.Code = StateOK, "update.updated"
			updated++
		case "current":
			it.State, it.Code = StateOK, "update.current"
			current++
		case "failed":
			it.State, it.Code = StateFailed, "update.failed"
			failed = append(failed, u.Name)
		case "rolledBack":
			it.State, it.Code = StateWarn, "update.rolled_back"
			notes = append(notes, u.Name)
		default:
			it.State, it.Code = StateWarn, "update.held"
			notes = append(notes, u.Name)
		}
		s.Items = append(s.Items, it)
	}
	switch {
	case len(failed) > 0:
		s.State, s.Code, s.Args = StateFailed, "update.failed_some", []string{strings.Join(failed, ", ")}
	case len(notes) > 0:
		s.State, s.Code, s.Args = StateWarn, "update.warn", []string{strconv.Itoa(updated), strconv.Itoa(len(notes))}
	default:
		s.State, s.Code, s.Args = StateDone, "update.done", []string{strconv.Itoa(updated), strconv.Itoa(current)}
	}
}

func (r *runner) check(s *StepReport) {
	r.hold = "restart.held_unchecked"
	if r.e.Check == nil {
		s.State, s.Code = StateSkipped, "check.missing"
		return
	}
	r.e.at(Progress{Started: r.started, Step: StepCheck})
	v, err := r.e.Check.Check(r.ctx)
	switch {
	case errors.Is(err, ErrNotInstalled):
		s.State, s.Code = StateSkipped, "check.missing"
		return
	case err != nil:
		s.State, s.Code, s.Args = StateFailed, "check.failed", []string{err.Error()}
		return
	}
	s.Verdict = v.Verdict
	for _, f := range v.Findings {
		it := Item{Name: f.ID, State: StateOK, Code: f.Key, Detail: f.Message, Link: f.Link}
		switch f.Status {
		case "warn":
			it.State = StateWarn
		case "fail":
			it.State = StateFailed
		}
		s.Items = append(s.Items, it)
	}
	switch v.Verdict {
	case VerdictGo:
		s.State, s.Code, r.hold = StateDone, "check.go", ""
	case VerdictCaution:
		s.State, s.Code, r.hold = StateWarn, "check.caution", ""
	case VerdictNoGo:
		s.State, s.Code, r.hold = StateFailed, "check.nogo", "restart.held_nogo"
	default:
		s.State, s.Code, s.Args = StateFailed, "check.failed", []string{v.Verdict}
	}
}

// Resume brings the last report up to date when the engine starts: a
// requested restart has happened, and a run the engine died in is stopped.
func (e *Engine) Resume() {
	saved, err := e.Store.Load()
	if err != nil || saved.Last == nil {
		return
	}
	rep := *saved.Last
	now := e.now()
	changed, cut := false, false
	for i := range rep.Steps {
		s := &rep.Steps[i]
		switch {
		case s.Step == StepRestart && s.Code == "restart.requested":
			s.Code, s.Args = "restart.back", []string{now.Format("15:04")}
			changed = true
		case s.State == StateRunning:
			s.State, s.Code, s.Args, s.Finished = StateStopped, "run.interrupted", nil, now
			changed, cut = true, true
		case s.State == StateWaiting:
			s.State, s.Code = StateNotRun, "run.after_stop"
			changed = true
		}
		for j := range s.Items {
			if it := &s.Items[j]; it.State == StateWaiting {
				it.State = StateNotRun
			}
		}
	}
	if !changed {
		return
	}
	if cut {
		rep.Outcome, rep.Finished = outcome(rep.Steps), now
	}
	e.save(rep)
	if e.Board != nil {
		e.Board.MaintenanceFinished(rep)
	}
}

// Tick starts a run when the schedule says so, once in its minute.
func (e *Engine) Tick(ctx context.Context) {
	saved, err := e.Store.Load()
	now := e.now()
	if err != nil || !saved.Plan.Schedule.Due(now) {
		return
	}
	minute := now.Format("2006-01-02 15:04")
	e.mu.Lock()
	again := e.fired == minute
	e.fired = minute
	e.mu.Unlock()
	// The engine forgets the minute when it restarts, the report does not.
	if again || (saved.Last != nil && saved.Last.Started.Format("2006-01-02 15:04") == minute) {
		return
	}
	if err := e.Start(ctx, TriggerSchedule); err != nil {
		log.Printf("towertorch: the scheduled maintenance did not start: %v", err)
	}
}

// Serve brings the last report up to date and then keeps the schedule until
// ctx ends.
func (e *Engine) Serve(ctx context.Context) {
	e.Resume()
	t := time.NewTicker(20 * time.Second)
	defer t.Stop()
	for {
		select {
		case <-ctx.Done():
			return
		case <-t.C:
			e.Tick(ctx)
		}
	}
}
