package folderimport

import (
	"path/filepath"
	"reflect"
	"testing"
)

func live(names ...string) []Container {
	out := make([]Container, 0, len(names))
	for _, n := range names {
		out = append(out, Container{Name: n})
	}
	return out
}

func read(t *testing.T, dir string, cts []Container) []Folder {
	t.Helper()
	got, err := Read(filepath.Join("testdata", dir), cts)
	if err != nil {
		t.Fatalf("Read(%s): %v", dir, err)
	}
	return got
}

func names(fs []Folder) []string {
	out := make([]string, 0, len(fs))
	for _, f := range fs {
		out = append(out, f.Name)
	}
	return out
}

func byName(t *testing.T, fs []Folder, name string) Folder {
	t.Helper()
	for _, f := range fs {
		if f.Name == name {
			return f
		}
	}
	t.Fatalf("no folder %q in %v", name, names(fs))
	return Folder{}
}

func plusLive() []Container {
	cts := live("plex", "jellyfin", "sonarr", "radarr", "sabnzbd", "nginx")
	cts = append(cts,
		Container{Name: "swag", Labels: map[string]string{"folderview.plus": "Network"}},
		Container{Name: "adguard", Labels: map[string]string{"folder.view3": "Network"}},
		Container{Name: "stray", Labels: map[string]string{"folderview.plus": "Nowhere"}},
	)
	return cts
}

func TestFoldersFollowTheSavedManualOrderWithChildrenUnderTheirParent(t *testing.T) {
	got := names(read(t, "plus", plusLive()))
	want := []string{"Tools", "Media", "Arr", "Network"}
	if !reflect.DeepEqual(got, want) {
		t.Fatalf("order = %v, want %v", got, want)
	}
}

func TestNestedFolderKeepsItsParent(t *testing.T) {
	fs := read(t, "plus", plusLive())
	media, arr := byName(t, fs, "Media"), byName(t, fs, "Arr")
	if arr.Parent != media.ID || media.Parent != "" {
		t.Fatalf("Arr.Parent = %q, Media.Parent = %q, want %q and empty", arr.Parent, media.Parent, media.ID)
	}
}

func TestContainerNamedInTwoFoldersLandsInTheFirstOneShown(t *testing.T) {
	fs := read(t, "plus", plusLive())
	if got := byName(t, fs, "Tools").Members; !reflect.DeepEqual(got, []string{"plex"}) {
		t.Fatalf("Tools members = %v", got)
	}
	if got := byName(t, fs, "Media").Members; !reflect.DeepEqual(got, []string{"jellyfin"}) {
		t.Fatalf("Media members = %v", got)
	}
}

func TestContainerThatNoLongerExistsIsListedAsGone(t *testing.T) {
	tools := byName(t, read(t, "plus", plusLive()), "Tools")
	if !reflect.DeepEqual(tools.Gone, []string{"oldtool"}) {
		t.Fatalf("Tools gone = %v", tools.Gone)
	}
}

func TestNamePatternAddsMatchesAfterTheNamedMembers(t *testing.T) {
	arr := byName(t, read(t, "plus", plusLive()), "Arr")
	if want := []string{"sabnzbd", "radarr", "sonarr"}; !reflect.DeepEqual(arr.Members, want) {
		t.Fatalf("Arr members = %v, want %v", arr.Members, want)
	}
}

func TestLabelPutsAContainerIntoTheFolderItNames(t *testing.T) {
	fs := read(t, "plus", plusLive())
	if got := byName(t, fs, "Network").Members; !reflect.DeepEqual(got, []string{"adguard", "swag"}) {
		t.Fatalf("Network members = %v", got)
	}
	for _, f := range fs {
		for _, m := range f.Members {
			if m == "stray" || m == "nginx" {
				t.Fatalf("%s landed in %s", m, f.Name)
			}
		}
	}
}

