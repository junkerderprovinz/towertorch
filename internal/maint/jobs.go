package maint

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"slices"
	"sort"
	"strings"
	"time"
)

// The actions TowerTorch asks for. A request starts a job and answers its
// run id; the same action with the body {"run": id} reports the job, so
// each needs one permission only.
const (
	// BackupAction backs up one container: {"container", "reason"}, the
	// contract ShipLog speaks before an update.
	BackupAction = "backup.request"
	// UpdateAction updates containers: {"containers", "backedUp", "reason"},
	// every container with an update waiting when the list is empty.
	UpdateAction = "updates.run"
)

// reason tells the app who asks and why.
const reason = "maintenance"

// Member is an instance of the fortress.
type Member struct {
	ID      string
	App     string
	Device  string
	Online  bool
	Actions []string
}

// Fortress carries actions to the other members. An answer that says no is
// a *Refused.
type Fortress interface {
	Members() []Member
	Act(ctx context.Context, id, action string, body []byte) ([]byte, error)
}

// Refused is a member's no, with the HTTP status and code it came with.
type Refused struct {
	Status int
	Code   string
}

func (r *Refused) Error() string { return fmt.Sprintf("refused with %s (%d)", r.Code, r.Status) }

var (
	// ErrNoApp means no member on this server offers the action.
	ErrNoApp   = errors.New("no app on this server does this")
	ErrTimeout = errors.New("the job did not finish in time")
)

// NoAppError is ErrNoApp naming the servers that have such an app, since a
// backup app on another server cannot reach the containers here.
type NoAppError struct{ Elsewhere []string }

func (e *NoAppError) Error() string {
	if len(e.Elsewhere) == 0 {
		return ErrNoApp.Error()
	}
	return ErrNoApp.Error() + ", only " + strings.Join(e.Elsewhere, ", ") + " has one"
}

func (e *NoAppError) Is(target error) bool { return target == ErrNoApp }

// Snapshot is a finished backup.
type Snapshot struct {
	Run  string
	ID   string
	Link string
}

// Updated is how the update of one container went: updated, current, held,
// rolledBack or failed.
type Updated struct {
	Name   string `json:"name"`
	Result string `json:"result"`
	Error  string `json:"error,omitempty"`
}

// Jobs asks the apps of the fortress on this server to do their jobs and
// waits until they are done.
type Jobs struct {
	Fortress Fortress
	// Device is the server TowerTorch runs on, as it joined the fortress.
	Device string
	// Poll is how often a job is asked about, ten seconds when zero.
	Poll time.Duration
	// CallTimeout bounds each call, a minute when zero, so a relay that never
	// answers cannot hold the run.
	CallTimeout   time.Duration
	BackupTimeout time.Duration // per container, 30 minutes when zero
	UpdateTimeout time.Duration // for the whole update, 2 hours when zero
	sleep         func(context.Context, time.Duration) error
}

// Find picks the member on this server that offers action. One that is
// known but offline is an error, not ErrNoApp, so the run waits for it
// instead of going on without it.
func (j *Jobs) Find(action string) (Member, error) {
	var here []Member
	var elsewhere []string
	for _, m := range j.Fortress.Members() {
		switch {
		case !slices.Contains(m.Actions, action):
		case sameDevice(m.Device, j.Device):
			here = append(here, m)
		default:
			elsewhere = append(elsewhere, m.Device)
		}
	}
	if len(here) == 0 {
		return Member{}, &NoAppError{Elsewhere: elsewhere}
	}
	sort.Slice(here, func(a, b int) bool { return here[a].ID < here[b].ID })
	for _, m := range here {
		if m.Online {
			return m, nil
		}
	}
	return here[0], fmt.Errorf("%s on %s is not reachable", here[0].App, here[0].Device)
}

// Backup has m back up container and returns the snapshot once it is done.
func (j *Jobs) Backup(ctx context.Context, m Member, container string) (Snapshot, error) {
	var done struct {
		Snapshot string `json:"snapshot"`
		Link     string `json:"link"`
	}
	run, err := j.job(ctx, m, BackupAction, map[string]any{"container": container, "reason": reason}, or(j.BackupTimeout, 30*time.Minute), &done)
	if err != nil {
		return Snapshot{}, err
	}
	return Snapshot{Run: run, ID: done.Snapshot, Link: done.Link}, nil
}

