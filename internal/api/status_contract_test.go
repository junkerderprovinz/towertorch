package api

import (
	"context"
	"net"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"testing"
	"time"

	"github.com/junkerderprovinz/parleyport/kit/status"
	"github.com/junkerderprovinz/parleyport/kit/statustest"

	"github.com/junkerderprovinz/towertorch/internal/fortress"
	"github.com/junkerderprovinz/towertorch/internal/maint"
	"github.com/junkerderprovinz/towertorch/internal/model"
)

// fortressServer is a server whose board holds a failed start, a
// maintenance run at work and one that held the restart.
func fortressServer() *Server {
	b := &fortress.Board{
		App:      status.App{ID: "towertorch", Name: "TowerTorch", Version: "1.4.2"},
		Instance: status.Instance{ID: "0123456789abcdef0123456789abcdef", Name: "Tower"},
	}
	b.RunStarted()
	b.RunFinished(model.RunResult{Nodes: []model.NodeResult{
		{Name: "db", State: model.StateFailed, Reason: "not ready within timeout"},
		{Name: "web", State: model.StateReady},
	}})
	b.WatchdogRestarted("web", 1)
	b.MaintenanceProgress(&maint.Progress{Started: time.Date(2026, 11, 10, 3, 30, 0, 0, time.UTC), Step: maint.StepBackup, Index: 1, Total: 2, Item: "db", BlocksRestart: true})
	b.MaintenanceFinished(maint.Report{ID: "1", Outcome: maint.StateHeld, Steps: []maint.StepReport{{Step: maint.StepRestart, State: maint.StateHeld, Code: "restart.held_nogo"}}})
	return &Server{Store: &memStore{}, Fortress: b}
}

func TestStatusContract(t *testing.T) {
	statustest.Run(t, fortressServer().Handler(), statustest.Options{Authenticate: func(r *http.Request) {
		*r = *r.WithContext(context.WithValue(r.Context(), viaSocket{}, true))
	}})
}

// shortSocketPath keeps the path under the 108 bytes a unix socket address
// may hold, which a test's temp dir can exceed.
func shortSocketPath(t *testing.T) string {
	t.Helper()
	dir, err := os.MkdirTemp("", "tt")
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { _ = os.RemoveAll(dir) })
	return filepath.Join(dir, "s")
}

func serve(t *testing.T, s *Server, network, address string) net.Listener {
	t.Helper()
	ln, err := net.Listen(network, address)
	if err != nil {
		t.Skipf("cannot listen on %s here: %v", network, err)
	}
	srv := s.HTTPServer()
	go func() { _ = srv.Serve(ln) }()
	t.Cleanup(func() { _ = srv.Close() })
	return ln
}

func get(t *testing.T, client *http.Client, url string) int {
	t.Helper()
	resp, err := client.Get(url)
	if err != nil {
		t.Fatal(err)
	}
	_ = resp.Body.Close()
	return resp.StatusCode
}

func TestTheStatusAnswersOnTheSocket(t *testing.T) {
	path := shortSocketPath(t)
	serve(t, fortressServer(), "unix", path)
	client := &http.Client{Timeout: 5 * time.Second, Transport: &http.Transport{
		DialContext: func(ctx context.Context, _, _ string) (net.Conn, error) {
			var d net.Dialer
			return d.DialContext(ctx, "unix", path)
		},
	}}
	for _, p := range []string{status.StatusPath, status.LogPath} {
		if code := get(t, client, "http://unix"+p); code != http.StatusOK {
			t.Errorf("GET %s over the socket: %d, want 200", p, code)
		}
	}
}

func TestTheStatusRefusesATCPConnection(t *testing.T) {
	ln := serve(t, fortressServer(), "tcp", "127.0.0.1:0")
	client := &http.Client{Timeout: 5 * time.Second}
	for _, p := range []string{status.StatusPath, status.LogPath} {
		if code := get(t, client, "http://"+ln.Addr().String()+p); code != http.StatusUnauthorized {
			t.Errorf("GET %s over TCP: %d, want 401", p, code)
		}
	}
}

func TestApplyShowsTheRunOnTheBoard(t *testing.T) {
	b := &fortress.Board{}
	s := &Server{Store: &memStore{}, Runner: resultRunner{model.RunResult{Nodes: []model.NodeResult{{Name: "db", State: model.StateFailed, Reason: "x"}}}}, Fortress: b}
	rec := httptestApply(t, s)
	if rec != http.StatusOK {
		t.Fatalf("apply code = %d", rec)
	}
	r, _ := b.Report(context.Background(), "en")
	if len(r.NeedsYou) != 1 || r.NeedsYou[0].ID != "start-db" || len(r.Work) != 0 {
		t.Errorf("board after apply = %+v", r)
	}
}

func httptestApply(t *testing.T, s *Server) int {
	t.Helper()
	rec := httptest.NewRecorder()
	s.Handler().ServeHTTP(rec, httptest.NewRequest(http.MethodPost, "/api/apply", nil))
	return rec.Code
}
