package api

import (
	"context"
	"encoding/json"
	"errors"
	"net/http"

	"github.com/junkerderprovinz/towertorch/internal/maint"
)

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
	maint.Localize(&o, language(r))
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
