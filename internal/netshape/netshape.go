// Package netshape caps a container's bandwidth inside its own network namespace,
// entered with nsenter through the container PID. The host uplink is never touched.
//
// Both directions are policed with an iptables hashlimit drop, upload on OUTPUT and
// download on INPUT, and TCP backs off to the cap. There is no tc qdisc: Unraid's
// kernel ships neither sch_tbf nor sch_htb, and adding an ingress qdisc crashes the
// sch_ingress module on some Unraid kernels (fault in tcx_miniq_inc), freezing the
// WebUI and SSH. The rules sit inside the container's namespace, so they work the
// same for bridge, ipvlan and macvlan networks.
//
// A failure only means no shaping. The rules are lost when the container restarts,
// so the monitor reapplies them every tick; both paths are idempotent.
package netshape

import (
	"context"
	"errors"
	"fmt"
	"os/exec"
	"strconv"
	"strings"
	"time"
)

// DefaultIface is the interface shaped when none is configured. eth0 is the
// container's primary NIC in bridge, ipvlan and macvlan setups alike.
const DefaultIface = "eth0"

// dlChain and ulChain are the chains inside the container namespace that hold the
// download and upload rules, so they can be replaced and inspected on their own.
const (
	dlChain = "TT_DL"
	ulChain = "TT_UL"
)

// ifaceOr returns iface, or DefaultIface when it is blank.
func ifaceOr(iface string) string {
	if iface = strings.TrimSpace(iface); iface != "" {
		return iface
	}
	return DefaultIface
}

// DLRateBytes converts kbit/s to bytes/s, at least 125. The rules use the plain
// byte unit because the kb and mb prefixes are parsed differently by the legacy
// and nf_tables userspace builds; "kb/s" enforced about 1/8 of the rate.
func DLRateBytes(kbit int) int {
	r := kbit * 125
	if r < 125 {
		r = 125
	}
	return r
}

// DLBurstBytes is two seconds of the rate. hashlimit demands a minimum burst of
// 1x the rate on nf_tables and about 1.5x on legacy iptables.
func DLBurstBytes(kbit int) int {
	return 2 * DLRateBytes(kbit)
}

// iptArgs builds an nsenter argv that runs iptables in the namespace of pid. -w
// waits for the xtables lock instead of failing.
func iptArgs(pid int, args ...string) []string {
	return append([]string{"-t", strconv.Itoa(pid), "-n", "iptables", "-w"}, args...)
}

// dlRuleSpec is the download rule after the chain name, shared by the -C check
// and the -A add.
func dlRuleSpec(kbit int) []string {
	return []string{"-m", "hashlimit",
		"--hashlimit-above", strconv.Itoa(DLRateBytes(kbit)) + "b/s",
		"--hashlimit-burst", strconv.Itoa(DLBurstBytes(kbit)) + "b",
		"--hashlimit-name", "ttdl", "-j", "DROP"}
}

// applyIngressPolicing installs the download cap. When the rule and the INPUT jump
// are already in place nothing runs, since the monitor calls this every tick.
func applyIngressPolicing(iface string, pid, kbit int) error {
	dev := ifaceOr(iface)
	if run(iptArgs(pid, append([]string{"-C", dlChain}, dlRuleSpec(kbit)...)...)) == nil &&
		run(iptArgs(pid, "-C", "INPUT", "-i", dev, "-j", dlChain)) == nil {
		return nil
	}
	_ = run(iptArgs(pid, "-N", dlChain)) // the chain may already exist
	if err := run(iptArgs(pid, "-F", dlChain)); err != nil {
		return err
	}
	if err := run(iptArgs(pid, append([]string{"-A", dlChain}, dlRuleSpec(kbit)...)...)); err != nil {
		return err
	}
	if run(iptArgs(pid, "-C", "INPUT", "-i", dev, "-j", dlChain)) != nil {
		return run(iptArgs(pid, "-I", "INPUT", "-i", dev, "-j", dlChain))
	}
	return nil
}

// clearIngressPolicing removes the download jump, rules and chain. Anything
// already missing counts as removed.
func clearIngressPolicing(iface string, pid int) error {
	dev := ifaceOr(iface)
	_ = ignoreMissing(run(iptArgs(pid, "-D", "INPUT", "-i", dev, "-j", dlChain)))
	_ = ignoreMissing(run(iptArgs(pid, "-F", dlChain)))
	return ignoreMissing(run(iptArgs(pid, "-X", dlChain)))
}

// ulRuleSpec is the upload rule, with the same rate math as the download rule and
// its own hashlimit table.
func ulRuleSpec(kbit int) []string {
	return []string{"-m", "hashlimit",
		"--hashlimit-above", strconv.Itoa(DLRateBytes(kbit)) + "b/s",
		"--hashlimit-burst", strconv.Itoa(DLBurstBytes(kbit)) + "b",
		"--hashlimit-name", "ttul", "-j", "DROP"}
}

