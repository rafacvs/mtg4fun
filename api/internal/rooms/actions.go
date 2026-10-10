package rooms

import (
	"context"
	cryptorand "crypto/rand"
	"database/sql"
	"encoding/json"
	"errors"
	"fmt"
	"math/big"

	"mtg4fun/internal/auth"
)

var errNotParticipant = errors.New("Você não participa desta partida.")

type matchAction struct {
	IntentID  string `json:"intentId"`
	Kind      string `json:"kind"`
	Sides     int    `json:"sides"`
	Direction string `json:"direction"`
}

func randomResult(sides int) (int, error) {
	value, err := cryptorand.Int(cryptorand.Reader, big.NewInt(int64(sides)))
	if err != nil {
		return 0, err
	}
	return int(value.Int64()) + 1, nil
}

func (s *Service) action(ctx context.Context, roomID int64, user auth.User, input matchAction) (Match, error) {
	tx, err := s.db.BeginTx(ctx, nil)
	if err != nil {
		return Match{}, err
	}
	defer tx.Rollback()
	var raw []byte
	if err = tx.QueryRowContext(ctx, "SELECT snapshot FROM matches WHERE room_id=? FOR UPDATE", roomID).Scan(&raw); err != nil {
		return Match{}, err
	}
	var match matchState
	if err = json.Unmarshal(raw, &match); err != nil {
		return Match{}, err
	}
	participant := false
	for _, player := range match.Players {
		if player.UserID == user.ID {
			participant = true
			break
		}
	}
	if !participant {
		return Match{}, errNotParticipant
	}
	var duplicate int
	err = tx.QueryRowContext(ctx, "SELECT 1 FROM match_intents WHERE room_id=? AND actor_id=? AND intent_id=?", roomID, user.ID, input.IntentID).Scan(&duplicate)
	if err == nil {
		if err = tx.Commit(); err != nil {
			return Match{}, err
		}
		view := match.view()
		view.Events, err = s.eventsForMatch(ctx, roomID)
		return view, err
	}
	if !errors.Is(err, sql.ErrNoRows) {
		return Match{}, err
	}
	result := ""
	switch input.Kind {
	case "roll":
		value, rollErr := randomResult(input.Sides)
		if rollErr != nil {
			return Match{}, rollErr
		}
		result = fmt.Sprintf("D%d: %d", input.Sides, value)
	case "coin":
		value, rollErr := randomResult(2)
		if rollErr != nil {
			return Match{}, rollErr
		}
		if value == 1 {
			result = "Cara"
		} else {
			result = "Coroa"
		}
	case "turn":
		if input.Direction == "next" {
			match.TurnIndex = (match.TurnIndex + 1) % len(match.TurnOrder)
			result = "Avançou para turno de " + match.TurnOrder[match.TurnIndex].Name
		} else {
			match.TurnIndex = (match.TurnIndex + len(match.TurnOrder) - 1) % len(match.TurnOrder)
			result = "Corrigiu para turno de " + match.TurnOrder[match.TurnIndex].Name
		}
	}
	snapshot, err := json.Marshal(match)
	if err != nil {
		return Match{}, err
	}
	payload, err := json.Marshal(map[string]string{"result": result})
	if err != nil {
		return Match{}, err
	}
	if _, err = tx.ExecContext(ctx, "UPDATE matches SET snapshot=? WHERE room_id=?", snapshot, roomID); err != nil {
		return Match{}, err
	}
	if _, err = tx.ExecContext(ctx, "INSERT INTO match_events(room_id,actor_id,action,payload) VALUES (?,?,?,?)", roomID, user.ID, input.Kind, payload); err != nil {
		return Match{}, err
	}
	if _, err = tx.ExecContext(ctx, "INSERT INTO match_intents(room_id,actor_id,intent_id) VALUES (?,?,?)", roomID, user.ID, input.IntentID); err != nil {
		return Match{}, err
	}
	if err = tx.Commit(); err != nil {
		return Match{}, err
	}
	view := match.view()
	view.Events, err = s.eventsForMatch(ctx, roomID)
	return view, err
}
