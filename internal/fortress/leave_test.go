package fortress

import (
	"net/http/httptest"
	"path/filepath"
	"testing"

	kitfortress "github.com/junkerderprovinz/parleyport/kit/fortress"
	"github.com/junkerderprovinz/parleyport/kit/group"
	"github.com/junkerderprovinz/parleyport/kit/member"
	"github.com/junkerderprovinz/parleyport/kit/phrase"
	"github.com/junkerderprovinz/parleyport/kit/relay"
)

func TestTowerTorchThatLeavesIsGoneFromTheOtherMembers(t *testing.T) {
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
	d := &Door{Dir: filepath.Join(t.TempDir(), "fortress"), App: towertorch, Device: "Tower", Relay: srv.URL}
	t.Cleanup(func() { _ = d.Close() })
	if err := d.Enter(w); err != nil {
		t.Fatal(err)
	}
	listed := func() bool {
		for _, m := range vault.Members() {
			if m.App.ID == "towertorch" {
				return true
			}
		}
		return false
	}
	waitFor(t, "BombVault to know TowerTorch", listed)

	if err := d.Leave(); err != nil {
		t.Fatal(err)
	}
	if listed() {
		t.Error("BombVault still lists TowerTorch after it left")
	}
}
