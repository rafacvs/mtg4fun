package rooms

import (
	"context"
	cryptorand "crypto/rand"
	"database/sql"
	"encoding/json"
	"errors"
	"fmt"
	"math/big"
	"strings"

	"mtg4fun/internal/auth"
)

var errNotParticipant = errors.New("Você não participa desta partida.")
var errNotController = errors.New("Você só pode mover cartas sob seu controle.")
var errCardNotFound = errors.New("Carta não encontrada nesta zona.")
var errInsufficientCards = errors.New("Não há cartas suficientes no grimório.")
var errInvalidPosition = errors.New("Posição inválida no campo.")
var errStackFull = errors.New("Essa pilha já tem 3 cartas.")

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
	TokenName        string
	CustomName       string
	Description      string
	Power            string
	Toughness        string
	Tapped           bool
	FaceDown         bool
	Revealed         bool
	FaceIndex        int
	ConsultFrom      string
	Target           string
	PlayerID         int64
	Subject          string
	Color            string
	Operation        string
	Value            int64
	ControllerID     int64
}

type actionLogPayload struct {
	Cards  []logCardReference `json:"cards,omitempty"`
	Kind   string             `json:"kind"`
	From   string             `json:"from,omitempty"`
	To     string             `json:"to,omitempty"`
	Count  int                `json:"count,omitempty"`
	Result string             `json:"result,omitempty"`
}

func playerByID(m *matchState, id int64) *playerState {
	for i := range m.Players {
		if m.Players[i].UserID == id {
			return &m.Players[i]
		}
	}
	return nil
}

func positionCard(m *matchState, p *playerState, input matchAction) (actionLogPayload, error) {
	if input.PositionX < 0 || input.PositionX > 20000 || input.Row < 0 || input.Row > 2000 {
		return actionLogPayload{}, errInvalidPosition
	}
	ids := input.CardIDs
	if len(ids) == 0 && input.CardID != "" {
		ids = []string{input.CardID}
	}
	if len(ids) == 0 {
		return actionLogPayload{}, errCardNotFound
	}
	// Preserve the established single-card response when a target stack is
	// already full, including malformed references sent by older clients.
	if len(input.CardIDs) == 0 {
		others := 0
		for _, card := range p.Battlefield {
			if card.ID != input.CardID && card.PositionX == input.PositionX && card.Row == input.Row {
				others++
			}
		}
		if others >= 3 {
			return actionLogPayload{}, errStackFull
		}
	}
	selected := make(map[string]int, len(ids))
	for _, id := range ids {
		if _, duplicate := selected[id]; duplicate {
			return actionLogPayload{}, errCardNotFound
		}
		for i := range p.Battlefield {
			if p.Battlefield[i].ID != id {
				continue
			}
			if p.Battlefield[i].ControllerID != p.UserID {
				return actionLogPayload{}, errNotController
			}
			selected[id] = i
			break
		}
		if _, found := selected[id]; !found {
			return actionLogPayload{}, errCardNotFound
		}
	}
	anchor := p.Battlefield[selected[ids[0]]]
	deltaX, deltaRow := input.PositionX-anchor.PositionX, input.Row-anchor.Row
	type target struct{ x, row int }
	targets := make(map[string]target, len(ids))
	for _, id := range ids {
		card := p.Battlefield[selected[id]]
		x, row := card.PositionX+deltaX, card.Row+deltaRow
		if x < 0 || x > 20000 || row < 0 || row > 2000 {
			return actionLogPayload{}, errInvalidPosition
		}
		targets[id] = target{x: x, row: row}
	}
	stacks := map[target]int{}
	for _, card := range p.Battlefield {
		if _, moving := selected[card.ID]; !moving {
			stacks[target{x: card.PositionX, row: card.Row}]++
		}
	}
	for _, destination := range targets {
		stacks[destination]++
		if stacks[destination] > 3 {
			return actionLogPayload{}, errStackFull
		}
	}
	for _, id := range ids {
		i, destination := selected[id], targets[id]
		m.NextStackOrder++
		p.Battlefield[i].PositionX = destination.x
		p.Battlefield[i].Row = destination.row
		p.Battlefield[i].StackOrder = m.NextStackOrder
	}
	return actionLogPayload{Kind: "position", Count: len(ids)}, nil
}

