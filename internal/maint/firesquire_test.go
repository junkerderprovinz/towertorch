package maint

import (
	"context"
	"errors"
	"os"
	"path/filepath"
	"testing"
)

const nogo = `{"verdict":"NO-GO","worst":2,"generated":"2026-11-10 03:20:00","checks":[
{"tier":"critical","id":"array","status":"pass","key":"array_ok","args":[],"message":"Array is started and healthy."},
{"tier":"critical","id":"fortress","status":"fail","key":"fortress_busy_open","args":["KnightLoader","Tower","Unpacking"],"message":"KnightLoader on Tower is still busy with Unpacking. Let it finish before rebooting."},
{"tier":"warning","id":"smart","status":"warn","key":"smart_attr","args":["sdc:pending=8"],"message":"SMART attribute warnings: sdc:pending=8","link":"http://tower:8080"},
{"tier":"info","id":"kernel","status":"info","key":"info_kernel","args":["6.12"],"message":"Kernel: 6.12"}]}`

func installed(t *testing.T) string {
	t.Helper()
	p := filepath.Join(t.TempDir(), "firesquire-check.sh")
	if err := os.WriteFile(p, []byte("#!/bin/bash\n"), 0o600); err != nil {
		t.Fatal(err)
	}
	return p
}

func TestWithoutFireSquireTheCheckIsNotInstalled(t *testing.T) {
	f := FireSquire{Script: filepath.Join(t.TempDir(), "missing.sh")}
	if _, err := f.Check(context.Background()); !errors.Is(err, ErrNotInstalled) {
		t.Errorf("err = %v", err)
	}
}

func TestANoGoComesWithWhatBlocksAndWhatToWatch(t *testing.T) {
	// The script exits 2 on NO-GO, so the run reports an error beside the output.
	f := FireSquire{Script: installed(t), run: func(context.Context, string) ([]byte, error) {
		return []byte(nogo), errors.New("exit status 2")
	}}
	v, err := f.Check(context.Background())
	if err != nil {
		t.Fatal(err)
	}
	if v.Verdict != VerdictNoGo {
		t.Errorf("verdict = %q", v.Verdict)
	}
	if len(v.Findings) != 3 {
		t.Fatalf("findings = %+v", v.Findings)
	}
	if f := v.Findings[1]; f.Status != "fail" || f.Key != "fortress_busy_open" || f.Message == "" {
		t.Errorf("finding = %+v", f)
	}
	if v.Findings[2].Link != "http://tower:8080" {
		t.Errorf("link lost: %+v", v.Findings[2])
	}
}

func TestACheckThatSaysNothingReadableFails(t *testing.T) {
	f := FireSquire{Script: installed(t), run: func(context.Context, string) ([]byte, error) {
		return []byte("bash: smartctl: command not found"), errors.New("exit status 127")
	}}
	if _, err := f.Check(context.Background()); err == nil || errors.Is(err, ErrNotInstalled) {
		t.Errorf("err = %v", err)
	}
}
