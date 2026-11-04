package vmctl

import (
	"context"
	"errors"
	"strings"
	"testing"
)

func TestParsers(t *testing.T) {
	if got := kibFieldToMiB("6291456 KiB"); got != 6144 {
		t.Errorf("kibFieldToMiB = %d, want 6144", got)
	}
	if got := firstVcpuAffinity(" VCPU   CPU Affinity\n----------------------\n 0      6-15\n 1      7"); got != "6-15" {
		t.Errorf("firstVcpuAffinity = %q, want 6-15", got)
	}
	if q, p := schedQuotaPeriod("cpu_shares     : 0\nvcpu_period    : 100000\nvcpu_quota     : 50000"); q != 50000 || p != 100000 {
		t.Errorf("schedQuotaPeriod = %d/%d, want 50000/100000", q, p)
	}
	if got := firstMAC(" Interface   Type     Source   Model        MAC\n---------\n -           bridge   br0      virtio-net   52:54:00:e4:52:5a"); got != "52:54:00:e4:52:5a" {
		t.Errorf("firstMAC = %q", got)
	}
	if got := hName("d", "vnet3"); got != "ttvmd3" {
		t.Errorf("hName(d,vnet3) = %q, want ttvmd3", got)
	}
	if got := firstTap(" Interface Type Source Model MAC\n - bridge br0 virtio-net 52:54:00:aa:bb:dd\n vnet6 bridge br0.20 virtio-net 52:54:00:6f:63:25"); got != "vnet6" {
		t.Errorf("firstTap = %q, want vnet6", got)
	}
}

// fakeVirsh answers Get's probes with canned output and records every call.
func fakeVirsh(calls *[][]string, state string) runner {
	return func(_ context.Context, args ...string) (string, error) {
		*calls = append(*calls, args)
		switch args[0] {
		case "dominfo":
			return "State:          " + state + "\nCPU(s):         2\nMax memory:     4194304 KiB\nUsed memory:    4194304 KiB", nil
		case "vcpupin":
			return " VCPU   CPU Affinity\n 0      0-7\n 1      0-7", nil
		case "schedinfo":
			return "vcpu_period    : 0\nvcpu_quota     : 0", nil
		case "domiflist":
			return " Interface Type Source Model MAC\n - bridge br0 virtio-net 52:54:00:aa:bb:dd", nil
		case "domiftune":
			return "inbound.average: 0\noutbound.average: 0", nil
		}
		return "", nil
	}
}

func TestApply_RunningSetsLiveConfigCap(t *testing.T) {
	var calls [][]string
	c := &Controller{run: fakeVirsh(&calls, "running")}
	cap := 50
	if err := c.Apply(context.Background(), "UbuntuTest", Limits{CPUCap: &cap}); err != nil {
		t.Fatalf("Apply: %v", err)
	}
	var sched []string
	for _, a := range calls {
		if a[0] == "schedinfo" && len(a) > 2 {
			sched = a
		}
	}
	if sched == nil || !contains(sched, "vcpu_quota=50000") || !contains(sched, "--live") || !contains(sched, "--config") {
		t.Fatalf("schedinfo argv wrong: %v", sched)
	}
}

func TestApply_ShutOffOmitsLive(t *testing.T) {
	var calls [][]string
	c := &Controller{run: fakeVirsh(&calls, "shut off")}
	mem := 2048
	if err := c.Apply(context.Background(), "Linux", Limits{MemMiB: &mem}); err != nil {
		t.Fatalf("Apply: %v", err)
	}
	var setmem []string
	for _, a := range calls {
		if a[0] == "setmem" {
			setmem = a
		}
	}
	if setmem == nil || contains(setmem, "--live") || !contains(setmem, "--config") || !contains(setmem, "2097152KiB") {
		t.Fatalf("setmem argv wrong (should be --config only): %v", setmem)
	}
}

func contains(s []string, want string) bool {
	for _, v := range s {
		if v == want || strings.Contains(v, want) {
			return true
		}
	}
	return false
}

