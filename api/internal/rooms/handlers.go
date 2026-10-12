package rooms

import (
	"database/sql"
	"encoding/json"
	"errors"
	"io"
	"net/http"
	"regexp"
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
	mux.HandleFunc("POST /api/rooms/{id}/match/actions", s.applyMatchAction)
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if _, ok := s.requireUser(w, r); !ok {
			return
		}
		mux.ServeHTTP(w, r)
	})
}

var intentIDPattern = regexp.MustCompile(`^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$`)

func actionInput(w http.ResponseWriter, r *http.Request) (matchAction, bool) {
	if strings.Split(r.Header.Get("Content-Type"), ";")[0] != "application/json" {
		httpserver.WriteError(w, 415, "Envie JSON.")
		return matchAction{}, false
	}
	decoder := json.NewDecoder(http.MaxBytesReader(w, r.Body, 65536))
	decoder.DisallowUnknownFields()
	var raw struct {
		IntentID         string   `json:"intentId"`
		Kind             string   `json:"kind"`
		Count            int      `json:"count"`
		CardIDs          []string `json:"cardIds"`
		To               string   `json:"to"`
		LibraryPlacement string   `json:"libraryPlacement"`
		Sides            int      `json:"sides"`
		Direction        string   `json:"direction"`
		CardID           string   `json:"cardId"`
		PositionX        int      `json:"x"`
		Row              int      `json:"row"`
	}
	if err := decoder.Decode(&raw); err != nil {
		httpserver.WriteError(w, 400, "Ação inválida.")
		return matchAction{}, false
	}
	if err := decoder.Decode(&struct{}{}); err != io.EOF {
		httpserver.WriteError(w, 400, "Ação inválida.")
		return matchAction{}, false
	}
	if !intentIDPattern.MatchString(raw.IntentID) {
		httpserver.WriteError(w, 400, "intentId inválido.")
		return matchAction{}, false
	}
	input := matchAction{IntentID: raw.IntentID, Kind: raw.Kind, Count: raw.Count, CardIDs: raw.CardIDs, To: raw.To, LibraryPlacement: raw.LibraryPlacement, Sides: raw.Sides, Direction: raw.Direction, CardID: raw.CardID, PositionX: raw.PositionX, Row: raw.Row}
	switch input.Kind {
	case "draw":
		if input.Count < 1 || input.To != "" || len(input.CardIDs) != 0 || input.LibraryPlacement != "" || input.Sides != 0 || input.Direction != "" || input.CardID != "" || input.PositionX != 0 || input.Row != 0 {
			httpserver.WriteError(w, 400, "Ação inválida.")
			return matchAction{}, false
		}
	case "move":
		if len(input.CardIDs) == 0 || input.Count != 0 || input.To == "" || input.Sides != 0 || input.Direction != "" || input.CardID != "" || input.PositionX != 0 || input.Row != 0 || (input.To == "library" && input.LibraryPlacement != "top" && input.LibraryPlacement != "bottom") || (input.To != "library" && input.LibraryPlacement != "") {
			httpserver.WriteError(w, 400, "Ação inválida.")
			return matchAction{}, false
		}
	case "roll":
		if input.Sides < 2 || input.Sides > 100 || input.Count != 0 || len(input.CardIDs) != 0 || input.To != "" || input.LibraryPlacement != "" || input.Direction != "" || input.CardID != "" || input.PositionX != 0 || input.Row != 0 {
			httpserver.WriteError(w, 400, "Ação inválida.")
			return matchAction{}, false
		}
	case "coin":
		if input.Sides != 0 || input.Count != 0 || len(input.CardIDs) != 0 || input.To != "" || input.LibraryPlacement != "" || input.Direction != "" || input.CardID != "" || input.PositionX != 0 || input.Row != 0 {
			httpserver.WriteError(w, 400, "Ação inválida.")
			return matchAction{}, false
		}
	case "turn":
		if input.Direction != "next" && input.Direction != "previous" || input.Sides != 0 || input.Count != 0 || len(input.CardIDs) != 0 || input.To != "" || input.LibraryPlacement != "" || input.CardID != "" || input.PositionX != 0 || input.Row != 0 {
			httpserver.WriteError(w, 400, "Ação inválida.")
			return matchAction{}, false
		}
	case "position":
		if input.CardID == "" || input.Count != 0 || len(input.CardIDs) != 0 || input.To != "" || input.LibraryPlacement != "" || input.Sides != 0 || input.Direction != "" || input.PositionX < 0 || input.PositionX > 20000 || input.Row < 0 || input.Row > 2000 {
			httpserver.WriteError(w, 400, "Ação inválida.")
			return matchAction{}, false
		}
	default:
		httpserver.WriteError(w, 400, "Ação inválida.")
		return matchAction{}, false
	}
	return input, true
}

func (s *Service) applyMatchAction(w http.ResponseWriter, r *http.Request) {
	id, ok := roomID(w, r)
	if !ok {
		return
	}
	input, ok := actionInput(w, r)
	if !ok {
		return
	}
	user, ok := s.requireUser(w, r)
	if !ok {
		return
	}
	match, err := s.action(r.Context(), id, user, input)
	switch {
	case errors.Is(err, sql.ErrNoRows):
		httpserver.WriteError(w, 404, "Partida não encontrada.")
	case errors.Is(err, errNotParticipant):
		httpserver.WriteError(w, 404, "Partida não encontrada.")
	case errors.Is(err, errCardNotFound), errors.Is(err, errNotController), errors.Is(err, errInsufficientCards), errors.Is(err, errInvalidPosition), errors.Is(err, errStackFull):
		httpserver.WriteError(w, 409, err.Error())
	case err != nil:
		httpserver.InternalError(w, err)
	default:
		httpserver.WriteJSON(w, 200, map[string]Match{"match": match})
	}
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
