package store

import (
	"errors"
	"fmt"
	"path/filepath"
	"strings"
	"sync"
	"testing"

	"github.com/junkerderprovinz/towertorch/internal/model"
)

func TestLoadMissingIsEmpty(t *testing.T) {
	s := New(filepath.Join(t.TempDir(), "nope", "plan.json"))
	p, err := s.Load()
	if err != nil {
		t.Fatalf("load of a missing file must not error: %v", err)
	}
	if len(p.Nodes) != 0 {
		t.Fatalf("missing file should yield an empty plan, got %d nodes", len(p.Nodes))
	}
}

func TestSaveLoadRoundTrip(t *testing.T) {
	s := New(filepath.Join(t.TempDir(), "sub", "plan.json"))
	want := model.Plan{Nodes: []model.Node{
		{Name: "gluetun", Probe: model.Probe{Kind: model.ProbeTCP, Port: 8000, TimeoutSeconds: 60}, Policy: model.PolicyAbort},
		{Name: "qbittorrent", After: []string{"gluetun"}, Probe: model.Probe{Kind: model.ProbeHealth}, Policy: model.PolicyDegrade},
	}}
	if err := s.Save(want); err != nil {
		t.Fatalf("save: %v", err)
	}
	got, err := s.Load()
	if err != nil {
		t.Fatalf("load: %v", err)
	}
	if len(got.Nodes) != 2 || got.Nodes[0].Name != "gluetun" || got.Nodes[1].After[0] != "gluetun" {
		t.Fatalf("round-trip mismatch: %+v", got)
	}
	if got.Nodes[0].Probe.Port != 8000 || got.Nodes[1].Policy != model.PolicyDegrade {
		t.Fatalf("fields not preserved: %+v", got)
	}
}

func TestLoadConfigNamesTheOldMotionDigits(t *testing.T) {
	for digit, name := range map[string]string{"0": "off", "1": "subtle", "2": "wild", "wild": "wild"} {
		s := New(filepath.Join(t.TempDir(), "plan.json"))
		if err := s.SaveConfig(model.Config{UISettings: map[string]string{"tt.anim": digit, "tt.accent": "#123456"}}); err != nil {
			t.Fatalf("save: %v", err)
		}
		c, err := s.LoadConfig()
		if err != nil {
			t.Fatalf("load: %v", err)
		}
		if c.UISettings["tt.anim"] != name {
			t.Errorf("tt.anim %q loaded as %q, want %q", digit, c.UISettings["tt.anim"], name)
		}
		if c.UISettings["tt.accent"] != "#123456" {
			t.Errorf("an unrelated setting changed: %q", c.UISettings["tt.accent"])
		}
	}
}

func TestLoadConfigWithoutUISettings(t *testing.T) {
	s := New(filepath.Join(t.TempDir(), "plan.json"))
	if err := s.SaveConfig(model.Config{}); err != nil {
		t.Fatalf("save: %v", err)
	}
	if _, err := s.LoadConfig(); err != nil {
		t.Fatalf("load: %v", err)
	}
}

func TestLoadConfigNamesTheOldShapes(t *testing.T) {
	for old, name := range map[string]string{"pill": "round", "rounded": "soft", "square": "square", "circle": "round", "soft": "soft"} {
		s := New(filepath.Join(t.TempDir(), "plan.json"))
		if err := s.SaveConfig(model.Config{UISettings: map[string]string{"tt.badgeshape": old}}); err != nil {
			t.Fatalf("save: %v", err)
		}
		c, err := s.LoadConfig()
		if err != nil {
			t.Fatalf("load: %v", err)
		}
		if c.UISettings["tt.badgeshape"] != name {
			t.Errorf("tt.badgeshape %q loaded as %q, want %q", old, c.UISettings["tt.badgeshape"], name)
		}
	}
}

func TestConcurrentConfigSavesAllSucceed(t *testing.T) {
	dir := t.TempDir()
	s := New(filepath.Join(dir, "plan.json"))
	const writers = 16
	errs := make(chan error, writers)
	var wg sync.WaitGroup
	for i := range writers {
		wg.Add(1)
		go func() {
			defer wg.Done()
			errs <- s.SaveConfig(model.Config{UISettings: map[string]string{"tt.accent": fmt.Sprintf("#%06d", i)}})
		}()
	}
	wg.Wait()
	close(errs)
	for err := range errs {
		if err != nil {
			t.Errorf("save: %v", err)
		}
	}
	c, err := s.LoadConfig()
	if err != nil {
		t.Fatalf("load: %v", err)
	}
	if !strings.HasPrefix(c.UISettings["tt.accent"], "#") {
		t.Errorf("config.json holds no whole write: %+v", c.UISettings)
	}
	left, _ := filepath.Glob(filepath.Join(dir, "*.tmp"))
	if len(left) != 0 {
		t.Errorf("temp files left behind: %v", left)
	}
}