func TestBlkCapacity(t *testing.T) {
	info := "Capacity:       53687091200\nAllocation:     14336000000\nPhysical:       53687091200"
	if got := blkCapacity(info); got != 53687091200 {
		t.Errorf("blkCapacity = %d, want 53687091200", got)
	}
	if got := blkCapacity("no capacity here"); got != 0 {
		t.Errorf("blkCapacity(garbage) = %d, want 0", got)
	}
}

// fakeDisk is fakeVirsh with one 50 GiB disk "hdc" and one cdrom.
func fakeDisk(calls *[][]string, state string) runner {
	return func(_ context.Context, args ...string) (string, error) {
		*calls = append(*calls, args)
		switch args[0] {
		case "dominfo":
			return "State:          " + state + "\nCPU(s):         2\nMax memory:     4194304 KiB\nUsed memory:    4194304 KiB", nil
		case "vcpupin":
			return " 0      0-7", nil
		case "schedinfo":
			return "vcpu_quota     : 0\nvcpu_period    : 0", nil
		case "domiflist":
			return " - bridge br0 virtio-net 52:54:00:aa:bb:dd", nil
		case "domblklist":
			return " Type   Device   Target   Source\n----------------------------\n" +
				" file   disk     hdc      /mnt/user/domains/VM/vdisk1.img\n" +
				" file   cdrom    hda      /mnt/user/isos/x.iso", nil
		case "domblkinfo":
			return "Capacity:       53687091200\nAllocation:     14336000000\nPhysical:       53687091200", nil
		}
		return "", nil
	}
}

func TestDisks_SkipsCdromParsesCapacity(t *testing.T) {
	var calls [][]string
	c := &Controller{run: fakeDisk(&calls, "running")}
	disks, err := c.Disks(context.Background(), "VM")
	if err != nil {
		t.Fatalf("Disks: %v", err)
	}
	if len(disks) != 1 {
		t.Fatalf("Disks = %d entries, want 1 (cdrom skipped): %+v", len(disks), disks)
	}
	if disks[0].Target != "hdc" || disks[0].Source != "/mnt/user/domains/VM/vdisk1.img" || disks[0].CapacityBytes != 53687091200 {
		t.Fatalf("disk parsed wrong: %+v", disks[0])
	}
}

func TestResizeDisk_GrowOnly(t *testing.T) {
	var calls [][]string
	c := &Controller{run: fakeDisk(&calls, "running")}
	if err := c.ResizeDisk(context.Background(), "VM", "hdc", 40*1024*1024*1024); err == nil {
		t.Fatal("ResizeDisk to a smaller size must fail (grow-only)")
	}
	if err := c.ResizeDisk(context.Background(), "VM", "nope", 60*1024*1024*1024); err == nil {
		t.Fatal("ResizeDisk of an unknown target must fail")
	}
	// An unreadable source reports capacity 0, which proves nothing about a grow.
	var c2calls [][]string
	unknownCap := func(ctx context.Context, args ...string) (string, error) {
		c2calls = append(c2calls, args)
		if args[0] == "domblklist" {
			return " Type Device Target Source\n----\n file disk vda /mnt/gone.img", nil
		}
		if args[0] == "domblkinfo" {
			return "", errors.New("Failed to open file: No such file or directory")
		}
		return "State: shut off\nCPU(s): 2", nil
	}
	c2 := &Controller{run: unknownCap}
	if err := c2.ResizeDisk(context.Background(), "VM", "vda", 99*1024*1024*1024); err == nil {
		t.Fatal("ResizeDisk with unknown current size must be refused")
	}
}

func TestResizeDisk_LiveBlockresize(t *testing.T) {
	var calls [][]string
	c := &Controller{run: fakeDisk(&calls, "running")}
	want := int64(60) * 1024 * 1024 * 1024
	if err := c.ResizeDisk(context.Background(), "VM", "hdc", want); err != nil {
		t.Fatalf("ResizeDisk: %v", err)
	}
	var br []string
	for _, a := range calls {
		if a[0] == "blockresize" {
			br = a
		}
	}
	if br == nil || !contains(br, "hdc") || !contains(br, "64424509440B") {
		t.Fatalf("blockresize argv wrong: %v", br)
	}
}
