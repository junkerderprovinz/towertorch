package fortress

import (
	"errors"
	"os"
	"path/filepath"
	"slices"
	"testing"

	"github.com/junkerderprovinz/parleyport/kit/phrase"

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
	d := &Door{Dir: dir, App: towertorch, Device: "Tower", Relay: "off", Opened: func(m *Membership) { got = m }}
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
	d := &Door{Dir: dir, App: towertorch, Device: "Tower", Relay: "off", Opened: func(*Membership) { t.Error("opened") }}
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
	d := &Door{Dir: dir, App: towertorch, Device: "Tower", Relay: "off", Opened: func(x *Membership) { m = x }}
	if err := d.Enter(words(t)); err != nil {
		t.Fatal(err)
	}
	defer func() { _ = m.Close() }()
	if err := d.Enter(words(t)); !errors.Is(err, ErrMember) {
		t.Errorf("second join: %v", err)
	}
}
