// Package vmctl applies CPU pinning, a CPU cap, RAM and bandwidth limits to
// libvirt VMs.
//
// CPU and RAM go through libvirt, so they persist in the domain XML and Unraid
// reads them back:
//   - CPU pinning: virsh vcpupin for each vcpu, plus emulatorpin
//   - CPU cap:     virsh schedinfo --set vcpu_quota/vcpu_period
//   - RAM:         virsh setmem, up to the maximum memory
//
// Each is applied with --config, plus --live while the VM runs.
//
// Bandwidth cannot go through libvirt on Unraid: domiftune needs sch_htb, which
// the kernel lacks. ApplyBandwidth instead adds an iptables hashlimit drop on
// the host's FORWARD chain, matched to the VM's tap with -m physdev, in both
// directions. The tap changes on every VM restart, so the monitor reapplies the
// caps from the config every tick.
//
// Every virsh and iptables call has a timeout, so a hung libvirtd or xtables
// lock cannot stall the caller.
package vmctl

import (
	"context"
	"errors"
	"fmt"
	"os"
	"os/exec"
	"strconv"
	"strings"
	"sync"
	"time"

	"github.com/junkerderprovinz/towertorch/internal/netshape"
)

// callTimeout bounds a single virsh invocation.
const callTimeout = 8 * time.Second

// VM is one domain with its configured limits; 0 or "" means unset.
type VM struct {
	Name      string `json:"name"`
	State     string `json:"state"` // running, shut off, paused, ...
	Running   bool   `json:"running"`
	VCPUs     int    `json:"vcpus"`
	MaxMemMiB int    `json:"maxMemMiB"`
	MemMiB    int    `json:"memMiB"`
	MAC       string `json:"mac"`       // first bridged NIC
	CPUCores  string `json:"cpuCores"`  // pin cpuset of vcpu 0, e.g. "6-15"
	CPUCap    int    `json:"cpuCap"`    // vcpu_quota as a percentage of one core
	InKbit    int    `json:"inKbit"`    // download cap
	OutKbit   int    `json:"outKbit"`   // upload cap
	DownBytes int64  `json:"downBytes"` // bytes host to VM so far, while running
	UpBytes   int64  `json:"upBytes"`   // bytes VM to host so far, while running
}

// Limits is a requested CPU and RAM change; a nil field is left alone. Bandwidth
// is applied separately through ApplyBandwidth.
type Limits struct {
	CPUCores *string `json:"cpuCores,omitempty"` // "" clears the pin
	CPUCap   *int    `json:"cpuCap,omitempty"`   // % of one core, 0 clears the cap
	MemMiB   *int    `json:"memMiB,omitempty"`
}

// Disk is one of a domain's disks. CapacityBytes is the virtual size the guest
// sees.
type Disk struct {
	Target        string `json:"target"` // guest target such as "vda"
	Source        string `json:"source"` // backing file or volume on the host
	CapacityBytes int64  `json:"capacityBytes"`
}

type runner func(ctx context.Context, args ...string) (string, error)

func virshRun(ctx context.Context, args ...string) (string, error) {
	cctx, cancel := context.WithTimeout(ctx, callTimeout)
	defer cancel()
	out, err := exec.CommandContext(cctx, "virsh", args...).CombinedOutput()
	if err != nil {
		return string(out), fmt.Errorf("virsh %s: %w: %s", strings.Join(args, " "), err, strings.TrimSpace(string(out)))
	}
	return string(out), nil
}

// Controller runs virsh and remembers which tap each VM's bandwidth is policed
// on, so a VM restarted onto a new tap gets the old tap's rules cleared.
type Controller struct {
	run    runner
	mu     sync.Mutex
	shaped map[string]string // VM name to tap
}

// New returns a Controller backed by the real virsh binary.
func New() *Controller { return &Controller{run: virshRun, shaped: map[string]string{}} }

// vcpuPeriod is a fixed CFS period, so a quota reads as a clean percentage.
const vcpuPeriod = 100000

func running(state string) bool { return strings.HasPrefix(strings.TrimSpace(state), "running") }

// scope returns --config, plus --live when the domain runs.
func scope(isRunning bool) []string {
	if isRunning {
		return []string{"--config", "--live"}
	}
	return []string{"--config"}
}

