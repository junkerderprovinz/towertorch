// Package unraidtmpl mirrors a live CPU, RAM or cpuset limit into the container's
// Unraid template XML, so the limit survives an Unraid "Apply", which recreates the
// container from that template. It touches only the ExtraParams flags it owns and
// writes atomically; a failure leaves the live update in place.
package unraidtmpl

import (
	"os"
	"path/filepath"
	"regexp"
	"sort"
	"strconv"
	"strings"
)

// DefaultDir is where Unraid's dockerMan stores user container templates.
const DefaultDir = "/boot/config/plugins/dockerMan/templates-user"

var (
	nameRe = regexp.MustCompile(`(?s)<Name>\s*([^<]*?)\s*</Name>`)
	// A self-closing <ExtraParams/> or an open/close pair, with or without
	// attributes. Group 1 is the inner text, unset for the self-closing form.
	epRe = regexp.MustCompile(`(?s)<ExtraParams\b[^>]*/>|<ExtraParams\b[^>]*>(.*?)</ExtraParams>`)
)

// SetExtraParams finds the template under dir whose <Name> equals name and upserts the
// given docker flags into its <ExtraParams> (a non-empty value replaces any prior value
// of that flag; an empty value removes the flag). Returns nil if it updated a template,
// or an error (no matching template / read / write). dir == "" is a no-op (nil).
func SetExtraParams(dir, name string, kv map[string]string) error {
	if dir == "" || name == "" || len(kv) == 0 {
		return nil
	}
	files, err := filepath.Glob(filepath.Join(dir, "*.xml"))
	if err != nil {
		return err
	}
	// Every matching template is updated: templates-user accumulates duplicates from
	// renames and reinstalls, and any of them may be the one Unraid uses.
	matched := false
	for _, f := range files {
		data, rerr := os.ReadFile(f)
		if rerr != nil {
			continue
		}
		out, ok := applyExtraParams(string(data), name, kv)
		if !ok {
			continue
		}
		if err := writeAtomic(f, []byte(out)); err != nil {
			return err
		}
		matched = true
	}
	if !matched {
		return os.ErrNotExist
	}
	return nil
}

// applyExtraParams upserts kv into the doc's <ExtraParams> when its <Name> equals
// name, and reports whether it matched.
func applyExtraParams(doc, name string, kv map[string]string) (string, bool) {
	m := nameRe.FindStringSubmatch(doc)
	if m == nil || strings.TrimSpace(m[1]) != name {
		return doc, false
	}
	loc := epRe.FindStringSubmatchIndex(doc)
	var inner string
	if loc != nil && loc[2] >= 0 { // group 1 is only set for the open/close form
		inner = doc[loc[2]:loc[3]]
	}
	// Sorted, so the output is stable.
	keys := make([]string, 0, len(kv))
	for k := range kv {
		keys = append(keys, k)
	}
	sort.Strings(keys)
	// Stripping every key before appending means the plugin's value replaces one the
	// template already carries.
	inner = strings.TrimSpace(StripFlags(inner, keys...))
	for _, flag := range keys {
		if v := kv[flag]; v != "" {
			if inner != "" {
				inner += " "
			}
			inner += flag + "=" + v
		}
	}
	newEP := "<ExtraParams>" + inner + "</ExtraParams>"
	if loc != nil {
		return doc[:loc[0]] + newEP + doc[loc[1]:], true
	}
	if i := strings.LastIndex(doc, "</Container>"); i >= 0 {
		return doc[:i] + "  " + newEP + "\n" + doc[i:], true
	}
	return doc + "\n" + newEP + "\n", true
}

// FormatMemory writes a byte count the way a person types it into a template, in
// the largest of G, M or K that divides it evenly: 2147483648 becomes "2G" and
// half a gigabyte "512M". Docker reads these suffixes as powers of 1024, so it
// parses the text back into the same byte count.
func FormatMemory(b int64) string {
	for _, u := range []struct {
		size   int64
		suffix string
	}{{1 << 30, "G"}, {1 << 20, "M"}, {1 << 10, "K"}} {
		if b >= u.size && b%u.size == 0 {
			return strconv.FormatInt(b/u.size, 10) + u.suffix
		}
	}
	return strconv.FormatInt(b, 10)
}

