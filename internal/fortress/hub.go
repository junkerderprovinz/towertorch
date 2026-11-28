package fortress

import (
	"cmp"
	"context"
	"encoding/json"
	"slices"
	"time"

	kitfortress "github.com/junkerderprovinz/parleyport/kit/fortress"
	"github.com/junkerderprovinz/parleyport/kit/member"
	"github.com/junkerderprovinz/parleyport/kit/notify"
	"github.com/junkerderprovinz/parleyport/kit/status"
)

// DeliverAction is how TollRoll takes the notifications of the apps of a
// fortress, and HubCapability what its status report lists while it does.
const (
	DeliverAction = "notify.deliver"
	HubCapability = "notify.hub"
)

// handFor bounds one try at one TollRoll, so an alert is not held up long
// before TowerTorch sends it itself.
const handFor = 10 * time.Second

// Hub hands alerts to a TollRoll in the fortress.
type Hub struct {
	Fortress interface {
		Members() []kitfortress.Member
		Act(ctx context.Context, id, action string, body []byte) ([]byte, error)
		Status(ctx context.Context, id, lang string) (status.Report, error)
	}
}

type delivery struct {
	Kind     string          `json:"kind"`
	Severity notify.Severity `json:"severity"`
	Title    string          `json:"title"`
	Body     string          `json:"body"`
	Key      string          `json:"key,omitempty"`
	Recovery bool            `json:"recovery,omitempty"`
}

// Hand offers e to each TollRoll in reach, in a fixed order, and reports
// whether one took it. Any other answer leaves e to TowerTorch's own
// channels.
func (h Hub) Hand(ctx context.Context, e notify.Event) bool {
	body, err := json.Marshal(delivery{Kind: e.Kind, Severity: e.Severity, Title: e.Title, Body: e.Body, Key: e.Key, Recovery: e.Recovery})
	if err != nil {
		return false
	}
	for _, id := range h.tollrolls() {
		if h.offer(ctx, id, body) {
			return true
		}
	}
	return false
}

// Active reports whether a TollRoll in reach takes the notifications now.
func (h Hub) Active(ctx context.Context) bool {
	for _, id := range h.tollrolls() {
		r, err := h.Fortress.Status(ctx, id, "")
		if err == nil && slices.Contains(r.Capabilities, HubCapability) {
			return true
		}
	}
	return false
}

func (h Hub) tollrolls() []string {
	var ids []string
	for _, m := range h.Fortress.Members() {
		if m.Kind == member.KindInstance && m.App.ID == "tollroll" && m.Online() && slices.Contains(m.Actions, DeliverAction) {
			ids = append(ids, m.ID)
		}
	}
	slices.SortFunc(ids, cmp.Compare)
	return ids
}

func (h Hub) offer(ctx context.Context, id string, body []byte) bool {
	ctx, cancel := context.WithTimeout(ctx, handFor)
	defer cancel()
	out, err := h.Fortress.Act(ctx, id, DeliverAction, body)
	if err != nil {
		return false
	}
	var answer struct {
		Taken bool `json:"taken"`
	}
	return json.Unmarshal(out, &answer) == nil && answer.Taken
}
