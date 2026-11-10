// Package tmplicon tells which containers show an icon their user set, by
// comparing the icon in a container's Unraid template with the one the template
// it was installed from ships. The icon pipeline keeps such an icon instead of
// swapping in a curated logo.
//
// The shipped icon comes from Community Applications' local catalog when CA has
// one, otherwise from the template at TemplateURL. Check never blocks on either:
// it answers from the cache and looks up anything unknown on background workers,
// so a box without internet keeps the plain pipeline.
package tmplicon

import (
	"bufio"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"html"
	"io"
	"net/http"
	"net/url"
	"os"
	"path/filepath"
	"regexp"
	"strconv"
	"strings"
	"sync"
	"time"
)

// DefaultCACache is where Community Applications keeps its catalog, PHP-serialized.
const DefaultCACache = "/tmp/community.applications/tempFiles/templates_new.json"

// Statuses Check reports. A name it leaves out has no template to compare, or
// its template's icon could not be found.
const (
	Own     = "own"     // the icon differs from the one the template ships
	Pending = "pending" // the template's icon is being looked up
)

// Cache lifetimes. A template's icon rarely changes, so an answer lasts a week; a
// transport error is retried within minutes because it is probably local.
const (
	ttlFound = 7 * 24 * time.Hour
	ttlError = 15 * time.Minute
)

// maxTemplate caps a fetched template; real ones are a few kilobytes.
const maxTemplate = 512 << 10

// entry is the shipped icon of one TemplateURL as stored in templates.json.
type entry struct {
	Icon string `json:"icon,omitempty"`
	At   int64  `json:"at"`
	Err  bool   `json:"err,omitempty"`
}

func (e entry) fresh(now time.Time) bool {
	ttl := ttlFound
	if e.Err {
		ttl = ttlError
	}
	return now.Sub(time.Unix(e.At, 0)) < ttl
}

// userTemplate is what Check needs from one file in templates-user.
type userTemplate struct {
	mod         time.Time
	size        int64
	name        string
	icon        string
	templateURL string
}

// Checker owns the cache of shipped icons and the workers that fill it.
type Checker struct {
	dir     string
	tmplDir string
	caPath  string
	client  *http.Client
	now     func() time.Time

	mu       sync.Mutex
	ents     map[string]entry
	inflight map[string]bool
	dirty    bool
	users    map[string]userTemplate // by path

	caMu  sync.Mutex
	caMod time.Time
	ca    map[string]string

	queue  chan string
	closed chan struct{}
	wg     sync.WaitGroup
	once   sync.Once
}

// New opens or creates the cache under dataDir/icons, next to iconsrc's, and starts
// the workers. tmplDir holds the user templates and caPath is CA's catalog.
func New(dataDir, tmplDir, caPath string) *Checker {
	c := &Checker{
		dir:      filepath.Join(dataDir, "icons"),
		tmplDir:  tmplDir,
		caPath:   caPath,
		client:   &http.Client{Timeout: 8 * time.Second},
		now:      time.Now,
		ents:     map[string]entry{},
		inflight: map[string]bool{},
		users:    map[string]userTemplate{},
		queue:    make(chan string, 256),
		closed:   make(chan struct{}),
	}
	_ = os.MkdirAll(c.dir, 0o755)
	c.load()
	for i := 0; i < 2; i++ {
		c.wg.Add(1)
		go c.worker()
	}
	return c
}

// Close stops the workers and flushes the cache.
func (c *Checker) Close() {
	c.once.Do(func() {
		close(c.closed)
		c.wg.Wait()
		c.save()
	})
}

