package fortress

import (
	"context"
	"errors"
	"os"
	"path/filepath"
	"runtime"
	"testing"
	"time"

	kitfortress "github.com/junkerderprovinz/parleyport/kit/fortress"
	"github.com/junkerderprovinz/parleyport/kit/group"
	"github.com/junkerderprovinz/parleyport/kit/member"

	"github.com/junkerderprovinz/towertorch/internal/maint"
)

// shiplog opens a ShipLog in v's fortress, on the phrase v has now.
func shiplog(t *testing.T, v *vault) {
	t.Helper()
	ident, err := member.NewIdentity(member.KindInstance)
	if err != nil {
		t.Fatal(err)
	}
	f, err := kitfortress.Open(kitfortress.Config{
		App: kitfortress.App{ID: "shiplog", Name: "ShipLog", Version: "1.0.0"}, Secret: v.phrase(), Identity: ident,
		Self: group.Self{Name: "Basement", Deployment: "plugin"}, Relay: group.RelayOwn, RelayURL: v.url, Store: &memStore{},
	})
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { _ = f.Close() })
}

func listed(d *Door, app string) bool {
	for _, m := range d.Members() {
		if m.App.ID == app {
			return true
		}
	}
	return false
}

func TestRemovingAMemberTakesItOutAndKeepsItsName(t *testing.T) {
	v, d := inFortress(t, func() ([]byte, error) { return nil, nil })
	if err := d.Remove(v.id.ID()); err != nil {
		t.Fatal(err)
	}
	if listed(d, "bombvault") {
		t.Error("BombVault is still a member after removing it")
	}
	want := []Removal{{App: "bombvault", Name: "BombVault", Device: "Tower"}}
	if got := d.RemovedMembers(); len(got) != 1 || got[0] != want[0] {
		t.Errorf("removed = %+v, want %+v", got, want)
	}
	info, err := os.Stat(filepath.Join(d.Dir, removedFile))
	if err != nil {
		t.Fatal(err)
	}
	if runtime.GOOS != "windows" && info.Mode().Perm() != 0o600 {
		t.Errorf("the removed list is %v, want readable by its owner alone", info.Mode().Perm())
	}
}

func TestRemovingSomebodyWhoIsNoMemberIsAClearError(t *testing.T) {
	_, d := inFortress(t, func() ([]byte, error) { return nil, nil })
	if err := d.Remove("nobody"); !errors.Is(err, ErrNoMember) {
		t.Errorf("remove nobody = %v, want ErrNoMember", err)
	}
	if got := d.RemovedMembers(); len(got) != 0 {
		t.Errorf("removed = %+v after removing nobody", got)
	}
	out := &Door{Dir: filepath.Join(t.TempDir(), "fortress"), App: towertorch}
	if err := out.Remove("x"); !errors.Is(err, ErrNotMember) {
		t.Errorf("remove outside a fortress = %v, want ErrNotMember", err)
	}
}

func TestARemovedMemberStaysNamedAndRefusedAfterARestart(t *testing.T) {
	v, d := inFortress(t, func() ([]byte, error) { return nil, nil })
	self := memberID(t, d.Dir)
	// BombVault is away and never hears of its removal.
	if err := v.f.Close(); err != nil {
		t.Fatal(err)
	}
	if err := d.Remove(v.id.ID()); err != nil {
		t.Fatal(err)
	}
	if err := d.Close(); err != nil {
		t.Fatal(err)
	}
	again := &Door{Dir: d.Dir, App: towertorch, Device: "Tower", Relay: v.url}
	t.Cleanup(func() { _ = again.Close() })
	if err := again.Open(); err != nil {
		t.Fatal(err)
	}
	v.open(v.phrase(), nil)
	waitFor(t, "BombVault to see TowerTorch on the relay", func() bool { return online(v.f, "towertorch") })

	if got := again.RemovedMembers(); len(got) != 1 || got[0].App != "bombvault" {
		t.Errorf("removed after a restart = %+v", got)
	}
	deadline := time.Now().Add(2 * time.Second)
	for time.Now().Before(deadline) {
		ctx, cancel := context.WithTimeout(context.Background(), time.Second)
		_, err := v.f.Status(ctx, self, "")
		cancel()
		if err == nil {
			t.Fatal("TowerTorch answers a member it removed before the restart")
		}
		if listed(again, "bombvault") {
			t.Fatal("BombVault is back among the members after a restart")
		}
		time.Sleep(100 * time.Millisecond)
	}
}

func TestFollowingANewPhraseClosesTheWayBackAndClearsTheList(t *testing.T) {
	v, d := inFortress(t, func() ([]byte, error) { return []byte(`{"ok":true}`), nil })
	shiplog(t, v)
	waitFor(t, "TowerTorch to see ShipLog", func() bool { return listed(d, "shiplog") })
	var gone string
	for _, m := range d.Members() {
		if m.App.ID == "shiplog" {
			gone = m.ID
		}
	}
	if err := d.Remove(gone); err != nil {
		t.Fatal(err)
	}
	old := v.phrase()
	if err := d.Close(); err != nil {
		t.Fatal(err)
	}
	if _, err := v.f.ChangePhrase(context.Background()); err != nil {
		t.Fatal(err)
	}
	if err := v.f.Close(); err != nil {
		t.Fatal(err)
	}
	v.open(v.phrase(), old)
	if err := d.Open(); err != nil {
		t.Fatal(err)
	}
	if len(d.RemovedMembers()) != 1 {
		t.Fatal("the list went before the phrase changed")
	}
	waitFor(t, "TowerTorch to reach BombVault on the old phrase", func() bool { return online(d.current(), "bombvault") })
	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer cancel()
	if _, err := d.Act(ctx, v.id.ID(), maint.BackupAction, nil); err != nil {
		t.Fatal(err)
	}
	if got := d.RemovedMembers(); len(got) != 0 {
		t.Errorf("removed = %+v after the new phrase", got)
	}
}

func TestTheNewWordsClearTheList(t *testing.T) {
	v, d := inFortress(t, func() ([]byte, error) { return nil, nil })
	if err := d.Remove(v.id.ID()); err != nil {
		t.Fatal(err)
	}
	d.mu.Lock()
	d.phraseChanged = true
	d.mu.Unlock()
	if err := d.Enter(words(t)); err != nil {
		t.Fatal(err)
	}
	if got := d.RemovedMembers(); len(got) != 0 {
		t.Errorf("removed = %+v after the new words", got)
	}
}
