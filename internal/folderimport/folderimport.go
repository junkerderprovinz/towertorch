// Package folderimport reads the Docker folders that another folder plugin
// keeps on the flash drive, so that TowerTorch can offer to take them over into
// Unraid's own Docker organizer. It only ever reads those files.
package folderimport

import (
	"bufio"
	"bytes"
	"encoding/json"
	"errors"
	"fmt"
	"io/fs"
	"os"
	"path/filepath"
	"regexp"
	"slices"
	"sort"
	"strconv"
	"strings"
)

// DefaultRoot is where Unraid plugins keep their configuration.
const DefaultRoot = "/boot/config/plugins"

// Folder is one folder as it would land in the organizer, parents always
// listed before their children. Members are the containers that exist now,
// each claimed by one folder only; Gone are the ones the folder names that no
// longer exist.
type Folder struct {
	ID      string   `json:"id"`
	Name    string   `json:"name"`
	Parent  string   `json:"parent,omitempty"`
	Color   string   `json:"color,omitempty"`
	Members []string `json:"members"`
	Gone    []string `json:"gone,omitempty"`
}

// Container is what membership needs to know of a live container.
type Container struct {
	Name   string
	Labels map[string]string
}

// The newest layout comes first: it keeps nesting and its own order file, and
// it migrates the older ones, which share one flat layout and order folders by
// the Docker page's saved order.
var sources = []struct {
	dir  string
	plus bool
}{
	{"folderview.plus", true},
	{"folder.view3", false},
	{"folder.view2", false},
	{"folder.view", false},
}

// labelKeys are the container labels that assign a container to a folder by
// its name, the first one set deciding.
var labelKeys = []string{"folderview.plus", "folder.view3", "folder.view2", "folder.view"}

var hexColour = regexp.MustCompile(`^#[0-9a-fA-F]{6}$`)

type source struct {
	id         string
	name       string
	parent     string
	regex      string
	containers []string
	color      string
	childOrder []string
}

// Read returns the folders of the first config under root that has any, with
// their members resolved against the live containers. No config at all is no
// folders and no error.
func Read(root string, live []Container) ([]Folder, error) {
	for _, s := range sources {
		data, err := os.ReadFile(filepath.Join(root, s.dir, "docker.json"))
		if errors.Is(err, fs.ErrNotExist) {
			continue
		}
		if err != nil {
			return nil, err
		}
		folders, err := parse(data, s.plus)
		if err != nil {
			return nil, fmt.Errorf("%s/docker.json: %w", s.dir, err)
		}
		if len(folders) == 0 {
			continue
		}
		var order []string
		if s.plus {
			order = plusOrder(folders, filepath.Join(root, s.dir, "docker.prefs.json"))
		} else {
			order = pageOrder(folders, filepath.Join(root, "dockerMan", "userprefs.cfg"))
		}
		return resolve(nest(folders, order), live), nil
	}
	return []Folder{}, nil
}

func parse(data []byte, plus bool) ([]source, error) {
	keys, raw, err := objectKeys(data)
	if err != nil {
		return nil, err
	}
	out := make([]source, 0, len(keys))
	for _, id := range jsKeyOrder(keys) {
		var f struct {
			Name       any            `json:"name"`
			Regex      any            `json:"regex"`
			Containers []any          `json:"containers"`
			ParentID   any            `json:"parentId"`
			Settings   map[string]any `json:"settings"`
		}
		if json.Unmarshal(raw[id], &f) != nil {
			continue
		}
		s := source{id: id, name: strings.TrimSpace(scalar(f.Name)), regex: scalar(f.Regex)}
		if s.name == "" {
			s.name = id
		}
		for _, c := range f.Containers {
			if n, ok := c.(string); ok && n != "" {
				s.containers = append(s.containers, n)
			}
		}
		if plus {
			s.parent = strings.TrimSpace(scalar(f.ParentID))
			if on, _ := f.Settings["folder_accent_enabled"].(bool); on {
				if c, _ := f.Settings["folder_accent_color"].(string); hexColour.MatchString(c) {
					s.color = strings.ToLower(c)
				}
			}
			if kids, ok := f.Settings["child_folder_order"].([]any); ok {
				for _, k := range kids {
					if id, ok := k.(string); ok {
						s.childOrder = append(s.childOrder, id)
					}
				}
			}
		}
		out = append(out, s)
	}
	return out, nil
}

