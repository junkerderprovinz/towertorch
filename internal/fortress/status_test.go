package fortress

import (
	"context"
	"errors"
	"path/filepath"
	"strconv"
	"testing"
	"time"

	kitfortress "github.com/junkerderprovinz/parleyport/kit/fortress"
	"github.com/junkerderprovinz/parleyport/kit/group"
	"github.com/junkerderprovinz/parleyport/kit/member"
	"github.com/junkerderprovinz/parleyport/kit/status"

	"github.com/junkerderprovinz/towertorch/internal/model"
)

// reporter opens a ShipLog plugin in v's fortress that answers the status
// contract from b, and returns its member id.
func reporter(t *testing.T, v *vault, b *Board) string {
	t.Helper()
	ident, err := member.NewIdentity(member.KindInstance)
	if err != nil {
		t.Fatal(err)
	}
	f, err := kitfortress.Open(kitfortress.Config{
		App: kitfortress.App{ID: "shiplog", Name: "ShipLog", Version: "1.0.0"}, Secret: v.phrase(), Identity: ident,
		Self: group.Self{Name: "Basement", Deployment: "plugin"}, Relay: group.RelayOwn, RelayURL: v.url, Store: &memStore{}, Status: b,
	})
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { _ = f.Close() })
	return ident.ID()
}

func TestTheDoorSaysWhetherAndAsWhatTowerTorchIsIn(t *testing.T) {
	out := &Door{Dir: filepath.Join(t.TempDir(), "fortress"), App: towertorch}
	if device, in := out.Joined(); in || device != "" {
		t.Errorf("outside a fortress joined = %q, %v", device, in)
	}
	_, d := inFortress(t, func() ([]byte, error) { return nil, nil })
	if device, in := d.Joined(); !in || device != "Tower" {
		t.Errorf("joined = %q, %v, want Tower", device, in)
	}
}

func TestAMemberStatusAndItsNewestLogLinesComeFromTheMember(t *testing.T) {
	v, d := inFortress(t, func() ([]byte, error) { return nil, nil })
	now := time.Date(2026, 11, 9, 10, 0, 0, 0, time.UTC)
	b := &Board{App: status.App{ID: "shiplog", Name: "ShipLog", Version: "1.0.0"}, Now: func() time.Time { return now }}
	// More lines than one page of the contract holds.
	for i := range status.MaxLogLimit + 50 {
		now = now.Add(time.Minute)
		b.RunFinished(model.RunResult{Nodes: []model.NodeResult{{Name: "c" + strconv.Itoa(i), State: model.StateReady}}})
	}
	id := reporter(t, v, b)
	waitFor(t, "TowerTorch to reach ShipLog", func() bool { return online(d.current(), "shiplog") })

	ctx, cancel := context.WithTimeout(context.Background(), 20*time.Second)
	defer cancel()
	r, err := d.Status(ctx, id, "de")
	if err != nil {
		t.Fatal(err)
	}
	if r.App.ID != "shiplog" || r.State != status.StateOK {
		t.Errorf("report = %+v", r)
	}
	log, err := d.Log(ctx, id, "de", 10)
	if err != nil {
		t.Fatal(err)
	}
	if len(log) != 10 {
		t.Fatalf("log = %d lines, want 10", len(log))
	}
	if !log[0].At.Equal(now) || !log[0].At.After(log[9].At) {
		t.Errorf("log runs from %v to %v, want the newest first, ending at %v", log[0].At, log[9].At, now)
	}
	en, err := d.Log(ctx, id, "en", 1)
	if err != nil || len(en) != 1 || en[0].ID != log[0].ID || en[0].Text == log[0].Text {
		t.Errorf("the same line in English = %+v, %v, in German %q", en, err, log[0].Text)
	}
}

func TestReadingSomebodyWhoIsNoMemberIsAClearError(t *testing.T) {
	_, d := inFortress(t, func() ([]byte, error) { return nil, nil })
	if _, err := d.Status(context.Background(), "nobody", ""); !errors.Is(err, ErrNoMember) {
		t.Errorf("status of nobody = %v, want ErrNoMember", err)
	}
	if _, err := d.Log(context.Background(), "nobody", "", 10); !errors.Is(err, ErrNoMember) {
		t.Errorf("log of nobody = %v, want ErrNoMember", err)
	}
	out := &Door{Dir: filepath.Join(t.TempDir(), "fortress"), App: towertorch}
	if _, err := out.Status(context.Background(), "x", ""); !errors.Is(err, ErrNotMember) {
		t.Errorf("status outside a fortress = %v, want ErrNotMember", err)
	}
	if _, err := out.Log(context.Background(), "x", "", 10); !errors.Is(err, ErrNotMember) {
		t.Errorf("log outside a fortress = %v, want ErrNotMember", err)
	}
}
