package api

import (
	"context"
	"encoding/json"
	"errors"
	"net/http"
	"strings"
	"testing"
	"time"

	kitfortress "github.com/junkerderprovinz/parleyport/kit/fortress"
	"github.com/junkerderprovinz/parleyport/kit/member"
	"github.com/junkerderprovinz/parleyport/kit/status"

	"github.com/junkerderprovinz/towertorch/internal/fortress"
	"github.com/junkerderprovinz/towertorch/internal/maint"
)

type fakeDoor struct {
	words    string
	err      error
	left     bool
	removed  bool
	changed  bool
	device   string
	members  []kitfortress.Member
	removals []fortress.Removal
	took     string
	report   status.Report
	log      []status.LogEntry
	asked    []string
}

func (d *fakeDoor) Joined() (string, bool) { return d.device, d.device != "" }

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
	if d.err == nil {
		d.device = ""
	}
	return d.err
}

func (d *fakeDoor) Enter(words string) error {
	d.words = words
	if d.err == nil {
		d.device = "Tower"
	}
	return d.err
}

func (d *fakeDoor) Status(_ context.Context, id, lang string) (status.Report, error) {
	d.asked = append(d.asked, "status "+id+" "+lang)
	return d.report, d.err
}

func (d *fakeDoor) Log(_ context.Context, id, lang string, n int) ([]status.LogEntry, error) {
	d.asked = append(d.asked, "log "+id+" "+lang)
	return d.log[:min(n, len(d.log))], d.err
}

type cardState struct {
	Joined        bool               `json:"joined"`
	Device        string             `json:"device"`
	RemovedHere   bool               `json:"removedHere"`
	PhraseChanged bool               `json:"phraseChanged"`
	Members       []map[string]any   `json:"members"`
	Removed       []fortress.Removal `json:"removed"`
}

func state(t *testing.T, body []byte) cardState {
	t.Helper()
	var s cardState
	if err := json.Unmarshal(body, &s); err != nil {
		t.Fatalf("state %s: %v", body, err)
	}
	return s
}

func TestTheCardReadsTheFortressOnItsOwn(t *testing.T) {
	seen := time.Date(2026, 11, 12, 21, 30, 0, 0, time.UTC)
	d := &fakeDoor{
		device: "Tower",
		members: []kitfortress.Member{
			{
				ID: "i-bv", Kind: member.KindInstance, App: kitfortress.App{ID: "bombvault", Name: "BombVault", Version: "2.1.0", Icon: "data:image/svg+xml;base64,PHN2Zy8+"},
				Device: "Bottich", Deployment: "container", Address: "http://192.168.10.10:8484", Relay: true,
			},
			{ID: "i-sl", Kind: member.KindInstance, App: kitfortress.App{ID: "shiplog", Name: "ShipLog"}, Device: "Tower", Deployment: "plugin", Direct: true, Relay: true},
			{ID: "i-kl", Kind: member.KindInstance, App: kitfortress.App{ID: "knightloader"}, Device: "Attic", Deployment: "container", LastSeen: seen},
		},
		removals: []fortress.Removal{{App: "tollroll", Name: "TollRoll", Device: "Bottich"}},
	}
	s := &Server{Store: &memStore{}, Door: d}
	rec := call(s, http.MethodGet, "/api/fortress", "")
	if rec.Code != http.StatusOK {
		t.Fatalf("state = %d %s", rec.Code, rec.Body)
	}
	got := state(t, rec.Body.Bytes())
	if !got.Joined || got.Device != "Tower" || got.RemovedHere || got.PhraseChanged || len(got.Members) != 3 {
		t.Fatalf("state = %s", rec.Body)
	}
	bv := got.Members[0]
	for k, want := range map[string]any{
		"id": "i-bv", "app": "bombvault", "name": "BombVault", "device": "Bottich", "form": "container",
		"version": "2.1.0", "icon": "data:image/svg+xml;base64,PHN2Zy8+", "online": true, "relay": true,
	} {
		if bv[k] != want {
			t.Errorf("BombVault %s = %v, want %v", k, bv[k], want)
		}
	}
	if sl := got.Members[1]; sl["form"] != "plugin" || sl["relay"] != false {
		t.Errorf("ShipLog, reached on this network, = %v", sl)
	}
	if kl := got.Members[2]; kl["online"] != false || kl["lastSeen"] != "2026-11-12T21:30:00Z" || kl["name"] != "knightloader" {
		t.Errorf("KnightLoader, away = %v", kl)
	}
	if _, ok := bv["lastSeen"]; ok {
		t.Errorf("a member never away has a last seen time: %v", bv)
	}
	if strings.Contains(rec.Body.String(), "address") || strings.Contains(rec.Body.String(), "192.168.10.10") {
		t.Errorf("the card gets a member's address: %s", rec.Body)
	}
	if len(got.Removed) != 1 || got.Removed[0].Name != "TollRoll" {
		t.Errorf("removed = %+v", got.Removed)
	}
}

