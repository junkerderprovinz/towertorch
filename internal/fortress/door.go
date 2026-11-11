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
	// ErrNotMember means TowerTorch is in no fortress it could leave.
	ErrNotMember = errors.New("TowerTorch is in no fortress")
)

// Door holds TowerTorch's place in a fortress: it opens the membership kept
// in Dir, joins with a phrase the way the kit's fortress join does on the
// console, and leaves. The phrase itself is never kept.
type Door struct {
	Dir    string
	App    status.App
	Src    status.Source
	Device string
	// Relay is "" for the project's relay, "off" or the address of an own one.
	Relay string
	// Changed gets the membership whenever it changes, nil once TowerTorch
	// has left.
	Changed func(*Membership)

	mu sync.Mutex
	m  *Membership
}

// Open takes part in the fortress kept in Dir, if TowerTorch joined one.
func (d *Door) Open() error {
	d.mu.Lock()
	defer d.mu.Unlock()
	m, err := Join(d.Dir, d.App, d.Src)
	if err != nil || m == nil {
		return err
	}
	d.set(m)
	return nil
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
	d.set(in)
	return nil
}

// Leave takes TowerTorch out of its fortress and forgets the membership. The
// other members keep it as away until somebody removes it, and the phrase
// brings it back.
func (d *Door) Leave() error {
	d.mu.Lock()
	defer d.mu.Unlock()
	if d.m == nil {
		return ErrNotMember
	}
	err := d.m.Close()
	d.set(nil)
	return errors.Join(err, os.RemoveAll(d.Dir))
}

// Close stops taking part and keeps the membership for the next start.
func (d *Door) Close() error {
	d.mu.Lock()
	defer d.mu.Unlock()
	if d.m == nil {
		return nil
	}
	err := d.m.Close()
	d.m = nil
	return err
}

func (d *Door) set(m *Membership) {
	d.m = m
	if d.Changed != nil {
		d.Changed(m)
	}
}
