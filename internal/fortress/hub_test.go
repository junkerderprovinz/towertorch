package fortress

import (
	"context"
	"encoding/json"
	"errors"
	"slices"
	"testing"

	kitfortress "github.com/junkerderprovinz/parleyport/kit/fortress"
	"github.com/junkerderprovinz/parleyport/kit/member"
)

type hubFortress struct {
	members []kitfortress.Member
	answer  map[string]error
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
	return []byte(`{"taken":true}`), nil
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
	if !(Hub{Fortress: f}).Hand(context.Background(), "Start failed", "plex: exited", "alert") {
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
}

func TestWithoutATollRollThatTakesItTheAlertStaysWithTowerTorch(t *testing.T) {
	for name, f := range map[string]*hubFortress{
		"no tollroll":    {},
		"the hub is off": {members: []kitfortress.Member{tollroll("a1", true)}, answer: map[string]error{"a1": &kitfortress.Refusal{Status: 409, Code: "hub_off"}}},
		"permission off": {members: []kitfortress.Member{tollroll("a1", true)}, answer: map[string]error{"a1": kitfortress.ErrPermissionOff}},
		"away mid call":  {members: []kitfortress.Member{tollroll("a1", true)}, answer: map[string]error{"a1": errors.New("unreachable")}},
		"only one away":  {members: []kitfortress.Member{tollroll("a1", false)}},
	} {
		if (Hub{Fortress: f}).Hand(context.Background(), "x", "y", "normal") {
			t.Errorf("%s: taken", name)
		}
	}
	if (Hub{}).Hand(context.Background(), "x", "y", "normal") {
		t.Error("taken without a fortress")
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
