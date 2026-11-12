package maint

import (
	"testing"
	"time"
)

func TestAPlanNeedsAStep(t *testing.T) {
	if err := (Plan{}).Validate(); err == nil {
		t.Error("a plan without steps passed")
	}
	if err := (Plan{Steps: Steps{Check: true}}).Validate(); err != nil {
		t.Errorf("check alone: %v", err)
	}
}

func TestAPlanRefusesContainerNamesDockerWouldNot(t *testing.T) {
	for _, name := range []string{"", "-x", "a b", "../x", "x;y"} {
		p := Plan{Steps: Steps{Backup: true}, Containers: []string{name}}
		if err := p.Validate(); err == nil {
			t.Errorf("%q passed", name)
		}
	}
	p := Plan{Steps: Steps{Backup: true}, Containers: []string{"nextcloud", "paperless-ngx", "Immich_DB.1"}}
	if err := p.Validate(); err != nil {
		t.Error(err)
	}
}

func TestAScheduleNeedsATimeOfDayAndRealWeekdays(t *testing.T) {
	bad := []Schedule{
		{On: true, At: ""},
		{On: true, At: "24:00"},
		{On: true, At: "3:30"},
		{On: true, At: "03:60"},
		{On: true, At: "03:30", Days: []int{7}},
		{On: true, At: "03:30", Days: []int{-1}},
	}
	for _, s := range bad {
		if err := (Plan{Steps: Steps{Check: true}, Schedule: s}).Validate(); err == nil {
			t.Errorf("%+v passed", s)
		}
	}
	off := Plan{Steps: Steps{Check: true}, Schedule: Schedule{At: "nonsense"}}
	if err := off.Validate(); err != nil {
		t.Errorf("a schedule that is off is not checked: %v", err)
	}
}

func TestAScheduleWithoutDaysRunsDaily(t *testing.T) {
	s := Schedule{On: true, At: "03:30"}
	now := time.Date(2026, 11, 10, 12, 0, 0, 0, time.UTC)
	next, ok := s.Next(now)
	want := time.Date(2026, 11, 11, 3, 30, 0, 0, time.UTC)
	if !ok || !next.Equal(want) {
		t.Errorf("next = %v %v, want %v", next, ok, want)
	}
}

func TestAScheduleWaitsForItsWeekday(t *testing.T) {
	// 10 November 2026 is a Tuesday; the next Sunday is the 15th.
	s := Schedule{On: true, At: "03:30", Days: []int{0}}
	now := time.Date(2026, 11, 10, 12, 0, 0, 0, time.UTC)
	next, _ := s.Next(now)
	if want := time.Date(2026, 11, 15, 3, 30, 0, 0, time.UTC); !next.Equal(want) {
		t.Errorf("next = %v, want %v", next, want)
	}
	if s.Due(time.Date(2026, 11, 14, 3, 30, 10, 0, time.UTC)) {
		t.Error("due on a Saturday")
	}
	if !s.Due(time.Date(2026, 11, 15, 3, 30, 40, 0, time.UTC)) {
		t.Error("not due on Sunday at 03:30")
	}
}

func TestATodaysTimeStillAheadIsNext(t *testing.T) {
	s := Schedule{On: true, At: "18:00"}
	now := time.Date(2026, 11, 10, 12, 0, 0, 0, time.UTC)
	next, _ := s.Next(now)
	if want := time.Date(2026, 11, 10, 18, 0, 0, 0, time.UTC); !next.Equal(want) {
		t.Errorf("next = %v, want %v", next, want)
	}
}

func TestAScheduleThatIsOffNeverRuns(t *testing.T) {
	s := Schedule{At: "03:30"}
	if _, ok := s.Next(time.Now()); ok {
		t.Error("next run for a schedule that is off")
	}
	if s.Due(time.Date(2026, 11, 15, 3, 30, 0, 0, time.UTC)) {
		t.Error("due while off")
	}
}
