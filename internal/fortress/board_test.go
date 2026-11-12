package fortress

import (
	"context"
	"errors"
	"strconv"
	"strings"
	"testing"
	"time"

	"github.com/junkerderprovinz/parleyport/kit/status"

	"github.com/junkerderprovinz/towertorch/internal/model"
)

type fakeDocker struct {
	list []model.Container
	err  error
}

func (f fakeDocker) List(context.Context) ([]model.Container, error) { return f.list, f.err }

func newBoard(now *time.Time) *Board {
	return &Board{
		App:      status.App{ID: "towertorch", Name: "TowerTorch", Version: "1.4.2"},
		Instance: status.Instance{ID: "abc", Name: "Tower"},
		Now:      func() time.Time { return *now },
	}
}

func report(t *testing.T, b *Board, lang string) status.Report {
	t.Helper()
	r, err := b.Report(context.Background(), lang)
	if err != nil {
		t.Fatal(err)
	}
	return r
}

func needByID(r status.Report, id string) (status.Need, bool) {
	for _, n := range r.NeedsYou {
		if n.ID == id {
			return n, true
		}
	}
	return status.Need{}, false
}

func TestAQuietBoardIsOK(t *testing.T) {
	now := time.Date(2026, 11, 9, 10, 0, 0, 0, time.UTC)
	r := report(t, newBoard(&now), "en")
	if r.State != status.StateOK || len(r.NeedsYou) != 0 || len(r.Work) != 0 {
		t.Fatalf("got %+v", r)
	}
	if r.App.ID != "towertorch" || r.Instance.ID != "abc" {
		t.Errorf("app or instance lost: %+v %+v", r.App, r.Instance)
	}
}

func TestARunningPlanIsWorkThatBlocksARestart(t *testing.T) {
	now := time.Date(2026, 11, 9, 10, 0, 0, 0, time.UTC)
	b := newBoard(&now)
	b.RunStarted()
	r := report(t, b, "en")
	if len(r.Work) != 1 {
		t.Fatalf("work = %+v", r.Work)
	}
	w := r.Work[0]
	if w.ID != "plan-run" || !w.BlocksRestart || !w.StartedAt.Equal(now) || w.Title == "" {
		t.Errorf("work = %+v", w)
	}
	b.RunFinished(model.RunResult{})
	if r := report(t, b, "en"); len(r.Work) != 0 {
		t.Errorf("work after the run = %+v", r.Work)
	}
}

func TestFailedStartsNeedYouOnePerContainer(t *testing.T) {
	now := time.Date(2026, 11, 9, 10, 0, 0, 0, time.UTC)
	b := newBoard(&now)
	b.RunStarted()
	b.RunFinished(model.RunResult{Nodes: []model.NodeResult{
		{Name: "db", State: model.StateFailed, Reason: "not ready within timeout"},
		{Name: "app", State: model.StateSkipped, Reason: "dependency db did not come up"},
		{Name: "cache", State: model.StateDegraded, Reason: "tcp 6379 refused"},
		{Name: "web", State: model.StateReady},
	}})
	r := report(t, b, "en")
	db, ok := needByID(r, "start-db")
	if !ok || db.Severity != status.SeverityError || db.Code != "start.failed" || !strings.Contains(db.Text, "db") || !strings.Contains(db.Text, "not ready within timeout") {
		t.Errorf("db = %+v (found %v)", db, ok)
	}
	if !db.Since.Equal(now) {
		t.Errorf("since = %v, want %v", db.Since, now)
	}
	if app, ok := needByID(r, "start-app"); !ok || app.Code != "start.skipped" || app.Severity != status.SeverityWarn {
		t.Errorf("app = %+v (found %v)", app, ok)
	}
	if c, ok := needByID(r, "start-cache"); !ok || c.Code != "start.degraded" || c.Severity != status.SeverityWarn {
		t.Errorf("cache = %+v (found %v)", c, ok)
	}
	if _, ok := needByID(r, "start-web"); ok || len(r.NeedsYou) != 3 {
		t.Errorf("needsYou = %+v", r.NeedsYou)
	}
}

