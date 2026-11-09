// Package store persists the orchestration plan, the automation config and the
// notification channels as JSON on the Unraid flash
// (/boot/config/plugins/towertorch), so they survive reboots.
package store

import (
	"crypto/rand"
	"encoding/hex"
	"encoding/json"
	"errors"
	"os"
	"path/filepath"
	"strings"
	"sync"

	"github.com/junkerderprovinz/parleyport/kit/notify"
	"github.com/junkerderprovinz/parleyport/kit/notify/legacy"

	"github.com/junkerderprovinz/towertorch/internal/model"
)

// Store reads and writes the plan, the config and the notification channels,
// which live next to each other.
type Store struct {
	path       string // plan.json
	cfgPath    string // config.json (in the same dir)
	notifyPath string // notify.json
	idPath     string // instance-id
	mu         sync.Mutex
}

// New builds a store backed by the given plan JSON file path; the config,
// channels and instance id live in the same directory.
func New(path string) *Store {
	dir := filepath.Dir(path)
	return &Store{
		path:       path,
		cfgPath:    filepath.Join(dir, "config.json"),
		notifyPath: filepath.Join(dir, "notify.json"),
		idPath:     filepath.Join(dir, "instance-id"),
	}
}

// Load reads the plan. A missing or empty file yields an empty plan, not an
// error, so a fresh install starts clean.
func (s *Store) Load() (model.Plan, error) {
	var p model.Plan
	err := readJSON(s.path, &p)
	return p, err
}

// Save writes the plan atomically (temp file + rename).
func (s *Store) Save(p model.Plan) error { return s.write(s.path, p) }

// LoadConfig reads the automation config. A missing or empty file yields the
// zero Config, with nothing scheduled or watched.
func (s *Store) LoadConfig() (model.Config, error) {
	var c model.Config
	err := readJSON(s.cfgPath, &c)
	renameUIValues(c.UISettings)
	splitToolsKeys(c.UISettings)
	keepAdoptedTiles(c.UISettings)
	keepAdoptedGridTiles(c.UISettings)
	return c, err
}

// adoptAreas maps each area whose logos can have a tile of their own to the key that says it
// keeps its own colours and the prefix of those colours.
var adoptAreas = map[string]string{"tt.styledocker": "ttd.", "tt.stylevms": "ttv.", "tt.styleplugin": "ttp."}

// keepAdoptedTiles turns the tile and tint switches on once for a config that adopts the badge
// colours, globally and for every area with colours of its own, so its logos keep the tile and
// the ink adopting gave them. tt-theme.js runs the same step in the browser. tt.iconadoptsplit
// marks it done, so a switch turned off later stays off.
func keepAdoptedTiles(ui map[string]string) {
	adopt, seen := ui["tt.iconbgrainbow"]
	if !seen || ui["tt.iconadoptsplit"] != "" {
		return
	}
	if adopt == "1" {
		ui["tt.iconbg"], ui["tt.icontint"] = "1", "1"
		for key, prefix := range adoptAreas {
			if ui[key] == "0" {
				ui[prefix+"iconbg"], ui[prefix+"icontint"] = "1", "1"
			}
		}
	}
	ui["tt.iconadoptsplit"] = "1"
}

// gridAdoptAreas lists the Settings and Tools grids the way adoptAreas lists the other areas.
var gridAdoptAreas = map[string]string{"tt.stylesettings": "tts.", "tt.styletools": "ttt."}

// keepAdoptedGridTiles takes the keepAdoptedTiles step for the Settings and Tools grids under a
// marker of its own, tt.iconadoptgrid, so a config that has already run that step gets it for
// the grids as well. tt-theme.js runs the same step in the browser.
func keepAdoptedGridTiles(ui map[string]string) {
	adopt, seen := ui["tt.iconbgrainbow"]
	if !seen || ui["tt.iconadoptgrid"] != "" {
		return
	}
	if adopt == "1" {
		for key, prefix := range gridAdoptAreas {
			if ui[key] == "0" {
				ui[prefix+"iconbg"], ui[prefix+"icontint"] = "1", "1"
			}
		}
	}
	ui["tt.iconadoptgrid"] = "1"
}

// splitToolsKeys copies the Settings keys to the Tools keys once, as tt-theme.js
// does in the browser, so a page adopting the mirror on another origin finds
// /Tools unchanged. A set tt.styletools marks the copy as done.
func splitToolsKeys(ui map[string]string) {
	if ui == nil {
		return
	}
	if _, done := ui["tt.styletools"]; done {
		return
	}
	adopt, seen := ui["tt.stylesettings"]
	for k, v := range ui {
		rest, ok := strings.CutPrefix(k, "tts.")
		if !ok {
			continue
		}
		seen = true
		if _, set := ui["ttt."+rest]; !set {
			ui["ttt."+rest] = v
		}
	}
	if !seen {
		return
	}
	if adopt == "" {
		adopt = "1"
	}
	ui["tt.styletools"] = adopt
}

// uiValueNames maps UI setting values stored under an older name to the current
// one, so a browser adopting the mirror on a new origin gets the current name.
var uiValueNames = map[string]map[string]string{
	"tt.anim":       {"0": "off", "1": "subtle", "2": "wild"},
	"tt.badgeshape": {"pill": "round", "rounded": "soft", "circle": "round"},
}

func renameUIValues(ui map[string]string) {
	for key, names := range uiValueNames {
		if name, ok := names[ui[key]]; ok {
			ui[key] = name
		}
	}
}