// Update has m update containers, every container with an update when the
// list is empty. backedUp names those with a fresh backup, so the app need
// not take another.
func (j *Jobs) Update(ctx context.Context, m Member, containers, backedUp []string) ([]Updated, error) {
	body := map[string]any{"containers": nonNil(containers), "backedUp": nonNil(backedUp), "reason": reason}
	var done struct {
		Containers []Updated `json:"containers"`
	}
	if _, err := j.job(ctx, m, UpdateAction, body, or(j.UpdateTimeout, 2*time.Hour), &done); err != nil {
		return nil, err
	}
	return done.Containers, nil
}

// job starts action at m and asks about the run until it is done, then reads
// the last answer into out.
func (j *Jobs) job(ctx context.Context, m Member, action string, body map[string]any, timeout time.Duration, out any) (string, error) {
	req, _ := json.Marshal(body)
	raw, err := j.act(ctx, m, action, req)
	if err != nil {
		return "", err
	}
	var started struct {
		Run runID `json:"run"`
		ID  runID `json:"id"`
	}
	if err := json.Unmarshal(raw, &started); err != nil {
		return "", fmt.Errorf("%s answered something unreadable: %w", m.App, err)
	}
	run := string(started.Run)
	if run == "" {
		run = string(started.ID)
	}
	if run == "" {
		return "", fmt.Errorf("%s named no run", m.App)
	}
	ask, _ := json.Marshal(map[string]string{"run": run})
	sleep := j.sleep
	if sleep == nil {
		sleep = wait
	}
	poll := or(j.Poll, 10*time.Second)
	for waited := time.Duration(0); ; waited += poll {
		raw, err := j.act(ctx, m, action, ask)
		if err != nil {
			return run, err
		}
		var state struct {
			State string `json:"state"`
			Error string `json:"error"`
		}
		if err := json.Unmarshal(raw, &state); err != nil {
			return run, fmt.Errorf("%s answered something unreadable: %w", m.App, err)
		}
		switch strings.ToLower(state.State) {
		case "done", "success":
			if err := json.Unmarshal(raw, out); err != nil {
				return run, fmt.Errorf("%s answered something unreadable: %w", m.App, err)
			}
			return run, nil
		case "failed", "error", "cancelled", "canceled":
			if state.Error == "" {
				state.Error = state.State
			}
			return run, errors.New(state.Error)
		}
		if waited >= timeout {
			return run, fmt.Errorf("%w (%s)", ErrTimeout, timeout)
		}
		if err := sleep(ctx, poll); err != nil {
			return run, err
		}
	}
}

func (j *Jobs) act(ctx context.Context, m Member, action string, body []byte) ([]byte, error) {
	ctx, cancel := context.WithTimeout(ctx, or(j.CallTimeout, time.Minute))
	defer cancel()
	raw, err := j.Fortress.Act(ctx, m.ID, action, body)
	var no *Refused
	switch {
	case errors.As(err, &no):
		return nil, fmt.Errorf("%s said no: %s", m.App, no.Code)
	case err != nil:
		return nil, fmt.Errorf("%s did not answer: %w", m.App, err)
	}
	return raw, nil
}

// sameDevice compares server names the way people write them: "Tower",
// "tower" and "tower.lan" are one server.
func sameDevice(a, b string) bool {
	host := func(s string) string {
		s, _, _ = strings.Cut(strings.ToLower(strings.TrimSpace(s)), ".")
		return s
	}
	return host(a) != "" && host(a) == host(b)
}

// runID reads a run id sent as a string or as a number.
type runID string

func (r *runID) UnmarshalJSON(b []byte) error {
	var s string
	if json.Unmarshal(b, &s) == nil {
		*r = runID(s)
		return nil
	}
	var n json.Number
	if err := json.Unmarshal(b, &n); err != nil {
		return err
	}
	*r = runID(n.String())
	return nil
}

func or(d, def time.Duration) time.Duration {
	if d > 0 {
		return d
	}
	return def
}

func nonNil(s []string) []string {
	if s == nil {
		return []string{}
	}
	return s
}

func wait(ctx context.Context, d time.Duration) error {
	t := time.NewTimer(d)
	defer t.Stop()
	select {
	case <-ctx.Done():
		return ctx.Err()
	case <-t.C:
		return nil
	}
}