func consultCards(p *playerState, input matchAction) (actionLogPayload, error) {
	if len(p.Consulted) != 0 || input.Count < 1 {
		return actionLogPayload{}, errCardNotFound
	}
	var cards []Card
	switch input.ConsultFrom {
	case "all":
		cards, p.Library = p.Library, []Card{}
	case "top":
		if input.Count > len(p.Library) {
			return actionLogPayload{}, errInsufficientCards
		}
		cards, p.Library = append([]Card(nil), p.Library[:input.Count]...), p.Library[input.Count:]
	case "bottom":
		if input.Count > len(p.Library) {
			return actionLogPayload{}, errInsufficientCards
		}
		at := len(p.Library) - input.Count
		cards, p.Library = append([]Card(nil), p.Library[at:]...), p.Library[:at]
	default:
		return actionLogPayload{}, errCardNotFound
	}
	placeCards(p, cards, "library", "consulted", "")
	p.ConsultationFrom = input.ConsultFrom
	return actionLogPayload{Kind: "consult", Count: len(cards)}, nil
}

func reorderConsulted(p *playerState, ids []string) (actionLogPayload, error) {
	// Older clients can leave both kinds of temporary cards open. Combine
	// them without losing visibility so their displayed order can be saved.
	if len(p.Consulted) > 0 && len(p.Revealed) > 0 && len(ids) == len(p.Consulted)+len(p.Revealed) {
		cards := p.Revealed
		p.Revealed = nil
		placeCards(p, cards, "revealed", "consulted", "")
	}
	cards := &p.Consulted
	if len(*cards) == 0 {
		cards = &p.Revealed
	}
	if len(ids) != len(*cards) {
		return actionLogPayload{}, errCardNotFound
	}
	byID := make(map[string]Card, len(*cards))
	for _, card := range *cards {
		byID[card.ID] = card
	}
	reordered := make([]Card, 0, len(ids))
	for _, id := range ids {
		card, ok := byID[id]
		if !ok {
			return actionLogPayload{}, errCardNotFound
		}
		delete(byID, id)
		reordered = append(reordered, card)
	}
	*cards = reordered
	return actionLogPayload{Kind: "reorder", Count: len(ids)}, nil
}

func closeConsultation(p *playerState, placement string, shuffleLibrary bool) (actionLogPayload, error) {
	if placement != "top" && placement != "bottom" {
		return actionLogPayload{}, errCardNotFound
	}
	cards := append(p.Consulted, p.Revealed...)
	placeCards(p, cards, "consulted", "library", placement)
	p.Consulted = []Card{}
	p.Revealed = []Card{}
	p.ConsultationFrom = ""
	if shuffleLibrary {
		if err := shuffle(p.Library); err != nil {
			return actionLogPayload{}, err
		}
		return actionLogPayload{Kind: "shuffle"}, nil
	}
	return actionLogPayload{Kind: "close"}, nil
}

func revealCards(p *playerState, count int) (actionLogPayload, error) {
	if len(p.Consulted) != 0 || count < 1 || count > len(p.Library) {
		return actionLogPayload{}, errInsufficientCards
	}
	cards := append([]Card(nil), p.Library[:count]...)
	p.Library = p.Library[count:]
	names := make([]string, len(cards))
	for i := range cards {
		cards[i].Revealed = true
		names[i] = cards[i].Name
	}
	placeCards(p, cards, "library", "consulted", "")
	p.ConsultationFrom = "top"
	return actionLogPayload{Kind: "reveal", Count: len(cards), Result: strings.Join(names, ", "), Cards: referencesForCards(cards)}, nil
}

