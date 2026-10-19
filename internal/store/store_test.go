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
		if err := s.SaveConfig(model.Config{UISettings: map[string]string{"cc.anim": digit, "cc.accent": "#123456"}}); err != nil {
			t.Fatalf("save: %v", err)
		}
		c, err := s.LoadConfig()
		if err != nil {
			t.Fatalf("load: %v", err)
		}
		if c.UISettings["cc.anim"] != name {
			t.Errorf("cc.anim %q loaded as %q, want %q", digit, c.UISettings["cc.anim"], name)
		}
		if c.UISettings["cc.accent"] != "#123456" {
			t.Errorf("an unrelated setting changed: %q", c.UISettings["cc.accent"])
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
		if err := s.SaveConfig(model.Config{UISettings: map[string]string{"cc.badgeshape": old}}); err != nil {
			t.Fatalf("save: %v", err)
		}
		c, err := s.LoadConfig()
		if err != nil {
			t.Fatalf("load: %v", err)
		}
		if c.UISettings["cc.badgeshape"] != name {
			t.Errorf("cc.badgeshape %q loaded as %q, want %q", old, c.UISettings["cc.badgeshape"], name)
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
			errs <- s.SaveConfig(model.Config{UISettings: map[string]string{"cc.accent": fmt.Sprintf("#%06d", i)}})
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
	if !strings.HasPrefix(c.UISettings["cc.accent"], "#") {
		t.Errorf("config.json holds no whole write: %+v", c.UISettings)
	}
	left, _ := filepath.Glob(filepath.Join(dir, "*.tmp"))
	if len(left) != 0 {
		t.Errorf("temp files left behind: %v", left)
	}
}

func TestMergeUISettingsKeepsTheRestOfTheConfig(t *testing.T) {
	s := New(filepath.Join(t.TempDir(), "plan.json"))
	if err := s.SaveConfig(model.Config{ShapeIface: "br0", UISettings: map[string]string{"cc.accent": "#FCC419", "cc.rainbow": "1"}}); err != nil {
		t.Fatal(err)
	}
	blue := "#1D99F3"
	if err := s.MergeUISettings(map[string]*string{"cc.accent": &blue, "cc.rainbow": nil}); err != nil {
		t.Fatal(err)
	}
	c, err := s.LoadConfig()
	if err != nil {
		t.Fatal(err)
	}
	if c.ShapeIface != "br0" || c.UISettings["cc.accent"] != blue || len(c.UISettings) != 1 {
		t.Errorf("config after merge = %+v", c)
	}
}

func TestMergeUISettingsIntoAFreshConfig(t *testing.T) {
	s := New(filepath.Join(t.TempDir(), "plan.json"))
	v := "1"
	if err := s.MergeUISettings(map[string]*string{"cc.rainbow": &v}); err != nil {
		t.Fatal(err)
	}
	c, _ := s.LoadConfig()
	if c.UISettings["cc.rainbow"] != "1" {
		t.Errorf("ui settings = %v", c.UISettings)
	}
}

func TestMergeUISettingsCapsTheCount(t *testing.T) {
	s := New(filepath.Join(t.TempDir(), "plan.json"))
	ch := map[string]*string{}
	v := "x"
	for i := range MaxUISettings + 1 {
		ch[fmt.Sprintf("cc.k%d", i)] = &v
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
			if err := s.MergeUISettings(map[string]*string{fmt.Sprintf("cc.k%d", i): &v}); err != nil {
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
	ui := map[string]string{"cc.stylesettings": "0", "ccs.accent": "#ff8389", "ccs.iconbg": "0", "cc.accent": "#fcc419"}
	if err := s.SaveConfig(model.Config{UISettings: ui}); err != nil {
		t.Fatalf("save: %v", err)
	}
	c, err := s.LoadConfig()
	if err != nil {
		t.Fatalf("load: %v", err)
	}
	got := c.UISettings
	if got["cc.styletools"] != "0" || got["cct.accent"] != "#ff8389" || got["cct.iconbg"] != "0" {
		t.Errorf("tools keys = %v", got)
	}
	if got["ccs.accent"] != "#ff8389" || got["cc.stylesettings"] != "0" {
		t.Errorf("the settings keys changed: %v", got)
	}

	// Once Tools has a colour of its own, a later load leaves it alone.
	ui = map[string]string{"cc.styletools": "0", "cct.accent": "#1d99f3", "ccs.accent": "#ff8389"}
	if err := s.SaveConfig(model.Config{UISettings: ui}); err != nil {
		t.Fatalf("save: %v", err)
	}
	if c, _ = s.LoadConfig(); c.UISettings["cct.accent"] != "#1d99f3" {
		t.Errorf("cct.accent overwritten: %v", c.UISettings)
	}
}

func TestLoadConfigKeepsTheTilesOfAnAdoptingConfigOnce(t *testing.T) {
	s := New(filepath.Join(t.TempDir(), "plan.json"))
	ui := map[string]string{
		"cc.iconbgrainbow": "1", "cc.iconbg": "0", "cc.icontint": "0",
		"cc.styledocker": "0", "ccd.iconbg": "0", "cc.stylevms": "1", "ccv.iconbg": "0",
	}
	if err := s.SaveConfig(model.Config{UISettings: ui}); err != nil {
		t.Fatalf("save: %v", err)
	}
	c, err := s.LoadConfig()
	if err != nil {
		t.Fatalf("load: %v", err)
	}
	got := c.UISettings
	if got["cc.iconbg"] != "1" || got["cc.icontint"] != "1" || got["cc.iconadoptsplit"] != "1" {
		t.Errorf("global switches = %v", got)
	}
	if got["ccd.iconbg"] != "1" || got["ccd.icontint"] != "1" {
		t.Errorf("Docker has its own colours and keeps its tiles: %v", got)
	}
	if got["ccv.iconbg"] != "0" {
		t.Errorf("the VMs follow the global keys, so their own stay: %v", got)
	}

	// Saved with the marker and a switch turned off since, the next load leaves it off.
	got["cc.iconbg"] = "0"
	if err := s.SaveConfig(model.Config{UISettings: got}); err != nil {
		t.Fatalf("save: %v", err)
	}
	if c, _ = s.LoadConfig(); c.UISettings["cc.iconbg"] != "0" {
		t.Errorf("a switch turned off after the step came back on: %v", c.UISettings)
	}
}

func TestLoadConfigGivesTheSettingsAndToolsGridsTheirTilesOnce(t *testing.T) {
	s := New(filepath.Join(t.TempDir(), "plan.json"))
	ui := map[string]string{
		"cc.iconbgrainbow": "1", "cc.iconadoptsplit": "1", "cc.iconbg": "0",
		"cc.stylesettings": "0", "ccs.iconbg": "0", "cc.styletools": "1", "cct.iconbg": "0",
	}
	if err := s.SaveConfig(model.Config{UISettings: ui}); err != nil {
		t.Fatalf("save: %v", err)
	}
	c, _ := s.LoadConfig()
	got := c.UISettings
	if got["ccs.iconbg"] != "1" || got["ccs.icontint"] != "1" || got["cc.iconadoptgrid"] != "1" {
		t.Errorf("Settings has its own colours and gets its tiles and tint: %v", got)
	}
	if got["cct.iconbg"] != "0" || got["cct.icontint"] != "" || got["cc.iconbg"] != "0" {
		t.Errorf("Tools follows the global keys, so neither its own nor the global ones change: %v", got)
	}

	got["ccs.iconbg"] = "0"
	if err := s.SaveConfig(model.Config{UISettings: got}); err != nil {
		t.Fatalf("save: %v", err)
	}
	if c, _ = s.LoadConfig(); c.UISettings["ccs.iconbg"] != "0" {
		t.Errorf("a grid switch turned off after the step came back on: %v", c.UISettings)
	}
}

func TestLoadConfigMarksANonAdoptingConfigWithoutTouchingIt(t *testing.T) {
	s := New(filepath.Join(t.TempDir(), "plan.json"))
	if err := s.SaveConfig(model.Config{UISettings: map[string]string{"cc.iconbgrainbow": "0", "cc.iconbg": "0"}}); err != nil {
		t.Fatalf("save: %v", err)
	}
	c, _ := s.LoadConfig()
	if c.UISettings["cc.iconbg"] != "0" || c.UISettings["cc.iconadoptsplit"] != "1" || c.UISettings["cc.iconadoptgrid"] != "1" {
		t.Errorf("ui settings = %v", c.UISettings)
	}
}

func TestLoadConfigLeavesAFreshMirrorWithoutToolsKeys(t *testing.T) {
	s := New(filepath.Join(t.TempDir(), "plan.json"))
	if err := s.SaveConfig(model.Config{UISettings: map[string]string{"cc.accent": "#fcc419"}}); err != nil {
		t.Fatalf("save: %v", err)
	}
	c, _ := s.LoadConfig()
	if len(c.UISettings) != 1 {
		t.Errorf("ui settings = %v", c.UISettings)
	}
}
