package monitor

import (
	"context"
	"encoding/json"
	"errors"
	"io"
	"net/http"
	"net/http/httptest"
	"slices"
	"testing"
	"time"

	"github.com/junkerderprovinz/parleyport/kit/notify"
)

type scriptCall struct {
	name string
	args []string
}

type recordingRunner chan scriptCall

func (r recordingRunner) Run(_ context.Context, name string, args ...string) error {
	r <- scriptCall{name, args}
	return nil
}

func receive[T any](t *testing.T, ch <-chan T) T {
	t.Helper()
	select {
	case v := <-ch:
		return v
	case <-time.After(5 * time.Second):
		t.Fatal("nothing arrived")
		panic("unreachable")
	}
}

func TestAlertsReachUnraidAndTheWebhookAsBefore(t *testing.T) {
	bodies := make(chan map[string]string, 1)
	hook := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		var got map[string]string
		b, _ := io.ReadAll(r.Body)
		_ = json.Unmarshal(b, &got)
		bodies <- got
	}))
	defer hook.Close()
	script := make(recordingRunner, 1)
	a := Alerts{
		Channels: func() ([]notify.Channel, error) {
			return []notify.Channel{
				{ID: "unraid", Kind: notify.KindUnraid, Enabled: true, On: notify.OnAlways},
				{ID: "webhook", Kind: notify.KindWebhook, Enabled: true, On: notify.OnAlways, TimeoutSeconds: 10,
					Webhook: &notify.Webhook{URL: hook.URL, Method: "POST", Headers: map[string]string{"Content-Type": "application/json"},
						Body: `{"event":"%%title%%","detail":"%%body%%","importance":"%%importance%%"}`}},
			}, nil
		},
		Unraid: script,
	}

	a.Notify(context.Background(), "Watchdog gave up", "db: too many restarts (>3/h)", "alert")

	call := receive(t, script)
	want := []string{"-e", "TowerTorch", "-s", "Watchdog gave up", "-d", "db: too many restarts (>3/h)", "-i", "alert"}
	if call.name != notify.UnraidNotifyScript || !slices.Equal(call.args, want) {
		t.Errorf("unraid got %s %q, want %s %q", call.name, call.args, notify.UnraidNotifyScript, want)
	}
	body := receive(t, bodies)
	if body["event"] != "Watchdog gave up" || body["detail"] != "db: too many restarts (>3/h)" || body["importance"] != "alert" {
		t.Errorf("webhook got %v", body)
	}
}

func TestAlertsKeepUnraidsImportance(t *testing.T) {
	for importance, want := range map[string]string{"alert": "alert", "warning": "warning", "normal": "normal", "": "normal"} {
		script := make(recordingRunner, 1)
		a := Alerts{Unraid: script, Channels: func() ([]notify.Channel, error) {
			return []notify.Channel{{ID: "unraid", Kind: notify.KindUnraid, Enabled: true, On: notify.OnAlways}}, nil
		}}
		a.Notify(context.Background(), "s", "d", importance)
		call := receive(t, script)
		if got := call.args[len(call.args)-1]; got != want {
			t.Errorf("importance %q reached Unraid as %q, want %q", importance, got, want)
		}
	}
}

func TestAlertsWithoutChannelsSendNothing(t *testing.T) {
	script := make(recordingRunner, 1)
	for _, load := range []func() ([]notify.Channel, error){
		func() ([]notify.Channel, error) { return nil, nil },
		func() ([]notify.Channel, error) { return nil, errors.New("flash unreadable") },
	} {
		Alerts{Unraid: script, Channels: load}.Notify(context.Background(), "s", "d", "alert")
	}
	select {
	case c := <-script:
		t.Errorf("sent %v", c)
	case <-time.After(200 * time.Millisecond):
	}
}

func TestSendSaysWhichChannelsTookTheAlert(t *testing.T) {
	hook := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) { w.WriteHeader(http.StatusInternalServerError) }))
	defer hook.Close()
	a := Alerts{
		Channels: func() ([]notify.Channel, error) {
			return []notify.Channel{
				{ID: "unraid", Kind: notify.KindUnraid, Enabled: true, On: notify.OnAlways},
				{ID: "hook-1", Name: "Home Assistant", Kind: notify.KindWebhook, Enabled: true, On: notify.OnAlways, TimeoutSeconds: 2,
					Webhook: &notify.Webhook{URL: hook.URL, Method: "POST", Body: `{}`}},
			}, nil
		},
		Unraid: make(recordingRunner, 4),
	}
	sent, failed := a.Send(context.Background(), "Maintenance done", "all went through", "normal")
	if sent != 1 || !slices.Equal(failed, []string{"Home Assistant"}) {
		t.Errorf("sent %d, failed %v", sent, failed)
	}
}

func TestSendWithoutChannelsReachesNobody(t *testing.T) {
	a := Alerts{Channels: func() ([]notify.Channel, error) { return nil, nil }}
	if sent, failed := a.Send(context.Background(), "x", "y", "normal"); sent != 0 || len(failed) != 0 {
		t.Errorf("sent %d, failed %v", sent, failed)
	}
}

type hand struct {
	took  bool
	calls []string
}

func (h *hand) Hand(_ context.Context, subject, _, importance string) bool {
	h.calls = append(h.calls, subject+" "+importance)
	return h.took
}

func TestAnAlertTollRollTakesReachesNoChannelOfTowerTorch(t *testing.T) {
	read := 0
	h := &hand{took: true}
	a := Alerts{Hub: h, Channels: func() ([]notify.Channel, error) {
		read++
		return []notify.Channel{{ID: "unraid", Kind: notify.KindUnraid, Enabled: true, On: notify.OnAlways}}, nil
	}, Unraid: make(recordingRunner, 4)}
	if sent, failed := a.Send(context.Background(), "Start failed", "plex", "alert"); sent != 1 || len(failed) != 0 || read != 0 {
		t.Errorf("sent %d, failed %v, channels read %d", sent, failed, read)
	}
	if !slices.Equal(h.calls, []string{"Start failed alert"}) {
		t.Errorf("%q", h.calls)
	}
}

func TestAnAlertTollRollDoesNotTakeGoesOutAsBefore(t *testing.T) {
	runner := make(recordingRunner, 4)
	a := Alerts{Hub: &hand{}, Channels: func() ([]notify.Channel, error) {
		return []notify.Channel{{ID: "unraid", Kind: notify.KindUnraid, Enabled: true, On: notify.OnAlways}}, nil
	}, Unraid: runner}
	if sent, _ := a.Send(context.Background(), "Start failed", "plex", "alert"); sent != 1 {
		t.Fatalf("sent %d", sent)
	}
	if c := receive(t, runner); !slices.Contains(c.args, "Start failed") {
		t.Errorf("%+v", c)
	}
}
