package fortress

import (
	"crypto/rand"
	"os"
	"path/filepath"
	"slices"
	"testing"

	kitfortress "github.com/junkerderprovinz/parleyport/kit/fortress"
	"github.com/junkerderprovinz/parleyport/kit/status"

	"github.com/junkerderprovinz/towertorch/internal/maint"
)

// joined lets dir join a fortress the way the plugin does, with the kit's
// fortress join.
func joined(t *testing.T, dir string, lan bool) {
	t.Helper()
	secret := make([]byte, 16)
	_, _ = rand.Read(secret)
	m := kitfortress.Membership{App: "towertorch", Device: "Tower", Relay: "off", LAN: lan}
	if err := kitfortress.Join(dir, secret, m); err != nil {
		t.Fatal(err)
	}
}

var towertorch = status.App{ID: "towertorch", Name: "TowerTorch", Version: "1.5.0"}

func TestWithoutAMembershipTowerTorchIsInNoFortress(t *testing.T) {
	for _, dir := range []string{"", t.TempDir()} {
		m, err := Join(dir, towertorch, "", nil, nil)
		if err != nil || m != nil {
			t.Fatalf("Join(%q) = %v, %v, want no fortress", dir, m, err)
		}
	}
}

func TestJoinTakesPartWithTheKeptMembership(t *testing.T) {
	dir := t.TempDir()
	joined(t, dir, false)
	m, err := Join(dir, towertorch, "", &Board{}, nil)
	if err != nil || m == nil {
		t.Fatalf("Join = %v, %v", m, err)
	}
	defer func() { _ = m.Close() }()
	if m.Device != "Tower" {
		t.Errorf("device = %q, want the name it joined with", m.Device)
	}
	if got := m.Fortress.Members(); len(got) != 0 {
		t.Errorf("members off the network = %v, want none", got)
	}
}

func TestTowerTorchUsesTheBackupAndTheUpdates(t *testing.T) {
	dir := t.TempDir()
	joined(t, dir, false)
	cfg, err := config(dir, towertorch, "", nil)
	if err != nil {
		t.Fatal(err)
	}
	for _, a := range []string{maint.BackupAction, maint.UpdateAction} {
		if !slices.Contains(cfg.Uses, a) {
			t.Errorf("uses %v, want %s", cfg.Uses, a)
		}
	}
	if cfg.App.ID != "towertorch" || cfg.App.Version != "1.5.0" {
		t.Errorf("app = %+v", cfg.App)
	}
}

func TestJoinTakesPartOnThisNetworkAndLeavesIt(t *testing.T) {
	dir := t.TempDir()
	joined(t, dir, true)
	m, err := Join(dir, towertorch, "", nil, nil)
	if err != nil || m == nil {
		t.Fatalf("Join = %v, %v", m, err)
	}
	if err := m.Close(); err != nil {
		t.Fatalf("Close = %v", err)
	}
}

func TestJoinRefusesADamagedMembership(t *testing.T) {
	dir := t.TempDir()
	if err := os.WriteFile(filepath.Join(dir, "fortress.json"), []byte(`{"seed":"zz"}`), 0o600); err != nil {
		t.Fatal(err)
	}
	if m, err := Join(dir, towertorch, "", nil, nil); err == nil {
		_ = m.Close()
		t.Fatal("want an error")
	}
}
