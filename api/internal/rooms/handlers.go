package rooms

import (
	"database/sql"
	"encoding/json"
	"errors"
	"io"
	"net/http"
	"strconv"
	"strings"

	"mtg4fun/internal/httpserver"
)

func (s *Service) Handler() http.Handler {
	mux := http.NewServeMux()
	mux.HandleFunc("GET /api/rooms", s.listRooms)
	mux.HandleFunc("POST /api/rooms", s.createRoom)
	mux.HandleFunc("GET /api/rooms/events", s.events)
	mux.HandleFunc("POST /api/rooms/{id}/participants", s.joinRoom)
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		_, _, err := s.users.CurrentUser(r)
		if errors.Is(err, sql.ErrNoRows) {
			httpserver.WriteError(w, 401, "Entre para continuar.")
			return
		}
		if err != nil {
			httpserver.InternalError(w, err)
			return
		}
		mux.ServeHTTP(w, r)
	})
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
	user, _, err := s.users.CurrentUser(r)
	if errors.Is(err, sql.ErrNoRows) {
		httpserver.WriteError(w, 401, "Entre para continuar.")
		return
	}
	if err != nil {
		httpserver.InternalError(w, err)
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
	id, err := strconv.ParseInt(r.PathValue("id"), 10, 64)
	if err != nil || id <= 0 {
		httpserver.WriteError(w, 400, "Sala inválida.")
		return
	}
	if !emptyJSON(w, r) {
		return
	}
	user, _, err := s.users.CurrentUser(r)
	if errors.Is(err, sql.ErrNoRows) {
		httpserver.WriteError(w, 401, "Entre para continuar.")
		return
	}
	if err != nil {
		httpserver.InternalError(w, err)
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
