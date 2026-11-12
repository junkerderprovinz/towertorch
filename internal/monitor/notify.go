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

// Alerts delivers alerts to the notification channels the store holds. It reads
// them for every alert, so a change on the settings page counts at once.
type Alerts struct {
	Channels func() ([]notify.Channel, error)
	// Unraid runs Unraid's notify script. Nil runs it on this host.
	Unraid notify.Runner
	HTTP   *http.Client
}

// Notify sends the alert in the background, since a channel that keeps failing
// is retried and must not hold up the monitor or a plan run. importance is
// Unraid's level: normal, warning or alert.
func (a Alerts) Notify(ctx context.Context, subject, desc, importance string) {
	go a.Send(context.WithoutCancel(ctx), subject, desc, importance)
}

// Send delivers the alert and waits for every channel, retries included. It
// returns how many channels took it and the names of those that did not.
func (a Alerts) Send(ctx context.Context, subject, desc, importance string) (sent int, failed []string) {
	channels, err := a.Channels()
	if err != nil {
		log.Printf("notify: channels unreadable, %q not sent: %v", subject, err)
		return 0, nil
	}
	if len(channels) == 0 {
		return 0, nil
	}
	d, err := notify.NewDispatcher(channels, notify.Options{Source: "TowerTorch", HTTP: a.HTTP, Unraid: a.Unraid})
	if err != nil {
		log.Printf("notify: %q not sent: %v", subject, err)
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
	for _, r := range d.Send(sctx, notify.Event{Severity: severity(importance), Title: subject, Body: desc}) {
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