// List returns every defined domain with its limits.
func (c *Controller) List(ctx context.Context) ([]VM, error) {
	out, err := c.run(ctx, "list", "--all", "--name")
	if err != nil {
		return nil, err
	}
	var vms []VM
	for _, name := range strings.Split(out, "\n") {
		name = strings.TrimSpace(name)
		if name == "" {
			continue
		}
		vm, gErr := c.Get(ctx, name)
		if gErr != nil {
			// A single unreadable domain must not blank the whole tab.
			vms = append(vms, VM{Name: name, State: "unknown"})
			continue
		}
		vms = append(vms, vm)
	}
	return vms, nil
}

// Get reads one domain's details and limits.
func (c *Controller) Get(ctx context.Context, name string) (VM, error) {
	vm := VM{Name: name}
	info, err := c.run(ctx, "dominfo", name)
	if err != nil {
		return vm, err
	}
	for _, ln := range strings.Split(info, "\n") {
		k, v, ok := splitKV(ln)
		if !ok {
			continue
		}
		switch k {
		case "State":
			vm.State = v
		case "CPU(s)":
			vm.VCPUs, _ = strconv.Atoi(v)
		case "Max memory":
			vm.MaxMemMiB = kibFieldToMiB(v)
		case "Used memory":
			vm.MemMiB = kibFieldToMiB(v)
		}
	}
	vm.Running = running(vm.State)

	// Unraid pins every vcpu the same, so vcpu 0 stands for the set.
	if pin, pErr := c.run(ctx, "vcpupin", name); pErr == nil {
		vm.CPUCores = firstVcpuAffinity(pin)
	}
	// An uncapped running domain reports a huge sentinel quota, so only a quota up
	// to vcpus+2 cores counts as a cap.
	if sched, sErr := c.run(ctx, "schedinfo", name); sErr == nil {
		q, p := schedQuotaPeriod(sched)
		if q > 0 && p > 0 && q <= int64(vm.VCPUs+2)*vcpuPeriod {
			vm.CPUCap = int(q * 100 / p)
		}
	}
	if iflist, iErr := c.run(ctx, "domiflist", name); iErr == nil {
		vm.MAC = firstMAC(iflist)
		if vm.Running {
			// Seen from the host's tap, tx is the VM's download and rx its upload.
			if tap := firstTap(iflist); tap != "" {
				vm.DownBytes = readCounter("/sys/class/net/" + tap + "/statistics/tx_bytes")
				vm.UpBytes = readCounter("/sys/class/net/" + tap + "/statistics/rx_bytes")
			}
		}
	}
	return vm, nil
}

// Apply writes the requested (non-nil) limit changes to a domain.
func (c *Controller) Apply(ctx context.Context, name string, lim Limits) error {
	vm, err := c.Get(ctx, name)
	if err != nil {
		return err
	}
	sc := scope(vm.Running)

	if lim.CPUCores != nil {
		cores := strings.TrimSpace(*lim.CPUCores)
		for v := 0; v < vm.VCPUs; v++ {
			set := cores
			if set == "" {
				set = allCores(vm)
			}
			if _, e := c.run(ctx, append([]string{"vcpupin", name, strconv.Itoa(v), set}, sc...)...); e != nil {
				return e
			}
		}
		if cores != "" {
			if _, e := c.run(ctx, append([]string{"emulatorpin", name, cores}, sc...)...); e != nil {
				return e
			}
		}
	}
	if lim.CPUCap != nil {
		quota := "-1" // uncapped
		if *lim.CPUCap > 0 {
			quota = strconv.Itoa(*lim.CPUCap * vcpuPeriod / 100)
		}
		args := append([]string{"schedinfo", name}, sc...)
		args = append(args, "--set", "vcpu_period="+strconv.Itoa(vcpuPeriod), "--set", "vcpu_quota="+quota)
		if _, e := c.run(ctx, args...); e != nil {
			return e
		}
	}
	if lim.MemMiB != nil && *lim.MemMiB > 0 {
		kib := strconv.Itoa(*lim.MemMiB*1024) + "KiB"
		if vm.MaxMemMiB > 0 && *lim.MemMiB > vm.MaxMemMiB {
			// setmem cannot go past the maximum, and setmaxmem only works on the
			// domain XML, so both go to --config. A running VM gets the RAM on its next
			// start, since a live raise needs memory hotplug slots Unraid does not create.
			if _, e := c.run(ctx, "setmaxmem", name, kib, "--config"); e != nil {
				return e
			}
			if _, e := c.run(ctx, "setmem", name, kib, "--config"); e != nil {
				return e
			}
		} else if _, e := c.run(ctx, append([]string{"setmem", name, kib}, sc...)...); e != nil {
			return e
		}
	}
	return nil
}

