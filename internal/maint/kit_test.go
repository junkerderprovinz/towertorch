package maint

import (
	"context"
	"errors"
	"fmt"
	"io"
	"net/http"
	"strings"
	"testing"

	"github.com/junkerderprovinz/parleyport/kit/fortress"
	"github.com/junkerderprovinz/parleyport/kit/group"
	"github.com/junkerderprovinz/parleyport/kit/member"
)

type fakeKit struct {
	members []fortress.Member
	err     error
	action  string
}

func (f *fakeKit) Members() []fortress.Member { return f.members }

func (f *fakeKit) Act(_ context.Context, _, action string, _ []byte) ([]byte, error) {
	f.action = action
	return []byte(`{"run":"1"}`), f.err
}

func TestTheKitListsInstancesWithTheirApp(t *testing.T) {
	k := Kit{Fortress: &fakeKit{members: []fortress.Member{
		{ID: "a", Kind: member.KindInstance, App: fortress.App{ID: "bombvault"}, Device: "My vault", Host: "Tower", Direct: true, Actions: []string{BackupAction}},
		{ID: "b", Kind: member.KindInstance, App: fortress.App{ID: "shiplog"}, Device: "Tower"},
		{ID: "c", Kind: member.KindViewer, App: fortress.App{ID: "tollroll"}, Device: "Phone", Relay: true},
	}}}
	got := k.Members()
	if len(got) != 2 {
		t.Fatalf("members = %+v", got)
	}
	if got[0].App != "bombvault" || got[0].Host != "Tower" || !got[0].Online || got[0].Actions[0] != BackupAction || got[1].Online {
		t.Errorf("members = %+v", got)
	}
}

func TestTheKitsNoComesBackAsARefusal(t *testing.T) {
	for _, c := range []struct {
		err  error
		code string
	}{
		{&fortress.Refusal{Status: 409, Code: "busy"}, "busy"},
		{fortress.ErrPermissionOff, "permission_off"},
		{fortress.ErrNoSuchAction, "no_such_action"},
	} {
		k := Kit{Fortress: &fakeKit{err: c.err}}
		_, err := k.Act(context.Background(), "a", BackupAction, nil)
		var no *Refused
		if !errors.As(err, &no) || no.Code != c.code {
			t.Errorf("%v came back as %v", c.err, err)
		}
	}
	k := Kit{Fortress: &fakeKit{err: context.DeadlineExceeded}}
	if _, err := k.Act(context.Background(), "a", BackupAction, nil); !errors.Is(err, context.DeadlineExceeded) {
		t.Errorf("err = %v", err)
	}
}

func TestAMemberOutOfReachIsReportedWithoutItsAddress(t *testing.T) {
	const at = "https://192.168.20.5:3443"
	for _, kitErr := range []error{
		fmt.Errorf("%w directly at %s: %w", group.ErrUnreachable, at, io.ErrUnexpectedEOF),
		fmt.Errorf("%w: %s refused the direct call with HTTP 403", group.ErrStranger, at),
		&group.StatusError{Address: at, Status: http.StatusBadGateway},
	} {
		_, err := Kit{Fortress: &fakeKit{err: kitErr}}.Act(context.Background(), "a", BackupAction, nil)
		if err == nil || strings.Contains(err.Error(), "192.168") {
			t.Errorf("%v came back as %v", kitErr, err)
		}
	}
	_, err := Kit{Fortress: &fakeKit{err: fmt.Errorf("%w directly at %s: %w", group.ErrUnreachable, at, io.ErrUnexpectedEOF)}}.Act(context.Background(), "a", BackupAction, nil)
	if !errors.Is(err, group.ErrUnreachable) {
		t.Errorf("err = %v, want it unreachable", err)
	}
}
