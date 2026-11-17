package fortress

import (
	"cmp"
	"context"
	"encoding/json"
	"slices"
	"time"

	kitfortress "github.com/junkerderprovinz/parleyport/kit/fortress"
	"github.com/junkerderprovinz/parleyport/kit/member"
)

// DeliverAction is how TollRoll takes the notifications of the apps of a
// fortress, while its hub is switched on.
const DeliverAction = "notify.deliver"

// handFor bounds one try at one TollRoll, so an alert is not held up long
// before TowerTorch sends it itself.
const handFor = 10 * time.Second

// Hub hands alerts to a TollRoll in the fortress.
type Hub struct {
	Fortress interface {
		Members() []kitfortress.Member
		Act(ctx context.Context, id, action string, body []byte) ([]byte, error)
	}
}

// Hand offers the alert to each TollRoll in reach that takes notifications,
// in a fixed order, and reports whether one took it. Any other answer leaves
// the alert to TowerTorch's own channels.
func (h Hub) Hand(ctx context.Context, subject, desc, importance string) bool {
	if h.Fortress == nil {
		return false
	}
	var hubs []kitfortress.Member
	for _, m := range h.Fortress.Members() {
		if m.Kind == member.KindInstance && m.App.ID == "tollroll" && m.Online() && slices.Contains(m.Actions, DeliverAction) {
			hubs = append(hubs, m)
		}
	}
	slices.SortFunc(hubs, func(a, b kitfortress.Member) int { return cmp.Compare(a.ID, b.ID) })
	body, _ := json.Marshal(map[string]string{"kind": "towertorch.alert", "severity": severity(importance), "title": subject, "body": desc})
	for _, m := range hubs {
		cctx, cancel := context.WithTimeout(ctx, handFor)
		_, err := h.Fortress.Act(cctx, m.ID, DeliverAction, body)
		cancel()
		if err == nil {
			return true
		}
	}
	return false
}

// severity is kit/notify's word for Unraid's importance.
func severity(importance string) string {
	switch importance {
	case "alert":
		return "critical"
	case "warning":
		return "warning"
	}
	return "info"
}
