package maint

import "time"

// Trigger is what started a run.
type Trigger string

const (
	TriggerManual   Trigger = "manual"
	TriggerSchedule Trigger = "schedule"
)

// Step is one part of a run.
type Step string

const (
	StepBackup  Step = "backup"
	StepUpdate  Step = "update"
	StepCheck   Step = "check"
	StepRestart Step = "restart"
)

// State is how a step, an item or a whole run stands.
type State string

const (
	StateOff     State = "off" // not in the plan
	StateWaiting State = "waiting"
	StateRunning State = "running"
	StateDone    State = "done"
	StateWarn    State = "warn" // done, with something to look at
	StateSkipped State = "skipped"
	StateFailed  State = "failed"
	StateHeld    State = "held" // the restart, after a check that did not say go
	StateNotRun  State = "notRun"
	StateStopped State = "stopped"
	StateOK      State = "ok" // an item that went well
)

// Report is the account of one run. Codes and their args say what happened
// in a way a reader can put in any language; Say does it for English and
// German.
type Report struct {
	ID       string       `json:"id"`
	Trigger  Trigger      `json:"trigger"`
	Started  time.Time    `json:"started"`
	Finished time.Time    `json:"finished,omitzero"`
	Outcome  State        `json:"outcome"`
	Steps    []StepReport `json:"steps"`
}

// StepReport is how one step went.
type StepReport struct {
	Step     Step      `json:"step"`
	State    State     `json:"state"`
	Code     string    `json:"code,omitempty"`
	Args     []string  `json:"args,omitempty"`
	Verdict  string    `json:"verdict,omitempty"`
	Text     string    `json:"text,omitempty"` // Code said in a reader's language, by Localize
	Items    []Item    `json:"items,omitempty"`
	Started  time.Time `json:"started,omitzero"`
	Finished time.Time `json:"finished,omitzero"`
}

// Item is a container of a step or a finding of the check.
type Item struct {
	Name   string `json:"name"`
	State  State  `json:"state"`
	Code   string `json:"code"`
	Detail string `json:"detail,omitempty"`
	Link   string `json:"link,omitempty"`
}

// Progress is where a run stands. BlocksRestart asks the other apps of the
// fortress not to restart the server meanwhile.
type Progress struct {
	Started       time.Time `json:"started"`
	Step          Step      `json:"step"`
	Index         int       `json:"index,omitempty"` // the item at work, from 1
	Total         int       `json:"total,omitempty"`
	Item          string    `json:"item,omitempty"`
	BlocksRestart bool      `json:"blocksRestart"`
}

// outcome sums up the steps: a stop or a failure wins over a held restart,
// which wins over notes and skipped steps. A check that holds the restart
// counts as the held restart.
func outcome(steps []StepReport) State {
	rank := map[State]int{StateWarn: 1, StateSkipped: 1, StateHeld: 2, StateFailed: 3, StateStopped: 4}
	held := false
	for _, s := range steps {
		held = held || (s.Step == StepRestart && s.State == StateHeld)
	}
	out := StateDone
	for _, s := range steps {
		if s.Step == StepCheck && s.State == StateFailed && held {
			continue
		}
		if rank[s.State] > rank[out] {
			out = s.State
		}
	}
	if out == StateSkipped {
		out = StateWarn
	}
	return out
}
