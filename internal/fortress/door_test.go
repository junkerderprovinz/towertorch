package fortress

import (
	"errors"
	"net/http/httptest"
	"os"
	"path/filepath"
	"slices"
	"sync"
	"testing"
	"time"

	kitfortress "github.com/junkerderprovinz/parleyport/kit/fortress"
	"github.com/junkerderprovinz/parleyport/kit/group"
	"github.com/junkerderprovinz/parleyport/kit/member"
	"github.com/junkerderprovinz/parleyport/kit/phrase"
	"github.com/junkerderprovinz/parleyport/kit/relay"

	"github.com/junkerderprovinz/towertorch/internal/maint"
)

func words(t *testing.T) string {
	t.Helper()
	_, w, err := phrase.New()
	if err != nil {
		t.Fatal(err)
	}
	return w
}

func TestThePhraseLetsTowerTorchIn(t *testing.T) {
	dir := filepath.Join(t.TempDir(), "fortress")
	var got *Membership
	d := &Door{Dir: dir, App: towertorch, Device: "Tower", Relay: "off", Changed: func(m *Membership) { got = m }}
	if err := d.Enter(words(t)); err != nil {
		t.Fatal(err)
	}
	if got == nil || got.Device != "Tower" {
		t.Fatalf("membership = %+v", got)
	}
	defer func() { _ = got.Close() }()
	cfg, err := config(dir, towertorch, nil)
	if err != nil || !slices.Contains(cfg.Uses, maint.UpdateAction) || cfg.Self.Name != "Tower" {
		t.Errorf("kept membership = %+v, %v", cfg, err)
	}
}

func TestAMistypedPhraseKeepsNothing(t *testing.T) {
	dir := filepath.Join(t.TempDir(), "fortress")
	d := &Door{Dir: dir, App: towertorch, Device: "Tower", Relay: "off", Changed: func(*Membership) { t.Error("opened") }}
	err := d.Enter("abandon abandon abandon")
	if !errors.Is(err, ErrPhrase) {
		t.Errorf("err = %v", err)
	}
	if _, err := os.Stat(dir); !errors.Is(err, os.ErrNotExist) {
		t.Errorf("something was kept: %v", err)
	}
}

func TestAMemberDoesNotJoinTwice(t *testing.T) {
	dir := filepath.Join(t.TempDir(), "fortress")
	var m *Membership
	d := &Door{Dir: dir, App: towertorch, Device: "Tower", Relay: "off", Changed: func(x *Membership) { m = x }}
	if err := d.Enter(words(t)); err != nil {
		t.Fatal(err)
	}
	defer func() { _ = m.Close() }()
	if err := d.Enter(words(t)); !errors.Is(err, ErrMember) {
		t.Errorf("second join: %v", err)
	}
}

func TestLeavingForgetsTheFortressAndThePhraseLetsItBackIn(t *testing.T) {
	dir := filepath.Join(t.TempDir(), "fortress")
	var got []*Membership
	d := &Door{Dir: dir, App: towertorch, Device: "Tower", Relay: "off", Changed: func(m *Membership) { got = append(got, m) }}
	if err := d.Enter(words(t)); err != nil {
		t.Fatal(err)
	}
	if err := d.Leave(); err != nil {
		t.Fatal(err)
	}
	if len(got) != 2 || got[1] != nil {
		t.Fatalf("changes = %v", got)
	}
	if _, err := os.Stat(dir); !errors.Is(err, os.ErrNotExist) {
		t.Errorf("leaving kept %s: %v", dir, err)
	}
	if err := d.Leave(); !errors.Is(err, ErrNotMember) {
		t.Errorf("leaving twice: %v", err)
	}
	if err := d.Enter(words(t)); err != nil {
		t.Errorf("joining again: %v", err)
	}
	_ = d.Close()
}

func TestTheDoorOpensAKeptMembership(t *testing.T) {
	dir := t.TempDir()
	joined(t, dir, false)
	var got *Membership
	d := &Door{Dir: dir, App: towertorch, Changed: func(m *Membership) { got = m }}
	if err := d.Open(); err != nil || got == nil || got.Device != "Tower" {
		t.Fatalf("open = %v, %+v", err, got)
	}
	_ = d.Close()
}

func TestRemovedByAnotherMemberTowerTorchForgetsTheFortress(t *testing.T) {
	srv := httptest.NewServer(relay.New())
	t.Cleanup(srv.CloseClientConnections)
	t.Cleanup(srv.Close)
	secret, w, err := phrase.New()
	if err != nil {
		t.Fatal(err)
	}
	ident, err := member.NewIdentity(member.KindInstance)
	if err != nil {
		t.Fatal(err)
	}
	vault, err := kitfortress.Open(kitfortress.Config{
		App: kitfortress.App{ID: "bombvault", Name: "BombVault", Version: "1.0.0"}, Secret: secret, Identity: ident,
		Self: group.Self{Name: "Tower", Deployment: "container"}, Relay: group.RelayOwn, RelayURL: srv.URL, Store: &memStore{},
	})
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { _ = vault.Close() })

	dir := filepath.Join(t.TempDir(), "fortress")
	var mu sync.Mutex
	var got []*Membership
	d := &Door{Dir: dir, App: towertorch, Device: "Tower", Relay: srv.URL, Changed: func(m *Membership) {
		mu.Lock()
		defer mu.Unlock()
		got = append(got, m)
	}}
	t.Cleanup(func() { _ = d.Close() })
	if err := d.Enter(w); err != nil {
		t.Fatal(err)
	}
	var self string
	waitFor(t, "BombVault to see TowerTorch", func() bool {
		for _, m := range vault.Members() {
			if m.App.ID == "towertorch" {
				self = m.ID
				return true
			}
		}
		return false
	})
	if err := vault.Remove(self); err != nil {
		t.Fatal(err)
	}
	waitFor(t, "TowerTorch to leave", d.Removed)
	mu.Lock()
	last := got[len(got)-1]
	mu.Unlock()
	if last != nil {
		t.Error("the plan still has the fortress of a removed TowerTorch")
	}
	if _, err := os.Stat(dir); !errors.Is(err, os.ErrNotExist) {
		t.Errorf("a removed TowerTorch kept %s: %v", dir, err)
	}
	if err := d.Enter(w); err != nil {
		t.Fatalf("joining again: %v", err)
	}
	if d.Removed() {
		t.Error("joining again still says TowerTorch was removed")
	}
}

type memStore struct {
	mu  sync.Mutex
	raw []byte
}

func (m *memStore) Load() ([]byte, error) {
	m.mu.Lock()
	defer m.mu.Unlock()
	return slices.Clone(m.raw), nil
}

func (m *memStore) Save(raw []byte) error {
	m.mu.Lock()
	defer m.mu.Unlock()
	m.raw = slices.Clone(raw)
	return nil
}

func waitFor(t *testing.T, what string, cond func() bool) {
	t.Helper()
	deadline := time.Now().Add(20 * time.Second)
	for time.Now().Before(deadline) {
		if cond() {
			return
		}
		time.Sleep(25 * time.Millisecond)
	}
	t.Fatalf("timed out waiting for %s", what)
}