// SetCPUCap sets only the CPU quota as a percentage of one core; <= 0 removes it.
// It skips the full Get because the monitor calls it every tick.
func (c *Controller) SetCPUCap(ctx context.Context, name string, capPct int) error {
	info, err := c.run(ctx, "dominfo", name)
	if err != nil {
		return err
	}
	var state string
	for _, ln := range strings.Split(info, "\n") {
		if k, v, ok := splitKV(ln); ok && k == "State" {
			state = v
			break
		}
	}
	quota := "-1"
	if capPct > 0 {
		quota = strconv.Itoa(capPct * vcpuPeriod / 100)
	}
	args := append([]string{"schedinfo", name}, scope(running(state))...)
	args = append(args, "--set", "vcpu_period="+strconv.Itoa(vcpuPeriod), "--set", "vcpu_quota="+quota)
	_, err = c.run(ctx, args...)
	return err
}

// Disks lists a domain's disks with their current capacity, leaving out cdroms
// and empty slots.
func (c *Controller) Disks(ctx context.Context, name string) ([]Disk, error) {
	out, err := c.run(ctx, "domblklist", name, "--details")
	if err != nil {
		return nil, err
	}
	var disks []Disk
	for _, ln := range strings.Split(out, "\n") {
		f := strings.Fields(ln)
		// columns: Type Device Target Source, after a header and a rule
		if len(f) < 4 {
			continue
		}
		if (f[0] != "file" && f[0] != "block" && f[0] != "network") || f[1] != "disk" {
			continue
		}
		source := f[3]
		if source == "-" || source == "" {
			continue
		}
		d := Disk{Target: f[2], Source: source}
		// domblkinfo prints bytes by default; --bytes is not accepted by every
		// libvirt build (12.2.0 rejects it).
		if bi, e := c.run(ctx, "domblkinfo", name, d.Target); e == nil {
			d.CapacityBytes = blkCapacity(bi)
		}
		disks = append(disks, d)
	}
	return disks, nil
}

// ResizeDisk grows the disk with guest target such as "vda" to newBytes. It only
// grows, because shrinking a virtual disk truncates it. A running domain is
// resized live with virsh blockresize, a shut-off one with qemu-img resize on
// the backing image.
func (c *Controller) ResizeDisk(ctx context.Context, name, target string, newBytes int64) error {
	if newBytes <= 0 {
		return fmt.Errorf("resize: bad size %d", newBytes)
	}
	disks, err := c.Disks(ctx, name)
	if err != nil {
		return err
	}
	var disk *Disk
	for i := range disks {
		if disks[i].Target == target {
			disk = &disks[i]
			break
		}
	}
	if disk == nil {
		return fmt.Errorf("resize: %s has no disk %q", name, target)
	}
	// Without the current size there is no proof the resize grows the disk.
	if disk.CapacityBytes <= 0 {
		return fmt.Errorf("resize: current size of %q is unknown (source missing/unreadable), refusing", target)
	}
	if newBytes <= disk.CapacityBytes {
		return fmt.Errorf("resize is grow-only: %d bytes is not larger than the current %d bytes", newBytes, disk.CapacityBytes)
	}
	vm, err := c.Get(ctx, name)
	if err != nil {
		return err
	}
	if vm.Running {
		// Without the B suffix blockresize reads the size as KiB.
		_, e := c.run(ctx, "blockresize", name, disk.Target, strconv.FormatInt(newBytes, 10)+"B")
		return e
	}
	cctx, cancel := context.WithTimeout(ctx, callTimeout)
	defer cancel()
	out, e := exec.CommandContext(cctx, "qemu-img", "resize", disk.Source, strconv.FormatInt(newBytes, 10)).CombinedOutput()
	if e != nil {
		return fmt.Errorf("qemu-img resize %s: %w: %s", disk.Source, e, strings.TrimSpace(string(out)))
	}
	return nil
}

