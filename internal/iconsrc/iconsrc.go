// Package iconsrc finds a better icon for a container, VM or plugin name than
// the one it ships, and caches the answer and the SVG on the flash.
//
// Two public icon sets are tried in order:
//
//  1. simple-icons/simple-icons (CC0-1.0): single-path monochrome glyphs, which
//     can be flattened to one ink colour without losing anything.
//  2. homarr-labs/dashboard-icons (Apache-2.0): full-colour app icons, used as
//     the source for the luminance-preserving tint.
//
// Resolve never blocks on the network. It answers from the cache and queues
// unknown names for background workers, reporting them as KindPending, so an
// unreachable CDN only means the native icons stay.
package iconsrc

import (
	"context"
	"crypto/sha1"
	"encoding/hex"
	"encoding/json"
	"html"
	"io"
	"net/http"
	"os"
	"path/filepath"
	"regexp"
	"strings"
	"sync"
	"time"
)

// Result kinds handed back to the browser.
const (
	KindGlyph   = "glyph"   // monochrome single-path glyph: safe to ink-flatten
	KindColor   = "color"   // full-colour artwork: tint it, never flatten it
	KindNone    = "none"    // nothing found in either set; use the native icon
	KindPending = "pending" // queued for lookup; ask again later
)

// Source names, so the UI can say where an icon came from.
const (
	SrcSimple    = "simple-icons"
	SrcDashboard = "dashboard-icons"
)

// Cache lifetimes. Icon sets change slowly, so a hit lasts a month; a 404 is
// checked again weekly because new icons get added; a transport error is retried
// within minutes because it is probably local.
const (
	ttlHit   = 30 * 24 * time.Hour
	ttlMiss  = 7 * 24 * time.Hour
	ttlError = 15 * time.Minute
)

// maxSVG caps a single cached icon; a few very detailed dashboard-icons pieces
// are larger and count as a miss.
const maxSVG = 128 << 10

// maxProbes bounds the HTTP requests one unknown name may cost, so a container
// called "a-b-c-d-e-f" can't fan out into a probe storm.
const maxProbes = 8

// entry is one cached lookup as stored in index.json.
type entry struct {
	Kind   string `json:"kind"`
	Source string `json:"source,omitempty"`
	Slug   string `json:"slug,omitempty"`
	File   string `json:"file,omitempty"` // basename of the cached .svg next to index.json
	At     int64  `json:"at"`             // unix seconds of the last resolution attempt
	Err    bool   `json:"err,omitempty"`  // last attempt failed at the transport level, not a 404
}

func (e entry) fresh(now time.Time) bool {
	age := now.Sub(time.Unix(e.At, 0))
	switch {
	case e.Err:
		return age < ttlError
	case e.Kind == KindNone:
		return age < ttlMiss
	default:
		return age < ttlHit
	}
}

// Result is what Resolve hands back per name.
type Result struct {
	Kind   string `json:"kind"`
	Source string `json:"source,omitempty"`
	Slug   string `json:"slug,omitempty"`
}

// Resolver owns the cache directory and the background lookup workers.
type Resolver struct {
	dir    string
	client *http.Client

	// SimpleBase and DashBase are the URL prefixes for slug + ".svg", tried in
	// order.
	SimpleBase []string
	DashBase   []string

	Now func() time.Time

	mu       sync.Mutex
	ents     map[string]entry
	inflight map[string]bool
	dirty    bool

	queue  chan string
	closed chan struct{}
	wg     sync.WaitGroup
	once   sync.Once
}