func revealSelection(p *playerState, ids []string) (actionLogPayload, error) {
	seen := make(map[string]bool, len(ids))
	names := make([]string, 0, len(ids))
	for _, id := range ids {
		if seen[id] {
			return actionLogPayload{}, errCardNotFound
		}
		seen[id] = true
		found := false
		for i := range p.Consulted {
			card := &p.Consulted[i]
			if card.ID == id {
				card.Revealed = true
				names = append(names, card.Name)
				found = true
				break
			}
		}
		if !found {
			return actionLogPayload{}, errCardNotFound
		}
	}
	return actionLogPayload{Kind: "reveal", Count: len(ids), Result: strings.Join(names, ", ")}, nil
}

func drawCards(p *playerState, count int) (actionLogPayload, error) {
	if count < 1 || count > len(p.Library) {
		return actionLogPayload{}, errInsufficientCards
	}
	cards := append([]Card(nil), p.Library[:count]...)
	p.Library = p.Library[count:]
	placeCards(p, cards, "library", "hand", "")
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
		for i := range m.Players {
			clearRevelations(&m.Players[i])
		}
		return actionLogPayload{Kind: "turn", Result: "avançou para o turno de " + m.TurnOrder[m.TurnIndex].Name + " e ocultou todas as revelações"}, nil
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
		log, e := matchLog(ctx, tx, roomID, m, u.ID)
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
	if m.Finished {
		return Match{}, errMatchFinished
	}
	if input.Kind == "finish" && hasFinishVote(m, u.ID) {
		if _, err = tx.ExecContext(ctx, "INSERT INTO match_intents(room_id,actor_id,intent_id) VALUES (?,?,?)", roomID, u.ID, input.IntentID); err != nil {
			return Match{}, err
		}
		log, err := matchLog(ctx, tx, roomID, m, u.ID)
		if err != nil {
			return Match{}, err
		}
		if err = tx.Commit(); err != nil {
			return Match{}, err
		}
		return m.view(u.ID, log), nil
	}
	ids := append([]string{}, input.CardIDs...)
	if input.CardID != "" {
		ids = append(ids, input.CardID)
	}
	beforeCards := referencesForIDs(m, ids)
	var payload actionLogPayload
	switch input.Kind {
	case "finish":
		payload = voteToFinish(&m, u.ID)
		err = nil
		if m.Finished {
			err = finishRoom(ctx, tx, roomID, u.ID)
		}
	case "create-custom-token":
		power, _ := modifierFromText(input.Power)
		toughness, _ := modifierFromText(input.Toughness)
		payload, err = addCreatedCard(p, Card{Name: input.CustomName, Text: input.Description, Power: power, Toughness: toughness, InstanceKind: "custom-token"}, input.Kind)
	case "copy-card":
		payload, err = s.copyCard(&m, p, input.CardID)
	case "create-token":
		payload, err = s.createCatalogToken(p, input.TokenName)
	case "counter":
		payload, err = changeCounter(&m, p, input)
	case "hide_all_revealed":
		payload, err = actionLogPayload{Kind: input.Kind, Count: clearRevelations(p)}, nil
	case "set_tapped", "untap_all", "set_face", "set_face_down", "reveal_cards":
		payload, err = changeCardState(p, input)
	case "draw":
		payload, err = drawCards(p, input.Count)
	case "move":
		payload, err = moveCards(&m, p, input)
	case "transfer_control":
		payload, err = transferControl(&m, p, input)
	case "position":
		payload, err = positionCard(&m, p, input)
	case "consult":
		payload, err = consultCards(p, input)
	case "reveal":
		if len(input.CardIDs) > 0 {
			payload, err = revealSelection(p, input.CardIDs)
		} else {
			payload, err = revealCards(p, input.Count)
		}
	case "reorder":
		payload, err = reorderConsulted(p, input.CardIDs)
	case "close":
		payload, err = closeConsultation(p, input.LibraryPlacement, false)
	case "shuffle":
		payload, err = closeConsultation(p, input.LibraryPlacement, true)
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
	payload.Cards = mergeLogReferences(beforeCards, referencesForIDs(m, ids), payload.Cards)
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
	log, err := matchLog(ctx, tx, roomID, m, u.ID)
	if err != nil {
		return Match{}, err
	}
	if err = tx.Commit(); err != nil {
		return Match{}, err
	}
	return m.view(u.ID, log), nil
}
