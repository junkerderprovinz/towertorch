package monitor

import (
	"context"
	"log"
	"net/http"
	"time"

	"github.com/junkerderprovinz/parleyport/kit/notify"
)

// sendLimit bounds one alert with every retry of every channel.
const sendLimit = 2 * time.Minute

// alertKind is the event kind of every alert, for channels that filter by kind
// and for TollRoll, which wants one.
const alertKind = "towertorch.alert"

// Alert is one message for the notification channels. Importance is Unraid's
// level: normal, warning or alert. Key names what the alert is about, and
// Recovery marks the news that it is over, which also reaches the channels
// that only carry problems.
type Alert struct {
	Subject    string
	Desc       string
	Importance string
	Key        string
	Recovery   bool
}

// Alerts delivers alerts to the notification channels the store holds. It reads
// them for every alert, so a change on the settings page counts at once.
type Alerts struct {
	Channels func() ([]notify.Channel, error)
	// Hub hands an alert to TollRoll when one in the fortress takes the
	// notifications of its apps. Nil, or a TollRoll that does not, leaves
	// every alert to the channels.
	Hub Handoff
	// Unraid runs Unraid's notify script. Nil runs it on this host.
	Unraid notify.Runner
	HTTP   *http.Client
}

// Handoff hands an alert on and reports whether it was taken.
type Handoff interface {
	Hand(ctx context.Context, e notify.Event) bool
}

// Notify sends the alert in the background, since a channel that keeps failing
// is retried and must not hold up the monitor or a plan run. importance is
// Unraid's level: normal, warning or alert.
func (a Alerts) Notify(ctx context.Context, subject, desc, importance string) {
	a.Tell(ctx, Alert{Subject: subject, Desc: desc, Importance: importance})
}

// Tell sends al in the background, like Notify.
func (a Alerts) Tell(ctx context.Context, al Alert) {
	go a.deliver(context.WithoutCancel(ctx), al)
}

// Send delivers the alert and waits for every channel, retries included. It
// returns how many channels took it and the names of those that did not. An
// alert TollRoll takes counts as sent to one.
func (a Alerts) Send(ctx context.Context, subject, desc, importance string) (sent int, failed []string) {
	return a.deliver(ctx, Alert{Subject: subject, Desc: desc, Importance: importance})
}

func (a Alerts) deliver(ctx context.Context, al Alert) (sent int, failed []string) {
	e := notify.Event{Kind: alertKind, Severity: severity(al.Importance), Recovery: al.Recovery, Title: al.Subject, Body: al.Desc, Key: al.Key}
	if al.Recovery {
		e.Severity = notify.SeveritySuccess
	}
	if a.Hub != nil && a.Hub.Hand(ctx, e) {
		return 1, nil
	}
	channels, err := a.Channels()
	if err != nil {
		log.Printf("notify: channels unreadable, %q not sent: %v", al.Subject, err)
		return 0, nil
	}
	if len(channels) == 0 {
		return 0, nil
	}
	d, err := notify.NewDispatcher(channels, notify.Options{Source: "TowerTorch", HTTP: a.HTTP, Unraid: a.Unraid})
	if err != nil {
		log.Printf("notify: %q not sent: %v", al.Subject, err)
		return 0, nil
	}
	names := map[string]string{}
	for _, c := range channels {
		names[c.ID] = c.Name
		if c.Name == "" {
			names[c.ID] = string(c.Kind)
		}
	}
	sctx, cancel := context.WithTimeout(ctx, sendLimit)
	defer cancel()
	for _, r := range d.Send(sctx, e) {
		if r.OK() {
			sent++
			continue
		}
		log.Printf("notify: channel %s: %v", r.Channel, r.Err)
		failed = append(failed, names[r.Channel])
	}
	return sent, failed
}

// severity maps Unraid's level to the one that gives it back.
func severity(importance string) notify.Severity {
	switch importance {
	case "alert":
		return notify.SeverityCritical
	case "warning":
		return notify.SeverityWarning
	}
	return notify.SeverityInfo
}
