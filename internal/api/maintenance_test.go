package api

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	kitfortress "github.com/junkerderprovinz/parleyport/kit/fortress"
	"github.com/junkerderprovinz/parleyport/kit/member"

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
	words    string
	err      error
	left     bool
	removed  bool
	changed  bool
	members  []kitfortress.Member
	removals []fortress.Removal
	took     string
}

func (d *fakeDoor) Members() []kitfortress.Member { return d.members }

func (d *fakeDoor) RemovedMembers() []fortress.Removal { return d.removals }

func (d *fakeDoor) Remove(id string) error {
	d.took = id
	return d.err
}

func (d *fakeDoor) Removed() bool { return d.removed }

func (d *fakeDoor) PhraseChanged() bool { return d.changed }

func (d *fakeDoor) Leave() error {
	d.left = true
	return d.err
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

func TestLeavingAsksTheDoor(t *testing.T) {
	d := &fakeDoor{}
	s := &Server{Store: &memStore{}, Door: d}
	if rec := call(s, http.MethodPost, "/api/fortress/leave", ""); rec.Code != http.StatusOK || !d.left {
		t.Errorf("leave = %d %s", rec.Code, rec.Body)
	}
	s.Door = &fakeDoor{err: fortress.ErrNotMember}
	if rec := call(s, http.MethodPost, "/api/fortress/leave", ""); rec.Code != http.StatusConflict || !strings.Contains(rec.Body.String(), `"error":"notMember"`) {
		t.Errorf("leave outside = %d %s", rec.Code, rec.Body)
	}
}

func TestThePanelHearsThatTowerTorchWasTakenOut(t *testing.T) {
	s := &Server{Store: &memStore{}, Maintenance: &fakeMaintenance{}, Door: &fakeDoor{removed: true}}
	rec := call(s, http.MethodGet, "/api/maintenance", "")
	var o maint.Overview
	if err := json.Unmarshal(rec.Body.Bytes(), &o); err != nil {
		t.Fatal(err)
	}
	if !o.Ready.Removed || o.Ready.Fortress {
		t.Errorf("ready = %+v, want removed and out of the fortress", o.Ready)
	}
}

func TestThePanelHearsThatThePhraseChanged(t *testing.T) {
	s := &Server{Store: &memStore{}, Maintenance: &fakeMaintenance{}, Door: &fakeDoor{changed: true}}
	rec := call(s, http.MethodGet, "/api/maintenance", "")
	var o maint.Overview
	if err := json.Unmarshal(rec.Body.Bytes(), &o); err != nil {
		t.Fatal(err)
	}
	if !o.Ready.PhraseChanged {
		t.Errorf("ready = %+v, want the phrase changed", o.Ready)
	}
}

func TestRemovingAMemberAsksTheDoor(t *testing.T) {
	d := &fakeDoor{}
	s := &Server{Store: &memStore{}, Door: d}
	if rec := call(s, http.MethodPost, "/api/fortress/remove", `{"id":"i-bv"}`); rec.Code != http.StatusOK || d.took != "i-bv" {
		t.Errorf("remove = %d %s, took %q", rec.Code, rec.Body, d.took)
	}
}

func TestARemovalThatFailsSaysWhyWithACode(t *testing.T) {
	for _, c := range []struct {
		err  error
		body string
		code int
		want string
	}{
		{fortress.ErrNoMember, `{"id":"x"}`, http.StatusNotFound, `"error":"noMember"`},
		{fortress.ErrNotMember, `{"id":"x"}`, http.StatusConflict, `"error":"notMember"`},
		{nil, `{"id":""}`, http.StatusBadRequest, `"error":"noMember"`},
		{nil, `not json`, http.StatusBadRequest, `"error":"noMember"`},
	} {
		d := &fakeDoor{err: c.err}
		s := &Server{Store: &memStore{}, Door: d}
		rec := call(s, http.MethodPost, "/api/fortress/remove", c.body)
		if rec.Code != c.code || !strings.Contains(rec.Body.String(), c.want) {
			t.Errorf("%v %s: %d %s", c.err, c.body, rec.Code, rec.Body)
		}
	}
}

func TestThePanelListsTheOtherMembersAndThoseRemoved(t *testing.T) {
	d := &fakeDoor{
		members: []kitfortress.Member{{
			ID: "i-bv", Kind: member.KindInstance, App: kitfortress.App{ID: "bombvault", Name: "BombVault"},
			Device: "Bottich", Deployment: "container", Address: "http://192.168.10.10:8484", Relay: true,
		}},
		removals: []fortress.Removal{{App: "tollroll", Name: "TollRoll", Device: "Bottich"}},
	}
	s := &Server{Store: &memStore{}, Maintenance: &fakeMaintenance{}, Door: d}
	rec := call(s, http.MethodGet, "/api/maintenance", "")
	var o struct {
		Fortress struct {
			Members []map[string]any   `json:"members"`
			Removed []fortress.Removal `json:"removed"`
		} `json:"fortress"`
	}
	if err := json.Unmarshal(rec.Body.Bytes(), &o); err != nil {
		t.Fatal(err)
	}
	if len(o.Fortress.Members) != 1 {
		t.Fatalf("members = %s", rec.Body)
	}
	m := o.Fortress.Members[0]
	for k, want := range map[string]any{"id": "i-bv", "app": "bombvault", "name": "BombVault", "device": "Bottich", "kind": "instance", "deployment": "container", "online": true} {
		if m[k] != want {
			t.Errorf("member %s = %v, want %v", k, m[k], want)
		}
	}
	if strings.Contains(rec.Body.String(), "address") || strings.Contains(rec.Body.String(), "192.168.10.10") {
		t.Errorf("the panel gets a member's address: %s", rec.Body)
	}
	if len(o.Fortress.Removed) != 1 || o.Fortress.Removed[0].Name != "TollRoll" {
		t.Errorf("removed = %+v", o.Fortress.Removed)
	}
}

func TestOutsideAFortressThePanelListsNobody(t *testing.T) {
	s := &Server{Store: &memStore{}, Maintenance: &fakeMaintenance{}, Door: &fakeDoor{}}
	rec := call(s, http.MethodGet, "/api/maintenance", "")
	if !strings.Contains(rec.Body.String(), `"fortress":{"members":[],`) {
		t.Errorf("body = %s", rec.Body)
	}
}

func TestAMemberThatNeverSaidItsAppStaysOffTheCard(t *testing.T) {
	d := &fakeDoor{
		members: []kitfortress.Member{
			{ID: "i-fs", Kind: member.KindInstance, Device: "Bottich", Deployment: "plugin"},
			{ID: "i-bv", Kind: member.KindInstance, App: kitfortress.App{ID: "bombvault", Name: "BombVault"}, Device: "Bottich"},
		},
		removals: []fortress.Removal{{Device: "Bottich"}, {App: "tollroll", Name: "TollRoll", Device: "Bottich"}},
	}
	s := &Server{Store: &memStore{}, Maintenance: &fakeMaintenance{}, Door: d}
	rec := call(s, http.MethodGet, "/api/maintenance", "")
	var o struct {
		Fortress struct {
			Members []memberView       `json:"members"`
			Removed []fortress.Removal `json:"removed"`
		} `json:"fortress"`
	}
	if err := json.Unmarshal(rec.Body.Bytes(), &o); err != nil {
		t.Fatal(err)
	}
	if len(o.Fortress.Members) != 1 || o.Fortress.Members[0].ID != "i-bv" {
		t.Errorf("members = %+v, want BombVault alone", o.Fortress.Members)
	}
	if len(o.Fortress.Removed) != 1 || o.Fortress.Removed[0].App != "tollroll" {
		t.Errorf("removed = %+v, want TollRoll alone", o.Fortress.Removed)
	}
}
