package fortress

import (
	"context"
	"errors"
	"net/http/httptest"
	"os"
	"path/filepath"
	"slices"
	"sync"
	"testing"
	"time"

	"github.com/junkerderprovinz/parleyport/kit/member"
	"github.com/junkerderprovinz/parleyport/kit/phrase"
	"github.com/junkerderprovinz/parleyport/kit/relay"
	"github.com/junkerderprovinz/parleyport/kit/status"

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
	app := towertorch
	app.Icon = testIcon(t)
	cfg, err := config(dir, app, "tower", nil)
	if err != nil || !slices.Contains(cfg.Uses, maint.UpdateAction) || cfg.Self.Name != "Tower" || cfg.Host != "tower" || cfg.App.Icon != app.Icon {
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

func TestRemovedByAnotherMemberTowerTorchForgetsTheFortressAndSaysSoAfterARestart(t *testing.T) {
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
	v := &vault{t: t, url: srv.URL, id: ident, store: &memStore{}, secret: secret}
	v.open(secret, nil)

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
		for _, m := range v.f.Members() {
			if m.App.ID == "towertorch" {
				self = m.ID
				return true
			}
		}
		return false
	})
	if err := v.f.Remove(self); err != nil {
		t.Fatal(err)
	}
	waitFor(t, "TowerTorch to leave", d.Removed)
	mu.Lock()
	last := got[len(got)-1]
	mu.Unlock()
	if last != nil {
		t.Error("the plan still has the fortress of a removed TowerTorch")
	}
	if _, err := os.Stat(filepath.Join(dir, "fortress.json")); !errors.Is(err, os.ErrNotExist) {
		t.Errorf("a removed TowerTorch kept its membership: %v", err)
	}
	if err := d.Close(); err != nil {
		t.Fatal(err)
	}
	again := &Door{Dir: dir, App: towertorch, Device: "Tower", Relay: srv.URL}
	t.Cleanup(func() { _ = again.Close() })
	if err := again.Open(); err != nil {
		t.Fatal(err)
	}
	if !again.Removed() {
		t.Error("after a restart TowerTorch no longer says it was removed")
	}
	if err := again.Enter(w); !errors.Is(err, ErrShutOut) {
		t.Fatalf("joining again on the old phrase = %v, want ErrShutOut", err)
	}
	if _, in := again.Joined(); in || !again.Removed() {
		t.Error("turned away on the old phrase, TowerTorch forgets that it was removed")
	}
	if _, err := v.f.ChangePhrase(context.Background()); err != nil {
		t.Fatal(err)
	}
	if err := v.f.Close(); err != nil {
		t.Fatal(err)
	}
	v.open(v.phrase(), secret)
	fresh, err := phrase.Encode(v.phrase())
	if err != nil {
		t.Fatal(err)
	}
	if err := again.Enter(fresh); err != nil {
		t.Fatalf("joining again on the new phrase: %v", err)
	}
	if again.Removed() {
		t.Error("joining again still says TowerTorch was removed")
	}
	if err := again.Close(); err != nil {
		t.Fatal(err)
	}
	restarted := &Door{Dir: dir, App: towertorch, Device: "Tower", Relay: srv.URL}
	t.Cleanup(func() { _ = restarted.Close() })
	if err := restarted.Open(); err != nil {
		t.Fatal(err)
	}
	if restarted.Removed() {
		t.Error("a restart after joining again says TowerTorch was removed")
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

func testIcon(t *testing.T) string {
	t.Helper()
	icon, err := status.IconFromSVG([]byte(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 8 8"><circle cx="4" cy="4" r="3"/></svg>`))
	if err != nil {
		t.Fatal(err)
	}
	return icon
}
