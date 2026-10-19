// Command towertorch is the host supervisor for the TowerTorch
// Unraid plugin. It serves the UNIX-socket API behind the plugin's PHP proxy and
// runs dependency-ordered, health-gated container starts. It runs on the host
// rather than in a container because only there can it drive the host's own
// autostart.
package main

import (
	"context"
	_ "embed"
	"fmt"
	"io"
	"log"
	"net"
	"net/http"
	"os"
	"os/signal"
	"path/filepath"
	"syscall"
	"time"

	"github.com/junkerderprovinz/towertorch/internal/api"
	"github.com/junkerderprovinz/towertorch/internal/bugreport"
	"github.com/junkerderprovinz/towertorch/internal/dockercli"
	"github.com/junkerderprovinz/towertorch/internal/iconsrc"
	"github.com/junkerderprovinz/towertorch/internal/monitor"
	"github.com/junkerderprovinz/towertorch/internal/netshape"
	"github.com/junkerderprovinz/towertorch/internal/orchestrator"
	"github.com/junkerderprovinz/towertorch/internal/readiness"
	"github.com/junkerderprovinz/towertorch/internal/store"
	"github.com/junkerderprovinz/towertorch/internal/unraidtmpl"
	"github.com/junkerderprovinz/towertorch/internal/vmctl"
)

// version is overridden at build time with -ldflags "-X main.version=vX.Y.Z".
var version = "dev"

// bannerArt is printed to the supervisor log on startup. banner.txt is a copy of
// .github/assets/banner-raw.txt.
//
//go:embed banner.txt
var bannerArt string

const (
	defaultDataDir    = "/boot/config/plugins/towertorch"
	defaultDockerSock = "/var/run/docker.sock"
	defaultAPISock    = "/var/run/towertorch.sock"
)

func main() {
	cmd := "serve"
	if len(os.Args) > 1 {
		cmd = os.Args[1]
	}
	switch cmd {
	case "serve":
		serve()
	case "apply":
		apply()
	case "version", "-v", "--version":
		fmt.Println(version)
	case "banner":
		fmt.Println(bannerArt)
	default:
		fmt.Fprintf(os.Stderr, "usage: towertorch [serve|apply|version]\n")
		os.Exit(2)
	}
}

func env(key, def string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return def
}

// shaperAdapter lets the monitor apply egress limits via the netshape package.
type shaperAdapter struct{}

func (shaperAdapter) Apply(iface string, pid, egressKbit, ingressKbit int) error {
	return netshape.Apply(iface, pid, egressKbit, ingressKbit)
}

func (shaperAdapter) DetectIface(pid int) string { return netshape.DetectIface(pid) }

// inspectorAdapter bridges the docker client to the readiness prober's minimal
// Inspector interface, keeping the readiness package free of docker types.
type inspectorAdapter struct{ c *dockercli.Client }

func (a inspectorAdapter) Snapshot(ctx context.Context, ref string) (readiness.Snapshot, error) {
	ins, err := a.c.Inspect(ctx, ref)
	if err != nil {
		return readiness.Snapshot{}, err
	}
	return readiness.Snapshot{Running: ins.Running, Health: ins.Health, IP: ins.IP}, nil
}

func serve() {
	dataDir := env("CC_DATA_DIR", defaultDataDir)
	dockerSock := env("CC_DOCKER_SOCK", defaultDockerSock)
	apiSock := env("CC_SOCK", defaultAPISock)

	docker := dockercli.NewUnix(dockerSock)
	st := store.New(filepath.Join(dataDir, "plan.json"))
	prober := readiness.Prober{Inspector: inspectorAdapter{docker}, ExecCheck: docker.Exec, GetLogs: docker.Logs}
	orch := &orchestrator.Orchestrator{Starter: docker, Ready: prober}
	vmc := vmctl.New()
	icons := iconsrc.New(dataDir)
	defer icons.Close()
	srv := &api.Server{Docker: docker, Store: st, Runner: orch, Pidder: docker, VMs: vmc, Icons: icons, TemplatesDir: env("CC_TEMPLATES_DIR", unraidtmpl.DefaultDir), Version: version, Diag: bugreport.Default}

	if err := os.MkdirAll(dataDir, 0o755); err != nil {
		log.Fatalf("towertorch: mkdir %s: %v", dataDir, err)
	}
	// A stale socket from an unclean stop would make Listen fail with EADDRINUSE.
	_ = os.Remove(apiSock)
	ln, err := net.Listen("unix", apiSock)
	if err != nil {
		log.Fatalf("towertorch: listen %s: %v", apiSock, err)
	}
	_ = os.Chmod(apiSock, 0o660)

	httpSrv := &http.Server{Handler: srv.Handler()}

	ctx, stop := signal.NotifyContext(context.Background(), syscall.SIGTERM, syscall.SIGINT)
	defer stop()
	go func() {
		<-ctx.Done()
		shutCtx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
		defer cancel()
		_ = httpSrv.Shutdown(shutCtx)
		_ = os.Remove(apiSock)
	}()

	mon := &monitor.Monitor{Docker: docker, Config: st, Notifier: monitor.SysNotifier{}, Pidder: docker, Shaper: shaperAdapter{}, Statter: docker, VMShaper: vmc}
	srv.BwLast = mon
	// A saved config takes effect at once instead of on the next 30s tick.
	srv.Kicker = mon
	go mon.Run(ctx)

	log.Print("\n" + bannerArt)
	// No ANSI colour: rc.towertorch sends this to a flat log file that
	// Unraid's log viewer shows as plain text.
	log.Printf("✓ TOWERTORCH %s IS READY - api %s · data %s · docker %s", version, apiSock, dataDir, dockerSock)

	if err := httpSrv.Serve(ln); err != nil && err != http.ErrServerClosed {
		log.Fatalf("towertorch: serve: %v", err)
	}
}

// apply pokes the running supervisor to (re)apply its plan. The array-start
// event hook calls this once the Docker daemon is up.
func apply() {
	apiSock := env("CC_SOCK", defaultAPISock)
	hc := &http.Client{
		Timeout: 15 * time.Minute, // health-gated starts can take a while
		Transport: &http.Transport{
			DialContext: func(ctx context.Context, _, _ string) (net.Conn, error) {
				var d net.Dialer
				return d.DialContext(ctx, "unix", apiSock)
			},
		},
	}
	resp, err := hc.Post("http://unix/api/apply", "application/json", nil)
	if err != nil {
		log.Fatalf("towertorch apply: %v", err)
	}
	defer func() { _ = resp.Body.Close() }()
	_, _ = io.Copy(os.Stdout, resp.Body)
	fmt.Println()
	if resp.StatusCode != http.StatusOK {
		os.Exit(1)
	}
}
