package rooms

import (
	"database/sql"
	"encoding/json"
	"errors"
	"io"
	"net/http"
	"sort"
	"strings"
	"time"

	"mtg4fun/internal/httpserver"
)

const (
	maxThrowPower = 10
)

type PreparationRoll struct {
	Power    int    `json:"power,omitempty"`
	ID       string `json:"id"`
	PlayerID int64  `json:"playerId"`
	Name     string `json:"name"`
	Value    int    `json:"value"`
	Seed     int64  `json:"seed"`
	Phase    string `json:"phase"`
	At       int64  `json:"at"`
}

func memberOf(r roomState, id int64) bool {
	for _, p := range r.Participants {
		if p.ID == id {
			return true
		}
	}
	return false
}

func (s *Service) preparationState(w http.ResponseWriter, req *http.Request) {
	id, ok := roomID(w, req)
	if !ok {
		return
	}
	user, ok := s.requireUser(w, req)
	if !ok {
		return
	}
	room, err := readRoom(s.db.QueryRowContext(req.Context(), "SELECT snapshot FROM rooms WHERE id=?", id))
	if errors.Is(err, sql.ErrNoRows) || (err == nil && !memberOf(room, user.ID)) {
		httpserver.WriteError(w, 404, "Sala não encontrada.")
		return
	}
	var view preparationView
	if err == nil {
		view, err = s.preparationView(req.Context(), id)
	}
	if err != nil {
		httpserver.InternalError(w, err)
		return
	}
	w.Header().Set("Cache-Control", "no-store")
	httpserver.WriteJSON(w, 200, view)
}

