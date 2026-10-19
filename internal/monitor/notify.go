package monitor

import (
	"bytes"
	"context"
	"encoding/json"
	"net/http"
	"os/exec"
	"time"

	"github.com/junkerderprovinz/towertorch/internal/model"
)

// unraidNotify is Unraid's own notification agent.
const unraidNotify = "/usr/local/emhttp/plugins/dynamix/scripts/notify"

// SysNotifier delivers alerts through Unraid's notification system or a webhook.
// Failures are ignored so a notification problem cannot break the monitor.
type SysNotifier struct{ HTTP *http.Client }

// Notify sends the alert as cfg says. importance is Unraid's level: normal,
// warning or alert.
func (s SysNotifier) Notify(ctx context.Context, cfg model.Notify, subject, desc, importance string) {
	if cfg.Unraid {
		// A hung notify agent must not stall the monitor tick.
		nctx, cancel := context.WithTimeout(ctx, 15*time.Second)
		_ = exec.CommandContext(nctx, unraidNotify,
			"-e", "TowerTorch", "-s", subject, "-d", desc, "-i", importance).Run()
		cancel()
	}
	if cfg.Webhook != "" {
		body, _ := json.Marshal(map[string]string{
			"event": subject, "detail": desc, "importance": importance,
		})
		req, err := http.NewRequestWithContext(ctx, http.MethodPost, cfg.Webhook, bytes.NewReader(body))
		if err != nil {
			return
		}
		req.Header.Set("Content-Type", "application/json")
		hc := s.HTTP
		if hc == nil {
			hc = &http.Client{Timeout: 10 * time.Second}
		}
		if resp, err := hc.Do(req); err == nil {
			_ = resp.Body.Close()
		}
	}
}
