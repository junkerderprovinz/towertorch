package maint

import (
	"context"
	"errors"
	"fmt"
	"path/filepath"
	"slices"
	"strings"
	"sync"
	"testing"
	"time"

	"github.com/junkerderprovinz/towertorch/internal/model"
)

type fakeJobs struct {
	mu        sync.Mutex
	noBackup  error // Find(BackupAction) fails with it
	noUpdate  error
	backupErr map[string]error
	backedUp  []string
	updated   [][]string // containers, backedUp of each update
	results   []Updated
	updateErr error
	onBackup  func(container string)
}

func (f *fakeJobs) Find(action string) (Member, error) {
	if action == BackupAction {
		if f.noBackup != nil {
			return Member{}, f.noBackup
		}
		return Member{ID: "bv", App: "bombvault", Device: "Tower", Online: true}, nil
	}
	if f.noUpdate != nil {
		return Member{}, f.noUpdate
	}
	return Member{ID: "sl", App: "shiplog", Device: "Tower", Online: true}, nil
}

func (f *fakeJobs) Backup(_ context.Context, _ Member, c string) (Snapshot, error) {
	if f.onBackup != nil {
		f.onBackup(c)
	}
	f.mu.Lock()
	defer f.mu.Unlock()
	f.backedUp = append(f.backedUp, c)
	if err := f.backupErr[c]; err != nil {
		return Snapshot{}, err
	}
	return Snapshot{Run: "r-" + c, ID: "snap-" + c, Link: "https://bv/" + c}, nil
}

func (f *fakeJobs) Update(_ context.Context, _ Member, containers, backedUp []string) ([]Updated, error) {
	f.mu.Lock()
	defer f.mu.Unlock()
	f.updated = append(f.updated, containers, backedUp)
	return f.results, f.updateErr
}

type fakeCheck struct {
	verdict Verdict
	err     error
	ran     bool
}

func (f *fakeCheck) Installed() bool { return !errors.Is(f.err, ErrNotInstalled) }

func (f *fakeCheck) Check(context.Context) (Verdict, error) {
	f.ran = true
	return f.verdict, f.err
}

type fakeDocker struct{ names []string }

func (f fakeDocker) List(context.Context) ([]model.Container, error) {
	var out []model.Container
	for _, n := range f.names {
		out = append(out, model.Container{Name: n})
	}
	return out, nil
}

type fakeBoard struct {
	mu       sync.Mutex
	progress []Progress
	finished []Report
}

func (b *fakeBoard) MaintenanceProgress(p *Progress) {
	b.mu.Lock()
	defer b.mu.Unlock()
	if p != nil {
		b.progress = append(b.progress, *p)
	}
}

func (b *fakeBoard) MaintenanceFinished(r Report) {
	b.mu.Lock()
	defer b.mu.Unlock()
	b.finished = append(b.finished, r)
}

type sent struct{ subject, desc, importance string }

type fakeNotifier struct{ sent []sent }

func (n *fakeNotifier) Notify(_ context.Context, subject, desc, importance string) {
	n.sent = append(n.sent, sent{subject, desc, importance})
}

type rig struct {
	e       *Engine
	jobs    *fakeJobs
	check   *fakeCheck
	board   *fakeBoard
	notify  *fakeNotifier
	reboots int
	now     time.Time
}

var all = Steps{Backup: true, Update: true, Check: true, Restart: true}

func newRig(t *testing.T, plan Plan) *rig {
	t.Helper()
	r := &rig{
		jobs:   &fakeJobs{},
		check:  &fakeCheck{verdict: Verdict{Verdict: VerdictGo}},
		board:  &fakeBoard{},
		notify: &fakeNotifier{},
		now:    time.Date(2026, 11, 10, 3, 30, 0, 0, time.UTC),
	}
	r.e = &Engine{
		Jobs:     r.jobs,
		Check:    r.check,
		Reboot:   func() error { r.reboots++; return nil },
		Docker:   fakeDocker{names: []string{"nextcloud", "mariadb", "immich"}},
		Board:    r.board,
		Notifier: r.notify,
		Store:    &File{Path: filepath.Join(t.TempDir(), "maintenance.json")},
		Now:      func() time.Time { return r.now },
	}
	if err := r.e.SavePlan(plan); err != nil {
		t.Fatal(err)
	}
	return r
}

