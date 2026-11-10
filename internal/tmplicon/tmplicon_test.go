package tmplicon

import (
	"fmt"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"strings"
	"sync/atomic"
	"testing"
	"time"
)

const customIcon = "https://i.ibb.co/cXvndxjJ/crowdsec.png"
const shippedIcon = "https://raw.githubusercontent.com/ibracorp/app-logos/main/crowdsec/crowdsec.png"

// tmplXML is a dockerMan template as Unraid writes it to templates-user.
func tmplXML(name, templateURL, icon string) string {
	return `<?xml version="1.0"?>
<Container version="2">
  <Name>` + name + `</Name>
  <Repository>crowdsecurity/crowdsec</Repository>
  <TemplateURL>` + templateURL + `</TemplateURL>
  <Icon>` + icon + `</Icon>
</Container>
`
}

func writeFile(t *testing.T, path, body string) {
	t.Helper()
	if err := os.WriteFile(path, []byte(body), 0o644); err != nil {
		t.Fatal(err)
	}
}

// templateServer serves one template whose icon is icon and counts the requests.
func templateServer(t *testing.T, icon string) (*httptest.Server, *atomic.Int32) {
	t.Helper()
	var hits atomic.Int32
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		hits.Add(1)
		if r.URL.Path != "/crowdsec/crowdsec.xml" {
			http.NotFound(w, r)
			return
		}
		_, _ = w.Write([]byte(tmplXML("crowdsec", "", icon)))
	}))
	t.Cleanup(srv.Close)
	return srv, &hits
}

type fixture struct {
	data, tmpl, ca string
}

func newFixture(t *testing.T) fixture {
	t.Helper()
	f := fixture{data: t.TempDir(), tmpl: t.TempDir()}
	f.ca = filepath.Join(t.TempDir(), "templates_new.json")
	return f
}

func (f fixture) open(t *testing.T) *Checker {
	t.Helper()
	c := New(f.data, f.tmpl, f.ca)
	t.Cleanup(c.Close)
	return c
}

// settle waits until name is no longer pending, since the defaults are looked up on
// background workers, and returns its final status.
func settle(t *testing.T, c *Checker, name string) string {
	t.Helper()
	deadline := time.Now().Add(5 * time.Second)
	for time.Now().Before(deadline) {
		if st := c.Check([]string{name})[name]; st != Pending {
			return st
		}
		time.Sleep(5 * time.Millisecond)
	}
	t.Fatalf("%s stayed pending", name)
	return ""
}

func TestIconTheUserSetIsOwn(t *testing.T) {
	srv, _ := templateServer(t, shippedIcon)
	f := newFixture(t)
	writeFile(t, filepath.Join(f.tmpl, "my-CrowdSec.xml"), tmplXML("CrowdSec", srv.URL+"/crowdsec/crowdsec.xml", customIcon))
	c := f.open(t)

	start := time.Now()
	first := c.Check([]string{"crowdsec"})
	if d := time.Since(start); d > 250*time.Millisecond {
		t.Fatalf("Check blocked for %v", d)
	}
	if first["crowdsec"] != Pending {
		t.Fatalf("first Check = %q, want %q while the template is fetched", first["crowdsec"], Pending)
	}
	if st := settle(t, c, "crowdsec"); st != Own {
		t.Fatalf("status = %q, want %q", st, Own)
	}
}

func TestIconAsTheTemplateShipsItIsNotOwn(t *testing.T) {
	cases := map[string]string{
		"the same address":         shippedIcon,
		"a cache-busting query":    shippedIcon + "?v=3",
		"plain http":               strings.Replace(shippedIcon, "https://", "http://", 1),
		"an escaped ampersand":     shippedIcon + "?a=1&amp;b=2",
		"whitespace in the field":  "\n    " + shippedIcon + "  ",
		"a differently cased host": strings.Replace(shippedIcon, "raw.githubusercontent.com", "Raw.GitHubUserContent.com", 1),
	}
	for what, icon := range cases {
		t.Run(what, func(t *testing.T) {
			srv, _ := templateServer(t, shippedIcon+"?v=2")
			f := newFixture(t)
			writeFile(t, filepath.Join(f.tmpl, "my-CrowdSec.xml"), tmplXML("CrowdSec", srv.URL+"/crowdsec/crowdsec.xml", icon))
			if st := settle(t, f.open(t), "crowdsec"); st != "" {
				t.Fatalf("status = %q, want none", st)
			}
		})
	}
}

func TestWithoutADefaultNothingChanges(t *testing.T) {
	srv, hits := templateServer(t, shippedIcon)
	dead := httptest.NewServer(http.NotFoundHandler())
	deadURL := dead.URL
	dead.Close()

	cases := map[string]string{
		"no TemplateURL":        tmplXML("CrowdSec", "", customIcon),
		"a template that 404s":  tmplXML("CrowdSec", srv.URL+"/gone.xml", customIcon),
		"an unreachable host":   tmplXML("CrowdSec", deadURL+"/crowdsec/crowdsec.xml", customIcon),
		"no icon of its own":    tmplXML("CrowdSec", srv.URL+"/crowdsec/crowdsec.xml", ""),
		"a template for others": tmplXML("Plex", srv.URL+"/crowdsec/crowdsec.xml", customIcon),
	}
	for what, tmpl := range cases {
		t.Run(what, func(t *testing.T) {
			f := newFixture(t)
			writeFile(t, filepath.Join(f.tmpl, "my-CrowdSec.xml"), tmpl)
			if st := settle(t, f.open(t), "crowdsec"); st != "" {
				t.Fatalf("status = %q, want none", st)
			}
		})
	}
	before := hits.Load()
	f := newFixture(t)
	writeFile(t, filepath.Join(f.tmpl, "my-CrowdSec.xml"), tmplXML("CrowdSec", "", customIcon))
	c := f.open(t)
	c.Check([]string{"crowdsec"})
	if hits.Load() != before {
		t.Fatal("a template without TemplateURL caused a request")
	}
}

