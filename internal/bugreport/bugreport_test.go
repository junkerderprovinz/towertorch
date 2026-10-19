package bugreport

import (
	"os"
	"path/filepath"
	"strings"
	"testing"
	"time"

	"github.com/junkerderprovinz/towertorch/internal/model"
)

const webhook = "https://discord.com/api/webhooks/123456/s3cr3t-T0KEN"

func samplePlan() model.Plan {
	return model.Plan{Nodes: []model.Node{
		{Name: "mariadb", Probe: model.Probe{Kind: model.ProbeExec, Command: "mysqladmin ping -uroot -phunter2"}},
		{Name: "nextcloud", After: []string{"mariadb"}, Probe: model.Probe{Kind: model.ProbeHTTP, Port: 80, Path: "/status.php?token=abc123def"}},
		{Name: "redis", Probe: model.Probe{Kind: model.ProbeTCP, Port: 6379}},
	}}
}

func sampleConfig() model.Config {
	return model.Config{
		Notify:     model.Notify{Unraid: true, Webhook: webhook},
		UISettings: map[string]string{"cc.accent": "#fcc419"},
		Schedules:  []model.Schedule{{Name: "plex", Action: "restart", Time: "04:00", Enabled: true}},
	}
}

func TestPlanLosesExecCommandsAndQueries(t *testing.T) {
	p := samplePlan()
	got := RedactPlan(p)
	if got.Nodes[0].Probe.Command != Redacted {
		t.Errorf("exec command kept: %q", got.Nodes[0].Probe.Command)
	}
	if got.Nodes[1].Probe.Path != "/status.php?"+Redacted {
		t.Errorf("http path = %q", got.Nodes[1].Probe.Path)
	}
	if got.Nodes[2].Probe.Port != 6379 || got.Nodes[1].After[0] != "mariadb" {
		t.Errorf("redaction dropped plain fields: %+v", got.Nodes)
	}
	if p.Nodes[0].Probe.Command == Redacted || p.Nodes[1].Probe.Path != "/status.php?token=abc123def" {
		t.Error("redaction changed the caller's plan")
	}
}

func TestConfigKeepsOnlyThatAWebhookIsSet(t *testing.T) {
	c := sampleConfig()
	got := RedactConfig(c)
	if got.Notify.Webhook != Redacted {
		t.Errorf("webhook = %q", got.Notify.Webhook)
	}
	if !got.Notify.Unraid || got.UISettings["cc.accent"] != "#fcc419" || len(got.Schedules) != 1 {
		t.Errorf("redaction dropped plain settings: %+v", got)
	}
	if c.Notify.Webhook != webhook {
		t.Error("redaction changed the caller's config")
	}
	if RedactConfig(model.Config{}).Notify.Webhook != "" {
		t.Error("an unset webhook reads as set")
	}
}

func TestTextLosesCredentials(t *testing.T) {
	cases := map[string]string{
		"GET https://bob:pa55@example.com/x":         "https://" + Redacted + "@example.com/x",
		"calling /hook?id=7&token=zzz":               "/hook?id=" + Redacted + "&token=" + Redacted,
		"DB_PASSWORD=hunter2 started":                "DB_PASSWORD=" + Redacted + " started",
		`api_key: "abc def"`:                         "api_key: " + Redacted,
		"Authorization: Bearer eyJhbGciOiJIUzI1NiJ9": "Authorization: " + Redacted,
		"curl -H 'X: Basic dXNlcjpwYXNz'":            "Basic " + Redacted,
	}
	for in, want := range cases {
		got := RedactText(in, nil)
		if !strings.Contains(got, want) {
			t.Errorf("RedactText(%q) = %q, want it to contain %q", in, got, want)
		}
		for _, secret := range []string{"pa55", "zzz", "hunter2", "abc def", "eyJhbGciOiJIUzI1NiJ9", "dXNlcjpwYXNz"} {
			if strings.Contains(got, secret) {
				t.Errorf("RedactText(%q) = %q still holds %q", in, got, secret)
			}
		}
	}
	plain := "✓ TOWERTORCH v1.2.0 IS READY - api /var/run/towertorch.sock"
	if got := RedactText(plain, nil); got != plain {
		t.Errorf("a plain line changed: %q", got)
	}
}

func TestKnownSecretsLeaveTheLogToo(t *testing.T) {
	r := Report{
		Created: time.Date(2026, 10, 14, 9, 30, 0, 0, time.UTC),
		Engine:  "v1.2.0", Plugin: "1.2.0", Unraid: "7.1.4",
		Plan: samplePlan(), Config: sampleConfig(),
		Log: []byte("notify: post " + webhook + " failed\nprobe mariadb: mysqladmin ping -uroot -phunter2 exit 1\n"),
	}
	out := string(r.Render())
	for _, secret := range []string{"s3cr3t-T0KEN", "hunter2", "abc123def"} {
		if strings.Contains(out, secret) {
			t.Errorf("the report still holds %q:\n%s", secret, out)
		}
	}
	for _, want := range []string{"Engine:  v1.2.0", "Plugin:  1.2.0", "Unraid:  7.1.4", "== Start plan ==", "\"name\": \"redis\"", "== Engine log (tail) =="} {
		if !strings.Contains(out, want) {
			t.Errorf("the report lacks %q", want)
		}
	}
	if r.FileName() != "towertorch-bugreport-20261014-093000.txt" {
		t.Errorf("file name = %q", r.FileName())
	}
}

func TestCollectReadsVersionsAndTheLogTail(t *testing.T) {
	dir := t.TempDir()
	write := func(name, body string) string {
		p := filepath.Join(dir, name)
		if err := os.WriteFile(p, []byte(body), 0o644); err != nil {
			t.Fatal(err)
		}
		return p
	}
	long := strings.Repeat("old line that scrolled away\n", 4000) + "the last line\n"
	s := Sources{
		LogFile:    write("cc.log", long),
		UnraidFile: write("unraid-version", "version=\"7.1.4\"\n"),
		PluginFile: write("cc.plg", "<!DOCTYPE PLUGIN [\n  <!ENTITY version   \"1.2.0\">\n]>"),
	}
	var r Report
	s.Collect(&r)
	if r.Unraid != "7.1.4" || r.Plugin != "1.2.0" {
		t.Errorf("versions = %q, %q", r.Unraid, r.Plugin)
	}
	if len(r.Log) > logTailBytes || !strings.HasSuffix(string(r.Log), "the last line\n") || !strings.HasPrefix(string(r.Log), "old line") {
		t.Errorf("tail is %d bytes and starts %q", len(r.Log), string(r.Log[:20]))
	}
	if len(r.Problems) != 0 {
		t.Errorf("problems: %v", r.Problems)
	}
}

func TestMissingFilesAreListedNotFatal(t *testing.T) {
	missing := filepath.Join(t.TempDir(), "nope")
	var r Report
	Sources{LogFile: missing, UnraidFile: missing, PluginFile: missing}.Collect(&r)
	if len(r.Problems) != 3 {
		t.Fatalf("problems = %v", r.Problems)
	}
	if out := string(r.Render()); !strings.Contains(out, "Could not read:") || !strings.Contains(out, "Unraid:  unknown") {
		t.Errorf("render:\n%s", out)
	}
}