func (r *rig) run(t *testing.T) Report {
	t.Helper()
	rep, err := r.e.Run(context.Background(), TriggerManual)
	if err != nil {
		t.Fatal(err)
	}
	return rep
}

func step(r Report, s Step) StepReport {
	for _, x := range r.Steps {
		if x.Step == s {
			return x
		}
	}
	return StepReport{}
}

func TestAFullRunBacksUpUpdatesChecksAndRestarts(t *testing.T) {
	r := newRig(t, Plan{Steps: all})
	r.jobs.results = []Updated{{Name: "nextcloud", Result: "updated"}, {Name: "mariadb", Result: "current"}}
	rep := r.run(t)

	if rep.Outcome != StateDone {
		t.Errorf("outcome = %s, steps %+v", rep.Outcome, rep.Steps)
	}
	if want := []string{"immich", "mariadb", "nextcloud"}; !slices.Equal(r.jobs.backedUp, want) {
		t.Errorf("backed up %v, want %v", r.jobs.backedUp, want)
	}
	if b := step(rep, StepBackup); b.State != StateDone || len(b.Items) != 3 || b.Items[0].Link != "https://bv/immich" {
		t.Errorf("backup = %+v", b)
	}
	if len(r.jobs.updated) != 2 || len(r.jobs.updated[0]) != 0 || len(r.jobs.updated[1]) != 3 {
		t.Errorf("an update of everything names every fresh backup: %v", r.jobs.updated)
	}
	if u := step(rep, StepUpdate); u.State != StateDone || len(u.Items) != 2 {
		t.Errorf("update = %+v", u)
	}
	if c := step(rep, StepCheck); c.State != StateDone || c.Verdict != VerdictGo {
		t.Errorf("check = %+v", c)
	}
	if s := step(rep, StepRestart); s.State != StateDone || s.Code != "restart.requested" || r.reboots != 1 {
		t.Errorf("restart = %+v, reboots %d", s, r.reboots)
	}
	if len(r.notify.sent) != 1 || r.notify.sent[0].importance != "normal" {
		t.Errorf("notifications = %+v", r.notify.sent)
	}
}

func TestTheRunAsksTheFortressNotToRestartOnlyWhileItBacksUpAndUpdates(t *testing.T) {
	r := newRig(t, Plan{Steps: all})
	r.run(t)
	blocks := map[Step]bool{}
	for _, p := range r.board.progress {
		blocks[p.Step] = p.BlocksRestart
	}
	if !blocks[StepBackup] || !blocks[StepUpdate] {
		t.Errorf("backup and update must block a restart: %+v", r.board.progress)
	}
	// FireSquire asks the fortress, and TowerTorch would block its own restart.
	if blocks[StepCheck] || blocks[StepRestart] {
		t.Errorf("check and restart must not block: %+v", r.board.progress)
	}
	if len(r.board.finished) != 1 {
		t.Errorf("finished = %d", len(r.board.finished))
	}
}

func TestProgressCountsTheContainers(t *testing.T) {
	r := newRig(t, Plan{Steps: Steps{Backup: true}})
	r.run(t)
	var seen []string
	for _, p := range r.board.progress {
		if p.Step == StepBackup && p.Item != "" {
			seen = append(seen, fmt.Sprintf("%s/%d/%d", p.Item, p.Index, p.Total))
		}
	}
	if want := []string{"immich/1/3", "mariadb/2/3", "nextcloud/3/3"}; !slices.Equal(seen, want) {
		t.Errorf("progress %v, want %v", seen, want)
	}
}

func TestStepsThatAreNotChosenAreOff(t *testing.T) {
	r := newRig(t, Plan{Steps: Steps{Check: true}})
	rep := r.run(t)
	for _, s := range []Step{StepBackup, StepUpdate, StepRestart} {
		if st := step(rep, s); st.State != StateOff {
			t.Errorf("%s = %+v", s, st)
		}
	}
	if len(r.jobs.backedUp) != 0 || len(r.jobs.updated) != 0 || r.reboots != 0 {
		t.Error("a step that is off ran")
	}
}

