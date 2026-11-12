package maint

import (
	"context"
	"errors"
	"testing"

	"github.com/junkerderprovinz/parleyport/kit/fortress"
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
