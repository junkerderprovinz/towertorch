package fortress

import (
	"testing"

	kitfortress "github.com/junkerderprovinz/parleyport/kit/fortress"
)

func TestAnAppThatJoinedByItsIDAloneShowsUnderItsHouseName(t *testing.T) {
	for _, c := range []struct {
		app  kitfortress.App
		want string
	}{
		{kitfortress.App{ID: "firesquire"}, "FireSquire"},
		{kitfortress.App{ID: "firesquire", Name: "firesquire"}, "FireSquire"},
		{kitfortress.App{ID: "bombvault", Name: "BombVault Home"}, "BombVault Home"},
		{kitfortress.App{ID: "somethingnew"}, "somethingnew"},
	} {
		if got := AppName(c.app); got != c.want {
			t.Errorf("AppName(%+v) = %q, want %q", c.app, got, c.want)
		}
	}
}