func TestWithoutABackupAppTheBackupIsSkippedAndSaysSo(t *testing.T) {
	r := newRig(t, Plan{Steps: all})
	r.jobs.noBackup = &NoAppError{}
	rep := r.run(t)
	if b := step(rep, StepBackup); b.State != StateSkipped || b.Code != "backup.no_app" {
		t.Errorf("backup = %+v", b)
	}
	if len(r.jobs.updated) != 2 || len(r.jobs.updated[1]) != 0 {
		t.Errorf("the update goes on without a backup to name: %v", r.jobs.updated)
	}
	if rep.Outcome != StateWarn || r.reboots != 1 {
		t.Errorf("outcome = %s, reboots %d", rep.Outcome, r.reboots)
	}
}

func TestABackupAppOnAnotherServerIsNamed(t *testing.T) {
	r := newRig(t, Plan{Steps: Steps{Backup: true}})
	r.jobs.noBackup = &NoAppError{Elsewhere: []string{"Basement"}}
	rep := r.run(t)
	if b := step(rep, StepBackup); b.Code != "backup.elsewhere" || len(b.Args) != 1 || b.Args[0] != "Basement" {
		t.Errorf("backup = %+v", b)
	}
}

func TestOutsideAFortressBackupAndUpdateAreSkipped(t *testing.T) {
	r := newRig(t, Plan{Steps: all})
	r.e.Jobs = nil
	rep := r.run(t)
	if b := step(rep, StepBackup); b.State != StateSkipped || b.Code != "backup.no_fortress" {
		t.Errorf("backup = %+v", b)
	}
	if u := step(rep, StepUpdate); u.State != StateSkipped || u.Code != "update.no_fortress" {
		t.Errorf("update = %+v", u)
	}
	if r.reboots != 1 {
		t.Error("the check passed, so the restart goes on")
	}
}

func TestWithoutShipLogTheUpdateIsSkipped(t *testing.T) {
	r := newRig(t, Plan{Steps: Steps{Update: true}})
	r.jobs.noUpdate = &NoAppError{}
	rep := r.run(t)
	if u := step(rep, StepUpdate); u.State != StateSkipped || u.Code != "update.no_app" {
		t.Errorf("update = %+v", u)
	}
}

func TestABackupAppThatIsOfflineFailsTheRun(t *testing.T) {
	r := newRig(t, Plan{Steps: all})
	r.jobs.noBackup = errors.New("bombvault on Tower is not reachable")
	rep := r.run(t)
	if b := step(rep, StepBackup); b.State != StateFailed || b.Code != "backup.unreachable" {
		t.Errorf("backup = %+v", b)
	}
	if len(r.jobs.updated) != 0 || r.reboots != 0 {
		t.Error("the run went on without a backup")
	}
}

func TestAFailedBackupBacksUpTheRestAndThenStops(t *testing.T) {
	r := newRig(t, Plan{Steps: all})
	r.jobs.backupErr = map[string]error{"immich": errors.New("the target is full")}
	rep := r.run(t)
	if len(r.jobs.backedUp) != 3 {
		t.Errorf("backed up %v", r.jobs.backedUp)
	}
	b := step(rep, StepBackup)
	if b.State != StateFailed || b.Code != "backup.failed" || b.Args[0] != "immich" {
		t.Errorf("backup = %+v", b)
	}
	if b.Items[0].State != StateFailed || !strings.Contains(b.Items[0].Detail, "full") {
		t.Errorf("item = %+v", b.Items[0])
	}
	for _, s := range []Step{StepUpdate, StepCheck, StepRestart} {
		if st := step(rep, s); st.State != StateNotRun || st.Code != "run.after_failure" {
			t.Errorf("%s = %+v", s, st)
		}
	}
	if rep.Outcome != StateFailed || r.reboots != 0 || r.check.ran {
		t.Errorf("outcome %s, reboots %d", rep.Outcome, r.reboots)
	}
	if r.notify.sent[0].importance != "alert" {
		t.Errorf("notification = %+v", r.notify.sent)
	}
}