// New opens or creates the cache under dir/icons and starts the workers. If the
// directory cannot be created the resolver works from memory only.
func New(dir string) *Resolver {
	r := &Resolver{
		dir: filepath.Join(dir, "icons"),
		client: &http.Client{Timeout: 8 * time.Second, CheckRedirect: func(_ *http.Request, via []*http.Request) error {
			if len(via) >= 5 {
				return http.ErrUseLastResponse
			}
			return nil
		}},
		SimpleBase: []string{
			"https://cdn.jsdelivr.net/gh/simple-icons/simple-icons/icons/",
			"https://raw.githubusercontent.com/simple-icons/simple-icons/develop/icons/",
		},
		DashBase: []string{
			"https://cdn.jsdelivr.net/gh/homarr-labs/dashboard-icons/svg/",
			"https://raw.githubusercontent.com/homarr-labs/dashboard-icons/main/svg/",
		},
		Now:      time.Now,
		ents:     map[string]entry{},
		inflight: map[string]bool{},
		queue:    make(chan string, 256),
		closed:   make(chan struct{}),
	}
	_ = os.MkdirAll(r.dir, 0o755)
	r.load()
	for i := 0; i < 3; i++ { // enough to warm 50 names quickly while staying gentle on the CDN
		r.wg.Add(1)
		go r.worker()
	}
	return r
}

// Close stops the workers and flushes the index.
func (r *Resolver) Close() {
	r.once.Do(func() {
		close(r.closed)
		r.wg.Wait()
		r.save()
	})
}

// Resolve answers for every name from the cache and queues anything unknown or
// stale for a background lookup. It does no network I/O.
func (r *Resolver) Resolve(names []string) map[string]Result {
	out := make(map[string]Result, len(names))
	now := r.Now()
	r.mu.Lock()
	defer r.mu.Unlock()
	for _, raw := range names {
		key := normalise(raw)
		if key == "" {
			continue
		}
		e, ok := r.ents[key]
		if ok && e.fresh(now) {
			out[raw] = Result{Kind: e.Kind, Source: e.Source, Slug: e.Slug}
			continue
		}
		// Stale but present: keep serving the old answer while the refresh runs,
		// so a monthly re-check never flickers an icon back to native.
		if ok && e.Kind != KindNone && !e.Err {
			out[raw] = Result{Kind: e.Kind, Source: e.Source, Slug: e.Slug}
		} else {
			out[raw] = Result{Kind: KindPending}
		}
		r.enqueue(key)
	}
	return out
}

// enqueue is called with the lock held. A full queue drops the name; the next
// Resolve offers it again.
func (r *Resolver) enqueue(key string) {
	if r.inflight[key] {
		return
	}
	select {
	case r.queue <- key:
		r.inflight[key] = true
	default:
	}
}

// SVG returns the cached artwork for a name, if any. The script check runs here
// as well, because a cache written by an older version was never filtered.
func (r *Resolver) SVG(name string) ([]byte, string, bool) {
	key := normalise(name)
	r.mu.Lock()
	e, ok := r.ents[key]
	r.mu.Unlock()
	if !ok || e.File == "" {
		return nil, "", false
	}
	b, err := os.ReadFile(filepath.Join(r.dir, e.File))
	if err != nil || scriptable(b) {
		return nil, "", false
	}
	return b, e.Kind, true
}

// Stats reports the cache's shape for the diagnostics card.
func (r *Resolver) Stats() map[string]int {
	r.mu.Lock()
	defer r.mu.Unlock()
	s := map[string]int{"total": len(r.ents), "glyph": 0, "color": 0, "none": 0, "error": 0}
	for _, e := range r.ents {
		if e.Err {
			s["error"]++
			continue
		}
		switch e.Kind {
		case KindGlyph:
			s["glyph"]++
		case KindColor:
			s["color"]++
		default:
			s["none"]++
		}
	}
	return s
}

func (r *Resolver) worker() {
	defer r.wg.Done()
	for {
		select {
		case <-r.closed:
			return
		case key := <-r.queue:
			r.lookup(key)
			r.mu.Lock()
			delete(r.inflight, key)
			dirty := r.dirty
			r.mu.Unlock()
			if dirty {
				r.save()
			}
		}
	}
}

