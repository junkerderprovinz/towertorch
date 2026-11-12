package fortress

import (
	"context"
	"errors"
	"io/fs"
	"os"
	"path/filepath"
	"sync"
	"time"

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
	// Host is the server as every app on it names it, so the others find
	// TowerTorch there under any device name.
	Host string
	// Relay is "" for the project's relay, "off" or the address of an own one.
	Relay string
	// Changed gets the membership whenever it changes, nil once TowerTorch
	// has left.
	Changed func(*Membership)

	mu            sync.Mutex
	m             *Membership
	removed       bool
	phraseChanged bool
	// following lets one follow run at a time without holding mu, so the
	// settings page is not kept waiting.
	following sync.Mutex
	// gen counts the memberships opened, so a removal that arrives late does
	// not end one joined after it.
	gen int
}

// removedHereFile is all that stays of a membership another member ended, so
// the settings page still says so after a restart.
const removedHereFile = "removed-here"

// followWait is how long a member that answered on the old phrase gets to
// hand over the new keys.
var followWait = 10 * time.Second

// Open takes part in the fortress kept in Dir, if TowerTorch joined one.
func (d *Door) Open() error {
	d.mu.Lock()
	defer d.mu.Unlock()
	m, err := d.join()
	if err != nil {
		return err
	}
	if m == nil {
		_, err := os.Stat(filepath.Join(d.Dir, removedHereFile))
		d.removed = err == nil
		return nil
	}
	d.set(m)
	return nil
}

// Enter joins the fortress of words and opens the membership. After a
// phrase change TowerTorch could not follow, the new words keep the member
// key in Dir, so the others know it as before.
func (d *Door) Enter(words string) error {
	d.mu.Lock()
	defer d.mu.Unlock()
	if _, err := os.Stat(filepath.Join(d.Dir, "fortress.json")); !d.phraseChanged && !errors.Is(err, fs.ErrNotExist) {
		return ErrMember
	}
	secret, err := phrase.Decode(words)
	if err != nil {
		return errors.Join(ErrPhrase, err)
	}
	defer clear(secret)
	// The kit opens the membership once while joining, and its state file
	// takes one writer at a time.
	if d.m != nil {
		_ = d.m.Close()
		d.m = nil
	}
	m := kitfortress.Membership{App: d.App.ID, Device: d.Device, Relay: d.Relay, Uses: []string{maint.BackupAction, maint.UpdateAction}}
	joinErr := kitfortress.Join(d.Dir, secret, m)
	in, err := d.join()
	if err != nil || joinErr != nil {
		d.set(in)
		return errors.Join(joinErr, err)
	}
	d.removed, d.phraseChanged = false, false
	d.forgetRemovals()
	d.set(in)
	if err := os.Remove(filepath.Join(d.Dir, removedHereFile)); err != nil && !errors.Is(err, fs.ErrNotExist) {
		return err
	}
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
	d.removed = false
	return errors.Join(err, os.RemoveAll(d.Dir))
}

// Removed says another member took TowerTorch out of the fortress, until it
// joins again.
func (d *Door) Removed() bool {
	d.mu.Lock()
	defer d.mu.Unlock()
	return d.removed
}

// PhraseChanged says the fortress has a new phrase TowerTorch could not
// follow on its own, until the new words are entered.
func (d *Door) PhraseChanged() bool {
	d.mu.Lock()
	defer d.mu.Unlock()
	return d.phraseChanged
}

// Joined says whether TowerTorch is in a fortress, and the device name it
// joined with.
func (d *Door) Joined() (string, bool) {
	d.mu.Lock()
	defer d.mu.Unlock()
	if d.m == nil {
		return "", false
	}
	return d.m.Device, true
}

// Members lists the other members, none while TowerTorch is out.
func (d *Door) Members() []kitfortress.Member {
	f := d.current()
	if f == nil {
		return nil
	}
	return f.Members()
}

// Act runs action at member id, or fails with ErrNotMember while TowerTorch
// is out. A member that answers on the phrase the fortress left hands over
// the new keys, and the action runs once more under them.
func (d *Door) Act(ctx context.Context, id, action string, body []byte) ([]byte, error) {
	f := d.current()
	if f == nil {
		return nil, ErrNotMember
	}
	var out []byte
	err := d.call(ctx, f, id, func(f *kitfortress.Fortress) (err error) {
		out, err = f.Act(ctx, id, action, body)
		return err
	})
	return out, err
}

