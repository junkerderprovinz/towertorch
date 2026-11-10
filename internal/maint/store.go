package maint

import (
	"encoding/json"
	"errors"
	"os"
	"path/filepath"
	"sync"
)

// Saved is what the file keeps: the plan and the report of the last run.
type Saved struct {
	Plan Plan    `json:"plan"`
	Last *Report `json:"last,omitempty"`
}

// File keeps the plan and the last report as JSON on the flash, so a report
// written before a restart is there after it.
type File struct {
	Path string
	mu   sync.Mutex
}

// Load reads the file. A missing one is an empty plan with no report.
func (f *File) Load() (Saved, error) {
	f.mu.Lock()
	defer f.mu.Unlock()
	return f.load()
}

func (f *File) load() (Saved, error) {
	var s Saved
	raw, err := os.ReadFile(f.Path)
	if errors.Is(err, os.ErrNotExist) || (err == nil && len(raw) == 0) {
		return s, nil
	}
	if err != nil {
		return s, err
	}
	return s, json.Unmarshal(raw, &s)
}

// SavePlan replaces the plan and keeps the report.
func (f *File) SavePlan(p Plan) error {
	return f.change(func(s *Saved) { s.Plan = p })
}

// SaveReport replaces the report and keeps the plan.
func (f *File) SaveReport(r Report) error {
	return f.change(func(s *Saved) { s.Last = &r })
}

func (f *File) change(edit func(*Saved)) error {
	f.mu.Lock()
	defer f.mu.Unlock()
	s, err := f.load()
	if err != nil {
		return err
	}
	edit(&s)
	raw, err := json.MarshalIndent(s, "", "  ")
	if err != nil {
		return err
	}
	tmp, err := os.CreateTemp(filepath.Dir(f.Path), ".maintenance-*.json")
	if err != nil {
		return err
	}
	defer func() { _ = os.Remove(tmp.Name()) }()
	if _, err := tmp.Write(raw); err != nil {
		_ = tmp.Close()
		return err
	}
	if err := tmp.Sync(); err != nil {
		_ = tmp.Close()
		return err
	}
	if err := tmp.Close(); err != nil {
		return err
	}
	return os.Rename(tmp.Name(), f.Path)
}
