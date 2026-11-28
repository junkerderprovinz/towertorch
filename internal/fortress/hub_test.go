package fortress

import (
	"context"
	"encoding/json"
	"errors"
	"slices"
	"testing"

	kitfortress "github.com/junkerderprovinz/parleyport/kit/fortress"
	"github.com/junkerderprovinz/parleyport/kit/member"
	"github.com/junkerderprovinz/parleyport/kit/notify"
	"github.com/junkerderprovinz/parleyport/kit/status"
)

type hubFortress struct {
	members []kitfortress.Member
	answer  map[string]error
	reply   map[string]string
	reports map[string]status.Report
	calls   []string
	body    []byte
}

func (f *hubFortress) Members() []kitfortress.Member { return f.members }

func (f *hubFortress) Act(_ context.Context, id, action string, body []byte) ([]byte, error) {
	f.calls = append(f.calls, id+" "+action)
	f.body = body
	if err := f.answer[id]; err != nil {
		return nil, err
	}
	if r, ok := f.reply[id]; ok {
		return []byte(r), nil
	}
	return []byte(`{"taken":true}`), nil
}

func (f *hubFortress) Status(_ context.Context, id, _ string) (status.Report, error) {
	r, ok := f.reports[id]
	if !ok {
		return status.Report{}, errors.New("unreachable")
	}
	return r, nil
}

func tollroll(id string, online bool) kitfortress.Member {
	return kitfortress.Member{ID: id, Kind: member.KindInstance, App: kitfortress.App{ID: "tollroll"}, Direct: online, Actions: []string{DeliverAction}}
}

func TestAnAlertGoesToTheFirstTollRollThatTakesIt(t *testing.T) {
	f := &hubFortress{
		members: []kitfortress.Member{
			tollroll("b2", true),
			tollroll("a1", true),
			tollroll("c3", false),
			{ID: "d4", Kind: member.KindInstance, App: kitfortress.App{ID: "bombvault"}, Direct: true, Actions: []string{DeliverAction}},
			{ID: "e5", Kind: member.KindInstance, App: kitfortress.App{ID: "tollroll"}, Direct: true},
		},
		answer: map[string]error{"a1": &kitfortress.Refusal{Status: 409, Code: "hub_off"}},
	}
	e := notify.Event{Kind: "towertorch.alert", Severity: notify.SeverityCritical, Title: "Start failed", Body: "plex: exited"}
	if !(Hub{Fortress: f}).Hand(context.Background(), e) {
		t.Fatal("not taken")
	}
	if want := []string{"a1 " + DeliverAction, "b2 " + DeliverAction}; !slices.Equal(f.calls, want) {
		t.Errorf("calls %q, want %q", f.calls, want)
	}
	var d map[string]any
	if err := json.Unmarshal(f.body, &d); err != nil {
		t.Fatal(err)
	}
	if d["kind"] != "towertorch.alert" || d["severity"] != "critical" || d["title"] != "Start failed" || d["body"] != "plex: exited" {
		t.Errorf("%v", d)
	}
	if _, ok := d["recovery"]; ok {
		t.Errorf("a problem was sent as its end: %v", d)
	}
}

func TestTheEndOfAProblemReachesTollRollAsARecoveryUnderItsKey(t *testing.T) {
	f := &hubFortress{members: []kitfortress.Member{tollroll("a1", true)}}
	e := notify.Event{Kind: "towertorch.alert", Severity: notify.SeveritySuccess, Recovery: true, Key: "watchdog/plex", Title: "Watchdog: plex is running again"}
	if !(Hub{Fortress: f}).Hand(context.Background(), e) {
		t.Fatal("not taken")
	}
	var d map[string]any
	if err := json.Unmarshal(f.body, &d); err != nil {
		t.Fatal(err)
	}
	if d["recovery"] != true || d["key"] != "watchdog/plex" || d["severity"] != "success" {
		t.Errorf("%v", d)
	}
}

func TestWithoutATollRollThatTakesItTheAlertStaysWithTowerTorch(t *testing.T) {
	for name, f := range map[string]*hubFortress{
		"no tollroll":    {},
		"the hub is off": {members: []kitfortress.Member{tollroll("a1", true)}, answer: map[string]error{"a1": &kitfortress.Refusal{Status: 409, Code: "hub_off"}}},
		"permission off": {members: []kitfortress.Member{tollroll("a1", true)}, answer: map[string]error{"a1": kitfortress.ErrPermissionOff}},
		"away mid call":  {members: []kitfortress.Member{tollroll("a1", true)}, answer: map[string]error{"a1": errors.New("unreachable")}},
		"only one away":  {members: []kitfortress.Member{tollroll("a1", false)}},
		"no word taken":  {members: []kitfortress.Member{tollroll("a1", true)}, reply: map[string]string{"a1": `{}`}},
		"not an answer":  {members: []kitfortress.Member{tollroll("a1", true)}, reply: map[string]string{"a1": `taken`}},
	} {
		if (Hub{Fortress: f}).Hand(context.Background(), notify.Event{Kind: "towertorch.alert", Title: "x"}) {
			t.Errorf("%s: taken", name)
		}
	}
}

func TestTheHubCountsAsActiveWhileATollRollReportsIt(t *testing.T) {
	hub := status.Report{Capabilities: []string{HubCapability}}
	for name, c := range map[string]struct {
		f    *hubFortress
		want bool
	}{
		"takes over":       {&hubFortress{members: []kitfortress.Member{tollroll("a1", true)}, reports: map[string]status.Report{"a1": hub}}, true},
		"second one does":  {&hubFortress{members: []kitfortress.Member{tollroll("a1", true), tollroll("b2", true)}, reports: map[string]status.Report{"b2": hub}}, true},
		"switch off there": {&hubFortress{members: []kitfortress.Member{tollroll("a1", true)}, reports: map[string]status.Report{"a1": {}}}, false},
		"away":             {&hubFortress{members: []kitfortress.Member{tollroll("a1", false)}, reports: map[string]status.Report{"a1": hub}}, false},
		"not tollroll": {&hubFortress{
			members: []kitfortress.Member{{ID: "d4", Kind: member.KindInstance, App: kitfortress.App{ID: "shiplog"}, Direct: true, Actions: []string{DeliverAction}}},
			reports: map[string]status.Report{"d4": hub},
		}, false},
		"no tollroll": {&hubFortress{}, false},
	} {
		if got := (Hub{Fortress: c.f}).Active(context.Background()); got != c.want {
			t.Errorf("%s: active %v, want %v", name, got, c.want)
		}
	}
}

func TestTowerTorchUsesTheHubsAction(t *testing.T) {
	dir := t.TempDir()
	joined(t, dir, false)
	cfg, err := config(dir, towertorch, "", nil)
	if err != nil {
		t.Fatal(err)
	}
	if !slices.Contains(cfg.Uses, DeliverAction) {
		t.Errorf("uses %v", cfg.Uses)
	}
}