// SaveConfig writes the automation config atomically. The settings page edits
// notifications as the config's notify block, so a changed block replaces the
// unraid and webhook channels and leaves every other channel as it is.
func (s *Store) SaveConfig(c model.Config) error {
	s.mu.Lock()
	defer s.mu.Unlock()
	var old model.Config
	oldErr := readJSON(s.cfgPath, &old)
	if err := writeJSON(s.cfgPath, c); err != nil {
		return err
	}
	if oldErr == nil && old.Notify == c.Notify {
		return nil
	}
	channels, err := s.channels()
	if err != nil {
		return err
	}
	fromBlock, err := blockChannels(c.Notify)
	if err != nil {
		return err
	}
	for _, ch := range channels {
		if ch.ID != "unraid" && ch.ID != "webhook" {
			fromBlock = append(fromBlock, ch)
		}
	}
	return writeJSON(s.notifyPath, fromBlock)
}

// LoadChannels reads the notification channels. Without notify.json yet, it
// builds them from the notify block of the config and saves them, leaving the
// block in place for an older TowerTorch.
func (s *Store) LoadChannels() ([]notify.Channel, error) {
	s.mu.Lock()
	defer s.mu.Unlock()
	return s.channels()
}

func (s *Store) channels() ([]notify.Channel, error) {
	var out []notify.Channel
	b, err := os.ReadFile(s.notifyPath)
	if err == nil {
		if len(b) == 0 {
			return nil, nil
		}
		return out, json.Unmarshal(b, &out)
	}
	if !errors.Is(err, os.ErrNotExist) {
		return nil, err
	}
	var c model.Config
	if err := readJSON(s.cfgPath, &c); err != nil {
		return nil, err
	}
	if out, err = blockChannels(c.Notify); err != nil {
		return nil, err
	}
	return out, writeJSON(s.notifyPath, out)
}

// blockChannels turns a notify block into its channels, never nil, so the file
// holds a list.
func blockChannels(n model.Notify) ([]notify.Channel, error) {
	b, err := json.Marshal(n)
	if err != nil {
		return nil, err
	}
	out, err := legacy.FromUnraidWebhook(b)
	if out == nil {
		out = []notify.Channel{}
	}
	return out, err
}

// InstanceID names this install to the other apps of a fortress. It is made
// once and kept on the flash, so it survives reboots and updates.
func (s *Store) InstanceID() (string, error) {
	s.mu.Lock()
	defer s.mu.Unlock()
	b, err := os.ReadFile(s.idPath)
	if err == nil && len(strings.TrimSpace(string(b))) > 0 {
		return strings.TrimSpace(string(b)), nil
	}
	if err != nil && !errors.Is(err, os.ErrNotExist) {
		return "", err
	}
	raw := make([]byte, 16)
	if _, err := rand.Read(raw); err != nil {
		return "", err
	}
	id := hex.EncodeToString(raw)
	if err := os.MkdirAll(filepath.Dir(s.idPath), 0o755); err != nil {
		return "", err
	}
	return id, os.WriteFile(s.idPath, []byte(id+"\n"), 0o644)
}

// ErrTooManyUISettings is returned by MergeUISettings when the merge would hold
// more entries than a config may.
var ErrTooManyUISettings = errors.New("too many ui settings")

// MaxUISettings caps the mirrored browser settings in one config.
const MaxUISettings = 512

// MergeUISettings sets the given UI settings in the stored config and deletes
// those mapped to nil, leaving the rest of the config as it is. The read and the
// write happen under one lock, so a page closing mid-save cannot lose a key to a
// concurrent save.
func (s *Store) MergeUISettings(changes map[string]*string) error {
	s.mu.Lock()
	defer s.mu.Unlock()
	var c model.Config
	if err := readJSON(s.cfgPath, &c); err != nil {
		return err
	}
	if c.UISettings == nil {
		c.UISettings = map[string]string{}
	}
	for k, v := range changes {
		if v == nil {
			delete(c.UISettings, k)
		} else {
			c.UISettings[k] = *v
		}
	}
	if len(c.UISettings) > MaxUISettings {
		return ErrTooManyUISettings
	}
	return writeJSON(s.cfgPath, c)
}

// write serialises the saves, so two requests landing together replace the file
// one after the other and the last one wins whole.
func (s *Store) write(path string, v any) error {
	s.mu.Lock()
	defer s.mu.Unlock()
	return writeJSON(path, v)
}

func readJSON(path string, v any) error {
	b, err := os.ReadFile(path)
	if errors.Is(err, os.ErrNotExist) || (err == nil && len(b) == 0) {
		return nil // fresh: leave v at its zero value
	}
	if err != nil {
		return err
	}
	return json.Unmarshal(b, v)
}

// writeJSON writes to a temp file, fsyncs it and renames it over the target. The
// fsync has to happen before the rename: the Unraid flash is unjournaled FAT32,
// so without it a power loss can leave a present but half-written file. Each
// write gets its own temp name, so two writers never share one temp file.
func writeJSON(path string, v any) error {
	if err := os.MkdirAll(filepath.Dir(path), 0o755); err != nil {
		return err
	}
	b, err := json.MarshalIndent(v, "", "  ")
	if err != nil {
		return err
	}
	f, err := os.CreateTemp(filepath.Dir(path), filepath.Base(path)+".*.tmp")
	if err != nil {
		return err
	}
	tmp := f.Name()
	if err := f.Chmod(0o644); err != nil {
		_ = f.Close()
		_ = os.Remove(tmp)
		return err
	}
	if _, err := f.Write(b); err != nil {
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
	if err := os.Rename(tmp, path); err != nil {
		_ = os.Remove(tmp) // don't leave an orphaned .tmp on the flash
		return err
	}
	return nil
}
