package maint

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"strings"
	"sync"
	"testing"
	"time"
)

// fakeFortress speaks the job contract: a body without "run" starts a job,
// a body with "run" asks about it. Each question pops the next answer from
// polls; the last one repeats.
type fakeFortress struct {
	members []Member

	mu      sync.Mutex
	calls   []call
	start   func(action string, body map[string]any) ([]byte, error)
	polls   map[string][]string
	pollErr error
}

type call struct {
	member, action string
	body           map[string]any
}

func (f *fakeFortress) Members() []Member { return f.members }

func (f *fakeFortress) Act(_ context.Context, id, action string, raw []byte) ([]byte, error) {
	var body map[string]any
	if err := json.Unmarshal(raw, &body); err != nil {
		return nil, err
	}
	f.mu.Lock()
	defer f.mu.Unlock()
	f.calls = append(f.calls, call{id, action, body})
	if run, ok := body["run"].(string); ok {
		if f.pollErr != nil {
			return nil, f.pollErr
		}
		answers := f.polls[run]
		if len(answers) == 0 {
			return nil, &Refused{Status: 404, Code: "no_such_run"}
		}
		next := answers[0]
		if len(answers) > 1 {
			f.polls[run] = answers[1:]
		}
		return []byte(next), nil
	}
	if f.start == nil {
		return []byte(`{"run":"r1"}`), nil
	}
	return f.start(action, body)
}

func (f *fakeFortress) starts(action string) []map[string]any {
	f.mu.Lock()
	defer f.mu.Unlock()
	var out []map[string]any
	for _, c := range f.calls {
		if _, poll := c.body["run"]; c.action == action && !poll {
			out = append(out, c.body)
		}
	}
	return out
}

func bombvault(device string, online bool) Member {
	return Member{ID: "bv-" + device, App: "bombvault", Device: device, Online: online, Actions: []string{BackupAction}}
}

func shiplog(device string) Member {
	return Member{ID: "sl-" + device, App: "shiplog", Device: device, Online: true, Actions: []string{UpdateAction}}
}

func newJobs(f Fortress) *Jobs {
	return &Jobs{Fortress: f, Device: "Tower", Poll: time.Second, BackupTimeout: 5 * time.Second, UpdateTimeout: 5 * time.Second,
		sleep: func(ctx context.Context, _ time.Duration) error { return ctx.Err() }}
}

func TestOnlyAnAppOnThisServerIsFound(t *testing.T) {
	j := newJobs(&fakeFortress{members: []Member{bombvault("Basement", true)}})
	_, err := j.Find(BackupAction)
	if !errors.Is(err, ErrNoApp) {
		t.Fatalf("err = %v", err)
	}
	var no *NoAppError
	if !errors.As(err, &no) || len(no.Elsewhere) != 1 || no.Elsewhere[0] != "Basement" {
		t.Errorf("the other server is not named: %#v", err)
	}
}

func TestTheServerNameMatchesTheWayPeopleWriteIt(t *testing.T) {
	j := newJobs(&fakeFortress{members: []Member{bombvault("tower.lan", true)}})
	m, err := j.Find(BackupAction)
	if err != nil || m.ID != "bv-tower.lan" {
		t.Errorf("m = %+v, err = %v", m, err)
	}
}

func TestAnAppOnThisServerThatIsOfflineIsNoReasonToSkip(t *testing.T) {
	j := newJobs(&fakeFortress{members: []Member{bombvault("Tower", false)}})
	_, err := j.Find(BackupAction)
	if err == nil || errors.Is(err, ErrNoApp) {
		t.Errorf("err = %v", err)
	}
}

func TestABackupStartsWaitsAndNamesTheSnapshot(t *testing.T) {
	f := &fakeFortress{members: []Member{bombvault("Tower", true)}, polls: map[string][]string{
		"r1": {`{"state":"running"}`, `{"state":"done","snapshot":"s-42","link":"https://bv/s/42"}`},
	}}
	j := newJobs(f)
	m, _ := j.Find(BackupAction)
	snap, err := j.Backup(context.Background(), m, "nextcloud")
	if err != nil {
		t.Fatal(err)
	}
	if snap.ID != "s-42" || snap.Run != "r1" {
		t.Errorf("snap = %+v", snap)
	}
	started := f.starts(BackupAction)
	if len(started) != 1 || started[0]["container"] != "nextcloud" || started[0]["reason"] != "maintenance" {
		t.Errorf("request = %+v", started)
	}
}

func TestARunIDMayComeAsANumberOrUnderID(t *testing.T) {
	for _, answer := range []string{`{"run":8812}`, `{"id":"8812"}`, `{"id":8812}`} {
		f := &fakeFortress{members: []Member{bombvault("Tower", true)},
			start: func(string, map[string]any) ([]byte, error) { return []byte(answer), nil },
			polls: map[string][]string{"8812": {`{"state":"success"}`}}}
		j := newJobs(f)
		m, _ := j.Find(BackupAction)
		if _, err := j.Backup(context.Background(), m, "x"); err != nil {
			t.Errorf("%s: %v", answer, err)
		}
	}
}

