package api

import (
	"context"
	"encoding/json"
	"errors"
	"net/http"

	"github.com/junkerderprovinz/towertorch/internal/fortress"
	"github.com/junkerderprovinz/towertorch/internal/maint"
)

// Door lets TowerTorch join a fortress with its phrase.
type Door interface {
	Enter(words string) error
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
	lang := r.URL.Query().Get("lang")
	if lang == "" {
		lang = r.Header.Get("Accept-Language")
	}
	maint.Localize(&o, lang)
	writeJSON(w, http.StatusOK, o)
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
