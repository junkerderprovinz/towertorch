package fortress

import (
	"encoding/json"
	"errors"
	"io/fs"
	"os"
	"path/filepath"
)

// ErrNoMember means no other member of the fortress has the id given.
var ErrNoMember = errors.New("no other member of the fortress has that id")

// removedFile sits in Dir beside the membership, so leaving or being taken
// out forgets it along with the fortress.
const removedFile = "removed.json"

// Removal is a member TowerTorch took out of the fortress. Until the phrase
// changes, the fortress takes no new member, so the card keeps naming it.
type Removal struct {
	App    string `json:"app"`
	Name   string `json:"name"`
	Device string `json:"device"`
}

// Remove takes member id out of the fortress, here and at every member in
// reach, and names it until the phrase changes. TowerTorch itself is no other
// member, so it leaves instead.
func (d *Door) Remove(id string) error {
	d.mu.Lock()
	defer d.mu.Unlock()
	if d.m == nil {
		return ErrNotMember
	}
	for _, m := range d.m.Fortress.Members() {
		if m.ID != id {
			continue
		}
		if err := d.m.Fortress.Remove(id); err != nil {
			return err
		}
		list, err := d.removals()
		if err != nil {
			return err
		}
		return d.keepRemovals(append(list, Removal{App: m.App.ID, Name: AppName(m.App), Device: m.Device}))
	}
	return ErrNoMember
}

// RemovedMembers lists the members TowerTorch took out since the phrase last
// changed.
func (d *Door) RemovedMembers() []Removal {
	d.mu.Lock()
	defer d.mu.Unlock()
	list, _ := d.removals()
	return list
}

func (d *Door) removals() ([]Removal, error) {
	list := []Removal{}
	raw, err := os.ReadFile(filepath.Join(d.Dir, removedFile))
	if errors.Is(err, fs.ErrNotExist) {
		return list, nil
	}
	if err != nil {
		return list, err
	}
	return list, json.Unmarshal(raw, &list)
}

// keepRemovals replaces the list in one step, so a crash leaves the old one
// or the new one. CreateTemp makes the file readable by its owner alone.
func (d *Door) keepRemovals(list []Removal) error {
	raw, err := json.Marshal(list)
	if err != nil {
		return err
	}
	tmp, err := os.CreateTemp(d.Dir, ".removed-*")
	if err != nil {
		return err
	}
	defer func() { _ = os.Remove(tmp.Name()) }()
	if _, err := tmp.Write(raw); err != nil {
		_ = tmp.Close()
		return err
	}
	if err := tmp.Close(); err != nil {
		return err
	}
	return os.Rename(tmp.Name(), filepath.Join(d.Dir, removedFile))
}

// forgetRemovals runs once the fortress has a new phrase, which the members
// taken out do not get.
func (d *Door) forgetRemovals() {
	_ = os.Remove(filepath.Join(d.Dir, removedFile))
}
