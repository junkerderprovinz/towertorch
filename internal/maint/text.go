package maint

import (
	"fmt"
	"strings"
)

var english = map[string]string{
	"step.backup":  "Back up",
	"step.update":  "Update",
	"step.check":   "Check",
	"step.restart": "Restart",

	"step.off": "Switched off in the plan.",

	"backup.done":        "All %s containers are backed up.",
	"backup.gone":        "%s containers are backed up. %s no longer exists.",
	"backup.failed":      "The backup of %s failed, so the run ended here.",
	"backup.no_fortress": "TowerTorch isn't in a fortress yet, so nothing was backed up.",
	"backup.no_app":      "No backup app runs on this server, so nothing was backed up.",
	"backup.elsewhere":   "The backup app runs on %s, not on this server, so nothing was backed up. If it's the same server, give both apps the same device name.",
	"backup.unreachable": "The backup app didn't answer, so the run ended before any update: %s",
	"backup.docker":      "Docker didn't list the containers: %s",

	"update.done":        "%s updated, %s were current.",
	"update.warn":        "%s updated, %s need a look.",
	"update.failed_some": "The update of %s failed, so the run ended here.",
	"update.failed":      "The update didn't go through: %s",
	"update.nothing":     "None of the chosen containers is there any more.",
	"update.no_fortress": "TowerTorch isn't in a fortress yet, so nothing was updated.",
	"update.no_app":      "No app on this server updates containers, so nothing was updated.",
	"update.elsewhere":   "The update app runs on %s, not on this server, so nothing was updated. If it's the same server, give both apps the same device name.",
	"update.unreachable": "The update app didn't answer, so the run ended here: %s",
	"update.docker":      "Docker didn't list the containers: %s",

	"check.go":      "FireSquire says GO.",
	"check.caution": "FireSquire advises caution, but nothing blocks the restart.",
	"check.nogo":    "FireSquire says NO-GO.",
	"check.missing": "FireSquire isn't installed, so nothing was checked.",
	"check.failed":  "FireSquire couldn't check: %s",

	"restart.requested":      "The server is restarting.",
	"restart.back":           "The server was back at %s.",
	"restart.held_nogo":      "Held back after FireSquire's NO-GO. The server keeps running.",
	"restart.held_unchecked": "Held back because nothing checked the server first.",
	"restart.failed":         "The server didn't restart: %s",

	"run.after_failure": "Didn't run because an earlier step failed.",
	"run.after_stop":    "Didn't run because the run was stopped.",
	"run.stopped":       "The run was stopped here.",
	"run.interrupted":   "TowerTorch stopped in the middle of this step.",

	"running.backup":  "Maintenance: backing up %s (%s of %s)",
	"running.update":  "Maintenance: updating the containers",
	"running.check":   "Maintenance: FireSquire is checking the server",
	"running.restart": "Maintenance: restarting the server",

	"maintenance.done":    "Maintenance done",
	"maintenance.warn":    "Maintenance done with notes",
	"maintenance.held":    "Maintenance done, restart held back",
	"maintenance.failed":  "Maintenance failed",
	"maintenance.stopped": "Maintenance stopped",
	"maintenance.next":    "Maintenance",
}