func TestTheCardHearsThatTowerTorchWasTakenOutOrLostThePhrase(t *testing.T) {
	s := &Server{Store: &memStore{}, Door: &fakeDoor{removed: true}}
	if got := state(t, call(s, http.MethodGet, "/api/fortress", "").Body.Bytes()); got.Joined || !got.RemovedHere {
		t.Errorf("taken out = %+v", got)
	}
	s.Door = &fakeDoor{device: "Tower", changed: true}
	if got := state(t, call(s, http.MethodGet, "/api/fortress", "").Body.Bytes()); !got.Joined || !got.PhraseChanged {
		t.Errorf("phrase changed = %+v", got)
	}
}

func TestOutsideAFortressTheCardListsNobody(t *testing.T) {
	s := &Server{Store: &memStore{}, Door: &fakeDoor{}}
	rec := call(s, http.MethodGet, "/api/fortress", "")
	if !strings.Contains(rec.Body.String(), `"members":[]`) || !strings.Contains(rec.Body.String(), `"removed":[]`) || !strings.Contains(rec.Body.String(), `"joined":false`) {
		t.Errorf("body = %s", rec.Body)
	}
}

func TestOnlyAppInstancesThatNamedTheirAppAreListed(t *testing.T) {
	d := &fakeDoor{
		device: "Tower",
		members: []kitfortress.Member{
			{ID: "i-fs", Kind: member.KindInstance, Device: "Bottich", Deployment: "plugin"},
			{ID: "viewer-tr", Kind: member.KindViewer, App: kitfortress.App{ID: "tollroll", Name: "TollRoll"}, Device: "Bottich"},
			{ID: "phone-1", Kind: member.KindMobile, Device: "Pixel"},
			{ID: "i-bv", Kind: member.KindInstance, App: kitfortress.App{ID: "bombvault", Name: "BombVault"}, Device: "Bottich"},
		},
		removals: []fortress.Removal{{Device: "Bottich"}, {App: "tollroll", Name: "TollRoll", Device: "Bottich"}},
	}
	s := &Server{Store: &memStore{}, Door: d}
	got := state(t, call(s, http.MethodGet, "/api/fortress", "").Body.Bytes())
	if len(got.Members) != 1 || got.Members[0]["id"] != "i-bv" {
		t.Errorf("members = %+v, want BombVault alone", got.Members)
	}
	if len(got.Removed) != 1 || got.Removed[0].App != "tollroll" {
		t.Errorf("removed = %+v, want TollRoll alone", got.Removed)
	}
}

