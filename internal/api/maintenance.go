package api

import (
	"cmp"
	"context"
	"encoding/json"
	"errors"
	"net/http"

	kitfortress "github.com/junkerderprovinz/parleyport/kit/fortress"

	"github.com/junkerderprovinz/towertorch/internal/fortress"
	"github.com/junkerderprovinz/towertorch/internal/maint"
)

// Door lets TowerTorch join a fortress with its phrase, take another member
// out and leave it.
type Door interface {
	Enter(words string) error
	Leave() error
	Removed() bool
	PhraseChanged() bool
	Members() []kitfortress.Member
	Remove(id string) error
	RemovedMembers() []fortress.Removal
}

// panelView is the overview with the other members of the fortress, for the
// card's list with Remove.
type panelView struct {
	maint.Overview
	Fortress *fortressView `json:"fortress,omitempty"`
}

type fortressView struct {
	Members []memberView       `json:"members"`
	Removed []fortress.Removal `json:"removed"`
}

// memberView is another member as the card names it. Deployment and Address
// let the card find an app that keeps the phrase, since TowerTorch keeps
// none.
type memberView struct {
	ID         string `json:"id"`
	Kind       string `json:"kind"`
	App        string `json:"app"`
	Name       string `json:"name"`
	Device     string `json:"device"`
	Deployment string `json:"deployment"`
	Address    string `json:"address"`
	Online     bool   `json:"online"`
}

func (s *Server) fortressView() *fortressView {
	v := &fortressView{Members: []memberView{}, Removed: s.Door.RemovedMembers()}
	for _, m := range s.Door.Members() {
		v.Members = append(v.Members, memberView{
			ID: m.ID, Kind: string(m.Kind), App: m.App.ID, Name: cmp.Or(m.App.Name, m.App.ID), Device: m.Device,
			Deployment: m.Deployment, Address: m.Address, Online: m.Online(),
		})
	}
	return v
}

// Maintenance runs the maintenance plan.
type Maintenance interface {
	State(ctx context.Context) maint.Overview
	SavePlan(p maint.Plan) error
	Start(ctx context.Context, trigger maint.Trigger) error
	Stop() bool
}

func (s *Server) handleGetMaintenance(w http.ResponseWriter, r *http.Request) {
	o := s.Maintenance.State(r.Context())
	if s.Door != nil {
		o.Ready.Removed, o.Ready.PhraseChanged = s.Door.Removed(), s.Door.PhraseChanged()
	}
	lang := r.URL.Query().Get("lang")
	if lang == "" {
		lang = r.Header.Get("Accept-Language")
	}
	maint.Localize(&o, lang)
	v := panelView{Overview: o}
	if s.Door != nil {
		v.Fortress = s.fortressView()
	}
	writeJSON(w, http.StatusOK, v)
}

func (s *Server) handlePutMaintenance(w http.ResponseWriter, r *http.Request) {
	var p maint.Plan
	if err := json.NewDecoder(r.Body).Decode(&p); err != nil {
		writeErr(w, http.StatusBadRequest, err)
		return
	}
	if err := p.Validate(); err != nil {
		writeErr(w, http.StatusBadRequest, err)
		return
	}
	if err := s.Maintenance.SavePlan(p); err != nil {
		writeErr(w, http.StatusInternalServerError, err)
		return
	}
	writeJSON(w, http.StatusOK, map[string]string{"status": "saved"})
}

func (s *Server) handleRunMaintenance(w http.ResponseWriter, r *http.Request) {
	err := s.Maintenance.Start(r.Context(), maint.TriggerManual)
	switch {
	case errors.Is(err, maint.ErrBusy):
		writeErr(w, http.StatusConflict, err)
	case errors.Is(err, maint.ErrNoPlan):
		writeErr(w, http.StatusBadRequest, err)
	case err != nil:
		writeErr(w, http.StatusInternalServerError, err)
	default:
		writeJSON(w, http.StatusAccepted, map[string]string{"status": "started"})
	}
}

func (s *Server) handleStopMaintenance(w http.ResponseWriter, _ *http.Request) {
	writeJSON(w, http.StatusOK, map[string]bool{"stopping": s.Maintenance.Stop()})
}

// handleJoin takes the phrase and answers with a code the panel can word:
// phrase for words that are no fortress phrase, member when TowerTorch is in
// one already.
func (s *Server) handleJoin(w http.ResponseWriter, r *http.Request) {
	var req struct {
		Phrase string `json:"phrase"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "phrase"})
		return
	}
	err := s.Door.Enter(req.Phrase)
	switch {
	case errors.Is(err, fortress.ErrPhrase):
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "phrase"})
	case errors.Is(err, fortress.ErrMember):
		writeJSON(w, http.StatusConflict, map[string]string{"error": "member"})
	case err != nil:
		writeErr(w, http.StatusInternalServerError, err)
	default:
		writeJSON(w, http.StatusOK, map[string]string{"status": "joined"})
	}
}

func (s *Server) handleLeave(w http.ResponseWriter, _ *http.Request) {
	err := s.Door.Leave()
	switch {
	case errors.Is(err, fortress.ErrNotMember):
		writeJSON(w, http.StatusConflict, map[string]string{"error": "notMember"})
	case err != nil:
		writeErr(w, http.StatusInternalServerError, err)
	default:
		writeJSON(w, http.StatusOK, map[string]string{"status": "left"})
	}
}

// handleRemove takes another member out, by its id: noMember for an id no
// other member has, notMember while TowerTorch is in no fortress.
func (s *Server) handleRemove(w http.ResponseWriter, r *http.Request) {
	var req struct {
		ID string `json:"id"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil || req.ID == "" {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "noMember"})
		return
	}
	err := s.Door.Remove(req.ID)
	switch {
	case errors.Is(err, fortress.ErrNoMember):
		writeJSON(w, http.StatusNotFound, map[string]string{"error": "noMember"})
	case errors.Is(err, fortress.ErrNotMember):
		writeJSON(w, http.StatusConflict, map[string]string{"error": "notMember"})
	case err != nil:
		writeErr(w, http.StatusInternalServerError, err)
	default:
		writeJSON(w, http.StatusOK, map[string]string{"status": "removed"})
	}
}
