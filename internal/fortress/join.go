package fortress

import (
	"errors"
	"io/fs"
	"net"
	"slices"

	kitfortress "github.com/junkerderprovinz/parleyport/kit/fortress"
	"github.com/junkerderprovinz/parleyport/kit/group"
	"github.com/junkerderprovinz/parleyport/kit/lan"
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
// src. removed runs once another member takes TowerTorch out. It returns nil
// when nobody joined there.
func Join(dir string, app status.App, host string, src status.Source, removed func()) (*Membership, error) {
	cfg, err := config(dir, app, host, src)
	if errors.Is(err, fs.ErrNotExist) {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}
	cfg.OnRemoved = removed
	if cfg.LAN == nil {
		f, err := kitfortress.Open(cfg)
		if err != nil {
			return nil, err
		}
		return &Membership{Fortress: f, Device: cfg.Self.Name, close: f.Close}, nil
	}
	ln, err := listenDirect()
	if err != nil {
		return nil, err
	}
	if ln != nil {
		cfg.Self.DirectURL = "http://" + ln.Addr().String()
	}
	cfg.LAN.Start()
	f, err := kitfortress.Open(cfg)
	if err != nil {
		if ln != nil {
			_ = ln.Close()
		}
		return nil, errors.Join(err, cfg.LAN.Close())
	}
	m := &Membership{Fortress: f, Device: cfg.Self.Name, close: func() error { return errors.Join(f.Close(), cfg.LAN.Close()) }}
	if ln != nil {
		srv := group.ServeDirect(ln, f.DirectHandler())
		m.close = func() error { return errors.Join(srv.Close(), f.Close(), cfg.LAN.Close()) }
	}
	return m, nil
}

// listenDirect opens the port the other members call TowerTorch on, on the
// address it announces on this network and no other. The OS picks the port,
// since the announce carries it. A host without an IPv4 address gets none and
// reaches the members through the relay alone.
func listenDirect() (net.Listener, error) {
	ip := lan.LocalIPv4()
	if ip == "" {
		return nil, nil
	}
	return net.Listen("tcp4", net.JoinHostPort(ip, "0"))
}

func config(dir string, app status.App, host string, src status.Source) (kitfortress.Config, error) {
	if dir == "" {
		return kitfortress.Config{}, fs.ErrNotExist
	}
	cfg, err := kitfortress.Load(dir)
	if err != nil {
		return cfg, err
	}
	cfg.App = kitfortress.App{ID: app.ID, Name: app.Name, Version: app.Version, Icon: app.Icon}
	cfg.Host = host
	cfg.Status = src
	for _, a := range []string{maint.BackupAction, maint.UpdateAction} {
		if !slices.Contains(cfg.Uses, a) {
			cfg.Uses = append(cfg.Uses, a)
		}
	}
	return cfg, nil
}