// lookup probes both icon sets for one normalised name. Every path, failures
// included, records an entry, so a name is not probed twice in quick succession.
func (r *Resolver) lookup(key string) {
	now := r.Now().Unix()
	probes := 0
	transportErr := false

	try := func(bases []string, slug, source, kind string) (entry, bool) {
		if slug == "" || probes >= maxProbes {
			return entry{}, false
		}
		probes++
		for _, base := range bases {
			body, status, err := r.get(base + slug + ".svg")
			if err != nil {
				transportErr = true
				continue // the other host may still answer
			}
			if status == http.StatusNotFound {
				return entry{}, false // the mirror would say the same
			}
			if status != http.StatusOK || !looksLikeSVG(body) || scriptable(body) {
				continue
			}
			file, werr := r.store(body)
			if werr != nil {
				file = ""
			}
			return entry{Kind: kind, Source: source, Slug: slug, File: file, At: now}, true
		}
		return entry{}, false
	}

	for _, slug := range simpleSlugs(key) {
		if e, ok := try(r.SimpleBase, slug, SrcSimple, KindGlyph); ok {
			r.put(key, e)
			return
		}
	}
	for _, slug := range dashSlugs(key) {
		if e, ok := try(r.DashBase, slug, SrcDashboard, KindColor); ok {
			r.put(key, e)
			return
		}
	}
	// A transport error is retried within minutes rather than weekly, so a
	// flaky moment cannot hide an icon that exists.
	r.put(key, entry{Kind: KindNone, At: now, Err: transportErr})
}

func (r *Resolver) get(url string) ([]byte, int, error) {
	ctx, cancel := context.WithTimeout(context.Background(), 8*time.Second)
	defer cancel()
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, url, nil)
	if err != nil {
		return nil, 0, err
	}
	req.Header.Set("Accept", "image/svg+xml,*/*")
	req.Header.Set("User-Agent", "TowerTorch-icons/1")
	resp, err := r.client.Do(req)
	if err != nil {
		return nil, 0, err
	}
	defer func() { _ = resp.Body.Close() }()
	if resp.StatusCode != http.StatusOK {
		_, _ = io.Copy(io.Discard, io.LimitReader(resp.Body, 4<<10))
		return nil, resp.StatusCode, nil
	}
	body, err := io.ReadAll(io.LimitReader(resp.Body, maxSVG+1))
	if err != nil {
		return nil, 0, err
	}
	if len(body) > maxSVG {
		return nil, http.StatusRequestEntityTooLarge, nil
	}
	return body, http.StatusOK, nil
}

// store writes the artwork content-addressed, so two names resolving to the same
// slug share one file and a re-fetch of unchanged bytes is a no-op.
func (r *Resolver) store(body []byte) (string, error) {
	sum := sha1.Sum(body)
	name := hex.EncodeToString(sum[:]) + ".svg"
	path := filepath.Join(r.dir, name)
	if _, err := os.Stat(path); err == nil {
		return name, nil
	}
	tmp := path + ".tmp"
	if err := os.WriteFile(tmp, body, 0o644); err != nil {
		return "", err
	}
	if err := os.Rename(tmp, path); err != nil {
		_ = os.Remove(tmp)
		return "", err
	}
	return name, nil
}

func (r *Resolver) put(key string, e entry) {
	r.mu.Lock()
	r.ents[key] = e
	r.dirty = true
	r.mu.Unlock()
}

func (r *Resolver) load() {
	b, err := os.ReadFile(filepath.Join(r.dir, "index.json"))
	if err != nil {
		return
	}
	var m map[string]entry
	if json.Unmarshal(b, &m) != nil || m == nil {
		return
	}
	r.mu.Lock()
	r.ents = m
	r.mu.Unlock()
}

func (r *Resolver) save() {
	r.mu.Lock()
	if !r.dirty {
		r.mu.Unlock()
		return
	}
	b, err := json.Marshal(r.ents)
	r.dirty = false
	r.mu.Unlock()
	if err != nil {
		return
	}
	path := filepath.Join(r.dir, "index.json")
	tmp := path + ".tmp"
	if os.WriteFile(tmp, b, 0o644) != nil {
		return
	}
	if os.Rename(tmp, path) != nil {
		_ = os.Remove(tmp)
	}
}