func TestASkippedStartAloneNeedsNothing(t *testing.T) {
	now := time.Now()
	b := newBoard(&now)
	b.RunFinished(model.RunResult{Nodes: []model.NodeResult{{Name: "app", State: model.StateSkipped, Reason: "run cancelled"}}})
	if r := report(t, b, "en"); len(r.NeedsYou) != 0 {
		t.Errorf("a run cancelled at shutdown should stay quiet: %+v", r.NeedsYou)
	}
}

func TestTheNextRunReplacesTheFailures(t *testing.T) {
	now := time.Now()
	b := newBoard(&now)
	b.RunFinished(model.RunResult{Nodes: []model.NodeResult{{Name: "db", State: model.StateFailed, Reason: "x"}}})
	b.RunFinished(model.RunResult{Nodes: []model.NodeResult{{Name: "db", State: model.StateReady}}})
	if r := report(t, b, "en"); len(r.NeedsYou) != 0 {
		t.Errorf("needsYou = %+v", r.NeedsYou)
	}
}

func TestAFailedStartClearsOnceTheContainerRuns(t *testing.T) {
	now := time.Now()
	b := newBoard(&now)
	b.RunFinished(model.RunResult{Nodes: []model.NodeResult{
		{Name: "db", State: model.StateFailed, Reason: "x"},
		{Name: "sick", State: model.StateFailed, Reason: "x"},
		{Name: "cache", State: model.StateDegraded, Reason: "y"},
	}})
	b.Docker = fakeDocker{list: []model.Container{
		{Name: "db", State: "running"},
		{Name: "sick", State: "running", Health: "unhealthy"},
		{Name: "cache", State: "running"},
	}}
	r := report(t, b, "en")
	if _, ok := needByID(r, "start-db"); ok {
		t.Error("db runs now, its failed start should be gone")
	}
	if _, ok := needByID(r, "start-sick"); !ok {
		t.Error("an unhealthy container still needs a look")
	}
	if _, ok := needByID(r, "start-cache"); !ok {
		t.Error("a degraded start ran all along, it stays until the next run")
	}

	b.Docker = fakeDocker{err: errors.New("docker down")}
	if r := report(t, b, "en"); len(r.NeedsYou) != 3 {
		t.Errorf("without docker every failure stays: %+v", r.NeedsYou)
	}
}

func TestWatchdogFailuresNeedYouUntilTheContainerRecovers(t *testing.T) {
	now := time.Date(2026, 11, 9, 10, 0, 0, 0, time.UTC)
	b := newBoard(&now)
	b.WatchdogGaveUp("nextcloud", 3)
	b.WatchdogRestartFailed("db", errors.New("no such container"))
	r := report(t, b, "en")
	nc, ok := needByID(r, "watchdog-nextcloud")
	if !ok || nc.Severity != status.SeverityError || nc.Code != "watchdog.gave_up" || !strings.Contains(nc.Text, "nextcloud") {
		t.Errorf("nextcloud = %+v (found %v)", nc, ok)
	}
	db, ok := needByID(r, "watchdog-db")
	if !ok || db.Code != "watchdog.restart_failed" || !strings.Contains(db.Text, "no such container") {
		t.Errorf("db = %+v (found %v)", db, ok)
	}

	later := now.Add(time.Hour)
	now = later
	b.WatchdogGaveUp("nextcloud", 3)
	if nc, _ := needByID(report(t, b, "en"), "watchdog-nextcloud"); !nc.Since.Equal(later.Add(-time.Hour)) {
		t.Errorf("since moved with a repeat: %v", nc.Since)
	}

	b.WatchdogRecovered("nextcloud")
	r = report(t, b, "en")
	if _, ok := needByID(r, "watchdog-nextcloud"); ok || len(r.NeedsYou) != 1 {
		t.Errorf("needsYou = %+v", r.NeedsYou)
	}
}

