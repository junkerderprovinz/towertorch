// Package maint runs TowerTorch's maintenance plan: back up, update, check and
// restart the server, one step after the other, through the apps of the
// fortress that do each job.
package maint

import (
	"errors"
	"fmt"
	"regexp"
	"slices"
	"time"
)

// Plan is what a maintenance run does. Back up and update work on Containers,
// all containers when it is empty.
type Plan struct {
	Steps      Steps    `json:"steps"`
	Containers []string `json:"containers"`
	Schedule   Schedule `json:"schedule"`
}

// Steps are the parts of a run. Their order is fixed.
type Steps struct {
	Backup  bool `json:"backup"`
	Update  bool `json:"update"`
	Check   bool `json:"check"`
	Restart bool `json:"restart"`
}

// Schedule starts a run at At ("15:04", local time) on Days, 0 for Sunday.
// No days means every day.
type Schedule struct {
	On   bool   `json:"on"`
	Days []int  `json:"days"`
	At   string `json:"at"`
}

// containerName is what Docker accepts as a name.
var containerName = regexp.MustCompile(`^[a-zA-Z0-9][a-zA-Z0-9_.-]*$`)

// Validate says what is wrong with the plan, if anything.
func (p Plan) Validate() error {
	if p.Steps == (Steps{}) {
		return errors.New("choose at least one step")
	}
	for _, c := range p.Containers {
		if !containerName.MatchString(c) {
			return fmt.Errorf("%q is not a container name", c)
		}
	}
	if !p.Schedule.On {
		return nil
	}
	if _, err := time.Parse("15:04", p.Schedule.At); err != nil || len(p.Schedule.At) != 5 {
		return fmt.Errorf("%q is not a time of day like 03:30", p.Schedule.At)
	}
	for _, d := range p.Schedule.Days {
		if d < 0 || d > 6 {
			return fmt.Errorf("%d is not a weekday, they run from 0 for Sunday to 6", d)
		}
	}
	return nil
}

// Due reports whether a run starts in the minute of now.
func (s Schedule) Due(now time.Time) bool {
	return s.On && now.Format("15:04") == s.At && s.onDay(now.Weekday())
}

// Next is the start of the next run from now on, false when the schedule is
// off or cannot run.
func (s Schedule) Next(now time.Time) (time.Time, bool) {
	at, err := time.Parse("15:04", s.At)
	if !s.On || err != nil {
		return time.Time{}, false
	}
	day := time.Date(now.Year(), now.Month(), now.Day(), at.Hour(), at.Minute(), 0, 0, now.Location())
	for range 8 {
		if !day.Before(now) && s.onDay(day.Weekday()) {
			return day, true
		}
		day = day.AddDate(0, 0, 1)
	}
	return time.Time{}, false
}

func (s Schedule) onDay(d time.Weekday) bool {
	return len(s.Days) == 0 || slices.Contains(s.Days, int(d))
}