// Check reports, per container name, whether its icon is one its user set. Names
// are matched without regard to case, as the browser sends them lowercased.
func (c *Checker) Check(names []string) map[string]string {
	out := map[string]string{}
	byName := c.templates()
	now := c.now()
	c.mu.Lock()
	defer c.mu.Unlock()
	for _, name := range names {
		t, ok := byName[strings.ToLower(strings.TrimSpace(name))]
		if !ok || t.icon == "" || t.templateURL == "" {
			continue
		}
		e, known := c.ents[t.templateURL]
		if !known || !e.fresh(now) {
			c.enqueue(t.templateURL)
		}
		switch {
		case !known:
			out[name] = Pending
		case e.Icon != "" && !sameIcon(t.icon, e.Icon):
			out[name] = Own
		}
	}
	return out
}

// templates reads templates-user, parsing only the files that changed since the
// last call, and indexes them by lowercased name. Of several templates with one
// name, the newest is the one Unraid wrote last.
func (c *Checker) templates() map[string]userTemplate {
	files, _ := filepath.Glob(filepath.Join(c.tmplDir, "*.xml"))
	c.mu.Lock()
	defer c.mu.Unlock()
	seen := make(map[string]bool, len(files))
	byName := map[string]userTemplate{}
	for _, f := range files {
		fi, err := os.Stat(f)
		if err != nil {
			continue
		}
		seen[f] = true
		t, ok := c.users[f]
		if !ok || !t.mod.Equal(fi.ModTime()) || t.size != fi.Size() {
			b, err := os.ReadFile(f)
			if err != nil {
				continue
			}
			doc := string(b)
			t = userTemplate{mod: fi.ModTime(), size: fi.Size(), name: field(doc, "Name"), icon: field(doc, "Icon"), templateURL: field(doc, "TemplateURL")}
			c.users[f] = t
		}
		key := strings.ToLower(t.name)
		if prev, dup := byName[key]; key == "" || dup && prev.mod.After(t.mod) {
			continue
		}
		byName[key] = t
	}
	for f := range c.users {
		if !seen[f] {
			delete(c.users, f)
		}
	}
	return byName
}

var fieldRe = map[string]*regexp.Regexp{"Name": tagRe("Name"), "Icon": tagRe("Icon"), "TemplateURL": tagRe("TemplateURL")}

func tagRe(tag string) *regexp.Regexp {
	return regexp.MustCompile(`(?s)<` + tag + `>\s*([^<]*?)\s*</` + tag + `>`)
}

// field reads one element's text. A regexp rather than encoding/xml, because
// templates in the wild are often not well-formed XML.
func field(doc, tag string) string {
	m := fieldRe[tag].FindStringSubmatch(doc)
	if m == nil {
		return ""
	}
	return strings.TrimSpace(html.UnescapeString(m[1]))
}

// sameIcon compares two icon addresses by host and path. The scheme and the query
// are left out, since templates bump a ?v= to bust caches and move from http to
// https without the picture changing.
func sameIcon(a, b string) bool {
	a, b = strings.TrimSpace(html.UnescapeString(a)), strings.TrimSpace(html.UnescapeString(b))
	ua, errA := url.Parse(a)
	ub, errB := url.Parse(b)
	if errA != nil || errB != nil || ua.Host == "" || ub.Host == "" {
		return a == b
	}
	return strings.EqualFold(ua.Host, ub.Host) && ua.Path == ub.Path
}

// enqueue is called with mu held. A full queue drops the address; the next Check
// offers it again.
func (c *Checker) enqueue(u string) {
	if c.inflight[u] {
		return
	}
	select {
	case c.queue <- u:
		c.inflight[u] = true
	default:
	}
}

func (c *Checker) worker() {
	defer c.wg.Done()
	for {
		select {
		case <-c.closed:
			return
		case u := <-c.queue:
			e := c.lookup(u)
			c.mu.Lock()
			c.ents[u] = e
			c.dirty = true
			delete(c.inflight, u)
			c.mu.Unlock()
			c.save()
		}
	}
}

// lookup finds the icon a template ships, in CA's catalog first and then at the
// template's own address. A template that answers without an icon records an
// empty icon, which never marks anything as own.
func (c *Checker) lookup(u string) entry {
	now := c.now().Unix()
	if icon, ok := c.caIcon(u); ok {
		return entry{Icon: icon, At: now}
	}
	body, status, err := c.get(u)
	if err != nil {
		return entry{At: now, Err: true}
	}
	if status != http.StatusOK {
		return entry{At: now}
	}
	return entry{Icon: field(string(body), "Icon"), At: now}
}