// call runs fn on f, and once more on the fortress under the new keys when
// member id answered on the phrase f left and TowerTorch could follow.
func (d *Door) call(ctx context.Context, f *kitfortress.Fortress, id string, fn func(*kitfortress.Fortress) error) error {
	err := fn(f)
	var no *kitfortress.Refusal
	if !errors.As(err, &no) || no.Code != "phrase_changed" {
		return err
	}
	moved := d.follow(ctx, f, true)
	if moved == nil {
		return err
	}
	reach(ctx, moved, id)
	return fn(moved)
}

// Watch follows a phrase change now and then, so that TowerTorch, which
// calls the others only for a maintenance run, still comes along while the
// old phrase answers. It returns when ctx ends.
func (d *Door) Watch(ctx context.Context) {
	t := time.NewTimer(time.Minute)
	defer t.Stop()
	for {
		select {
		case <-ctx.Done():
			return
		case <-t.C:
		}
		if f := d.current(); f != nil {
			d.follow(ctx, f, false)
		}
		t.Reset(15 * time.Minute)
	}
}

// follow takes the membership in Dir to the fortress's new keys and opens it
// again, returning the fortress under them, or nil where none came. f is the
// fortress that ran into the old phrase, and signalled says a member answered
// so. The kit asks that member what it is only after its answer, so the keys
// may take a moment to be on offer.
func (d *Door) follow(ctx context.Context, f *kitfortress.Fortress, signalled bool) *kitfortress.Fortress {
	d.following.Lock()
	defer d.following.Unlock()
	if cur := d.current(); cur != f {
		return cur
	}
	deadline := time.Now().Add(followWait)
	moved, err := kitfortress.Follow(ctx, d.Dir, f)
	for signalled && !moved && err == nil && time.Now().Before(deadline) {
		select {
		case <-ctx.Done():
			err = ctx.Err()
		case <-time.After(200 * time.Millisecond):
			moved, err = kitfortress.Follow(ctx, d.Dir, f)
		}
	}
	d.mu.Lock()
	defer d.mu.Unlock()
	if d.m == nil {
		return nil
	}
	if d.m.Fortress != f {
		return d.m.Fortress
	}
	if !moved {
		if signalled || err != nil {
			d.phraseChanged = true
		}
		return nil
	}
	_ = d.m.Close()
	in, err := d.join()
	d.set(in)
	if err != nil || in == nil {
		d.phraseChanged = true
		return nil
	}
	d.phraseChanged = false
	d.forgetRemovals()
	return in.Fortress
}

// reach waits until member id is online in f, which has just opened, for as
// long as followWait.
func reach(ctx context.Context, f *kitfortress.Fortress, id string) {
	ctx, cancel := context.WithTimeout(ctx, followWait)
	defer cancel()
	for {
		for _, m := range f.Members() {
			if m.ID == id && m.Online() {
				return
			}
		}
		select {
		case <-ctx.Done():
			return
		case <-time.After(50 * time.Millisecond):
		}
	}
}

func (d *Door) current() *kitfortress.Fortress {
	d.mu.Lock()
	defer d.mu.Unlock()
	if d.m == nil {
		return nil
	}
	return d.m.Fortress
}

func (d *Door) join() (*Membership, error) {
	d.gen++
	gen := d.gen
	return Join(d.Dir, d.App, d.Host, d.Src, func() { d.removedBy(gen) })
}

// removedBy forgets the membership once another member took it out: its key
// is no good anywhere now, and the phrase makes a new one. The kit calls it on
// a goroutine that closing the membership waits for, so the closing happens
// on another.
func (d *Door) removedBy(gen int) {
	go func() {
		d.mu.Lock()
		defer d.mu.Unlock()
		if d.gen != gen || d.m == nil {
			return
		}
		_ = d.m.Close()
		d.set(nil)
		_ = os.RemoveAll(d.Dir)
		if os.MkdirAll(d.Dir, 0o700) == nil {
			_ = os.WriteFile(filepath.Join(d.Dir, removedHereFile), nil, 0o600)
		}
		d.removed, d.phraseChanged = true, false
	}()
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
