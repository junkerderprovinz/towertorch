package maint

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"os"
	"os/exec"
	"strings"
	"time"
)

// DefaultFireSquire is where the FireSquire plugin keeps its check.
const DefaultFireSquire = "/usr/local/emhttp/plugins/firesquire/firesquire-check.sh"

// The verdicts of FireSquire.
const (
	VerdictGo      = "GO"
	VerdictCaution = "CAUTION"
	VerdictNoGo    = "NO-GO"
)

// ErrNotInstalled means FireSquire is not on this server.
var ErrNotInstalled = errors.New("FireSquire is not installed")

// Verdict is FireSquire's answer to whether the server may restart.
type Verdict struct {
	Verdict  string
	Findings []Finding
}

// Finding is one check of FireSquire. Status is pass, warn or fail; Message
// is in English, Key and Args let a reader say it in another language.
type Finding struct {
	ID      string   `json:"id"`
	Status  string   `json:"status"`
	Key     string   `json:"key"`
	Args    []string `json:"args"`
	Message string   `json:"message"`
	Link    string   `json:"link,omitempty"`
}

// FireSquire runs the check of the FireSquire plugin on this server.
type FireSquire struct {
	Script string
	// Timeout bounds the check, which spins up every disk for SMART. Fifteen
	// minutes when zero.
	Timeout time.Duration
	run     func(ctx context.Context, script string) ([]byte, error)
}

// Installed reports whether FireSquire is on this server.
func (f FireSquire) Installed() bool {
	_, err := os.Stat(f.Script)
	return err == nil
}

// Check runs FireSquire and returns its verdict with every finding that is
// not mere information.
func (f FireSquire) Check(ctx context.Context) (Verdict, error) {
	if _, err := os.Stat(f.Script); errors.Is(err, os.ErrNotExist) {
		return Verdict{}, ErrNotInstalled
	}
	ctx, cancel := context.WithTimeout(ctx, or(f.Timeout, 15*time.Minute))
	defer cancel()
	run := f.run
	if run == nil {
		run = runScript
	}
	// The exit code mirrors the verdict, so an error beside readable output
	// is no failure.
	out, runErr := run(ctx, f.Script)
	var report struct {
		Verdict string    `json:"verdict"`
		Checks  []Finding `json:"checks"`
	}
	if err := json.Unmarshal(out, &report); err != nil || report.Verdict == "" {
		if runErr == nil {
			runErr = errors.New("its answer is unreadable")
		}
		return Verdict{}, fmt.Errorf("FireSquire could not check: %w", runErr)
	}
	v := Verdict{Verdict: strings.ToUpper(report.Verdict)}
	for _, c := range report.Checks {
		if c.Status == "pass" || c.Status == "warn" || c.Status == "fail" {
			v.Findings = append(v.Findings, c)
		}
	}
	return v, nil
}

func runScript(ctx context.Context, script string) ([]byte, error) {
	return exec.CommandContext(ctx, script, "--json").Output() //nolint:gosec // G204: the script is FireSquire's, at a path TowerTorch sets
}
