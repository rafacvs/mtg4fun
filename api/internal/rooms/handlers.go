package rooms

import (
	"database/sql"
	"encoding/json"
	"errors"
	"io"
	"net/http"
	"strconv"
	"strings"

	"mtg4fun/internal/auth"
	"mtg4fun/internal/httpserver"
)

func (s *Service) Handler() http.Handler {
	mux := http.NewServeMux()
	mux.HandleFunc("GET /api/rooms", s.listRooms)
	mux.HandleFunc("POST /api/rooms", s.createRoom)
	mux.HandleFunc("GET /api/rooms/events", s.events)
	mux.HandleFunc("POST /api/rooms/{id}/participants", s.joinRoom)
	mux.HandleFunc("PUT /api/rooms/{id}/participants/me/ready", s.readyParticipant)
	mux.HandleFunc("POST /api/rooms/{id}/start", s.startMatch)
	mux.HandleFunc("GET /api/rooms/{id}/match", s.getMatch)
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if _, ok := s.requireUser(w, r); !ok {
			return
		}
		mux.ServeHTTP(w, r)
	})
}

func roomID(w http.ResponseWriter, r *http.Request) (int64, bool) {
	id, err := strconv.ParseInt(r.PathValue("id"), 10, 64)
	if err != nil || id <= 0 {
		httpserver.WriteError(w, 400, "Sala inválida.")
		return 0, false
	}
	return id, true
}

func deckInput(w http.ResponseWriter, r *http.Request) (int64, bool) {
	if strings.Split(r.Header.Get("Content-Type"), ";")[0] != "application/json" {
		httpserver.WriteError(w, 415, "Envie JSON.")
		return 0, false
	}
	decoder := json.NewDecoder(http.MaxBytesReader(w, r.Body, 4096))
	decoder.DisallowUnknownFields()
	var input struct {
		DeckID int64 `json:"deckId"`
	}
	if err := decoder.Decode(&input); err != nil || input.DeckID <= 0 {
		httpserver.WriteError(w, 400, "Deck inválido.")
		return 0, false
	}
	if err := decoder.Decode(&struct{}{}); err != io.EOF {
		httpserver.WriteError(w, 400, "Deck inválido.")
		return 0, false
	}
	return input.DeckID, true
}

func (s *Service) readyParticipant(w http.ResponseWriter, r *http.Request) {
	id, ok := roomID(w, r)
	if !ok {
		return
	}
	deckID, ok := deckInput(w, r)
	if !ok {
		return
	}
	user, ok := s.requireUser(w, r)
	if !ok {
		return
	}
	room, err := s.ready(r.Context(), id, deckID, user)
	switch {
	case errors.Is(err, sql.ErrNoRows):
		httpserver.WriteError(w, 404, "Sala não encontrada.")
	case errors.Is(err, errDeckNotFound):
		httpserver.WriteError(w, 404, err.Error())
	case errors.Is(err, errRoomStarted):
		httpserver.WriteError(w, 409, err.Error())
	case err != nil:
		httpserver.InternalError(w, err)
	default:
		httpserver.WriteJSON(w, 200, map[string]Room{"room": room})
	}
}

func (s *Service) startMatch(w http.ResponseWriter, r *http.Request) {
	id, ok := roomID(w, r)
	if !ok {
		return
	}
	if !emptyJSON(w, r) {
		return
	}
	user, ok := s.requireUser(w, r)
	if !ok {
		return
	}
	match, err := s.start(r.Context(), id, user)
	switch {
	case errors.Is(err, sql.ErrNoRows):
		httpserver.WriteError(w, 404, "Sala não encontrada.")
	case errors.Is(err, errNotCreator):
		httpserver.WriteError(w, 403, err.Error())
	case errors.Is(err, errNotReady), errors.Is(err, errRoomStarted), errors.Is(err, errDeckNotFound):
		httpserver.WriteError(w, 409, err.Error())
	case err != nil:
		httpserver.InternalError(w, err)
	default:
		httpserver.WriteJSON(w, 201, map[string]Match{"match": match})
	}
}

func (s *Service) getMatch(w http.ResponseWriter, r *http.Request) {
	id, ok := roomID(w, r)
	if !ok {
		return
	}
	user, ok := s.requireUser(w, r)
	if !ok {
		return
	}
	match, err := s.match(r.Context(), id, user)
	switch {
	case errors.Is(err, sql.ErrNoRows):
		httpserver.WriteError(w, 404, "Partida não encontrada.")
	case err != nil:
		httpserver.InternalError(w, err)
	default:
		httpserver.WriteJSON(w, 200, map[string]Match{"match": match})
	}
}

func emptyJSON(w http.ResponseWriter, r *http.Request) bool {
	if strings.Split(r.Header.Get("Content-Type"), ";")[0] != "application/json" {
		httpserver.WriteError(w, 415, "Envie JSON.")
		return false
	}
	decoder := json.NewDecoder(http.MaxBytesReader(w, r.Body, 4096))
	decoder.DisallowUnknownFields()
	var input *struct{}
	if err := decoder.Decode(&input); err != nil || input == nil {
		httpserver.WriteError(w, 400, "Dados de sala inválidos.")
		return false
	}
	if err := decoder.Decode(&struct{}{}); err != io.EOF {
		httpserver.WriteError(w, 400, "Dados de sala inválidos.")
		return false
	}
	return true
}

func (s *Service) listRooms(w http.ResponseWriter, r *http.Request) {
	rooms, err := s.list(r.Context())
	if err != nil {
		httpserver.InternalError(w, err)
		return
	}
	httpserver.WriteJSON(w, 200, map[string]any{"rooms": rooms})
}

func (s *Service) createRoom(w http.ResponseWriter, r *http.Request) {
	if !emptyJSON(w, r) {
		return
	}
	user, ok := s.requireUser(w, r)
	if !ok {
		return
	}
	room, err := s.create(r.Context(), user)
	if err != nil {
		httpserver.InternalError(w, err)
		return
	}
	httpserver.WriteJSON(w, 201, map[string]Room{"room": room})
}

func (s *Service) joinRoom(w http.ResponseWriter, r *http.Request) {
	id, ok := roomID(w, r)
	if !ok {
		return
	}
	if !emptyJSON(w, r) {
		return
	}
	user, ok := s.requireUser(w, r)
	if !ok {
		return
	}
	room, err := s.join(r.Context(), id, user)
	switch {
	case errors.Is(err, sql.ErrNoRows):
		httpserver.WriteError(w, 404, "Sala não encontrada.")
	case errors.Is(err, errRoomFull), errors.Is(err, errRoomStarted):
		httpserver.WriteError(w, 409, err.Error())
	case err != nil:
		httpserver.InternalError(w, err)
	default:
		httpserver.WriteJSON(w, 200, map[string]Room{"room": room})
	}
}

// Mutations recheck after parsing so a revoked session cannot use an earlier
// successful lookup. The wrapper also protects reads and unknown room routes.
func (s *Service) requireUser(w http.ResponseWriter, r *http.Request) (auth.User, bool) {
	user, _, err := s.users.CurrentUser(r)
	if errors.Is(err, sql.ErrNoRows) {
		httpserver.WriteError(w, 401, "Entre para continuar.")
		return auth.User{}, false
	}
	if err != nil {
		httpserver.InternalError(w, err)
		return auth.User{}, false
	}
	return user, true
}