// caIcon answers from CA's catalog, rereading it when CA has refreshed it.
func (c *Checker) caIcon(u string) (string, bool) {
	c.caMu.Lock()
	defer c.caMu.Unlock()
	fi, err := os.Stat(c.caPath)
	if err != nil {
		c.ca, c.caMod = nil, time.Time{}
		return "", false
	}
	if c.ca == nil || !fi.ModTime().Equal(c.caMod) {
		idx, err := readCAIndex(c.caPath)
		if err != nil {
			idx = map[string]string{}
		}
		c.ca, c.caMod = idx, fi.ModTime()
	}
	icon, ok := c.ca[u]
	return icon, ok
}

func (c *Checker) get(u string) ([]byte, int, error) {
	ctx, cancel := context.WithTimeout(context.Background(), 8*time.Second)
	defer cancel()
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, u, nil)
	if err != nil {
		return nil, 0, err
	}
	req.Header.Set("User-Agent", "TowerTorch-icons/1")
	resp, err := c.client.Do(req)
	if err != nil {
		return nil, 0, err
	}
	defer func() { _ = resp.Body.Close() }()
	if resp.StatusCode != http.StatusOK {
		_, _ = io.Copy(io.Discard, io.LimitReader(resp.Body, 4<<10))
		return nil, resp.StatusCode, nil
	}
	body, err := io.ReadAll(io.LimitReader(resp.Body, maxTemplate))
	if err != nil {
		return nil, 0, err
	}
	return body, http.StatusOK, nil
}

func (c *Checker) load() {
	b, err := os.ReadFile(filepath.Join(c.dir, "templates.json"))
	if err != nil {
		return
	}
	var m map[string]entry
	if json.Unmarshal(b, &m) != nil || m == nil {
		return
	}
	c.mu.Lock()
	c.ents = m
	c.mu.Unlock()
}

func (c *Checker) save() {
	c.mu.Lock()
	if !c.dirty {
		c.mu.Unlock()
		return
	}
	b, err := json.Marshal(c.ents)
	c.dirty = false
	c.mu.Unlock()
	if err != nil {
		return
	}
	path := filepath.Join(c.dir, "templates.json")
	tmp := path + ".tmp"
	if os.WriteFile(tmp, b, 0o644) != nil {
		return
	}
	if os.Rename(tmp, path) != nil {
		_ = os.Remove(tmp)
	}
}

// readCAIndex maps each TemplateURL in CA's catalog to the icon it lists. The
// catalog is a PHP-serialized array of template arrays and runs to tens of
// megabytes, so it is streamed and only those two fields are kept.
func readCAIndex(path string) (map[string]string, error) {
	f, err := os.Open(path)
	if err != nil {
		return nil, err
	}
	defer func() { _ = f.Close() }()
	p := phpReader{r: bufio.NewReaderSize(f, 64<<10)}
	n, err := p.arrayHead()
	if err != nil {
		return nil, err
	}
	out := map[string]string{}
	for i := 0; i < n; i++ {
		if err := p.skip(); err != nil { // the index
			return nil, err
		}
		tag, err := p.r.ReadByte()
		if err != nil {
			return nil, err
		}
		if tag != 'a' {
			if err := p.skipAfter(tag); err != nil {
				return nil, err
			}
			continue
		}
		var tmplURL, icon string
		err = p.fields(func(key, val string) {
			switch key {
			case "TemplateURL":
				tmplURL = val
			case "Icon":
				icon = val
			}
		})
		if err != nil {
			return nil, err
		}
		if _, dup := out[tmplURL]; tmplURL != "" && icon != "" && !dup {
			out[tmplURL] = icon
		}
	}
	return out, nil
}