var german = map[string]string{
	"step.backup":  "Sichern",
	"step.update":  "Aktualisieren",
	"step.check":   "Prüfen",
	"step.restart": "Neu starten",

	"step.off": "Im Plan abgeschaltet.",

	"backup.done":        "Alle %s Container sind gesichert.",
	"backup.gone":        "%s Container sind gesichert. %s gibt es nicht mehr.",
	"backup.failed":      "Die Sicherung von %s ist gescheitert, deshalb endet der Lauf hier.",
	"backup.no_fortress": "TowerTorch ist noch in keiner Festung, gesichert wurde nichts.",
	"backup.no_app":      "Auf diesem Server läuft keine Sicherungs-App, gesichert wurde nichts.",
	"backup.elsewhere":   "Die Sicherungs-App läuft auf %s, nicht auf diesem Server, gesichert wurde nichts. Ist es derselbe Server, gib beiden Apps denselben Gerätenamen.",
	"backup.unreachable": "Die Sicherungs-App hat nicht geantwortet, deshalb endet der Lauf vor jedem Update: %s",
	"backup.docker":      "Docker hat die Container nicht aufgelistet: %s",

	"update.done":        "%s aktualisiert, %s waren aktuell.",
	"update.warn":        "%s aktualisiert, bei %s lohnt ein Blick.",
	"update.failed_some": "Das Update von %s ist gescheitert, deshalb endet der Lauf hier.",
	"update.failed":      "Das Update ist nicht durchgelaufen: %s",
	"update.nothing":     "Keinen der gewählten Container gibt es noch.",
	"update.no_fortress": "TowerTorch ist noch in keiner Festung, aktualisiert wurde nichts.",
	"update.no_app":      "Auf diesem Server aktualisiert keine App Container, aktualisiert wurde nichts.",
	"update.elsewhere":   "Die Update-App läuft auf %s, nicht auf diesem Server, aktualisiert wurde nichts. Ist es derselbe Server, gib beiden Apps denselben Gerätenamen.",
	"update.unreachable": "Die Update-App hat nicht geantwortet, deshalb endet der Lauf hier: %s",
	"update.docker":      "Docker hat die Container nicht aufgelistet: %s",

	"check.go":      "FireSquire sagt GO.",
	"check.caution": "FireSquire rät zur Vorsicht, den Neustart hält aber nichts auf.",
	"check.nogo":    "FireSquire sagt NO-GO.",
	"check.missing": "FireSquire ist nicht installiert, geprüft wurde nichts.",
	"check.failed":  "FireSquire konnte nicht prüfen: %s",

	"restart.requested":      "Der Server startet neu.",
	"restart.back":           "Der Server war um %s wieder da.",
	"restart.held_nogo":      "Nach FireSquires NO-GO zurückgehalten. Der Server läuft weiter.",
	"restart.held_unchecked": "Zurückgehalten, weil vorher niemand den Server geprüft hat.",
	"restart.failed":         "Der Server ist nicht neu gestartet: %s",

	"run.after_failure": "Lief nicht, weil ein früherer Schritt gescheitert ist.",
	"run.after_stop":    "Lief nicht, weil der Lauf angehalten wurde.",
	"run.stopped":       "Der Lauf wurde hier angehalten.",
	"run.interrupted":   "TowerTorch wurde mitten in diesem Schritt beendet.",

	"running.backup":  "Wartung: %s wird gesichert (%s von %s)",
	"running.update":  "Wartung: Container werden aktualisiert",
	"running.check":   "Wartung: FireSquire prüft den Server",
	"running.restart": "Wartung: Server startet neu",

	"maintenance.done":    "Wartung fertig",
	"maintenance.warn":    "Wartung fertig mit Hinweisen",
	"maintenance.held":    "Wartung fertig, Neustart zurückgehalten",
	"maintenance.failed":  "Wartung gescheitert",
	"maintenance.stopped": "Wartung angehalten",
	"maintenance.next":    "Wartung",
}

// Say puts a code and its args in the language of tag, English when there
// is no German in it.
func Say(tag, code string, args ...string) string {
	texts := english
	if primary, _, _ := strings.Cut(strings.ToLower(tag), "-"); primary == "de" {
		texts = german
	}
	format, ok := texts[code]
	if !ok {
		return code
	}
	vals := make([]any, len(args))
	for i, a := range args {
		vals[i] = a
	}
	return fmt.Sprintf(format, vals...)
}

// Summary is a run's notification: a subject, a line per step that ran and
// Unraid's importance.
func Summary(r Report, lang string) (subject, desc, importance string) {
	var lines []string
	for _, s := range r.Steps {
		if s.State != StateOff {
			lines = append(lines, Say(lang, "step."+string(s.Step))+": "+Say(lang, s.Code, s.Args...))
		}
	}
	importance = "warning"
	switch r.Outcome {
	case StateDone:
		importance = "normal"
	case StateFailed:
		importance = "alert"
	}
	return Say(lang, "maintenance."+string(r.Outcome)), strings.Join(lines, " "), importance
}

// Title says what a run is doing, for the fortress's list of work.
func Title(p Progress, lang string) string {
	if p.Step == StepBackup && p.Item != "" {
		return Say(lang, "running.backup", p.Item, fmt.Sprint(p.Index), fmt.Sprint(p.Total))
	}
	return Say(lang, "running."+string(p.Step))
}