func TestAChosenContainerThatIsGoneIsSkipped(t *testing.T) {
	r := newRig(t, Plan{Steps: Steps{Backup: true, Update: true}, Containers: []string{"nextcloud", "ghost"}})
	rep := r.run(t)
	b := step(rep, StepBackup)
	if len(b.Items) != 2 || b.Items[1].Name != "ghost" || b.Items[1].State != StateSkipped || b.Items[1].Code != "container.gone" {
		t.Errorf("backup = %+v", b)
	}
	if b.State != StateWarn {
		t.Errorf("state = %s", b.State)
	}
	if !slices.Equal(r.jobs.backedUp, []string{"nextcloud"}) || !slices.Equal(r.jobs.updated[0], []string{"nextcloud"}) {
		t.Errorf("backed up %v, updated %v", r.jobs.backedUp, r.jobs.updated)
	}
}

func TestARolledBackUpdateIsANoteAndAFailedOneStopsTheRun(t *testing.T) {
	r := newRig(t, Plan{Steps: all})
	r.jobs.results = []Updated{{Name: "nextcloud", Result: "updated"}, {Name: "immich", Result: "rolledBack", Error: "unhealthy"}}
	rep := r.run(t)
	if u := step(rep, StepUpdate); u.State != StateWarn || u.Items[1].Code != "update.rolled_back" {
		t.Errorf("update = %+v", u)
	}
	if r.reboots != 1 {
		t.Error("a rolled back update stopped the restart")
	}

	r = newRig(t, Plan{Steps: all})
	r.jobs.results = []Updated{{Name: "immich", Result: "failed", Error: "pull failed"}}
	rep = r.run(t)
	if u := step(rep, StepUpdate); u.State != StateFailed || u.Code != "update.failed_some" {
		t.Errorf("update = %+v", u)
	}
	if r.reboots != 0 {
		t.Error("restarted after a failed update")
	}
}

func TestANoGoHoldsTheRestart(t *testing.T) {
	r := newRig(t, Plan{Steps: all})
	r.check.verdict = Verdict{Verdict: VerdictNoGo, Findings: []Finding{{Status: "fail", Key: "fortress_busy_open", Message: "KnightLoader on Tower is still busy with Unpacking."}}}
	rep := r.run(t)
	c := step(rep, StepCheck)
	if c.State != StateFailed || c.Verdict != VerdictNoGo || len(c.Items) != 1 || c.Items[0].State != StateFailed {
		t.Errorf("check = %+v", c)
	}
	if s := step(rep, StepRestart); s.State != StateHeld || s.Code != "restart.held_nogo" {
		t.Errorf("restart = %+v", s)
	}
	if rep.Outcome != StateHeld || r.reboots != 0 {
		t.Errorf("outcome %s, reboots %d", rep.Outcome, r.reboots)
	}
}

func TestACautionStillRestarts(t *testing.T) {
	r := newRig(t, Plan{Steps: Steps{Check: true, Restart: true}})
	r.check.verdict = Verdict{Verdict: VerdictCaution, Findings: []Finding{{Status: "warn", Key: "smart_attr", Message: "SMART attribute warnings"}}}
	rep := r.run(t)
	if c := step(rep, StepCheck); c.State != StateWarn || c.Items[0].State != StateWarn {
		t.Errorf("check = %+v", c)
	}
	if r.reboots != 1 || rep.Outcome != StateWarn {
		t.Errorf("outcome %s, reboots %d", rep.Outcome, r.reboots)
	}
}

func TestWithoutFireSquireTheRestartWaits(t *testing.T) {
	r := newRig(t, Plan{Steps: Steps{Check: true, Restart: true}})
	r.check.err = ErrNotInstalled
	rep := r.run(t)
	if c := step(rep, StepCheck); c.State != StateSkipped || c.Code != "check.missing" {
		t.Errorf("check = %+v", c)
	}
	if s := step(rep, StepRestart); s.State != StateHeld || s.Code != "restart.held_unchecked" {
		t.Errorf("restart = %+v", s)
	}
	if r.reboots != 0 {
		t.Error("restarted without a check")
	}
}