// blkCapacity reads the Capacity in bytes from domblkinfo output.
func blkCapacity(info string) int64 {
	for _, ln := range strings.Split(info, "\n") {
		if k, v, ok := splitKV(ln); ok && k == "Capacity" {
			f := strings.Fields(v)
			if len(f) == 0 {
				return 0
			}
			n, _ := strconv.ParseInt(f[0], 10, 64)
			return n
		}
	}
	return 0
}

func splitKV(ln string) (string, string, bool) {
	i := strings.Index(ln, ":")
	if i < 0 {
		return "", "", false
	}
	return strings.TrimSpace(ln[:i]), strings.TrimSpace(ln[i+1:]), true
}

// kibFieldToMiB turns "6291456 KiB" into MiB.
func kibFieldToMiB(v string) int {
	f := strings.Fields(v)
	if len(f) == 0 {
		return 0
	}
	kib, _ := strconv.Atoi(f[0])
	return kib / 1024
}

// firstVcpuAffinity reads the cpuset of "0" from a vcpupin table.
func firstVcpuAffinity(table string) string {
	for _, ln := range strings.Split(table, "\n") {
		f := strings.Fields(ln)
		if len(f) == 2 && f[0] == "0" {
			return f[1]
		}
	}
	return ""
}

// schedQuotaPeriod reads vcpu_quota and vcpu_period from schedinfo. They are
// int64 because the sentinel an uncapped domain reports would overflow an int.
func schedQuotaPeriod(sched string) (quota, period int64) {
	for _, ln := range strings.Split(sched, "\n") {
		k, v, ok := splitKV(ln)
		if !ok {
			continue
		}
		switch k {
		case "vcpu_quota":
			quota, _ = strconv.ParseInt(v, 10, 64)
		case "vcpu_period":
			period, _ = strconv.ParseInt(v, 10, 64)
		}
	}
	return
}

// firstMAC returns the MAC of the first bridged interface in a domiflist table.
func firstMAC(table string) string {
	for _, ln := range strings.Split(table, "\n") {
		f := strings.Fields(ln)
		// columns: Interface Type Source Model MAC
		if len(f) >= 5 && strings.Contains(f[4], ":") {
			return f[4]
		}
	}
	return ""
}

// firstTap returns the first tap device (vnetX) in a domiflist table, or "".
func firstTap(table string) string {
	for _, ln := range strings.Split(table, "\n") {
		f := strings.Fields(ln)
		if len(f) >= 1 && strings.HasPrefix(f[0], "vnet") {
			return f[0]
		}
	}
	return ""
}

// readCounter reads the integer in a /sys counter file, or 0 on any error.
func readCounter(path string) int64 {
	b, err := os.ReadFile(path)
	if err != nil {
		return 0
	}
	n, _ := strconv.ParseInt(strings.TrimSpace(string(b)), 10, 64)
	return n
}

// allCores returns a cpuset for clearing a pin. libvirt clamps 0-127 to the
// host's cores.
func allCores(vm VM) string {
	return "0-127"
}

// The bandwidth rules rely on br_netfilter with bridge-nf-call-iptables on, so
// bridged VM traffic passes the host's FORWARD chain.

func vmDLChain(tap string) string { return "CC-VMBW-DL-" + tap }
func vmULChain(tap string) string { return "CC-VMBW-UL-" + tap }

// ipt runs iptables on the host; -w waits for the xtables lock.
func ipt(ctx context.Context, args ...string) error {
	cctx, cancel := context.WithTimeout(ctx, callTimeout)
	defer cancel()
	out, err := exec.CommandContext(cctx, "iptables", append([]string{"-w"}, args...)...).CombinedOutput()
	if err != nil {
		return fmt.Errorf("iptables %s: %w: %s", strings.Join(args, " "), err, strings.TrimSpace(string(out)))
	}
	return nil
}

// iptQuiet runs iptables for a clear, where nothing to remove is not an error.
func iptQuiet(ctx context.Context, args ...string) {
	if err := ipt(ctx, args...); err != nil {
		m := err.Error()
		if strings.Contains(m, "No chain/target/match by that name") || strings.Contains(m, "does not exist") ||
			strings.Contains(m, "Chain already exists") || strings.Contains(m, "No such file or directory") {
			return
		}
	}
}