func TestTextsFollowTheLanguage(t *testing.T) {
	now := time.Now()
	b := newBoard(&now)
	b.RunStarted()
	b.WatchdogGaveUp("nextcloud", 3)
	en, de, pt, deAT := report(t, b, "en"), report(t, b, "de"), report(t, b, "pt-BR"), report(t, b, "de-AT")
	if en.NeedsYou[0].Text == de.NeedsYou[0].Text || en.Work[0].Title == de.Work[0].Title {
		t.Errorf("de and en read the same: %q / %q", en.NeedsYou[0].Text, en.Work[0].Title)
	}
	if pt.NeedsYou[0].Text != en.NeedsYou[0].Text {
		t.Errorf("a language without texts should fall back to English: %q", pt.NeedsYou[0].Text)
	}
	if deAT.NeedsYou[0].Text != de.NeedsYou[0].Text {
		t.Errorf("de-AT should read German: %q", deAT.NeedsYou[0].Text)
	}
}

func logPage(t *testing.T, b *Board, after string, limit int, lang string) status.LogPage {
	t.Helper()
	p, err := b.Log(context.Background(), status.LogQuery{After: after, Limit: limit, Lang: lang})
	if err != nil {
		t.Fatal(err)
	}
	return p
}

func TestTheLogPagesForwardInOrder(t *testing.T) {
	now := time.Date(2026, 11, 9, 10, 0, 0, 0, time.UTC)
	b := newBoard(&now)
	b.RunFinished(model.RunResult{Nodes: []model.NodeResult{{Name: "web", State: model.StateReady}}})
	now = now.Add(time.Minute)
	b.WatchdogRestarted("db", 1)
	now = now.Add(time.Minute)
	b.WatchdogRestarted("db", 0)

	all := logPage(t, b, "", 50, "en")
	if len(all.Entries) != 3 {
		t.Fatalf("entries = %+v", all.Entries)
	}
	if all.Entries[0].Code != "plan.done" || all.Entries[1].Code != "watchdog.restarted" {
		t.Errorf("codes = %s, %s", all.Entries[0].Code, all.Entries[1].Code)
	}
	if !strings.Contains(all.Entries[1].Text, "1") || all.Entries[1].Text == all.Entries[2].Text {
		t.Errorf("a crash and an unhealthy container should read apart: %q / %q", all.Entries[1].Text, all.Entries[2].Text)
	}

	first := logPage(t, b, "", 1, "en")
	second := logPage(t, b, first.Next, 1, "en")
	if len(second.Entries) != 1 || second.Entries[0].ID != all.Entries[1].ID {
		t.Errorf("second page = %+v", second)
	}
	end := logPage(t, b, all.Next, 10, "en")
	if len(end.Entries) != 0 || end.Next != all.Next {
		t.Errorf("past the end = %+v, want next %q", end, all.Next)
	}
	if de := logPage(t, b, "", 50, "de"); de.Entries[0].Text == all.Entries[0].Text {
		t.Errorf("the log ignores the language: %q", de.Entries[0].Text)
	}
}

func TestLogIDsKeepRisingAcrossARestart(t *testing.T) {
	now := time.Now()
	b := newBoard(&now)
	b.WatchdogRestarted("db", 1)
	old := logPage(t, b, "", 10, "en").Next

	now = now.Add(time.Second)
	restarted := newBoard(&now)
	restarted.WatchdogRestarted("db", 1)
	if p := logPage(t, restarted, old, 10, "en"); len(p.Entries) != 1 {
		t.Errorf("a reader with a cursor from before the restart missed the new entry: %+v", p)
	}
}

func TestTheLogKeepsItsNewestEntries(t *testing.T) {
	now := time.Now()
	b := newBoard(&now)
	for i := range maxLog + 10 {
		b.WatchdogRestarted("c"+strconv.Itoa(i), 1)
	}
	p := logPage(t, b, "", status.MaxLogLimit, "en")
	if len(p.Entries) != status.MaxLogLimit {
		t.Fatalf("page holds %d", len(p.Entries))
	}
	if !strings.Contains(p.Entries[0].Text, "c10 ") {
		t.Errorf("oldest kept entry = %q, want the one for c10", p.Entries[0].Text)
	}
}
