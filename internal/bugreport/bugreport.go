// Package bugreport builds the file the settings page offers to attach to a bug
// report: the versions, the engine log's tail, the settings and the start plan,
// with every secret the engine can recognise taken out.
package bugreport

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"os"
	"regexp"
	"strings"
	"time"

	"github.com/junkerderprovinz/towertorch/internal/model"
)

// Redacted stands in for every value the report leaves out.
const Redacted = "[redacted]"

// logTailBytes caps how much of the engine log the report carries. The tail is
// where the failure is, and a log that has run for months would bury it.
const logTailBytes = 64 << 10

// Sources are the host files the report reads besides the engine's own state.
type Sources struct {
	LogFile    string // the engine log rc.towertorch writes
	UnraidFile string // /etc/unraid-version
	PluginFile string // the installed .plg, whose version entity names the plugin build
}

// Default is where those files live on an Unraid host.
var Default = Sources{
	LogFile:    "/var/log/towertorch.log",
	UnraidFile: "/etc/unraid-version",
	PluginFile: "/var/log/plugins/towertorch.plg",
}

// Report is everything the file holds. Problems lists what could not be read,
// since a report is most needed when something is broken.
type Report struct {
	Created  time.Time
	Engine   string
	Plugin   string
	Unraid   string
	Plan     model.Plan
	Config   model.Config
	Log      []byte
	Problems []string
}

// Collect fills in the versions and the log tail from the host files.
func (s Sources) Collect(r *Report) {
	r.Unraid = readVersion(s.UnraidFile, unraidVersion, &r.Problems)
	r.Plugin = readVersion(s.PluginFile, pluginVersion, &r.Problems)
	tail, err := readTail(s.LogFile, logTailBytes)
	if err != nil {
		r.Problems = append(r.Problems, "engine log: "+err.Error())
	}
	r.Log = tail
}

var (
	unraidVersion = regexp.MustCompile(`(?m)^version="?([^"\s]+)"?`)
	pluginVersion = regexp.MustCompile(`<!ENTITY\s+version\s+"([^"]+)"`)
)

func readVersion(path string, re *regexp.Regexp, problems *[]string) string {
	b, err := os.ReadFile(path)
	if err != nil {
		*problems = append(*problems, path+": "+err.Error())
		return ""
	}
	if m := re.FindSubmatch(b); m != nil {
		return string(m[1])
	}
	*problems = append(*problems, path+": no version in it")
	return ""
}

// readTail returns the last max bytes of the file, starting at a whole line.
func readTail(path string, max int64) ([]byte, error) {
	f, err := os.Open(path)
	if err != nil {
		return nil, err
	}
	defer func() { _ = f.Close() }()
	fi, err := f.Stat()
	if err != nil {
		return nil, err
	}
	start := fi.Size() - max
	if start < 0 {
		start = 0
	}
	if _, err := f.Seek(start, io.SeekStart); err != nil {
		return nil, err
	}
	b, err := io.ReadAll(f)
	if err != nil {
		return nil, err
	}
	if start > 0 {
		if i := bytes.IndexByte(b, '\n'); i >= 0 {
			b = b[i+1:]
		}
	}
	return b, nil
}

// FileName is the name the download is saved under.
func (r Report) FileName() string {
	return "towertorch-bugreport-" + r.Created.Format("20060102-150405") + ".txt"
}

// Render writes the report as plain text. The settings and the plan go through
// the redaction first, and so does the log, with every secret found in them
// replaced wherever it shows up.
func (r Report) Render() []byte {
	plan := RedactPlan(r.Plan)
	cfg := RedactConfig(r.Config)
	known := Secrets(r.Plan, r.Config)

	var b bytes.Buffer
	fmt.Fprintf(&b, "TowerTorch bug report, %s\n\n", r.Created.UTC().Format(time.RFC3339))
	fmt.Fprintf(&b, "Engine:  %s\n", orUnknown(r.Engine))
	fmt.Fprintf(&b, "Plugin:  %s\n", orUnknown(r.Plugin))
	fmt.Fprintf(&b, "Unraid:  %s\n", orUnknown(r.Unraid))
	if len(r.Problems) > 0 {
		b.WriteString("\nCould not read:\n")
		for _, p := range r.Problems {
			fmt.Fprintf(&b, "  %s\n", RedactText(p, known))
		}
	}
	section(&b, "Settings", cfg)
	section(&b, "Start plan", plan)
	b.WriteString("\n== Engine log (tail) ==\n")
	if len(r.Log) == 0 {
		b.WriteString("(empty)\n")
	} else {
		b.WriteString(RedactText(string(r.Log), known))
		if r.Log[len(r.Log)-1] != '\n' {
			b.WriteByte('\n')
		}
	}
	return b.Bytes()
}

