package fortress

import (
	"fmt"
	"slices"
	"strings"
)

// lang holds the texts of one language by code, as fmt formats over the
// code's values.
type lang map[string]string

var english = lang{
	"plan.running":                 "Starting the containers in order",
	"plan.done":                    "Started %s containers in order.",
	"plan.degraded":                "Start in order finished, %s containers did not get ready.",
	"plan.failed":                  "Start in order finished with %s failed and %s degraded containers.",
	"plan.invalid":                 "The start plan could not run: %s",
	"start.failed":                 "%s did not start: %s",
	"start.degraded":               "%s runs but did not get ready: %s",
	"start.skipped":                "%s was not started because a container it waits for failed: %s",
	"watchdog.restarted":           "The watchdog restarted %s after it crashed with exit code %s.",
	"watchdog.restarted_unhealthy": "The watchdog restarted %s because it was unhealthy.",
	"watchdog.gave_up":             "The watchdog stopped restarting %s after %s restarts within an hour.",
	"watchdog.restart_failed":      "The watchdog could not restart %s: %s",
	"watchdog.recovered":           "%s runs again.",
}

var german = lang{
	"plan.running":                 "Container werden der Reihe nach gestartet",
	"plan.done":                    "%s Container der Reihe nach gestartet.",
	"plan.degraded":                "Start in Reihenfolge fertig, %s Container wurden nicht bereit.",
	"plan.failed":                  "Start in Reihenfolge fertig, %s Container gescheitert und %s eingeschränkt.",
	"plan.invalid":                 "Der Startplan konnte nicht laufen: %s",
	"start.failed":                 "%s ist nicht gestartet: %s",
	"start.degraded":               "%s läuft, wurde aber nicht bereit: %s",
	"start.skipped":                "%s wurde nicht gestartet, weil ein Container davor gescheitert ist: %s",
	"watchdog.restarted":           "Der Watchdog hat %s nach einem Absturz mit Exit-Code %s neu gestartet.",
	"watchdog.restarted_unhealthy": "Der Watchdog hat %s neu gestartet, weil er nicht gesund war.",
	"watchdog.gave_up":             "Der Watchdog startet %s nicht mehr neu, nach %s Neustarts in einer Stunde.",
	"watchdog.restart_failed":      "Der Watchdog konnte %s nicht neu starten: %s",
	"watchdog.recovered":           "%s läuft wieder.",
}

// texts picks the language by its primary subtag, English when there is none
// for it.
func texts(tag string) lang {
	primary, _, _ := strings.Cut(strings.ToLower(tag), "-")
	if primary == "de" {
		return german
	}
	return english
}

func (l lang) say(code string, args ...string) string {
	vals := make([]any, len(args))
	for i, a := range args {
		vals[i] = a
	}
	return fmt.Sprintf(l[code], vals...)
}

func sortedKeys[V any](m map[string]V) []string {
	keys := make([]string, 0, len(m))
	for k := range m {
		keys = append(keys, k)
	}
	slices.Sort(keys)
	return keys
}
