package fortress

import (
	"context"
	"errors"
	"net/http"
	"net/http/httptest"
	"path/filepath"
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

// memberID is the member TowerTorch is in the fortress kept in dir.
func memberID(t *testing.T, dir string) string {
	t.Helper()
	cfg, err := kitfortress.Load(dir)
	if err != nil {
		t.Fatal(err)
	}
	return cfg.Identity.ID()
}

func TestTheNewWordsKeepTowerTorchTheSameMember(t *testing.T) {
	dir := filepath.Join(t.TempDir(), "fortress")
	d := &Door{Dir: dir, App: towertorch, Device: "Tower", Relay: "off"}
	t.Cleanup(func() { _ = d.Close() })
	if err := d.Enter(words(t)); err != nil {
		t.Fatal(err)
	}
	before := memberID(t, dir)
	d.mu.Lock()
	d.phraseChanged = true
	d.mu.Unlock()

	if err := d.Enter(words(t)); err != nil {
		t.Fatalf("entering the new words: %v", err)
	}
	if after := memberID(t, dir); after != before {
		t.Errorf("member %s after the new words, want %s", after, before)
	}
	if d.PhraseChanged() {
		t.Error("the new words still say the phrase changed")
	}
	if d.current() == nil {
		t.Error("TowerTorch is out of the fortress after the new words")
	}
}

// vault is a BombVault that keeps its phrase, so it can change it.
type vault struct {
	t     *testing.T
	url   string
	id    member.Identity
	store *memStore
	run   func() ([]byte, error)

	mu     sync.Mutex
	secret []byte
	f      *kitfortress.Fortress
	calls  int
}

func (v *vault) Keep(secret []byte) error {
	v.mu.Lock()
	defer v.mu.Unlock()
	v.secret = append([]byte(nil), secret...)
	return nil
}

func (v *vault) ran() int {
	v.mu.Lock()
	defer v.mu.Unlock()
	return v.calls
}

func (v *vault) phrase() []byte {
	v.mu.Lock()
	defer v.mu.Unlock()
	return v.secret
}

func (v *vault) open(secret, previous []byte) {
	v.t.Helper()
	f, err := kitfortress.Open(kitfortress.Config{
		App: kitfortress.App{ID: "bombvault", Name: "BombVault", Version: "1.0.0"}, Secret: secret, Previous: previous, Identity: v.id,
		Self: group.Self{Name: "Tower", Deployment: "container"}, Relay: group.RelayOwn, RelayURL: v.url, Store: v.store, Keeper: v,
		Actions: []kitfortress.Action{{Name: maint.BackupAction, Run: func(context.Context, kitfortress.Caller, []byte) ([]byte, error) {
			v.mu.Lock()
			v.calls++
			v.mu.Unlock()
			return v.run()
		}}},
	})
	if err != nil {
		v.t.Fatal(err)
	}
	v.t.Cleanup(func() { _ = f.Close() })
	v.f = f
}

// inFortress starts a BombVault and lets TowerTorch join its fortress through
// the door.
func inFortress(t *testing.T, run func() ([]byte, error)) (*vault, *Door) {
	t.Helper()
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
	v := &vault{t: t, url: srv.URL, id: ident, store: &memStore{}, run: run, secret: secret}
	v.open(secret, nil)
	d := &Door{Dir: filepath.Join(t.TempDir(), "fortress"), App: towertorch, Device: "Tower", Relay: srv.URL}
	t.Cleanup(func() { _ = d.Close() })
	if err := d.Enter(w); err != nil {
		t.Fatal(err)
	}
	waitFor(t, "BombVault and TowerTorch to see each other", func() bool { return online(v.f, "towertorch") && online(d.current(), "bombvault") })
	return v, d
}

// online says an instance of app is in reach of f.
func online(f *kitfortress.Fortress, app string) bool {
	if f == nil {
		return false
	}
	for _, m := range f.Members() {
		if m.App.ID == app && m.Online() {
			return true
		}
	}
	return false
}

func TestTowerTorchFollowsANewPhraseAndAsksAgain(t *testing.T) {
	v, d := inFortress(t, func() ([]byte, error) { return []byte(`{"ok":true}`), nil })
	self := memberID(t, d.Dir)
	old := v.phrase()
	// TowerTorch is away while the phrase changes.
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
	waitFor(t, "TowerTorch to reach BombVault on the old phrase", func() bool { return online(d.current(), "bombvault") })

	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer cancel()
	out, err := d.Act(ctx, v.id.ID(), maint.BackupAction, nil)
	if err != nil || string(out) != `{"ok":true}` {
		t.Fatalf("act after the change = %s, %v", out, err)
	}
	if v.ran() != 1 {
		t.Errorf("BombVault ran the action %d times, want once", v.ran())
	}
	if d.PhraseChanged() {
		t.Error("TowerTorch followed and still says the phrase changed")
	}
	if got := memberID(t, d.Dir); got != self {
		t.Errorf("TowerTorch is member %s after following, want %s", got, self)
	}
	cfg, err := kitfortress.Load(d.Dir)
	if err != nil {
		t.Fatal(err)
	}
	if want := kitfortress.Domain.Keys(v.phrase()).Group; cfg.Keys.Group != want {
		t.Error("the membership kept the keys of the old phrase")
	}
}

func TestWhenItCannotFollowTheCardAsksForTheNewWords(t *testing.T) {
	followWait = 300 * time.Millisecond
	t.Cleanup(func() { followWait = 10 * time.Second })
	// A member that says the phrase changed but hands no keys, as one does
	// after the 30 days or to a member taken out since.
	v, d := inFortress(t, func() ([]byte, error) {
		return nil, &kitfortress.Refusal{Status: http.StatusGone, Code: "phrase_changed"}
	})
	_, err := d.Act(context.Background(), v.id.ID(), maint.BackupAction, nil)
	var no *kitfortress.Refusal
	if !errors.As(err, &no) || no.Code != "phrase_changed" {
		t.Fatalf("act = %v, want the refusal", err)
	}
	if v.ran() != 1 {
		t.Errorf("BombVault was asked %d times, want once while nothing changed", v.ran())
	}
	if !d.PhraseChanged() {
		t.Fatal("the card does not hear that the phrase changed")
	}
	if err := d.Enter(words(t)); err != nil {
		t.Errorf("entering the new words: %v", err)
	}
	if d.PhraseChanged() {
		t.Error("the new words still say the phrase changed")
	}
}

func TestOutsideAFortressTheDoorActsForNobody(t *testing.T) {
	d := &Door{Dir: filepath.Join(t.TempDir(), "fortress"), App: towertorch}
	if _, err := d.Act(context.Background(), "x", maint.BackupAction, nil); !errors.Is(err, ErrNotMember) {
		t.Errorf("act = %v, want ErrNotMember", err)
	}
	if d.Members() != nil {
		t.Error("members outside a fortress")
	}
}