func scalar(v any) string {
	switch x := v.(type) {
	case string:
		return x
	case float64:
		return strconv.FormatFloat(x, 'f', -1, 64)
	}
	return ""
}

// objectKeys decodes a JSON object keeping the order its keys were written in,
// which a Go map loses.
func objectKeys(data []byte) ([]string, map[string]json.RawMessage, error) {
	dec := json.NewDecoder(bytes.NewReader(data))
	if tok, err := dec.Token(); err != nil || tok != json.Delim('{') {
		if err == nil {
			err = errors.New("not a JSON object")
		}
		return nil, nil, err
	}
	var keys []string
	raw := map[string]json.RawMessage{}
	for dec.More() {
		tok, err := dec.Token()
		if err != nil {
			return nil, nil, err
		}
		key, _ := tok.(string)
		var v json.RawMessage
		if err := dec.Decode(&v); err != nil {
			return nil, nil, err
		}
		if _, seen := raw[key]; !seen {
			keys = append(keys, key)
		}
		raw[key] = v
	}
	if _, err := dec.Token(); err != nil {
		return nil, nil, err
	}
	return keys, raw, nil
}

// jsKeyOrder is the order a browser walks an object's keys in, which is the
// order the plugins draw their folders in: array-index keys ascending first,
// then the rest as written.
func jsKeyOrder(keys []string) []string {
	var index, rest []string
	for _, k := range keys {
		if n, err := strconv.ParseUint(k, 10, 32); err == nil && n < 1<<32-1 && strconv.FormatUint(n, 10) == k {
			index = append(index, k)
		} else {
			rest = append(rest, k)
		}
	}
	sort.SliceStable(index, func(i, j int) bool {
		a, _ := strconv.ParseUint(index[i], 10, 32)
		b, _ := strconv.ParseUint(index[j], 10, 32)
		return a < b
	})
	return append(index, rest...)
}

func ids(folders []source) []string {
	out := make([]string, len(folders))
	for i, f := range folders {
		out[i] = f.id
	}
	return out
}

func byNameOrder(folders []source) []string {
	sorted := append([]source(nil), folders...)
	sort.SliceStable(sorted, func(i, j int) bool { return strings.ToLower(sorted[i].name) < strings.ToLower(sorted[j].name) })
	return ids(sorted)
}

// plusOrder applies the saved sort: a manual order or by name, pinned
// folders first. The time-based sorts fall back to the file's order.
func plusOrder(folders []source, prefsPath string) []string {
	var prefs struct {
		SortMode    string   `json:"sortMode"`
		ManualOrder []string `json:"manualOrder"`
		Pinned      []string `json:"pinnedFolderIds"`
	}
	if data, err := os.ReadFile(prefsPath); err == nil {
		_ = json.Unmarshal(data, &prefs)
	}
	var order []string
	switch prefs.SortMode {
	case "manual":
		order = append(append([]string(nil), prefs.ManualOrder...), ids(folders)...)
	case "alpha":
		order = byNameOrder(folders)
	case "name_desc":
		order = byNameOrder(folders)
		for i, j := 0, len(order)-1; i < j; i, j = i+1, j-1 {
			order[i], order[j] = order[j], order[i]
		}
	default:
		order = ids(folders)
	}
	return append(append([]string(nil), prefs.Pinned...), order...)
}

// pageOrder is the order the Docker page shows the folders in: those its saved
// order names, as folder-<id> entries, in that order, then the rest as the file
// lists them. With nothing saved the page sorts them by name.
func pageOrder(folders []source, prefsPath string) []string {
	f, err := os.Open(prefsPath)
	if err != nil {
		return byNameOrder(folders)
	}
	defer func() { _ = f.Close() }()
	var order []string
	sc := bufio.NewScanner(f)
	for sc.Scan() {
		_, v, ok := strings.Cut(sc.Text(), "=")
		if !ok {
			continue
		}
		if id, ok := strings.CutPrefix(strings.Trim(strings.TrimSpace(v), `"`), "folder-"); ok {
			order = append(order, id)
		}
	}
	if len(order) == 0 {
		return byNameOrder(folders)
	}
	return append(order, ids(folders)...)
}