func (s *Service) beginOrder(w http.ResponseWriter, req *http.Request) {
	s.changePreparation(w, req, true)
}
func (s *Service) preparationAction(w http.ResponseWriter, req *http.Request) {
	s.changePreparation(w, req, false)
}
func (s *Service) changePreparation(w http.ResponseWriter, req *http.Request, start bool) {
	id, ok := roomID(w, req)
	if !ok {
		return
	}
	user, ok := s.requireUser(w, req)
	if !ok {
		return
	}
	var input struct {
		Power    int    `json:"power"`
		IntentID string `json:"intentId"`
		Kind     string `json:"kind"`
		RollID   string `json:"rollId"`
	}
	if start {
		if !emptyJSON(w, req) {
			return
		}
	} else {
		dec := json.NewDecoder(http.MaxBytesReader(w, req.Body, 4096))
		dec.DisallowUnknownFields()
		if dec.Decode(&input) != nil || dec.Decode(&struct{}{}) != io.EOF || !intentIDPattern.MatchString(input.IntentID) || (input.Kind != "roll" && input.Kind != "confirm" && input.Kind != "unconfirm") || input.Power < 0 || input.Power > maxThrowPower {
			httpserver.WriteError(w, 400, "Ação inválida.")
			return
		}
	}
	tx, err := s.db.BeginTx(req.Context(), nil)
	if err != nil {
		httpserver.InternalError(w, err)
		return
	}
	defer tx.Rollback()
	room, err := lockedRoom(req.Context(), tx, id)
	if errors.Is(err, sql.ErrNoRows) || (err == nil && !memberOf(room, user.ID)) {
		httpserver.WriteError(w, 404, "Sala não encontrada.")
		return
	}
	if err != nil {
		httpserver.InternalError(w, err)
		return
	}
	fail := func(message string) { httpserver.WriteError(w, 409, message) }
	if start {
		if room.CreatorID != user.ID {
			httpserver.WriteError(w, 403, errNotCreator.Error())
			return
		}
		if room.Status != "preparing" {
			fail(errRoomStarted.Error())
			return
		}
		for _, p := range room.Participants {
			if !p.Ready {
				fail(errNotReady.Error())
				return
			}
		}
		room.Status = "determining_order"
		room.Vacancies = 0
		room.Confirmed = map[int64]string{}
		if _, err = s.initializeMatch(req.Context(), tx, room, user, nil, room.Life); err != nil {
			httpserver.InternalError(w, err)
			return
		}
		s.coinDuels.CancelRoom(id)
		s.publishPreparation(id)
		httpserver.WriteJSON(w, 200, map[string]bool{"ok": true})
		return
	} else {
		// A rolagem de brincadeira não vale nada e fica só na memória.
		if input.Kind == "roll" && room.Status == "preparing" {
			if !s.addPlayRoll(w, id, user.ID, user.Name, input.IntentID, input.Power) {
				return
			}
			_ = tx.Rollback()
			s.publishPreparation(id)
			httpserver.WriteJSON(w, 200, map[string]bool{"ok": true})
			return
		}
		// Idempotency is durable in room_events, including confirmations.
		var count int
		err = tx.QueryRowContext(req.Context(), "SELECT COUNT(*) FROM room_events WHERE room_id=? AND actor_id=? AND action=?", id, user.ID, strings.ReplaceAll(input.IntentID, "-", "")).Scan(&count)
		if err != nil {
			httpserver.InternalError(w, err)
			return
		}
		if count > 0 {
			httpserver.WriteJSON(w, 200, map[string]bool{"ok": true})
			return
		}
		if room.Status != "preparing" && room.Status != "determining_order" {
			fail(errRoomStarted.Error())
			return
		}
		if room.Status == "determining_order" && room.Confirmed[user.ID] != "" && input.Kind != "unconfirm" {
			fail("Sua rolagem já foi confirmada.")
			return
		}
		if input.Kind == "roll" {
			now := time.Now().UnixMilli()
			recent := 0
			for _, roll := range room.Dice {
				if roll.PlayerID == user.ID && now-roll.At < 1000 {
					recent++
				}
			}
			if recent >= 5 {
				httpserver.WriteError(w, 429, "Aguarde um instante para rolar novamente.")
				return
			}
			value, e := s.roll()
			if e != nil {
				httpserver.InternalError(w, e)
				return
			}
			// A força só existe na brincadeira: a rolagem que vale é sempre normal.
			room.Dice = append(room.Dice, PreparationRoll{ID: input.IntentID, PlayerID: user.ID, Name: user.Name, Value: value, Seed: now, Phase: room.Status, At: now})
		} else if input.Kind == "unconfirm" {
			// A última confirmação inicia a partida: depois dela não há o que desfazer.
			if room.Status != "determining_order" || room.Confirmed[user.ID] == "" {
				fail("Não há confirmação para desfazer.")
				return
			}
			delete(room.Confirmed, user.ID)
		} else {
			if room.Status != "determining_order" {
				fail("A ordem ainda não está sendo definida.")
				return
			}
			var latest PreparationRoll
			for _, roll := range room.Dice {
				if roll.PlayerID == user.ID && roll.Phase == "determining_order" {
					latest = roll
				}
			}
			if latest.ID == "" || latest.ID != input.RollID {
				fail("Confirme sua rolagem mais recente.")
				return
			}
			for _, roll := range room.Dice {
				if room.Confirmed[roll.PlayerID] == roll.ID && roll.Value == latest.Value {
					fail("Empate: role novamente antes de confirmar.")
					return
				}
			}
			if room.Confirmed == nil {
				room.Confirmed = map[int64]string{}
			}
			room.Confirmed[user.ID] = latest.ID
		}
	}
	action := "order-started"
	if !start {
		action = strings.ReplaceAll(input.IntentID, "-", "")
	}
	if err = save(req.Context(), tx, room, user.ID, action); err != nil {
		httpserver.InternalError(w, err)
		return
	}
	if len(room.Confirmed) == len(room.Participants) && room.Status == "determining_order" {
		order := []Turn{}
		for _, roll := range room.Dice {
			if room.Confirmed[roll.PlayerID] == roll.ID {
				order = append(order, Turn{roll.PlayerID, roll.Name, roll.Value})
			}
		}
		sort.Slice(order, func(i, j int) bool { return order[i].Roll > order[j].Roll })
		var raw []byte
		err = tx.QueryRowContext(req.Context(), "SELECT snapshot FROM matches WHERE room_id=? FOR UPDATE", id).Scan(&raw)
		var match matchState
		if err == nil {
			err = json.Unmarshal(raw, &match)
		}
		if err == nil {
			match.PendingOrder = false
			match.TurnOrder = order
			raw, err = json.Marshal(match)
		}
		if err == nil {
			_, err = tx.ExecContext(req.Context(), "UPDATE matches SET snapshot=? WHERE room_id=?", raw, id)
		}
		if err == nil {
			room.Status = "started"
			err = save(req.Context(), tx, room, user.ID, "order-defined")
		}
		if err == nil {
			payload, _ := json.Marshal(map[string]any{"turnOrder": order})
			_, err = tx.ExecContext(req.Context(), "UPDATE match_events SET payload=? WHERE room_id=? AND action='started'", payload, id)
		}
		if err == nil {
			err = tx.Commit()
		}
		if err != nil {
			httpserver.InternalError(w, err)
			return
		}
	} else if err = tx.Commit(); err != nil {
		httpserver.InternalError(w, err)
		return
	}
	if room.Status == "started" {
		s.playRolls.drop(id)
	}
	s.publishPreparation(id)
	httpserver.WriteJSON(w, 200, map[string]bool{"ok": true})
}

// addPlayRoll runs with the room locked, so it keeps the limit of rolls per second.
func (s *Service) addPlayRoll(w http.ResponseWriter, id, playerID int64, name, intentID string, power int) bool {
	if s.playRolls.has(id, intentID) {
		return true
	}
	now := time.Now().UnixMilli()
	if s.playRolls.recent(id, playerID, now-1000) >= 5 {
		httpserver.WriteError(w, 429, "Aguarde um instante para rolar novamente.")
		return false
	}
	value, err := s.roll()
	if err != nil {
		httpserver.InternalError(w, err)
		return false
	}
	s.playRolls.add(id, PreparationRoll{ID: intentID, PlayerID: playerID, Name: name, Value: value, Seed: now, Phase: "preparing", At: now, Power: power})
	return true
}
