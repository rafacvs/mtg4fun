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
var errNotController = errors.New("Você só pode mover cartas sob seu controle.")
var errCardNotFound = errors.New("Carta não encontrada nesta zona.")
var errInsufficientCards = errors.New("Não há cartas suficientes no grimório.")
var errInvalidPosition = errors.New("Posição inválida no campo.")

type matchAction struct {
	IntentID         string
	Kind             string
	Count            int
	CardIDs          []string
	To               string
	LibraryPlacement string
	Sides            int
	Direction        string
	CardID           string
	PositionX        int
	Row              int
}

type actionLogPayload struct {
	Kind   string `json:"kind"`
	From   string `json:"from,omitempty"`
	To     string `json:"to,omitempty"`
	Count  int    `json:"count,omitempty"`
	Result string `json:"result,omitempty"`
}

func playerByID(m *matchState, id int64) *playerState {
	for i := range m.Players {
		if m.Players[i].UserID == id {
			return &m.Players[i]
		}
	}
	return nil
}

func zone(p *playerState, name string) *[]Card {
	switch name {
	case "library":
		return &p.Library
	case "hand":
		return &p.Hand
	case "battlefield":
		return &p.Battlefield
	case "graveyard":
		return &p.Graveyard
	case "exile":
		return &p.Exile
	case "command":
		return &p.Command
	}
	return nil
}

func moveCards(p *playerState, input matchAction) (actionLogPayload, error) {
	if zone(p, input.To) == nil || input.To == "library" && input.LibraryPlacement != "top" && input.LibraryPlacement != "bottom" {
		return actionLogPayload{}, errCardNotFound
	}
	seen := map[string]bool{}
	cards := []Card{}
	from := ""
	for _, id := range input.CardIDs {
		if seen[id] {
			return actionLogPayload{}, errCardNotFound
		}
		seen[id] = true
		found := false
		for _, name := range []string{"hand", "battlefield", "graveyard", "exile", "command"} {
			cardsInZone := zone(p, name)
			for i, c := range *cardsInZone {
				if c.ID != id {
					continue
				}
				if c.ControllerID != p.UserID {
					return actionLogPayload{}, errNotController
				}
				if from == "" {
					from = name
				}
				if from != name {
					return actionLogPayload{}, errCardNotFound
				}
				*cardsInZone = append((*cardsInZone)[:i], (*cardsInZone)[i+1:]...)
				cards = append(cards, c)
				found = true
				break
			}
			if found {
				break
			}
		}
		if !found {
			return actionLogPayload{}, errCardNotFound
		}
	}
	destination := zone(p, input.To)
	for i := range cards {
		cards[i].Zone = input.To
		if input.To == "battlefield" {
			position := len(p.Battlefield) + i
			cards[i].PositionX = (position % 4) * 250
			cards[i].Row = (position / 4) % 4
		}
	}
	if input.To == "library" && input.LibraryPlacement == "top" {
		*destination = append(cards, *destination...)
	} else {
		*destination = append(*destination, cards...)
	}
	return actionLogPayload{Kind: "move", From: from, To: input.To, Count: len(cards)}, nil
}

func positionCard(m *matchState, p *playerState, input matchAction) (actionLogPayload, error) {
	if input.PositionX < 0 || input.PositionX > 1000 || input.Row < 0 || input.Row > 3 {
		return actionLogPayload{}, errInvalidPosition
	}
	for i := range p.Battlefield {
		if p.Battlefield[i].ID != input.CardID {
			continue
		}
		if p.Battlefield[i].ControllerID != p.UserID {
			return actionLogPayload{}, errNotController
		}
		m.NextStackOrder++
		p.Battlefield[i].PositionX = input.PositionX
		p.Battlefield[i].Row = input.Row
		p.Battlefield[i].StackOrder = m.NextStackOrder
		return actionLogPayload{Kind: "position"}, nil
	}
	return actionLogPayload{}, errCardNotFound
}

func drawCards(p *playerState, count int) (actionLogPayload, error) {
	if count < 1 || count > len(p.Library) {
		return actionLogPayload{}, errInsufficientCards
	}
	cards := append([]Card(nil), p.Library[:count]...)
	p.Library = p.Library[count:]
	for i := range cards {
		cards[i].Zone = "hand"
	}
	p.Hand = append(p.Hand, cards...)
	return actionLogPayload{Kind: "draw", From: "library", To: "hand", Count: count}, nil
}

func randomResult(sides int) (int, error) {
	value, err := cryptorand.Int(cryptorand.Reader, big.NewInt(int64(sides)))
	if err != nil {
		return 0, err
	}
	return int(value.Int64()) + 1, nil
}

func rollDice(sides int) (actionLogPayload, error) {
	value, err := randomResult(sides)
	if err != nil {
		return actionLogPayload{}, err
	}
	return actionLogPayload{Kind: "roll", Result: fmt.Sprintf("D%d: %d", sides, value)}, nil
}