// nest walks the folders parents first, siblings in the given order. A folder
// whose parent is missing, or whose parents lead back to itself, sits at the
// top.
func nest(folders []source, order []string) []source {
	byID := map[string]*source{}
	for i := range folders {
		byID[folders[i].id] = &folders[i]
	}
	rank := map[string]int{}
	for _, id := range order {
		if _, ok := rank[id]; !ok {
			rank[id] = len(rank)
		}
	}
	var top []*source
	for _, f := range byID {
		if f.parent != "" && (byID[f.parent] == nil || loops(byID, f.id)) {
			top = append(top, f)
		}
	}
	for _, f := range top {
		f.parent = ""
	}
	kids := map[string][]*source{}
	for _, id := range order {
		f := byID[id]
		if f == nil || slices.Contains(kids[f.parent], f) {
			continue
		}
		kids[f.parent] = append(kids[f.parent], f)
	}
	var out []source
	var walk func(parent string)
	walk = func(parent string) {
		list := kids[parent]
		if p := byID[parent]; p != nil && len(p.childOrder) > 0 {
			list = childSorted(list, p.childOrder, rank)
		}
		for _, f := range list {
			out = append(out, *f)
			walk(f.id)
		}
	}
	walk("")
	return out
}

func loops(byID map[string]*source, id string) bool {
	seen := map[string]bool{}
	for cur := byID[id]; cur != nil && cur.parent != ""; cur = byID[cur.parent] {
		if cur.parent == id || seen[cur.parent] {
			return true
		}
		seen[cur.parent] = true
	}
	return false
}

// childSorted puts the children a parent's own order names first, in that
// order, and the rest after them in the global order.
func childSorted(list []*source, childOrder []string, rank map[string]int) []*source {
	pos := map[string]int{}
	for i, id := range childOrder {
		if _, ok := pos[id]; !ok {
			pos[id] = i
		}
	}
	out := append([]*source(nil), list...)
	sort.SliceStable(out, func(i, j int) bool {
		pi, iok := pos[out[i].id]
		pj, jok := pos[out[j].id]
		if iok != jok {
			return iok
		}
		if iok {
			return pi < pj
		}
		return rank[out[i].id] < rank[out[j].id]
	})
	return out
}

// resolve hands each live container to one folder. A folder naming it wins,
// the first such folder in the walk order; then a label naming the folder;
// then the first folder whose name pattern matches it.
func resolve(folders []source, live []Container) []Folder {
	exists := map[string]bool{}
	var liveNames []string
	for _, c := range live {
		if c.Name != "" && !exists[c.Name] {
			exists[c.Name] = true
			liveNames = append(liveNames, c.Name)
		}
	}
	sort.Strings(liveNames)
	out := make([]Folder, len(folders))
	claimed := map[string]bool{}
	for i, f := range folders {
		out[i] = Folder{ID: f.id, Name: f.name, Parent: f.parent, Color: f.color, Members: []string{}}
		for _, n := range f.containers {
			switch {
			case !exists[n]:
				if !slices.Contains(out[i].Gone, n) {
					out[i].Gone = append(out[i].Gone, n)
				}
			case !claimed[n]:
				claimed[n] = true
				out[i].Members = append(out[i].Members, n)
			}
		}
	}
	firstNamed := map[string]int{}
	for i := len(out) - 1; i >= 0; i-- {
		firstNamed[out[i].Name] = i
	}
	labelled := map[string]string{}
	for _, c := range live {
		for _, k := range labelKeys {
			if v := strings.TrimSpace(c.Labels[k]); v != "" {
				labelled[c.Name] = v
				break
			}
		}
	}
	for _, n := range liveNames {
		if i, ok := firstNamed[labelled[n]]; ok && !claimed[n] {
			claimed[n] = true
			out[i].Members = append(out[i].Members, n)
		}
	}
	for i, f := range folders {
		if strings.TrimSpace(f.regex) == "" {
			continue
		}
		re, err := regexp.Compile(f.regex)
		if err != nil {
			continue
		}
		for _, n := range liveNames {
			if !claimed[n] && re.MatchString(n) {
				claimed[n] = true
				out[i].Members = append(out[i].Members, n)
			}
		}
	}
	return out
}
