package api

import (
	"cmp"
	"context"
	"encoding/json"
	"errors"
	"net/http"
	"time"

	kitfortress "github.com/junkerderprovinz/parleyport/kit/fortress"
	"github.com/junkerderprovinz/parleyport/kit/member"
	"github.com/junkerderprovinz/parleyport/kit/status"

	"github.com/junkerderprovinz/towertorch/internal/fortress"
)

// Door lets TowerTorch join a fortress with its phrase, take another member
// out, read how another member is doing and leave.
type Door interface {
	Enter(words string) error
	Leave() error
	Joined() (device string, in bool)
	Removed() bool
	PhraseChanged() bool
	Members() []kitfortress.Member
	Remove(id string) error
	RemovedMembers() []fortress.Removal
	Status(ctx context.Context, id, lang string) (status.Report, error)
	Log(ctx context.Context, id, lang string, n int) ([]status.LogEntry, error)
}

// statusLogLines is how many log lines the card's status window shows.
const statusLogLines = 10

// fortressState is the fortress as the settings card draws it. RemovedHere
// says another member took TowerTorch out, PhraseChanged that the fortress
// has a new phrase TowerTorch could not follow.
type fortressState struct {
	Joined        bool               `json:"joined"`
	Device        string             `json:"device"`
	RemovedHere   bool               `json:"removedHere"`
	PhraseChanged bool               `json:"phraseChanged"`
	Members       []memberView       `json:"members"`
	Removed       []fortress.Removal `json:"removed"`
}

// memberView is another member as the card shows it. Form is how the app is
// deployed, which tells the card the apps that keep the phrase, since a
// plugin keeps none. Relay means it is reached through the relay alone.
type memberView struct {
	ID       string    `json:"id"`
	App      string    `json:"app"`
	Name     string    `json:"name"`
	Device   string    `json:"device"`
	Form     string    `json:"form"`
	Version  string    `json:"version"`
	Icon     string    `json:"icon"`
	Online   bool      `json:"online"`
	Relay    bool      `json:"relay"`
	LastSeen time.Time `json:"lastSeen,omitzero"`
}

// fortressState lists the other app instances only. A viewer or a phone has
// no app to show, and a member that never said which app it runs, such as
// FireSquire's helper, which is online only while it runs, would name a
// device and nothing else.
func (s *Server) fortressState() fortressState {
	device, in := s.Door.Joined()
	v := fortressState{
		Joined: in, Device: device, RemovedHere: s.Door.Removed(), PhraseChanged: s.Door.PhraseChanged(),
		Members: []memberView{}, Removed: []fortress.Removal{},
	}
	for _, r := range s.Door.RemovedMembers() {
		if r.App != "" {
			v.Removed = append(v.Removed, r)
		}
	}
	for _, m := range s.Door.Members() {
		if m.Kind != member.KindInstance || m.App.ID == "" {
			continue
		}
		v.Members = append(v.Members, memberView{
			ID: m.ID, App: m.App.ID, Name: cmp.Or(m.App.Name, m.App.ID), Device: m.Device, Form: m.Deployment,
			Version: m.App.Version, Icon: m.App.Icon, Online: m.Online(), Relay: m.Relay && !m.Direct, LastSeen: m.LastSeen,
		})
	}
	return v
}

func (s *Server) handleGetFortress(w http.ResponseWriter, _ *http.Request) {
	writeJSON(w, http.StatusOK, s.fortressState())
}

// handleJoin takes the phrase and answers with the new state, or with a code
// the card can word: phrase for words that are no fortress phrase, member
// when TowerTorch is in one already.
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
		writeJSON(w, http.StatusOK, s.fortressState())
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
		writeJSON(w, http.StatusOK, s.fortressState())
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
		writeJSON(w, http.StatusOK, s.fortressState())
	}
}

// handleMember answers how another member is doing, its report and the
// newest lines of its log, for the card's status window. A member that does
// not answer is a bad gateway, since TowerTorch itself is fine.
func (s *Server) handleMember(w http.ResponseWriter, r *http.Request) {
	id, lang := r.URL.Query().Get("id"), language(r)
	if id == "" {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "noMember"})
		return
	}
	report, err := s.Door.Status(r.Context(), id, lang)
	var log []status.LogEntry
	if err == nil {
		log, err = s.Door.Log(r.Context(), id, lang, statusLogLines)
	}
	switch {
	case errors.Is(err, fortress.ErrNoMember):
		writeJSON(w, http.StatusNotFound, map[string]string{"error": "noMember"})
	case errors.Is(err, fortress.ErrNotMember):
		writeJSON(w, http.StatusConflict, map[string]string{"error": "notMember"})
	case err != nil:
		writeErr(w, http.StatusBadGateway, err)
	default:
		writeJSON(w, http.StatusOK, map[string]any{"report": report, "log": log})
	}
}

// language is the language a page asks for, by its lang parameter or else
// its browser's.
func language(r *http.Request) string {
	return cmp.Or(r.URL.Query().Get("lang"), r.Header.Get("Accept-Language"))
}