// StripFlags removes the given docker flags from a space-separated ExtraParams
// string in both the "--flag=value" and the "--flag value" form, the latter
// taking the value token with it unless that token starts with a dash. A short
// flag such as "-m" also matches its attached form "-m2g". Quoted segments stay
// opaque, so flag text inside an --env value is left alone, and whatever is not
// removed comes back byte-identical.
func StripFlags(s string, flags ...string) string {
	if s == "" || len(flags) == 0 {
		return s
	}
	spans := tokenize(s)
	remove := make([]bool, len(spans))
	for i, sp := range spans {
		if remove[i] {
			continue // already consumed as a preceding flag's value
		}
		tok := s[sp[0]:sp[1]]
		for _, f := range flags {
			if f == "" || !matchFlag(tok, f) {
				continue
			}
			remove[i] = true
			if tok == f && i+1 < len(spans) { // a bare flag takes the next token as its value
				if next := s[spans[i+1][0]:spans[i+1][1]]; !strings.HasPrefix(next, "-") {
					remove[i+1] = true
				}
			}
			break
		}
	}
	// Merging runs of removed tokens lets a run at the end of the string drop the
	// gap in front of it, leaving no trailing space.
	type rng struct{ start, end int }
	var rngs []rng
	for i := 0; i < len(spans); i++ {
		if !remove[i] {
			continue
		}
		start, end := spans[i][0], spans[i][1]
		for i+1 < len(spans) && remove[i+1] {
			i++
			end = spans[i][1]
		}
		rngs = append(rngs, rng{start, end})
	}
	var b strings.Builder
	b.Grow(len(s))
	prev := 0
	for _, r := range rngs {
		start, end := r.start, r.end
		for end < len(s) && isSpace(s[end]) { // the gap after the run
			end++
		}
		if end == len(s) { // at the end of the string, take the gap in front instead
			for start > prev && isSpace(s[start-1]) {
				start--
			}
		}
		b.WriteString(s[prev:start])
		prev = end
	}
	b.WriteString(s[prev:])
	return b.String()
}

// matchFlag reports whether tok is flag f, written exactly ("--cpus"), joined by
// an equals sign ("--cpus=2"), or, for a short flag only, with the value attached
// ("-m2g"). None of the three lets "--memory" match "--memory-swap".
func matchFlag(tok, f string) bool {
	if tok == f || strings.HasPrefix(tok, f+"=") {
		return true
	}
	short := len(f) == 2 && f[0] == '-' && f[1] != '-'
	return short && len(tok) > 2 && strings.HasPrefix(tok, f) && tok[2] != '-'
}

// tokenize returns the byte spans of the whitespace-separated tokens. A quote,
// single or double, opens a run in which spaces do not split, mid-token as well,
// the way dockerMan hands ExtraParams to sh.
func tokenize(s string) [][2]int {
	var spans [][2]int
	for i := 0; i < len(s); {
		for i < len(s) && isSpace(s[i]) {
			i++
		}
		if i >= len(s) {
			break
		}
		start := i
		var q byte
		for i < len(s) {
			c := s[i]
			switch {
			case q != 0:
				if c == q {
					q = 0
				}
			case c == '"' || c == '\'':
				q = c
			}
			if q == 0 && isSpace(c) {
				break
			}
			i++
		}
		spans = append(spans, [2]int{start, i})
	}
	return spans
}

func isSpace(c byte) bool { return c == ' ' || c == '\t' || c == '\n' || c == '\r' }

func writeAtomic(path string, data []byte) error {
	// The temp name is unique so two writers to the same path cannot clobber each
	// other's partial file, and the fsync has to precede the rename: a rename alone
	// does not flush the data to the USB flash.
	f, err := os.CreateTemp(filepath.Dir(path), filepath.Base(path)+".tt-*.tmp")
	if err != nil {
		return err
	}
	tmp := f.Name()
	if _, err := f.Write(data); err != nil {
		_ = f.Close()
		_ = os.Remove(tmp)
		return err
	}
	if err := f.Sync(); err != nil {
		_ = f.Close()
		_ = os.Remove(tmp)
		return err
	}
	if err := f.Close(); err != nil {
		_ = os.Remove(tmp)
		return err
	}
	if err := os.Chmod(tmp, 0o644); err != nil { // CreateTemp makes 0600, the share needs 0644
		_ = os.Remove(tmp)
		return err
	}
	if err := os.Rename(tmp, path); err != nil {
		_ = os.Remove(tmp)
		return err
	}
	return nil
}
