package main

import "testing"

func TestAppNamesTheVersionWithoutItsPrefix(t *testing.T) {
	for in, want := range map[string]string{"v1.4.2": "1.4.2", "v0.0.0-ci": "0.0.0-ci", "dev": "dev"} {
		a := app(in)
		if a.Version != want || a.ID != "towertorch" || a.Name != "TowerTorch" {
			t.Errorf("app(%q) = %+v, want version %q", in, a, want)
		}
	}
}