// resolveTap returns the domain's first tap, or "" when it is not running.
func (c *Controller) resolveTap(ctx context.Context, name string) string {
	out, err := c.run(ctx, "domiflist", name)
	if err != nil {
		return ""
	}
	return firstTap(out)
}

// hashRule is the hashlimit drop inside a per-tap, per-direction chain, with the
// same rate math as netshape.
func hashRule(hname string, kbit int) []string {
	return []string{"-m", "hashlimit",
		"--hashlimit-above", strconv.Itoa(netshape.DLRateBytes(kbit)) + "b/s",
		"--hashlimit-burst", strconv.Itoa(netshape.DLBurstBytes(kbit)) + "b",
		"--hashlimit-name", hname, "-j", "DROP"}
}

// hName is a hashlimit table name of at most 15 characters, unique per tap and
// direction.
func hName(dir, tap string) string {
	n := "ccvm" + dir + strings.TrimPrefix(tap, "vnet")
	if len(n) > 15 {
		n = n[:15]
	}
	return n
}

// applyDir sets one direction: a per-tap chain holds the rule and FORWARD jumps to
// it for packets crossing the tap (--physdev-out is the VM's download,
// --physdev-in its upload). The chain is flushed first so a new rate replaces the
// old one.
func (c *Controller) applyDir(ctx context.Context, chain, physdev, tap, hname string, kbit int) error {
	_ = ipt(ctx, "-N", chain) // the chain may already exist
	if err := ipt(ctx, "-F", chain); err != nil {
		return err
	}
	if err := ipt(ctx, append([]string{"-A", chain}, hashRule(hname, kbit)...)...); err != nil {
		return err
	}
	jump := []string{"FORWARD", "-m", "physdev", physdev, tap, "-j", chain}
	if ipt(ctx, append([]string{"-C"}, jump...)...) != nil {
		return ipt(ctx, append([]string{"-I"}, jump...)...)
	}
	return nil
}

func (c *Controller) clearDir(ctx context.Context, chain, physdev, tap string) {
	iptQuiet(ctx, "-D", "FORWARD", "-m", "physdev", physdev, tap, "-j", chain)
	iptQuiet(ctx, "-F", chain)
	iptQuiet(ctx, "-X", chain)
}

// ApplyBandwidth polices a domain's download (inKbit) and upload (outKbit) on its
// current tap and clears the previous tap after a restart. A stopped VM or zero
// for both clears and forgets it. It is idempotent.
func (c *Controller) ApplyBandwidth(ctx context.Context, name string, inKbit, outKbit int) error {
	tap := c.resolveTap(ctx, name)
	c.mu.Lock()
	if c.shaped == nil {
		c.shaped = map[string]string{}
	}
	old := c.shaped[name]
	c.mu.Unlock()
	if old != "" && old != tap {
		c.clearDir(ctx, vmDLChain(old), "--physdev-out", old)
		c.clearDir(ctx, vmULChain(old), "--physdev-in", old)
	}
	if tap == "" || (inKbit <= 0 && outKbit <= 0) {
		if tap != "" {
			c.clearDir(ctx, vmDLChain(tap), "--physdev-out", tap)
			c.clearDir(ctx, vmULChain(tap), "--physdev-in", tap)
		}
		c.mu.Lock()
		delete(c.shaped, name)
		c.mu.Unlock()
		return nil
	}
	var errs []error
	if inKbit > 0 {
		errs = append(errs, c.applyDir(ctx, vmDLChain(tap), "--physdev-out", tap, hName("d", tap), inKbit))
	} else {
		c.clearDir(ctx, vmDLChain(tap), "--physdev-out", tap)
	}
	if outKbit > 0 {
		errs = append(errs, c.applyDir(ctx, vmULChain(tap), "--physdev-in", tap, hName("u", tap), outKbit))
	} else {
		c.clearDir(ctx, vmULChain(tap), "--physdev-in", tap)
	}
	c.mu.Lock()
	c.shaped[name] = tap
	c.mu.Unlock()
	return errors.Join(errs...)
}