func TestACheckThatBreaksHoldsTheRestart(t *testing.T) {
	r := newRig(t, Plan{Steps: Steps{Check: true, Restart: true}})
	r.check.err = errors.New("FireSquire could not check: exit status 127")
	rep := r.run(t)
	if c := step(rep, StepCheck); c.State != StateFailed || c.Code != "check.failed" {
		t.Errorf("check = %+v", c)
	}
	if s := step(rep, StepRestart); s.State != StateHeld || r.reboots != 0 {
		t.Errorf("restart = %+v, reboots %d", s, r.reboots)
	}
}

func TestARestartWithoutACheckIsWhatWasAskedFor(t *testing.T) {
	r := newRig(t, Plan{Steps: Steps{Restart: true}})
	r.run(t)
	if r.reboots != 1 || r.check.ran {
		t.Errorf("reboots %d, checked %v", r.reboots, r.check.ran)
	}
}

func TestARestartThatFailsSaysWhy(t *testing.T) {
	r := newRig(t, Plan{Steps: Steps{Restart: true}})
	r.e.Reboot = func() error { return errors.New("reboot: permission denied") }
	rep := r.run(t)
	if s := step(rep, StepRestart); s.State != StateFailed || s.Code != "restart.failed" || !strings.Contains(s.Args[0], "permission denied") {
		t.Errorf("restart = %+v", s)
	}
	if rep.Outcome != StateFailed {
		t.Errorf("outcome = %s", rep.Outcome)
	}
}

func TestTheReportIsKeptBeforeTheRestart(t *testing.T) {
	r := newRig(t, Plan{Steps: Steps{Backup: true, Restart: true}})
	var kept *Report
	r.e.Reboot = func() error {
		s, err := r.e.Store.Load()
		if err != nil {
			t.Fatal(err)
		}
		kept = s.Last
		return nil
	}
	r.run(t)
	if kept == nil || step(*kept, StepBackup).State != StateDone || step(*kept, StepRestart).Code != "restart.requested" {
		t.Errorf("kept = %+v", kept)
	}
}

func TestAfterTheRestartTheReportSaysWhenTheServerWasBack(t *testing.T) {
	r := newRig(t, Plan{Steps: Steps{Restart: true}})
	r.run(t)
	r.now = r.now.Add(4 * time.Minute)
	again := &Engine{Store: r.e.Store, Board: r.board, Now: func() time.Time { return r.now }}
	again.Resume()
	last := again.State(context.Background()).Last
	if s := step(*last, StepRestart); s.Code != "restart.back" || s.Args[0] != "03:34" {
		t.Errorf("restart = %+v", s)
	}
}

func TestARunCutShortByAnEngineStopIsReportedAsStopped(t *testing.T) {
	r := newRig(t, Plan{Steps: Steps{Backup: true, Update: true}})
	r.jobs.onBackup = func(string) { panic("engine stopped") }
	func() {
		defer func() { _ = recover() }()
		r.run(t)
	}()
	again := &Engine{Store: r.e.Store, Now: func() time.Time { return r.now }}
	again.Resume()
	last := again.State(context.Background()).Last
	if last.Outcome != StateStopped {
		t.Fatalf("outcome = %s", last.Outcome)
	}
	if b := step(*last, StepBackup); b.State != StateStopped || b.Code != "run.interrupted" {
		t.Errorf("backup = %+v", b)
	}
	if u := step(*last, StepUpdate); u.State != StateNotRun {
		t.Errorf("update = %+v", u)
	}
}

