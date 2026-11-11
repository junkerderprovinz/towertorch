package api

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/junkerderprovinz/towertorch/internal/fortress"
	"github.com/junkerderprovinz/towertorch/internal/maint"
)

type fakeMaintenance struct {
	plan    maint.Plan
	busy    bool
	started []maint.Trigger
	stopped bool
}

func (f *fakeMaintenance) State(context.Context) maint.Overview {
	return maint.Overview{Plan: f.plan, Ready: maint.Ready{Check: true}}
}

func (f *fakeMaintenance) SavePlan(p maint.Plan) error {
	if err := p.Validate(); err != nil {
		return err
	}
	f.plan = p
	return nil
}

func (f *fakeMaintenance) Start(_ context.Context, t maint.Trigger) error {
	if f.busy {
		return maint.ErrBusy
	}
	f.started = append(f.started, t)
	return nil
}

func (f *fakeMaintenance) Stop() bool {
	f.stopped = f.busy
	return f.busy
}

func call(s *Server, method, path, body string) *httptest.ResponseRecorder {
	rec := httptest.NewRecorder()
	s.Handler().ServeHTTP(rec, httptest.NewRequest(method, path, strings.NewReader(body)))
	return rec
}

func TestThePanelReadsAndSavesTheMaintenancePlan(t *testing.T) {
	m := &fakeMaintenance{}
	s := &Server{Store: &memStore{}, Maintenance: m}
	rec := call(s, http.MethodPut, "/api/maintenance", `{"steps":{"backup":true,"restart":true},"containers":["nextcloud"],"schedule":{"on":true,"days":[0],"at":"03:30"}}`)
	if rec.Code != http.StatusOK {
		t.Fatalf("save = %d %s", rec.Code, rec.Body)
	}
	rec = call(s, http.MethodGet, "/api/maintenance", "")
	var o maint.Overview
	if err := json.Unmarshal(rec.Body.Bytes(), &o); err != nil || rec.Code != http.StatusOK {
		t.Fatalf("get = %d %v", rec.Code, err)
	}
	if !o.Plan.Steps.Backup || o.Plan.Schedule.At != "03:30" || !o.Ready.Check {
		t.Errorf("overview = %+v", o)
	}
}

func TestAPlanWithoutStepsIsRefused(t *testing.T) {
	s := &Server{Store: &memStore{}, Maintenance: &fakeMaintenance{}}
	if rec := call(s, http.MethodPut, "/api/maintenance", `{"steps":{}}`); rec.Code != http.StatusBadRequest {
		t.Errorf("code = %d", rec.Code)
	}
	if rec := call(s, http.MethodPut, "/api/maintenance", `{`); rec.Code != http.StatusBadRequest {
		t.Errorf("broken JSON: code = %d", rec.Code)
	}
}

func TestARunStartsByHandAndOnlyOnce(t *testing.T) {
	m := &fakeMaintenance{}
	s := &Server{Store: &memStore{}, Maintenance: m}
	if rec := call(s, http.MethodPost, "/api/maintenance/run", ""); rec.Code != http.StatusAccepted {
		t.Errorf("run = %d", rec.Code)
	}
	if len(m.started) != 1 || m.started[0] != maint.TriggerManual {
		t.Errorf("started = %v", m.started)
	}
	m.busy = true
	if rec := call(s, http.MethodPost, "/api/maintenance/run", ""); rec.Code != http.StatusConflict {
		t.Errorf("second run = %d", rec.Code)
	}
}

func TestStoppingSaysWhetherARunWasGoing(t *testing.T) {
	m := &fakeMaintenance{busy: true}
	s := &Server{Store: &memStore{}, Maintenance: m}
	rec := call(s, http.MethodPost, "/api/maintenance/stop", "")
	if rec.Code != http.StatusOK || !m.stopped || !strings.Contains(rec.Body.String(), `"stopping":true`) {
		t.Errorf("stop = %d %s", rec.Code, rec.Body)
	}
}

func TestWithoutAnEngineThereIsNoMaintenanceRoute(t *testing.T) {
	s := &Server{Store: &memStore{}}
	if rec := call(s, http.MethodGet, "/api/maintenance", ""); rec.Code != http.StatusNotFound {
		t.Errorf("code = %d", rec.Code)
	}
}

type fakeDoor struct {
	words string
	err   error
}

func (d *fakeDoor) Enter(words string) error {
	d.words = words
	return d.err
}

func TestThePhraseJoinsTheFortress(t *testing.T) {
	d := &fakeDoor{}
	s := &Server{Store: &memStore{}, Door: d}
	rec := call(s, http.MethodPost, "/api/fortress/join", `{"phrase":"legal winner thank year wave sausage worth useful legal winner thank yellow"}`)
	if rec.Code != http.StatusOK || !strings.HasPrefix(d.words, "legal winner") {
		t.Errorf("join = %d %s, words %q", rec.Code, rec.Body, d.words)
	}
}

func TestAJoinThatFailsSaysWhyWithACode(t *testing.T) {
	for _, c := range []struct {
		err  error
		code int
		body string
	}{
		{fortress.ErrPhrase, http.StatusBadRequest, `"error":"phrase"`},
		{fortress.ErrMember, http.StatusConflict, `"error":"member"`},
	} {
		s := &Server{Store: &memStore{}, Door: &fakeDoor{err: c.err}}
		rec := call(s, http.MethodPost, "/api/fortress/join", `{"phrase":"x"}`)
		if rec.Code != c.code || !strings.Contains(rec.Body.String(), c.body) {
			t.Errorf("%v: %d %s", c.err, rec.Code, rec.Body)
		}
	}
}