func section(b *bytes.Buffer, title string, v any) {
	fmt.Fprintf(b, "\n== %s ==\n", title)
	j, err := json.MarshalIndent(v, "", "  ")
	if err != nil {
		fmt.Fprintf(b, "(not encodable: %v)\n", err)
		return
	}
	b.Write(j)
	b.WriteByte('\n')
}

func orUnknown(s string) string {
	if s == "" {
		return "unknown"
	}
	return s
}

// RedactPlan returns a copy of the plan without its secrets. An exec probe's
// command can carry a password, so it goes whole; an HTTP probe keeps its path
// but loses the query, where tokens travel.
func RedactPlan(p model.Plan) model.Plan {
	out := model.Plan{Nodes: make([]model.Node, len(p.Nodes))}
	for i, n := range p.Nodes {
		n.After = append([]string(nil), n.After...)
		if n.Probe.Command != "" {
			n.Probe.Command = Redacted
		}
		n.Probe.Path = stripQuery(n.Probe.Path)
		out.Nodes[i] = n
	}
	return out
}

// RedactConfig returns a copy of the config without its secrets. A webhook URL
// is its own credential, so only the fact that one is set survives.
func RedactConfig(c model.Config) model.Config {
	if c.Notify.Webhook != "" {
		c.Notify.Webhook = Redacted
	}
	if c.UISettings != nil {
		ui := make(map[string]string, len(c.UISettings))
		for k, v := range c.UISettings {
			ui[k] = RedactText(v, nil)
		}
		c.UISettings = ui
	}
	return c
}

// Secrets lists the literal values from the plan and the config that must not
// appear anywhere in the report, the log included.
func Secrets(p model.Plan, c model.Config) []string {
	var out []string
	add := func(s string) {
		if len(s) >= 4 {
			out = append(out, s)
		}
	}
	add(c.Notify.Webhook)
	for _, n := range p.Nodes {
		add(n.Probe.Command)
		if q := strings.IndexAny(n.Probe.Path, "?#"); q >= 0 {
			add(n.Probe.Path[q+1:])
		}
	}
	return out
}

func stripQuery(path string) string {
	if q := strings.IndexAny(path, "?#"); q >= 0 {
		return path[:q] + "?" + Redacted
	}
	return path
}

var (
	urlUserinfo = regexp.MustCompile(`(?i)\b([a-z][a-z0-9+.-]*://)[^/\s:@]+(?::[^/\s@]*)?@`)
	queryValue  = regexp.MustCompile(`([?&][^=&\s#?]+)=[^&\s#"']+`)
	secretPair  = regexp.MustCompile(`(?i)\b([\w.-]*(?:pass(?:word|wd|phrase)?|pwd|secret|token|api[_-]?key|access[_-]?key|private[_-]?key|auth(?:orization)?)(?:[_.-][\w.-]*)?)(\s*[=:]\s*)((?:bearer|basic)\s+\S+|"[^"]*"|'[^']*'|[^\s,;&]+)`)
	authScheme  = regexp.MustCompile(`(?i)\b(bearer|basic)\s+[A-Za-z0-9._~+/=-]{6,}`)
)

// RedactText takes the secrets out of free text: the known literals first, then
// whatever looks like a credential, such as a URL's user and password, a query
// value, a password or token assignment and an Authorization header.
func RedactText(s string, known []string) string {
	for _, k := range known {
		s = strings.ReplaceAll(s, k, Redacted)
	}
	s = urlUserinfo.ReplaceAllString(s, "${1}"+Redacted+"@")
	s = queryValue.ReplaceAllString(s, "${1}="+Redacted)
	s = secretPair.ReplaceAllStringFunc(s, func(m string) string {
		p := secretPair.FindStringSubmatch(m)
		if p[3] == Redacted {
			return m
		}
		return p[1] + p[2] + Redacted
	})
	s = authScheme.ReplaceAllString(s, "${1} "+Redacted)
	return s
}