func TestMergeUISettingsKeepsTheRestOfTheConfig(t *testing.T) {
	s := New(filepath.Join(t.TempDir(), "plan.json"))
	if err := s.SaveConfig(model.Config{ShapeIface: "br0", UISettings: map[string]string{"tt.accent": "#FCC419", "tt.rainbow": "1"}}); err != nil {
		t.Fatal(err)
	}
	blue := "#1D99F3"
	if err := s.MergeUISettings(map[string]*string{"tt.accent": &blue, "tt.rainbow": nil}); err != nil {
		t.Fatal(err)
	}
	c, err := s.LoadConfig()
	if err != nil {
		t.Fatal(err)
	}
	if c.ShapeIface != "br0" || c.UISettings["tt.accent"] != blue || len(c.UISettings) != 1 {
		t.Errorf("config after merge = %+v", c)
	}
}

func TestMergeUISettingsIntoAFreshConfig(t *testing.T) {
	s := New(filepath.Join(t.TempDir(), "plan.json"))
	v := "1"
	if err := s.MergeUISettings(map[string]*string{"tt.rainbow": &v}); err != nil {
		t.Fatal(err)
	}
	c, _ := s.LoadConfig()
	if c.UISettings["tt.rainbow"] != "1" {
		t.Errorf("ui settings = %v", c.UISettings)
	}
}

func TestMergeUISettingsCapsTheCount(t *testing.T) {
	s := New(filepath.Join(t.TempDir(), "plan.json"))
	ch := map[string]*string{}
	v := "x"
	for i := range MaxUISettings + 1 {
		ch[fmt.Sprintf("tt.k%d", i)] = &v
	}
	if err := s.MergeUISettings(ch); !errors.Is(err, ErrTooManyUISettings) {
		t.Errorf("err = %v, want ErrTooManyUISettings", err)
	}
}

func TestConcurrentMergesKeepEveryKey(t *testing.T) {
	s := New(filepath.Join(t.TempDir(), "plan.json"))
	const writers = 16
	var wg sync.WaitGroup
	for i := range writers {
		wg.Add(1)
		go func() {
			defer wg.Done()
			v := fmt.Sprint(i)
			if err := s.MergeUISettings(map[string]*string{fmt.Sprintf("tt.k%d", i): &v}); err != nil {
				t.Errorf("merge: %v", err)
			}
		}()
	}
	wg.Wait()
	c, _ := s.LoadConfig()
	if len(c.UISettings) != writers {
		t.Errorf("%d keys survived, want %d", len(c.UISettings), writers)
	}
}

func TestLoadConfigGivesToolsTheSettingsKeysOnce(t *testing.T) {
	s := New(filepath.Join(t.TempDir(), "plan.json"))
	ui := map[string]string{"tt.stylesettings": "0", "tts.accent": "#ff8389", "tts.iconbg": "0", "tt.accent": "#fcc419"}
	if err := s.SaveConfig(model.Config{UISettings: ui}); err != nil {
		t.Fatalf("save: %v", err)
	}
	c, err := s.LoadConfig()
	if err != nil {
		t.Fatalf("load: %v", err)
	}
	got := c.UISettings
	if got["tt.styletools"] != "0" || got["ttt.accent"] != "#ff8389" || got["ttt.iconbg"] != "0" {
		t.Errorf("tools keys = %v", got)
	}
	if got["tts.accent"] != "#ff8389" || got["tt.stylesettings"] != "0" {
		t.Errorf("the settings keys changed: %v", got)
	}

	// Once Tools has a colour of its own, a later load leaves it alone.
	ui = map[string]string{"tt.styletools": "0", "ttt.accent": "#1d99f3", "tts.accent": "#ff8389"}
	if err := s.SaveConfig(model.Config{UISettings: ui}); err != nil {
		t.Fatalf("save: %v", err)
	}
	if c, _ = s.LoadConfig(); c.UISettings["ttt.accent"] != "#1d99f3" {
		t.Errorf("ttt.accent overwritten: %v", c.UISettings)
	}
}

