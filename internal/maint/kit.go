package maint

import (
	"context"
	"errors"
	"net/http"

	"github.com/junkerderprovinz/parleyport/kit/fortress"
	"github.com/junkerderprovinz/parleyport/kit/member"
)

// KitFortress is the part of the kit's fortress the jobs use.
type KitFortress interface {
	Members() []fortress.Member
	Act(ctx context.Context, id, action string, body []byte) ([]byte, error)
}

// Kit carries the jobs through the kit's fortress.
type Kit struct {
	Fortress KitFortress
}

// Members lists the instances. A viewer does no jobs.
func (k Kit) Members() []Member {
	var out []Member
	for _, m := range k.Fortress.Members() {
		if m.Kind == member.KindInstance {
			out = append(out, Member{ID: m.ID, App: m.App.ID, Device: m.Device, Online: m.Online(), Actions: m.Actions})
		}
	}
	return out
}

// Act asks member id to run action, with the kit's no as a *Refused.
func (k Kit) Act(ctx context.Context, id, action string, body []byte) ([]byte, error) {
	out, err := k.Fortress.Act(ctx, id, action, body)
	var no *fortress.Refusal
	switch {
	case errors.As(err, &no):
		return nil, &Refused{Status: no.Status, Code: no.Code}
	case errors.Is(err, fortress.ErrPermissionOff):
		return nil, &Refused{Status: http.StatusForbidden, Code: "permission_off"}
	case errors.Is(err, fortress.ErrNoSuchAction):
		return nil, &Refused{Status: http.StatusNotFound, Code: "no_such_action"}
	}
	return out, err
}
