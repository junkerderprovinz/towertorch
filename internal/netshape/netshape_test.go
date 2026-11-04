package netshape

import (
	"reflect"
	"strings"
	"testing"
)

func TestUlRuleSpec(t *testing.T) {
	got := strings.Join(ulRuleSpec(10000), " ")
	for _, want := range []string{"-m hashlimit", "--hashlimit-above", "--hashlimit-name ttul", "-j DROP"} {
		if !strings.Contains(got, want) {
			t.Fatalf("ulRuleSpec missing %q: %q", want, got)
		}
	}
	if strings.Contains(got, "tbf") || strings.Contains(got, "tc ") || strings.Contains(got, "qdisc") {
		t.Fatalf("upload must not use a tc/tbf qdisc (unavailable on the kernel): %q", got)
	}
}

func TestApply_NoIngress_BadPID(t *testing.T) {
	if err := Apply("eth0", 0, 5000, 9000); err == nil {
		t.Fatalf("Apply with pid 0 should error")
	}
}

func TestDlRuleSpec(t *testing.T) {
	got := dlRuleSpec(8000) // 1,000,000 B/s with a burst of two seconds
	want := []string{"-m", "hashlimit", "--hashlimit-above", "1000000b/s", "--hashlimit-burst", "2000000b", "--hashlimit-name", "ttdl", "-j", "DROP"}
	if !reflect.DeepEqual(got, want) {
		t.Fatalf("dlRuleSpec =\n %v\nwant\n %v", got, want)
	}
}

func TestDlRateAndBurstFloors(t *testing.T) {
	if r := DLRateBytes(0); r != 125 {
		t.Fatalf("DLRateBytes(0) = %d, want 125", r)
	}
	if b := DLBurstBytes(100); b != 2*DLRateBytes(100) {
		t.Fatalf("DLBurstBytes(100) = %d, want %d (== 2x rate)", b, 2*DLRateBytes(100))
	}
}

func TestIptArgs(t *testing.T) {
	got := iptArgs(4242, "-F", dlChain)
	want := []string{"-t", "4242", "-n", "iptables", "-w", "-F", "TT_DL"}
	if !reflect.DeepEqual(got, want) {
		t.Fatalf("iptArgs = %v, want %v", got, want)
	}
}

// An ingress qdisc crashes the sch_ingress module on some Unraid kernels.
func TestDownloadPathIsQdiscFree(t *testing.T) {
	all := strings.Join(iptArgs(1, dlRuleSpec(5000)...), " ")
	if strings.Contains(all, "tc ") || strings.Contains(all, "ingress") || strings.Contains(all, "ffff:") {
		t.Fatalf("download policing must be pure netfilter, got %q", all)
	}
	if !strings.Contains(all, "iptables") || !strings.Contains(all, "hashlimit") {
		t.Fatalf("download policing should use iptables hashlimit, got %q", all)
	}
}