func TestThePhraseJoinsTheFortressAndAnswersTheNewState(t *testing.T) {
	d := &fakeDoor{}
	s := &Server{Store: &memStore{}, Door: d}
	rec := call(s, http.MethodPost, "/api/fortress/join", `{"phrase":"legal winner thank year wave sausage worth useful legal winner thank yellow"}`)
	if rec.Code != http.StatusOK || !strings.HasPrefix(d.words, "legal winner") {
		t.Fatalf("join = %d %s, words %q", rec.Code, rec.Body, d.words)
	}
	if got := state(t, rec.Body.Bytes()); !got.Joined || got.Device != "Tower" {
		t.Errorf("state after joining = %s", rec.Body)
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

func TestLeavingAsksTheDoorAndAnswersTheNewState(t *testing.T) {
	d := &fakeDoor{device: "Tower"}
	s := &Server{Store: &memStore{}, Door: d}
	rec := call(s, http.MethodPost, "/api/fortress/leave", "")
	if rec.Code != http.StatusOK || !d.left {
		t.Fatalf("leave = %d %s", rec.Code, rec.Body)
	}
	if got := state(t, rec.Body.Bytes()); got.Joined {
		t.Errorf("state after leaving = %s", rec.Body)
	}
	s.Door = &fakeDoor{err: fortress.ErrNotMember}
	if rec := call(s, http.MethodPost, "/api/fortress/leave", ""); rec.Code != http.StatusConflict || !strings.Contains(rec.Body.String(), `"error":"notMember"`) {
		t.Errorf("leave outside = %d %s", rec.Code, rec.Body)
	}
}

func TestRemovingAMemberAsksTheDoorAndAnswersTheNewState(t *testing.T) {
	d := &fakeDoor{device: "Tower", removals: []fortress.Removal{{App: "bombvault", Name: "BombVault", Device: "Bottich"}}}
	s := &Server{Store: &memStore{}, Door: d}
	rec := call(s, http.MethodPost, "/api/fortress/remove", `{"id":"i-bv"}`)
	if rec.Code != http.StatusOK || d.took != "i-bv" {
		t.Fatalf("remove = %d %s, took %q", rec.Code, rec.Body, d.took)
	}
	if got := state(t, rec.Body.Bytes()); !got.Joined || len(got.Removed) != 1 {
		t.Errorf("state after removing = %s", rec.Body)
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

func TestAMemberStatusIsItsReportAndItsNewestLogLines(t *testing.T) {
	at := time.Date(2026, 11, 13, 3, 30, 0, 0, time.UTC)
	lines := make([]status.LogEntry, 12)
	for i := range lines {
		lines[i] = status.LogEntry{ID: string(rune('a' + i)), At: at, Level: status.SeverityInfo, Text: "line"}
	}
	d := &fakeDoor{device: "Tower", report: status.Report{State: status.StateWarning, NeedsYou: []status.Need{{Severity: status.SeverityWarn, Text: "Check the disk"}}}, log: lines}
	s := &Server{Store: &memStore{}, Door: d}
	rec := call(s, http.MethodGet, "/api/fortress/member?id=i-sl&lang=de", "")
	if rec.Code != http.StatusOK {
		t.Fatalf("member = %d %s", rec.Code, rec.Body)
	}
	var got struct {
		Report status.Report     `json:"report"`
		Log    []status.LogEntry `json:"log"`
	}
	if err := json.Unmarshal(rec.Body.Bytes(), &got); err != nil {
		t.Fatal(err)
	}
	if got.Report.State != status.StateWarning || len(got.Report.NeedsYou) != 1 || len(got.Log) != 10 || got.Log[0].ID != "a" {
		t.Errorf("member = %s", rec.Body)
	}
	if strings.Join(d.asked, ",") != "status i-sl de,log i-sl de" {
		t.Errorf("asked %v", d.asked)
	}
}

func TestAMemberStatusThatCannotBeReadSaysWhyWithACode(t *testing.T) {
	for _, c := range []struct {
		err   error
		query string
		code  int
		want  string
	}{
		{fortress.ErrNoMember, "id=x", http.StatusNotFound, `"error":"noMember"`},
		{fortress.ErrNotMember, "id=x", http.StatusConflict, `"error":"notMember"`},
		{errors.New("no answer"), "id=x", http.StatusBadGateway, `"error":"no answer"`},
		{nil, "", http.StatusBadRequest, `"error":"noMember"`},
	} {
		s := &Server{Store: &memStore{}, Door: &fakeDoor{err: c.err}}
		rec := call(s, http.MethodGet, "/api/fortress/member?"+c.query, "")
		if rec.Code != c.code || !strings.Contains(rec.Body.String(), c.want) {
			t.Errorf("%v %q: %d %s", c.err, c.query, rec.Code, rec.Body)
		}
	}
}

func TestWithoutADoorThereIsNoFortressRoute(t *testing.T) {
	s := &Server{Store: &memStore{}}
	for _, path := range []string{"/api/fortress", "/api/fortress/member?id=x"} {
		if rec := call(s, http.MethodGet, path, ""); rec.Code != http.StatusNotFound {
			t.Errorf("%s = %d", path, rec.Code)
		}
	}
}

func TestThePlanHearsThatTowerTorchWasTakenOut(t *testing.T) {
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

func TestThePlanHearsThatThePhraseChanged(t *testing.T) {
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
