package store

import (
	"bytes"
	"encoding/hex"
	"encoding/json"
	"os"
	"path/filepath"
	"reflect"
	"testing"

	"github.com/junkerderprovinz/parleyport/kit/notify"

	"github.com/junkerderprovinz/towertorch/internal/model"
)

// storeWith returns a store whose config.json is a copy of the named file in
// testdata.
func storeWith(t *testing.T, name string) (*Store, string) {
	t.Helper()
	dir := t.TempDir()
	b, err := os.ReadFile(filepath.Join("testdata", name))
	if err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(filepath.Join(dir, "config.json"), b, 0o644); err != nil {
		t.Fatal(err)
	}
	return New(filepath.Join(dir, "plan.json")), dir
}

func sameChannels(t *testing.T, got, want []notify.Channel) {
	t.Helper()
	if !reflect.DeepEqual(got, want) {
		g, _ := json.MarshalIndent(got, "", "  ")
		w, _ := json.MarshalIndent(want, "", "  ")
		t.Errorf("channels\n got %s\nwant %s", g, w)
	}
}

var migrated14 = []notify.Channel{
	{ID: "unraid", Kind: notify.KindUnraid, Enabled: true, On: notify.OnAlways},
	{ID: "webhook", Kind: notify.KindWebhook, Enabled: true, On: notify.OnAlways, TimeoutSeconds: 10,
		Webhook: &notify.Webhook{
			URL:     "https://hooks.example.org/towertorch/T0K3N",
			Method:  "POST",
			Headers: map[string]string{"Content-Type": "application/json"},
			Body:    `{"event":"%%title%%","detail":"%%body%%","importance":"%%importance%%"}`,
		}},
}

func TestLoadChannelsTurnsTheNotifyBlockOfAnOldConfigIntoChannels(t *testing.T) {
	s, dir := storeWith(t, "config-1.4.json")
	before, _ := os.ReadFile(filepath.Join(dir, "config.json"))

	got, err := s.LoadChannels()
	if err != nil {
		t.Fatal(err)
	}
	sameChannels(t, got, migrated14)

	var saved []notify.Channel
	b, err := os.ReadFile(filepath.Join(dir, "notify.json"))
	if err != nil {
		t.Fatalf("the channels were not saved: %v", err)
	}
	if err := json.Unmarshal(b, &saved); err != nil {
		t.Fatal(err)
	}
	sameChannels(t, saved, migrated14)

	after, _ := os.ReadFile(filepath.Join(dir, "config.json"))
	if !bytes.Equal(before, after) {
		t.Error("the old config changed, it should stay readable as it was")
	}
}

func TestLoadChannelsReadsSavedChannelsInsteadOfTheNotifyBlock(t *testing.T) {
	s, dir := storeWith(t, "config-1.4.json")
	own := []notify.Channel{{ID: "phone", Kind: notify.KindNtfy, Enabled: true, Ntfy: &notify.Ntfy{URL: "https://ntfy.example.org/tower"}}}
	b, _ := json.Marshal(own)
	if err := os.WriteFile(filepath.Join(dir, "notify.json"), b, 0o644); err != nil {
		t.Fatal(err)
	}
	got, err := s.LoadChannels()
	if err != nil {
		t.Fatal(err)
	}
	sameChannels(t, got, own)
}

func TestLoadChannelsOfAFreshInstallIsEmpty(t *testing.T) {
	s := New(filepath.Join(t.TempDir(), "plan.json"))
	got, err := s.LoadChannels()
	if err != nil || len(got) != 0 {
		t.Fatalf("got %v, %v", got, err)
	}
}

func TestSaveConfigCarriesAChangedNotifyBlockToTheChannels(t *testing.T) {
	s, dir := storeWith(t, "config-1.4.json")
	if _, err := s.LoadChannels(); err != nil {
		t.Fatal(err)
	}
	phone := notify.Channel{ID: "phone", Kind: notify.KindNtfy, Enabled: true, Ntfy: &notify.Ntfy{URL: "https://ntfy.example.org/tower"}}
	b, _ := json.Marshal(append(append([]notify.Channel{}, migrated14...), phone))
	if err := os.WriteFile(filepath.Join(dir, "notify.json"), b, 0o644); err != nil {
		t.Fatal(err)
	}

	cfg, err := s.LoadConfig()
	if err != nil {
		t.Fatal(err)
	}
	cfg.Notify = model.Notify{Unraid: false, Webhook: "https://hooks.example.org/other"}
	if err := s.SaveConfig(cfg); err != nil {
		t.Fatal(err)
	}
	got, err := s.LoadChannels()
	if err != nil {
		t.Fatal(err)
	}
	webhook := migrated14[1]
	webhook.Webhook = &notify.Webhook{URL: "https://hooks.example.org/other", Method: "POST",
		Headers: map[string]string{"Content-Type": "application/json"}, Body: migrated14[1].Webhook.Body}
	sameChannels(t, got, []notify.Channel{webhook, phone})
}

func TestSaveConfigLeavesTheChannelsAloneWhileTheNotifyBlockStaysTheSame(t *testing.T) {
	s, dir := storeWith(t, "config-1.4.json")
	tuned := append([]notify.Channel{}, migrated14...)
	tuned[1].Attempts = 5
	b, _ := json.Marshal(tuned)
	if err := os.WriteFile(filepath.Join(dir, "notify.json"), b, 0o644); err != nil {
		t.Fatal(err)
	}
	cfg, err := s.LoadConfig()
	if err != nil {
		t.Fatal(err)
	}
	cfg.Schedules = nil
	if err := s.SaveConfig(cfg); err != nil {
		t.Fatal(err)
	}
	got, err := s.LoadChannels()
	if err != nil {
		t.Fatal(err)
	}
	sameChannels(t, got, tuned)
}

func TestInstanceIDIsCreatedOnceAndKept(t *testing.T) {
	dir := t.TempDir()
	first, err := New(filepath.Join(dir, "plan.json")).InstanceID()
	if err != nil {
		t.Fatal(err)
	}
	if b, err := hex.DecodeString(first); err != nil || len(b) != 16 {
		t.Fatalf("instance id %q is not 32 hex digits", first)
	}
	again, err := New(filepath.Join(dir, "plan.json")).InstanceID()
	if err != nil || again != first {
		t.Fatalf("second read gave %q, %v, want %q", again, err, first)
	}
	other, _ := New(filepath.Join(t.TempDir(), "plan.json")).InstanceID()
	if other == first {
		t.Error("two installs share an instance id")
	}
}
