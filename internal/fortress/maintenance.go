package fortress

import (
	"strings"

	"github.com/junkerderprovinz/parleyport/kit/status"

	"github.com/junkerderprovinz/towertorch/internal/maint"
)

// MaintenanceProgress shows the maintenance run at work, or none for nil.
func (b *Board) MaintenanceProgress(p *maint.Progress) {
	b.mu.Lock()
	defer b.mu.Unlock()
	if p == nil {
		b.maintRun = nil
		return
	}
	c := *p
	b.maintRun = &c
}

// MaintenanceFinished logs how a run went. A failed run or a held restart
// needs the user until a later run goes through.
func (b *Board) MaintenanceFinished(r maint.Report) {
	b.mu.Lock()
	defer b.mu.Unlock()
	code := "maintenance." + string(r.Outcome)
	args := reason(r)
	b.maintBad = nil
	switch r.Outcome {
	case maint.StateFailed:
		b.maintBad = &r
		b.add(status.SeverityError, code, args...)
	case maint.StateHeld:
		b.maintBad = &r
		b.add(status.SeverityWarn, code, args...)
	case maint.StateWarn, maint.StateStopped:
		b.add(status.SeverityWarn, code, args...)
	default:
		b.add(status.SeverityInfo, code, args...)
	}
}

// reason is the code and args of the step that failed or held the restart.
func reason(r maint.Report) []string {
	for _, s := range r.Steps {
		// When the restart is held, the check before it failed for that reason.
		if s.State == maint.StateHeld || (s.State == maint.StateFailed && r.Outcome != maint.StateHeld) {
			return append([]string{s.Code}, s.Args...)
		}
	}
	return nil
}

func maintenanceWork(p maint.Progress, lang string) status.Task {
	kind := map[maint.Step]status.WorkKind{maint.StepBackup: status.KindBackup, maint.StepUpdate: status.KindUpdate, maint.StepCheck: status.KindCheck}[p.Step]
	if kind == "" {
		kind = status.KindOther
	}
	t := status.Task{ID: "maintenance", Kind: kind, Title: maint.Title(p, lang), StartedAt: p.Started, BlocksRestart: p.BlocksRestart}
	if p.Total > 0 {
		done := float64(p.Index-1) / float64(p.Total)
		t.Progress = &done
	}
	return t
}

func maintenanceNeed(r maint.Report, lang string) status.Need {
	code := "maintenance." + string(r.Outcome)
	sev := status.SeverityWarn
	if r.Outcome == maint.StateFailed {
		sev = status.SeverityError
	}
	return status.Need{ID: "maintenance", Severity: sev, Code: code, Text: say(lang, code, reason(r)), Since: r.Finished}
}

// say puts a log or need code in the reader's language. A maintenance code
// carries the code of the step behind it as its first arg.
func say(lang, code string, args []string) string {
	if !strings.HasPrefix(code, "maintenance.") {
		return texts(lang).say(code, args...)
	}
	text := maint.Say(lang, code)
	if len(args) == 0 {
		return text + "."
	}
	return text + ": " + maint.Say(lang, args[0], args[1:]...)
}