func TestLoadConfigKeepsTheTilesOfAnAdoptingConfigOnce(t *testing.T) {
	s := New(filepath.Join(t.TempDir(), "plan.json"))
	ui := map[string]string{
		"tt.iconbgrainbow": "1", "tt.iconbg": "0", "tt.icontint": "0",
		"tt.styledocker": "0", "ttd.iconbg": "0", "tt.stylevms": "1", "ttv.iconbg": "0",
	}
	if err := s.SaveConfig(model.Config{UISettings: ui}); err != nil {
		t.Fatalf("save: %v", err)
	}
	c, err := s.LoadConfig()
	if err != nil {
		t.Fatalf("load: %v", err)
	}
	got := c.UISettings
	if got["tt.iconbg"] != "1" || got["tt.icontint"] != "1" || got["tt.iconadoptsplit"] != "1" {
		t.Errorf("global switches = %v", got)
	}
	if got["ttd.iconbg"] != "1" || got["ttd.icontint"] != "1" {
		t.Errorf("Docker has its own colours and keeps its tiles: %v", got)
	}
	if got["ttv.iconbg"] != "0" {
		t.Errorf("the VMs follow the global keys, so their own stay: %v", got)
	}

	// Saved with the marker and a switch turned off since, the next load leaves it off.
	got["tt.iconbg"] = "0"
	if err := s.SaveConfig(model.Config{UISettings: got}); err != nil {
		t.Fatalf("save: %v", err)
	}
	if c, _ = s.LoadConfig(); c.UISettings["tt.iconbg"] != "0" {
		t.Errorf("a switch turned off after the step came back on: %v", c.UISettings)
	}
}

func TestLoadConfigGivesTheSettingsAndToolsGridsTheirTilesOnce(t *testing.T) {
	s := New(filepath.Join(t.TempDir(), "plan.json"))
	ui := map[string]string{
		"tt.iconbgrainbow": "1", "tt.iconadoptsplit": "1", "tt.iconbg": "0",
		"tt.stylesettings": "0", "tts.iconbg": "0", "tt.styletools": "1", "ttt.iconbg": "0",
	}
	if err := s.SaveConfig(model.Config{UISettings: ui}); err != nil {
		t.Fatalf("save: %v", err)
	}
	c, _ := s.LoadConfig()
	got := c.UISettings
	if got["tts.iconbg"] != "1" || got["tts.icontint"] != "1" || got["tt.iconadoptgrid"] != "1" {
		t.Errorf("Settings has its own colours and gets its tiles and tint: %v", got)
	}
	if got["ttt.iconbg"] != "0" || got["ttt.icontint"] != "" || got["tt.iconbg"] != "0" {
		t.Errorf("Tools follows the global keys, so neither its own nor the global ones change: %v", got)
	}

	got["tts.iconbg"] = "0"
	if err := s.SaveConfig(model.Config{UISettings: got}); err != nil {
		t.Fatalf("save: %v", err)
	}
	if c, _ = s.LoadConfig(); c.UISettings["tts.iconbg"] != "0" {
		t.Errorf("a grid switch turned off after the step came back on: %v", c.UISettings)
	}
}

func TestLoadConfigMarksANonAdoptingConfigWithoutTouchingIt(t *testing.T) {
	s := New(filepath.Join(t.TempDir(), "plan.json"))
	if err := s.SaveConfig(model.Config{UISettings: map[string]string{"tt.iconbgrainbow": "0", "tt.iconbg": "0"}}); err != nil {
		t.Fatalf("save: %v", err)
	}
	c, _ := s.LoadConfig()
	if c.UISettings["tt.iconbg"] != "0" || c.UISettings["tt.iconadoptsplit"] != "1" || c.UISettings["tt.iconadoptgrid"] != "1" {
		t.Errorf("ui settings = %v", c.UISettings)
	}
}

func TestLoadConfigLeavesAFreshMirrorWithoutToolsKeys(t *testing.T) {
	s := New(filepath.Join(t.TempDir(), "plan.json"))
	if err := s.SaveConfig(model.Config{UISettings: map[string]string{"tt.accent": "#fcc419"}}); err != nil {
		t.Fatalf("save: %v", err)
	}
	c, _ := s.LoadConfig()
	if len(c.UISettings) != 1 {
		t.Errorf("ui settings = %v", c.UISettings)
	}
}
