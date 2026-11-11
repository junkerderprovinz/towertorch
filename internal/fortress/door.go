package fortress

import (
	"errors"
	"io/fs"
	"os"
	"path/filepath"
	"sync"

	kitfortress "github.com/junkerderprovinz/parleyport/kit/fortress"
	"github.com/junkerderprovinz/parleyport/kit/phrase"
	"github.com/junkerderprovinz/parleyport/kit/status"

	"github.com/junkerderprovinz/towertorch/internal/maint"
)

var (
	// ErrPhrase means the words are not a fortress phrase.
	ErrPhrase = errors.New("that is not a fortress phrase")
	// ErrMember means TowerTorch is in a fortress already.
	ErrMember = errors.New("TowerTorch is in a fortress already")
)

// Door lets TowerTorch join a fortress with its phrase, the way the kit's
// fortress join does on the console. The phrase itself is never kept.
type Door struct {
	Dir    string
	App    status.App
	Src    status.Source
	Device string
	// Relay is "" for the project's relay, "off" or the address of an own one.
	Relay string
	// Opened gets the membership once TowerTorch is in.
	Opened func(*Membership)
	mu     sync.Mutex
}

// Enter joins the fortress of words and opens the membership.
func (d *Door) Enter(words string) error {
	d.mu.Lock()
	defer d.mu.Unlock()
	if _, err := os.Stat(filepath.Join(d.Dir, "fortress.json")); !errors.Is(err, fs.ErrNotExist) {
		return ErrMember
	}
	secret, err := phrase.Decode(words)
	if err != nil {
		return errors.Join(ErrPhrase, err)
	}
	defer clear(secret)
	m := kitfortress.Membership{App: d.App.ID, Device: d.Device, Relay: d.Relay, Uses: []string{maint.BackupAction, maint.UpdateAction}}
	if err := kitfortress.Join(d.Dir, secret, m); err != nil {
		return err
	}
	in, err := Join(d.Dir, d.App, d.Src)
	if err != nil {
		return err
	}
	if d.Opened != nil {
		d.Opened(in)
	}
	return nil
}
