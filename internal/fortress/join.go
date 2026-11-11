package fortress

import (
	"errors"
	"io/fs"
	"slices"

	kitfortress "github.com/junkerderprovinz/parleyport/kit/fortress"
	"github.com/junkerderprovinz/parleyport/kit/status"

	"github.com/junkerderprovinz/towertorch/internal/maint"
)

// Membership is TowerTorch taking part in a fortress.
type Membership struct {
	Fortress *kitfortress.Fortress
	// Device is the server's name in the fortress, the one TowerTorch joined
	// with. The maintenance plan asks the apps on this device only.
	Device string
	close  func() error
}

// Close leaves the fortress.
func (m *Membership) Close() error { return m.close() }

// Join takes part in the fortress whose membership the kit's fortress join
// kept in dir, as app, and answers the other members about TowerTorch from
// src. It returns nil when nobody joined there.
func Join(dir string, app status.App, src status.Source) (*Membership, error) {
	cfg, err := config(dir, app, src)
	if errors.Is(err, fs.ErrNotExist) {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}
	if cfg.LAN != nil {
		cfg.LAN.Start()
	}
	f, err := kitfortress.Open(cfg)
	if err != nil {
		if cfg.LAN != nil {
			_ = cfg.LAN.Close()
		}
		return nil, err
	}
	m := &Membership{Fortress: f, Device: cfg.Self.Name, close: f.Close}
	if cfg.LAN != nil {
		m.close = func() error { return errors.Join(f.Close(), cfg.LAN.Close()) }
	}
	return m, nil
}

func config(dir string, app status.App, src status.Source) (kitfortress.Config, error) {
	if dir == "" {
		return kitfortress.Config{}, fs.ErrNotExist
	}
	cfg, err := kitfortress.Load(dir)
	if err != nil {
		return cfg, err
	}
	cfg.App = kitfortress.App{ID: app.ID, Name: app.Name, Version: app.Version}
	cfg.Status = src
	for _, a := range []string{maint.BackupAction, maint.UpdateAction} {
		if !slices.Contains(cfg.Uses, a) {
			cfg.Uses = append(cfg.Uses, a)
		}
	}
	return cfg, nil
}
