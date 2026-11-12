package fortress

import (
	"context"
	"slices"

	kitfortress "github.com/junkerderprovinz/parleyport/kit/fortress"
	"github.com/junkerderprovinz/parleyport/kit/status"
)

// logPages bounds how far Log reads into a member's log, so a member that
// keeps a very long one cannot hold the settings page.
const logPages = 20

// Status reads the status report of member id, its texts in lang.
func (d *Door) Status(ctx context.Context, id, lang string) (status.Report, error) {
	f, err := d.other(id)
	if err != nil {
		return status.Report{}, err
	}
	var r status.Report
	err = d.call(ctx, f, id, func(f *kitfortress.Fortress) (err error) {
		r, err = f.Status(ctx, id, lang)
		return err
	})
	return r, err
}

// Log reads the newest n lines of member id's log, newest first. The
// contract pages from the oldest line on, so Log reads to the end.
func (d *Door) Log(ctx context.Context, id, lang string, n int) ([]status.LogEntry, error) {
	f, err := d.other(id)
	if err != nil {
		return nil, err
	}
	var tail []status.LogEntry
	err = d.call(ctx, f, id, func(f *kitfortress.Fortress) error {
		tail = nil
		after := ""
		for range logPages {
			page, err := f.Log(ctx, id, status.LogQuery{After: after, Limit: status.MaxLogLimit, Lang: lang})
			if err != nil {
				return err
			}
			tail = append(tail, page.Entries...)
			tail = tail[max(0, len(tail)-n):]
			if len(page.Entries) == 0 || page.Next == after {
				return nil
			}
			after = page.Next
		}
		return nil
	})
	slices.Reverse(tail)
	return tail, err
}

// other is the fortress while id is one of its other members.
func (d *Door) other(id string) (*kitfortress.Fortress, error) {
	f := d.current()
	if f == nil {
		return nil, ErrNotMember
	}
	if !slices.ContainsFunc(f.Members(), func(m kitfortress.Member) bool { return m.ID == id }) {
		return nil, ErrNoMember
	}
	return f, nil
}