// nonSlug matches every run of characters that is not a lowercase alphanumeric;
// it both splits a name into tokens and scrubs a token down to a slug.
var nonSlug = regexp.MustCompile(`[^a-z0-9]+`)

// vendorPrefixes are the image-maintainer prefixes Unraid container names carry
// so often that leaving them in would miss nearly every glyph ("binhex-plex").
var vendorPrefixes = []string{"binhex-", "binhex", "linuxserver-", "lsio-", "ls-", "official-", "docker-", "hotio-"}

// normalise is the cache key: lowercase, trimmed, vendor prefix removed.
func normalise(name string) string {
	s := strings.ToLower(strings.TrimSpace(name))
	if s == "" {
		return ""
	}
	for _, p := range vendorPrefixes {
		if strings.HasPrefix(s, p) && len(s) > len(p)+1 {
			s = s[len(p):]
			break
		}
	}
	return strings.Trim(s, "-_. ")
}

// variants yields the name and then shorter forms with trailing tokens dropped
// ("plex-media-server", "plex-media", "plex"), so "Nextcloud-AIO" still finds
// its icon.
func variants(key string) []string {
	toks := nonSlug.Split(key, -1)
	clean := toks[:0]
	for _, t := range toks {
		if t != "" {
			clean = append(clean, t)
		}
	}
	if len(clean) == 0 {
		return nil
	}
	out := make([]string, 0, 4)
	for n := len(clean); n >= 1 && len(out) < 4; n-- {
		out = append(out, strings.Join(clean[:n], "-"))
	}
	return out
}

// simpleSlugs are Simple Icons' slugs: lowercase alphanumerics, nothing else.
func simpleSlugs(key string) []string {
	seen := map[string]bool{}
	var out []string
	for _, v := range variants(key) {
		s := nonSlug.ReplaceAllString(v, "")
		if len(s) < 2 || seen[s] {
			continue
		}
		seen[s] = true
		out = append(out, s)
	}
	return out
}

// dashSlugs are dashboard-icons' slugs: kebab-case.
func dashSlugs(key string) []string {
	seen := map[string]bool{}
	var out []string
	for _, v := range variants(key) {
		s := strings.Trim(nonSlug.ReplaceAllString(v, "-"), "-")
		if len(s) < 2 || seen[s] {
			continue
		}
		seen[s] = true
		out = append(out, s)
	}
	return out
}

// looksLikeSVG rejects a 200 that is not artwork, such as a CDN error page,
// which would otherwise be cached and served as an icon.
func looksLikeSVG(b []byte) bool {
	head := strings.ToLower(strings.TrimSpace(string(b[:min(len(b), 512)])))
	if strings.HasPrefix(head, "<?xml") {
		return strings.Contains(head, "<svg")
	}
	return strings.HasPrefix(head, "<svg")
}

// activeContent matches what could run in an SVG opened as a page: a script in
// any namespace, an event handler attribute, a foreignObject carrying HTML, and
// an entity declaration, which could assemble any of these out of sight.
var activeContent = regexp.MustCompile(`<([a-z0-9_.-]+:)?(script|foreignobject)\b|[\s"'/]on[a-z]+\s*=|<!entity`)

// urlBreaks are the characters a browser drops from a URL before it reads the
// scheme, which turns java&#9;script: into javascript:.
var urlBreaks = strings.NewReplacer("\t", "", "\n", "", "\r", "")

// scriptable reports whether an icon could run script. The set follows the
// icon projects' default branches, so a single bad commit upstream would
// otherwise reach the WebGUI and run in the admin's session.
func scriptable(b []byte) bool {
	s := strings.ToLower(html.UnescapeString(string(b)))
	return activeContent.MatchString(s) || strings.Contains(urlBreaks.Replace(s), "javascript:")
}