func TestStoppingFinishesTheCurrentContainerAndRunsNothingAfter(t *testing.T) {
	r := newRig(t, Plan{Steps: all})
	r.jobs.onBackup = func(c string) {
		if c == "immich" {
			if !r.e.Stop() {
				t.Error("nothing to stop")
			}
		}
	}
	rep := r.run(t)
	if !slices.Equal(r.jobs.backedUp, []string{"immich"}) {
		t.Errorf("backed up %v", r.jobs.backedUp)
	}
	b := step(rep, StepBackup)
	if b.State != StateStopped || b.Code != "run.stopped" || len(b.Items) != 3 || b.Items[1].State != StateNotRun {
		t.Errorf("backup = %+v", b)
	}
	if u := step(rep, StepUpdate); u.State != StateNotRun || u.Code != "run.after_stop" {
		t.Errorf("update = %+v", u)
	}
	if rep.Outcome != StateStopped || r.reboots != 0 {
		t.Errorf("outcome %s, reboots %d", rep.Outcome, r.reboots)
	}
}

func TestOneRunAtATime(t *testing.T) {
	r := newRig(t, Plan{Steps: Steps{Backup: true}})
	release := make(chan struct{})
	started := make(chan struct{})
	r.jobs.onBackup = func(c string) {
		if c == "immich" {
			close(started)
			<-release
		}
	}
	if err := r.e.Start(context.Background(), TriggerManual); err != nil {
		t.Fatal(err)
	}
	<-started
	if err := r.e.Start(context.Background(), TriggerManual); !errors.Is(err, ErrBusy) {
		t.Errorf("second start: %v", err)
	}
	if st := r.e.State(context.Background()); st.Running == nil || st.Running.Step != StepBackup {
		t.Errorf("running = %+v", st.Running)
	}
	close(release)
	r.e.Wait()
	if st := r.e.State(context.Background()); st.Running != nil || st.Last == nil || st.Last.Outcome != StateDone {
		t.Errorf("state after the run = %+v", st)
	}
}

func TestAnInvalidPlanIsNotSaved(t *testing.T) {
	r := newRig(t, Plan{Steps: all})
	if err := r.e.SavePlan(Plan{}); err == nil {
		t.Error("saved a plan without steps")
	}
	if p := r.e.State(context.Background()).Plan; p.Steps != all {
		t.Errorf("plan = %+v", p)
	}
}

func TestTheScheduleStartsARunOncePerMinute(t *testing.T) {
	r := newRig(t, Plan{Steps: Steps{Check: true}, Schedule: Schedule{On: true, At: "03:30"}})
	r.e.Tick(context.Background())
	r.e.Wait()
	r.now = r.now.Add(20 * time.Second)
	r.e.Tick(context.Background())
	r.e.Wait()
	st := r.e.State(context.Background())
	if st.Last == nil || st.Last.Trigger != TriggerSchedule {
		t.Fatalf("last = %+v", st.Last)
	}
	if len(r.board.finished) != 1 {
		t.Errorf("runs = %d", len(r.board.finished))
	}
	r.now = r.now.Add(time.Minute)
	r.e.Tick(context.Background())
	r.e.Wait()
	if len(r.board.finished) != 1 {
		t.Errorf("ran outside its minute: %d", len(r.board.finished))
	}
}

func TestTheNextScheduledRunIsKnown(t *testing.T) {
	r := newRig(t, Plan{Steps: Steps{Check: true}, Schedule: Schedule{On: true, At: "04:00"}})
	st := r.e.State(context.Background())
	if st.Next == nil || !st.Next.Equal(time.Date(2026, 11, 10, 4, 0, 0, 0, time.UTC)) {
		t.Errorf("next = %v", st.Next)
	}
}

func TestTheStateSaysWhatTheFortressOffers(t *testing.T) {
	r := newRig(t, Plan{Steps: all})
	r.jobs.noUpdate = &NoAppError{Elsewhere: []string{"Basement"}}
	st := r.e.State(context.Background())
	if !st.Ready.Fortress || !st.Ready.Backup.Found || st.Ready.Backup.App != "bombvault" || !st.Ready.Backup.Online {
		t.Errorf("backup = %+v", st.Ready)
	}
	if st.Ready.Update.Found || len(st.Ready.Update.Elsewhere) != 1 {
		t.Errorf("update = %+v", st.Ready.Update)
	}
	r.e.Jobs = nil
	if st := r.e.State(context.Background()); st.Ready.Fortress || st.Ready.Backup.Found {
		t.Errorf("outside a fortress = %+v", st.Ready)
	}
}
