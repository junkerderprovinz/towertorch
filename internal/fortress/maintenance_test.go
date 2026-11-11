package fortress

import (
	"strings"
	"testing"
	"time"

	"github.com/junkerderprovinz/parleyport/kit/status"

	"github.com/junkerderprovinz/towertorch/internal/maint"
)

func TestAMaintenanceRunIsWorkThatBlocksARestartWhileItBacksUp(t *testing.T) {
	now := time.Date(2026, 11, 10, 3, 30, 0, 0, time.UTC)
	b := newBoard(&now)
	b.MaintenanceProgress(&maint.Progress{Started: now, Step: maint.StepBackup, Index: 3, Total: 12, Item: "nextcloud", BlocksRestart: true})
	r := report(t, b, "en")
	if len(r.Work) != 1 {
		t.Fatalf("work = %+v", r.Work)
	}
	w := r.Work[0]
	if w.ID != "maintenance" || w.Kind != status.KindBackup || !w.BlocksRestart || !strings.Contains(w.Title, "nextcloud") {
		t.Errorf("work = %+v", w)
	}
	// Two of twelve are done while the third runs.
	if w.Progress == nil || *w.Progress != 2.0/12 {
		t.Errorf("progress = %v", w.Progress)
	}
	if de := report(t, b, "de").Work[0].Title; de == w.Title {
		t.Errorf("German title = %q", de)
	}

	b.MaintenanceProgress(&maint.Progress{Started: now, Step: maint.StepCheck})
	w = report(t, b, "en").Work[0]
	if w.Kind != status.KindCheck || w.BlocksRestart || w.Progress != nil {
		t.Errorf("work while checking = %+v", w)
	}
	b.MaintenanceProgress(nil)
	if r := report(t, b, "en"); len(r.Work) != 0 {
		t.Errorf("work after the run = %+v", r.Work)
	}
}

func failedRun(at time.Time) maint.Report {
	return maint.Report{ID: "1", Started: at, Finished: at, Outcome: maint.StateFailed, Steps: []maint.StepReport{
		{Step: maint.StepBackup, State: maint.StateFailed, Code: "backup.failed", Args: []string{"immich"}},
		{Step: maint.StepRestart, State: maint.StateNotRun, Code: "run.after_failure"},
	}}
}

func TestAFailedMaintenanceRunNeedsYouUntilOneGoesThrough(t *testing.T) {
	now := time.Date(2026, 11, 10, 3, 30, 0, 0, time.UTC)
	b := newBoard(&now)
	b.MaintenanceFinished(failedRun(now))
	r := report(t, b, "en")
	n, ok := needByID(r, "maintenance")
	if !ok || n.Severity != status.SeverityError || n.Code != "maintenance.failed" || !strings.Contains(n.Text, "immich") {
		t.Fatalf("need = %+v %v", n, ok)
	}
	page, _ := b.Log(t.Context(), status.LogQuery{Limit: 10, Lang: "en"})
	if len(page.Entries) != 1 || page.Entries[0].Code != "maintenance.failed" || page.Entries[0].Level != status.SeverityError {
		t.Errorf("log = %+v", page.Entries)
	}

	b.MaintenanceFinished(maint.Report{ID: "2", Outcome: maint.StateDone})
	if _, ok := needByID(report(t, b, "en"), "maintenance"); ok {
		t.Error("the need stayed after a run went through")
	}
}

func TestAHeldRestartIsAWarning(t *testing.T) {
	now := time.Date(2026, 11, 10, 3, 30, 0, 0, time.UTC)
	b := newBoard(&now)
	b.MaintenanceFinished(maint.Report{ID: "1", Outcome: maint.StateHeld, Steps: []maint.StepReport{
		{Step: maint.StepCheck, State: maint.StateFailed, Code: "check.nogo"},
		{Step: maint.StepRestart, State: maint.StateHeld, Code: "restart.held_nogo"},
	}})
	n, ok := needByID(report(t, b, "de"), "maintenance")
	if !ok || n.Severity != status.SeverityWarn || !strings.Contains(n.Text, "NO-GO") {
		t.Errorf("need = %+v %v", n, ok)
	}
}

func TestTheNextMaintenanceRunIsAnnounced(t *testing.T) {
	now := time.Date(2026, 11, 10, 3, 30, 0, 0, time.UTC)
	b := newBoard(&now)
	at := now.Add(24 * time.Hour)
	b.NextMaintenance = func() (time.Time, bool) { return at, true }
	r := report(t, b, "en")
	if len(r.Next) != 1 || !r.Next[0].At.Equal(at) || r.Next[0].Title == "" {
		t.Errorf("next = %+v", r.Next)
	}
}