func TestAccentColourComesAlongOnlyWhenSwitchedOn(t *testing.T) {
	fs := read(t, "plus", plusLive())
	if c := byName(t, fs, "Media").Color; c != "#ffca63" {
		t.Fatalf("Media colour = %q", c)
	}
	if c := byName(t, fs, "Arr").Color; c != "" {
		t.Fatalf("Arr colour = %q, want none", c)
	}
}

func TestNewerConfigWinsOverAnOlderOne(t *testing.T) {
	got := names(read(t, "plus", plusLive()))
	for _, n := range got {
		if n == "Older" {
			t.Fatalf("older config read too: %v", got)
		}
	}
}

func TestEmptyNewerConfigFallsBackToTheOlderOne(t *testing.T) {
	got := names(read(t, "emptyplus", live("plex")))
	if want := []string{"Audiobooks", "Torrents"}; !reflect.DeepEqual(got, want) {
		t.Fatalf("folders = %v, want %v", got, want)
	}
}

func TestClassicFoldersFollowTheDockerPageOrder(t *testing.T) {
	fs := read(t, "classic", live("audiobookshelf", "qbittorrent", "sonarr", "plex"))
	if got, want := names(fs), []string{"Torrents", "Audiobooks"}; !reflect.DeepEqual(got, want) {
		t.Fatalf("order = %v, want %v", got, want)
	}
	if got := byName(t, fs, "Torrents").Members; !reflect.DeepEqual(got, []string{"qbittorrent", "sonarr"}) {
		t.Fatalf("Torrents members = %v", got)
	}
	audio := byName(t, fs, "Audiobooks")
	if !reflect.DeepEqual(audio.Members, []string{"audiobookshelf"}) || !reflect.DeepEqual(audio.Gone, []string{"audiobookshelf-temp"}) {
		t.Fatalf("Audiobooks = %+v", audio)
	}
	if audio.Color != "" {
		t.Fatalf("a border colour is not a folder colour: %q", audio.Color)
	}
}

func TestClassicFoldersWithoutASavedOrderGoByName(t *testing.T) {
	got := names(read(t, "unordered", live("plex")))
	if want := []string{"Audiobooks", "Torrents"}; !reflect.DeepEqual(got, want) {
		t.Fatalf("order = %v, want %v", got, want)
	}
}

func TestNamedMemberBeatsAnotherFoldersPattern(t *testing.T) {
	fs := read(t, "classic", live("audiobookshelf", "qbittorrent"))
	for _, f := range fs {
		if f.Name == "Torrents" {
			continue
		}
		for _, m := range f.Members {
			if m == "qbittorrent" {
				t.Fatalf("qbittorrent claimed by %s", f.Name)
			}
		}
	}
}

func TestParentLoopsAndMissingParentsEndUpAtTheTop(t *testing.T) {
	fs := read(t, "loop", live("plex"))
	if got, want := names(fs), []string{"Alpha", "Beta", "Gamma"}; !reflect.DeepEqual(got, want) {
		t.Fatalf("order = %v, want %v", got, want)
	}
	for _, f := range fs {
		if f.Parent != "" {
			t.Fatalf("%s kept parent %q", f.Name, f.Parent)
		}
	}
}

func TestNoConfigMeansNoFolders(t *testing.T) {
	got, err := Read(filepath.Join("testdata", "none"), live("plex"))
	if err != nil || len(got) != 0 {
		t.Fatalf("Read = %v, %v", got, err)
	}
}

func TestUnreadableConfigIsAnError(t *testing.T) {
	if _, err := Read(filepath.Join("testdata", "broken"), live("plex")); err == nil {
		t.Fatal("broken config read without an error")
	}
}

func TestEveryFolderCarriesAMemberList(t *testing.T) {
	for _, f := range read(t, "classic", nil) {
		if f.Members == nil {
			t.Fatalf("%s has a nil member list, which encodes as null", f.Name)
		}
	}
}