var errPHP = errors.New("tmplicon: malformed PHP serialization")

// phpReader walks PHP's serialize() format: s:len:"bytes"; i:n; d:x; b:0; N;
// and a:count:{key value ...}.
type phpReader struct{ r *bufio.Reader }

// arrayHead reads "a:count:{" and returns count.
func (p phpReader) arrayHead() (int, error) {
	tag, err := p.r.ReadByte()
	if err != nil {
		return 0, err
	}
	if tag != 'a' {
		return 0, errPHP
	}
	return p.countBrace()
}

// countBrace reads ":count:{" once the 'a' is consumed.
func (p phpReader) countBrace() (int, error) {
	if b, err := p.r.ReadByte(); err != nil || b != ':' {
		return 0, errPHP
	}
	s, err := p.r.ReadString(':')
	if err != nil {
		return 0, err
	}
	n, err := strconv.Atoi(strings.TrimSuffix(s, ":"))
	if err != nil || n < 0 {
		return 0, errPHP
	}
	if b, err := p.r.ReadByte(); err != nil || b != '{' {
		return 0, errPHP
	}
	return n, nil
}

// fields walks one array, its 'a' already consumed, and hands each string-keyed
// string value to fn, skipping every other value.
func (p phpReader) fields(fn func(key, val string)) error {
	n, err := p.countBrace()
	if err != nil {
		return err
	}
	for i := 0; i < n; i++ {
		tag, err := p.r.ReadByte()
		if err != nil {
			return err
		}
		key := ""
		if tag == 's' {
			if key, err = p.str(); err != nil {
				return err
			}
		} else if err := p.skipAfter(tag); err != nil {
			return err
		}
		tag, err = p.r.ReadByte()
		if err != nil {
			return err
		}
		if tag == 's' {
			v, err := p.str()
			if err != nil {
				return err
			}
			fn(key, v)
			continue
		}
		if err := p.skipAfter(tag); err != nil {
			return err
		}
	}
	return p.closeBrace()
}

// str reads ":len:\"bytes\";" once the 's' is consumed.
func (p phpReader) str() (string, error) {
	if b, err := p.r.ReadByte(); err != nil || b != ':' {
		return "", errPHP
	}
	s, err := p.r.ReadString(':')
	if err != nil {
		return "", err
	}
	n, err := strconv.Atoi(strings.TrimSuffix(s, ":"))
	if err != nil || n < 0 || n > 64<<20 {
		return "", errPHP
	}
	if b, err := p.r.ReadByte(); err != nil || b != '"' {
		return "", errPHP
	}
	buf := make([]byte, n)
	if _, err := io.ReadFull(p.r, buf); err != nil {
		return "", err
	}
	if q, err := p.r.ReadByte(); err != nil || q != '"' {
		return "", errPHP
	}
	if sc, err := p.r.ReadByte(); err != nil || sc != ';' {
		return "", errPHP
	}
	return string(buf), nil
}

// skip reads past one value of any type.
func (p phpReader) skip() error {
	tag, err := p.r.ReadByte()
	if err != nil {
		return err
	}
	return p.skipAfter(tag)
}

// skipAfter reads past one value whose type tag is already consumed.
func (p phpReader) skipAfter(tag byte) error {
	switch tag {
	case 'N':
		if b, err := p.r.ReadByte(); err != nil || b != ';' {
			return errPHP
		}
		return nil
	case 'i', 'd', 'b':
		_, err := p.r.ReadString(';')
		return err
	case 's':
		_, err := p.str()
		return err
	case 'a':
		n, err := p.countBrace()
		if err != nil {
			return err
		}
		for i := 0; i < 2*n; i++ {
			if err := p.skip(); err != nil {
				return err
			}
		}
		return p.closeBrace()
	}
	return fmt.Errorf("%w: unexpected type %q", errPHP, tag)
}

func (p phpReader) closeBrace() error {
	if b, err := p.r.ReadByte(); err != nil || b != '}' {
		return errPHP
	}
	return nil
}