// applyEgressPolicing installs the upload cap on OUTPUT, like applyIngressPolicing.
func applyEgressPolicing(iface string, pid, kbit int) error {
	dev := ifaceOr(iface)
	if run(iptArgs(pid, append([]string{"-C", ulChain}, ulRuleSpec(kbit)...)...)) == nil &&
		run(iptArgs(pid, "-C", "OUTPUT", "-o", dev, "-j", ulChain)) == nil {
		return nil
	}
	_ = run(iptArgs(pid, "-N", ulChain)) // the chain may already exist
	if err := run(iptArgs(pid, "-F", ulChain)); err != nil {
		return err
	}
	if err := run(iptArgs(pid, append([]string{"-A", ulChain}, ulRuleSpec(kbit)...)...)); err != nil {
		return err
	}
	if run(iptArgs(pid, "-C", "OUTPUT", "-o", dev, "-j", ulChain)) != nil {
		return run(iptArgs(pid, "-I", "OUTPUT", "-o", dev, "-j", ulChain))
	}
	return nil
}

// clearEgressPolicing removes the upload jump, rules and chain.
func clearEgressPolicing(iface string, pid int) error {
	dev := ifaceOr(iface)
	_ = ignoreMissing(run(iptArgs(pid, "-D", "OUTPUT", "-o", dev, "-j", ulChain)))
	_ = ignoreMissing(run(iptArgs(pid, "-F", ulChain)))
	return ignoreMissing(run(iptArgs(pid, "-X", ulChain)))
}

// Apply sets the upload and download caps on iface inside the container whose
// main process is pid. A value <= 0 clears that direction, so Apply(iface, pid,
// 0, 0) removes both.
func Apply(iface string, pid, egressKbit, ingressKbit int) error {
	if pid <= 0 {
		return fmt.Errorf("netshape: invalid pid %d", pid)
	}
	// A failure in one direction must not keep the other from being applied.
	var errs []error
	if egressKbit > 0 {
		if err := applyEgressPolicing(iface, pid, egressKbit); err != nil {
			errs = append(errs, fmt.Errorf("netshape: egress policing: %w", err))
		}
	} else if err := clearEgressPolicing(iface, pid); err != nil {
		errs = append(errs, fmt.Errorf("netshape: egress clear: %w", err))
	}
	if ingressKbit > 0 {
		if err := applyIngressPolicing(iface, pid, ingressKbit); err != nil {
			errs = append(errs, fmt.Errorf("netshape: ingress policing: %w", err))
		}
	} else if err := clearIngressPolicing(iface, pid); err != nil {
		errs = append(errs, fmt.Errorf("netshape: ingress clear: %w", err))
	}
	return errors.Join(errs...)
}

// Clear removes both caps from the container.
func Clear(iface string, pid int) error {
	if pid <= 0 {
		return nil
	}
	if err := clearEgressPolicing(iface, pid); err != nil {
		return err
	}
	return clearIngressPolicing(iface, pid)
}

// ignoreMissing swallows the tc and iptables errors for something that is not
// there to delete.
func ignoreMissing(err error) error {
	if err != nil {
		m := err.Error()
		if strings.Contains(m, "No such file or directory") || strings.Contains(m, "RTNETLINK answers: No such file") ||
			strings.Contains(m, "Cannot find") || strings.Contains(m, "No chain/target/match by that name") ||
			strings.Contains(m, "does not exist") ||
			// deleting the root qdisc of a device that only has the default noqueue
			strings.Contains(m, "handle of zero") {
			return nil
		}
	}
	return err
}

// Show returns the qdiscs on the interface and the TT_DL and TT_UL chains inside
// the namespace, for the diagnostics endpoint. Errors come back as text.
func Show(iface string, pid int) (qdisc, filter string) {
	dev := ifaceOr(iface)
	q, qe := output([]string{"-t", strconv.Itoa(pid), "-n", "tc", "qdisc", "show", "dev", dev})
	if qe != nil {
		q = qe.Error()
	}
	f, fe := output(iptArgs(pid, "-S", dlChain))
	if fe != nil {
		f = fe.Error()
	}
	if uf, ue := output(iptArgs(pid, "-S", ulChain)); ue == nil {
		f = strings.TrimSpace(f) + "\n" + strings.TrimSpace(uf)
	}
	return strings.TrimSpace(q), strings.TrimSpace(f)
}

// DetectIface returns the container's default-route device, or "" if it cannot
// be found. It covers containers whose NIC is not called eth0.
func DetectIface(pid int) string {
	if pid <= 0 {
		return ""
	}
	out, err := output([]string{"-t", strconv.Itoa(pid), "-n", "ip", "-o", "-4", "route", "show", "default"})
	if err != nil {
		return ""
	}
	fs := strings.Fields(out)
	for i, f := range fs {
		if f == "dev" && i+1 < len(fs) {
			return fs[i+1]
		}
	}
	return ""
}

func run(args []string) error {
	_, err := output(args)
	return err
}

func output(args []string) (string, error) {
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()
	out, err := exec.CommandContext(ctx, "nsenter", args...).CombinedOutput()
	if err != nil {
		return "", fmt.Errorf("nsenter: %w: %s", err, strings.TrimSpace(string(out)))
	}
	return string(out), nil
}