func flipCoin() (actionLogPayload, error) {
	value, err := randomResult(2)
	if err != nil {
		return actionLogPayload{}, err
	}
	result := "Coroa"
	if value == 1 {
		result = "Cara"
	}
	return actionLogPayload{Kind: "coin", Result: result}, nil
}

func changeTurn(m *matchState, direction string) (actionLogPayload, error) {
	if len(m.TurnOrder) == 0 {
		return actionLogPayload{}, errCardNotFound
	}
	if direction == "next" {
		m.TurnIndex = (m.TurnIndex + 1) % len(m.TurnOrder)
		return actionLogPayload{Kind: "turn", Result: "avançou para o turno de " + m.TurnOrder[m.TurnIndex].Name}, nil
	}
	m.TurnIndex = (m.TurnIndex + len(m.TurnOrder) - 1) % len(m.TurnOrder)
	return actionLogPayload{Kind: "turn", Result: "corrigiu para o turno de " + m.TurnOrder[m.TurnIndex].Name}, nil
}

func (s *Service) action(ctx context.Context, roomID int64, u auth.User, input matchAction) (Match, error) {
	tx, err := s.db.BeginTx(ctx, nil)
	if err != nil {
		return Match{}, err
	}
	defer tx.Rollback()
	var raw []byte
	if err = tx.QueryRowContext(ctx, "SELECT snapshot FROM matches WHERE room_id=? FOR UPDATE", roomID).Scan(&raw); err != nil {
		return Match{}, err
	}
	var m matchState
	if err = json.Unmarshal(raw, &m); err != nil {
		return Match{}, err
	}
	p := playerByID(&m, u.ID)
	if p == nil {
		return Match{}, errNotParticipant
	}
	var duplicate int
	err = tx.QueryRowContext(ctx, "SELECT 1 FROM match_intents WHERE room_id=? AND actor_id=? AND intent_id=?", roomID, u.ID, input.IntentID).Scan(&duplicate)
	if err == nil {
		log, e := matchLog(ctx, tx, roomID, m)
		if e != nil {
			return Match{}, e
		}
		if e = tx.Commit(); e != nil {
			return Match{}, e
		}
		return m.view(u.ID, log), nil
	}
	if !errors.Is(err, sql.ErrNoRows) {
		return Match{}, err
	}
	var payload actionLogPayload
	switch input.Kind {
	case "draw":
		payload, err = drawCards(p, input.Count)
	case "move":
		payload, err = moveCards(p, input)
	case "position":
		payload, err = positionCard(&m, p, input)
	case "roll":
		payload, err = rollDice(input.Sides)
	case "coin":
		payload, err = flipCoin()
	case "turn":
		payload, err = changeTurn(&m, input.Direction)
	default:
		return Match{}, errCardNotFound
	}
	if err != nil {
		return Match{}, err
	}
	snapshot, err := json.Marshal(m)
	if err != nil {
		return Match{}, err
	}
	encodedPayload, err := json.Marshal(payload)
	if err != nil {
		return Match{}, err
	}
	if _, err = tx.ExecContext(ctx, "UPDATE matches SET snapshot=? WHERE room_id=?", snapshot, roomID); err != nil {
		return Match{}, err
	}
	if _, err = tx.ExecContext(ctx, "INSERT INTO match_events(room_id,actor_id,action,payload) VALUES (?,?,?,?)", roomID, u.ID, input.Kind, encodedPayload); err != nil {
		return Match{}, err
	}
	if _, err = tx.ExecContext(ctx, "INSERT INTO match_intents(room_id,actor_id,intent_id) VALUES (?,?,?)", roomID, u.ID, input.IntentID); err != nil {
		return Match{}, err
	}
	log, err := matchLog(ctx, tx, roomID, m)
	if err != nil {
		return Match{}, err
	}
	if err = tx.Commit(); err != nil {
		return Match{}, err
	}
	return m.view(u.ID, log), nil
}

type queryer interface {
	QueryContext(context.Context, string, ...any) (*sql.Rows, error)
}

func matchLog(ctx context.Context, q queryer, roomID int64, m matchState) ([]MatchLog, error) {
	rows, err := q.QueryContext(ctx, "SELECT actor_id,action,payload FROM match_events WHERE room_id=? ORDER BY id", roomID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	names := map[int64]string{}
	for _, p := range m.Players {
		names[p.UserID] = p.Name
	}
	log := []MatchLog{}
	for rows.Next() {
		var actor int64
		var action string
		var raw []byte
		if err = rows.Scan(&actor, &action, &raw); err != nil {
			return nil, err
		}
		var p actionLogPayload
		_ = json.Unmarshal(raw, &p)
		if p.Kind == "" {
			p.Kind = action
		}
		log = append(log, MatchLog{ActorName: names[actor], Kind: p.Kind, From: p.From, To: p.To, Count: p.Count, Result: p.Result})
	}
	return log, rows.Err()
}