func TestAFailedBackupSaysWhy(t *testing.T) {
	f := &fakeFortress{members: []Member{bombvault("Tower", true)}, polls: map[string][]string{
		"r1": {`{"state":"failed","error":"the target is full"}`},
	}}
	j := newJobs(f)
	m, _ := j.Find(BackupAction)
	_, err := j.Backup(context.Background(), m, "immich")
	if err == nil || !strings.Contains(err.Error(), "the target is full") {
		t.Errorf("err = %v", err)
	}
}

func TestABackupThatNeverEndsTimesOut(t *testing.T) {
	f := &fakeFortress{members: []Member{bombvault("Tower", true)}, polls: map[string][]string{"r1": {`{"state":"warning"}`}}}
	j := newJobs(f)
	j.sleep = func(context.Context, time.Duration) error { return nil }
	m, _ := j.Find(BackupAction)
	_, err := j.Backup(context.Background(), m, "x")
	if !errors.Is(err, ErrTimeout) {
		t.Errorf("err = %v", err)
	}
}

func TestARefusalCarriesTheAppsCode(t *testing.T) {
	f := &fakeFortress{members: []Member{bombvault("Tower", true)},
		start: func(string, map[string]any) ([]byte, error) {
			return nil, &Refused{Status: 403, Code: "permission_off"}
		}}
	j := newJobs(f)
	m, _ := j.Find(BackupAction)
	_, err := j.Backup(context.Background(), m, "x")
	if err == nil || !strings.Contains(err.Error(), "permission_off") {
		t.Errorf("err = %v", err)
	}
}

func TestAnUpdateNamesWhatWasBackedUpAndReportsEachContainer(t *testing.T) {
	f := &fakeFortress{members: []Member{shiplog("Tower")}, polls: map[string][]string{
		"r1": {`{"state":"running"}`, `{"state":"done","containers":[{"name":"nextcloud","result":"updated"},{"name":"immich","result":"rolledBack","error":"unhealthy"}]}`},
	}}
	j := newJobs(f)
	m, err := j.Find(UpdateAction)
	if err != nil {
		t.Fatal(err)
	}
	got, err := j.Update(context.Background(), m, []string{"nextcloud", "immich"}, []string{"nextcloud"})
	if err != nil {
		t.Fatal(err)
	}
	if len(got) != 2 || got[0] != (Updated{Name: "nextcloud", Result: "updated"}) || got[1].Result != "rolledBack" || got[1].Error != "unhealthy" {
		t.Errorf("got %+v", got)
	}
	req := f.starts(UpdateAction)
	if len(req) != 1 || req[0]["reason"] != "maintenance" {
		t.Fatalf("request = %+v", req)
	}
	if b, _ := json.Marshal(req[0]["backedUp"]); string(b) != `["nextcloud"]` {
		t.Errorf("backedUp = %s", b)
	}
}

func TestAnUpdateOfEverythingSendsAnEmptyList(t *testing.T) {
	f := &fakeFortress{members: []Member{shiplog("Tower")}, polls: map[string][]string{"r1": {`{"state":"done"}`}}}
	j := newJobs(f)
	m, _ := j.Find(UpdateAction)
	if _, err := j.Update(context.Background(), m, nil, nil); err != nil {
		t.Fatal(err)
	}
	if b, _ := json.Marshal(f.starts(UpdateAction)[0]["containers"]); string(b) != `[]` {
		t.Errorf("containers = %s", b)
	}
}

func TestAFailedUpdateRunSaysWhy(t *testing.T) {
	f := &fakeFortress{members: []Member{shiplog("Tower")}, polls: map[string][]string{"r1": {`{"state":"error","error":"docker is down"}`}}}
	j := newJobs(f)
	m, _ := j.Find(UpdateAction)
	_, err := j.Update(context.Background(), m, nil, nil)
	if err == nil || !strings.Contains(err.Error(), "docker is down") {
		t.Errorf("err = %v", err)
	}
}

func TestAnAppOnThisServerIsFoundWhateverItIsCalled(t *testing.T) {
	renamed := bombvault("My vault", true)
	renamed.Host = "tower.lan"
	j := newJobs(&fakeFortress{members: []Member{renamed}})
	j.Host = "Tower"
	if m, err := j.Find(BackupAction); err != nil || m.ID != renamed.ID {
		t.Errorf("m = %+v, err = %v; want the app on this server", m, err)
	}
}

func TestAnAppOnAnotherServerUnderTheSameNameIsNotFound(t *testing.T) {
	there := bombvault("Tower", true)
	there.Host = "Barn"
	j := newJobs(&fakeFortress{members: []Member{there}})
	j.Host = "Tower"
	if _, err := j.Find(BackupAction); !errors.Is(err, ErrNoApp) {
		t.Errorf("err = %v, want ErrNoApp for an app on another server", err)
	}
}

func TestABackupKeepsNoAddressOfTheBackupApp(t *testing.T) {
	f := &fakeFortress{members: []Member{bombvault("Tower", true)}, polls: map[string][]string{
		"r1": {`{"state":"done","snapshot":"s-42","link":"https://192.168.10.10:13443/backups/container/nextcloud"}`},
	}}
	j := newJobs(f)
	m, _ := j.Find(BackupAction)
	snap, err := j.Backup(context.Background(), m, "nextcloud")
	if err != nil {
		t.Fatal(err)
	}
	if got := fmt.Sprintf("%+v", snap); strings.Contains(got, "192.168") {
		t.Errorf("snap = %s, want it without the backup app's address", got)
	}
}