// caCache writes Community Applications' catalog the way CA stores it, PHP-serialized.
func caCache(t *testing.T, path string, entries ...[2]string) {
	t.Helper()
	s := func(v string) string { return fmt.Sprintf("s:%d:\"%s\";", len(v), v) }
	var b strings.Builder
	fmt.Fprintf(&b, "a:%d:{", len(entries)+1)
	// An entry carrying every value type CA uses, with nested arrays and a string that
	// holds the serializer's own delimiters, has to be skipped cleanly.
	b.WriteString(`i:0;a:7:{` + s("Name") + s("Odd \"};é") + s("Config") + `a:2:{i:0;a:1:{` + s("@attributes") + `a:1:{` + s("Name") + s("x") + `}}i:1;N;}` +
		s("Downloads") + `i:42;` + s("Rating") + `d:4.5;` + s("Beta") + `b:0;` + s("Icon") + `N;` + s("TemplateURL") + s("https://example.com/odd.xml") + `}`)
	for i, e := range entries {
		fmt.Fprintf(&b, "i:%d;a:3:{%s%s%s%s%s%s}", i+1, s("Name"), s("crowdsec"), s("TemplateURL"), s(e[0]), s("Icon"), s(e[1]))
	}
	b.WriteString("}")
	writeFile(t, path, b.String())
}

func TestCommunityApplicationsCacheAnswersFirst(t *testing.T) {
	srv, hits := templateServer(t, customIcon)
	f := newFixture(t)
	url := srv.URL + "/crowdsec/crowdsec.xml"
	caCache(t, f.ca, [2]string{url, shippedIcon})
	writeFile(t, filepath.Join(f.tmpl, "my-CrowdSec.xml"), tmplXML("CrowdSec", url, customIcon))
	if st := settle(t, f.open(t), "crowdsec"); st != Own {
		t.Fatalf("status = %q, want %q from the CA cache", st, Own)
	}
	if hits.Load() != 0 {
		t.Fatalf("fetched the template %d times although CA's cache had it", hits.Load())
	}
}

func TestCAIndexReadsOnlyTopLevelFields(t *testing.T) {
	f := newFixture(t)
	caCache(t, f.ca, [2]string{"https://example.com/a.xml", "https://example.com/a.png"})
	got, err := readCAIndex(f.ca)
	if err != nil {
		t.Fatal(err)
	}
	want := map[string]string{"https://example.com/a.xml": "https://example.com/a.png"}
	if len(got) != len(want) || got["https://example.com/a.xml"] != want["https://example.com/a.xml"] {
		t.Fatalf("index = %v, want %v", got, want)
	}
}

func TestDefaultsPersistAcrossRestart(t *testing.T) {
	srv, hits := templateServer(t, shippedIcon)
	f := newFixture(t)
	writeFile(t, filepath.Join(f.tmpl, "my-CrowdSec.xml"), tmplXML("CrowdSec", srv.URL+"/crowdsec/crowdsec.xml", customIcon))
	c := New(f.data, f.tmpl, f.ca)
	settle(t, c, "crowdsec")
	c.Close()

	before := hits.Load()
	c2 := f.open(t)
	if st := c2.Check([]string{"crowdsec"})["crowdsec"]; st != Own {
		t.Fatalf("after a restart the first Check = %q, want %q from the stored defaults", st, Own)
	}
	if hits.Load() != before {
		t.Fatal("a restart fetched the template again")
	}
}

func TestNewestTemplateOfANameWins(t *testing.T) {
	srv, _ := templateServer(t, shippedIcon)
	f := newFixture(t)
	url := srv.URL + "/crowdsec/crowdsec.xml"
	old := filepath.Join(f.tmpl, "my-crowdsec-old.xml")
	writeFile(t, old, tmplXML("CrowdSec", url, customIcon))
	past := time.Now().Add(-time.Hour)
	if err := os.Chtimes(old, past, past); err != nil {
		t.Fatal(err)
	}
	writeFile(t, filepath.Join(f.tmpl, "my-CrowdSec.xml"), tmplXML("CrowdSec", url, shippedIcon))
	if st := settle(t, f.open(t), "CrowdSec"); st != "" {
		t.Fatalf("status = %q, want none: the newer template carries the shipped icon", st)
	}
}

func TestAnEditedTemplateIsReadAgain(t *testing.T) {
	srv, _ := templateServer(t, shippedIcon)
	f := newFixture(t)
	path := filepath.Join(f.tmpl, "my-CrowdSec.xml")
	url := srv.URL + "/crowdsec/crowdsec.xml"
	writeFile(t, path, tmplXML("CrowdSec", url, shippedIcon))
	c := f.open(t)
	if st := settle(t, c, "crowdsec"); st != "" {
		t.Fatalf("status = %q, want none", st)
	}
	writeFile(t, path, tmplXML("CrowdSec", url, customIcon))
	later := time.Now().Add(time.Minute)
	if err := os.Chtimes(path, later, later); err != nil {
		t.Fatal(err)
	}
	if st := c.Check([]string{"crowdsec"})["crowdsec"]; st != Own {
		t.Fatalf("after the edit status = %q, want %q", st, Own)
	}
}
