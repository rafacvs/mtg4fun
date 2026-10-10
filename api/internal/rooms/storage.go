// Package rooms owns durable room preparation, match initialization and participation.
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
	"os"
	"strconv"
	"strings"
)

const capacity = 6

type Participant struct {
	ID    int64  `json:"id"`
	Name  string `json:"name"`
	Ready bool   `json:"ready"`
}
type Room struct {
	ID           int64         `json:"id"`
	Title        string        `json:"title"`
	CreatorID    int64         `json:"creatorId"`
	Status       string        `json:"status"`
	Participants []Participant `json:"participants"`
	Vacancies    int           `json:"vacancies"`
}
type participantState struct {
	ID     int64  `json:"id"`
	Name   string `json:"name"`
	DeckID int64  `json:"deckId"`
	Ready  bool   `json:"ready"`
}
type roomState struct {
	ID           int64              `json:"id"`
	Title        string             `json:"title"`
	CreatorID    int64              `json:"creatorId"`
	Status       string             `json:"status"`
	Participants []participantState `json:"participants"`
	Vacancies    int                `json:"vacancies"`
}

func (r roomState) view() Room {
	p := make([]Participant, len(r.Participants))
	for i, v := range r.Participants {
		p[i] = Participant{v.ID, v.Name, v.Ready}
	}
	return Room{r.ID, r.Title, r.CreatorID, r.Status, p, r.Vacancies}
}

type Turn struct {
	UserID int64  `json:"userId"`
	Name   string `json:"name"`
	Roll   int    `json:"roll"`
}
type Card struct {
	ID           string `json:"id"`
	Name         string `json:"name"`
	OwnerID      int64  `json:"ownerId"`
	ControllerID int64  `json:"controllerId"`
	Zone         string `json:"zone"`
}
type playerState struct {
	UserID      int64  `json:"userId"`
	Name        string `json:"name"`
	Life        int    `json:"life"`
	Library     []Card `json:"library"`
	Hand        []Card `json:"hand"`
	Battlefield []Card `json:"battlefield"`
	Graveyard   []Card `json:"graveyard"`
	Exile       []Card `json:"exile"`
	Command     []Card `json:"command"`
}
type matchState struct {
	RoomID      int64         `json:"roomId"`
	InitialLife int           `json:"initialLife"`
	TurnOrder   []Turn        `json:"turnOrder"`
	Players     []playerState `json:"players"`
}
type Match struct {
	RoomID      int64         `json:"roomId"`
	InitialLife int           `json:"initialLife"`
	TurnOrder   []Turn        `json:"turnOrder"`
	Players     []MatchPlayer `json:"players"`
}
type MatchPlayer struct {
	UserID           int64  `json:"userId"`
	Name             string `json:"name"`
	Life             int    `json:"life"`
	LibraryCount     int    `json:"libraryCount"`
	HandCount        int    `json:"handCount"`
	BattlefieldCount int    `json:"battlefieldCount"`
	GraveyardCount   int    `json:"graveyardCount"`
	ExileCount       int    `json:"exileCount"`
	CommandCount     int    `json:"commandCount"`
}

func (m matchState) view() Match {
	p := make([]MatchPlayer, len(m.Players))
	for i, v := range m.Players {
		p[i] = MatchPlayer{v.UserID, v.Name, v.Life, len(v.Library), len(v.Hand), len(v.Battlefield), len(v.Graveyard), len(v.Exile), len(v.Command)}
	}
	return Match{m.RoomID, m.InitialLife, m.TurnOrder, p}
}

type Service struct {
	db    *sql.DB
	users *auth.Service
	roll  func() (int, error)
}

func New(db *sql.DB, users *auth.Service) *Service {
	return &Service{db: db, users: users, roll: configuredRoller()}
}
func configuredRoller() func() (int, error) {
	values := strings.Split(os.Getenv("MTG4FUN_TEST_D20"), ",")
	if len(values) == 1 && values[0] == "" {
		return rollD20
	}
	next := 0
	return func() (int, error) {
		if next >= len(values) {
			return 0, errors.New("rolagens de teste insuficientes")
		}
		value, err := strconv.Atoi(values[next])
		next++
		if err != nil || value < 1 || value > 20 {
			return 0, errors.New("rolagem de teste inválida")
		}
		return value, nil
	}
}
func rollD20() (int, error) {
	n, e := cryptorand.Int(cryptorand.Reader, big.NewInt(20))
	if e != nil {
		return 0, e
	}
	return int(n.Int64()) + 1, nil
}

type scanner interface{ Scan(...any) error }

func readRoom(row scanner) (roomState, error) {
	var b []byte
	var r roomState
	e := row.Scan(&b)
	if e == nil {
		e = json.Unmarshal(b, &r)
	}
	return r, e
}
func (s *Service) list(ctx context.Context) ([]Room, error) {
	rows, e := s.db.QueryContext(ctx, "SELECT snapshot FROM rooms ORDER BY id")
	if e != nil {
		return nil, e
	}
	defer rows.Close()
	out := []Room{}
	for rows.Next() {
		r, e := readRoom(rows)
		if e != nil {
			return nil, e
		}
		out = append(out, r.view())
	}
	return out, rows.Err()
}
func save(ctx context.Context, tx *sql.Tx, r roomState, actor int64, action string) error {
	b, e := json.Marshal(r)
	if e != nil {
		return e
	}
	if _, e = tx.ExecContext(ctx, "UPDATE rooms SET snapshot=? WHERE id=?", b, r.ID); e != nil {
		return e
	}
	_, e = tx.ExecContext(ctx, "INSERT INTO room_events (room_id,actor_id,action) VALUES (?,?,?)", r.ID, actor, action)
	return e
}
func (s *Service) create(ctx context.Context, u auth.User) (Room, error) {
	tx, e := s.db.BeginTx(ctx, nil)
	if e != nil {
		return Room{}, e
	}
	defer tx.Rollback()
	result, e := tx.ExecContext(ctx, "INSERT INTO rooms (creator_id,snapshot) VALUES (?,JSON_OBJECT())", u.ID)
	if e != nil {
		return Room{}, e
	}
	id, e := result.LastInsertId()
	if e != nil {
		return Room{}, e
	}
	r := roomState{ID: id, Title: fmt.Sprintf("Sala #%d", id), CreatorID: u.ID, Status: "preparing", Participants: []participantState{{ID: u.ID, Name: u.Name}}, Vacancies: capacity - 1}
	if e = save(ctx, tx, r, u.ID, "created"); e != nil {
		return Room{}, e
	}
	e = tx.Commit()
	return r.view(), e
}

var errRoomFull = errors.New("A sala está cheia.")
var errRoomStarted = errors.New("A partida já foi iniciada.")
var errNotCreator = errors.New("Somente o criador pode iniciar a partida.")
var errNotReady = errors.New("Todos os participantes precisam confirmar um deck.")
var errDeckNotFound = errors.New("Deck não encontrado.")

func lockedRoom(ctx context.Context, tx *sql.Tx, id int64) (roomState, error) {
	return readRoom(tx.QueryRowContext(ctx, "SELECT snapshot FROM rooms WHERE id=? FOR UPDATE", id))
}
func (s *Service) join(ctx context.Context, id int64, u auth.User) (Room, error) {
	tx, e := s.db.BeginTx(ctx, nil)
	if e != nil {
		return Room{}, e
	}
	defer tx.Rollback()
	r, e := lockedRoom(ctx, tx, id)
	if e != nil {
		return Room{}, e
	}
	for _, p := range r.Participants {
		if p.ID == u.ID {
			return r.view(), nil
		}
	}
	if r.Status != "preparing" {
		return Room{}, errRoomStarted
	}
	if len(r.Participants) >= capacity {
		return Room{}, errRoomFull
	}
	r.Participants = append(r.Participants, participantState{ID: u.ID, Name: u.Name})
	r.Vacancies = capacity - len(r.Participants)
	if e = save(ctx, tx, r, u.ID, "joined"); e != nil {
		return Room{}, e
	}
	e = tx.Commit()
	return r.view(), e
}
func (s *Service) ready(ctx context.Context, id, deckID int64, u auth.User) (Room, error) {
	tx, e := s.db.BeginTx(ctx, nil)
	if e != nil {
		return Room{}, e
	}
	defer tx.Rollback()
	r, e := lockedRoom(ctx, tx, id)
	if e != nil {
		return Room{}, e
	}
	if r.Status != "preparing" {
		return Room{}, errRoomStarted
	}
	var found int
	if e = tx.QueryRowContext(ctx, "SELECT 1 FROM decks WHERE id=? AND user_id=?", deckID, u.ID).Scan(&found); e != nil {
		if errors.Is(e, sql.ErrNoRows) {
			return Room{}, errDeckNotFound
		}
		return Room{}, e
	}
	for i := range r.Participants {
		if r.Participants[i].ID == u.ID {
			r.Participants[i].DeckID = deckID
			r.Participants[i].Ready = true
			if e = save(ctx, tx, r, u.ID, "ready"); e != nil {
				return Room{}, e
			}
			e = tx.Commit()
			return r.view(), e
		}
	}
	return Room{}, sql.ErrNoRows
}
func drawTurnOrder(participants []participantState, roll func() (int, error)) ([]Turn, error) {
	pending := append([]participantState(nil), participants...)
	order := []Turn{}
	for len(pending) > 0 {
		groups := map[int][]participantState{}
		scores := []int{}
		for _, p := range pending {
			v, e := roll()
			if e != nil {
				return nil, e
			}
			if _, ok := groups[v]; !ok {
				scores = append(scores, v)
			}
			groups[v] = append(groups[v], p)
		}
		for i := 0; i < len(scores); i++ {
			for j := i + 1; j < len(scores); j++ {
				if scores[j] > scores[i] {
					scores[i], scores[j] = scores[j], scores[i]
				}
			}
		}
		pending = nil
		for _, score := range scores {
			group := groups[score]
			if len(group) == 1 {
				order = append(order, Turn{group[0].ID, group[0].Name, score})
			} else {
				pending = append(pending, group...)
			}
		}
	}
	return order, nil
}
func deckCards(ctx context.Context, tx *sql.Tx, deckID, userID int64) ([]Card, error) {
	rows, e := tx.QueryContext(ctx, "SELECT deck_cards.name,deck_cards.quantity,deck_cards.position FROM deck_cards JOIN decks ON decks.id=deck_cards.deck_id WHERE deck_cards.deck_id=? AND decks.user_id=? ORDER BY deck_cards.position", deckID, userID)
	if e != nil {
		return nil, e
	}
	defer rows.Close()
	cards := []Card{}
	for rows.Next() {
		var n string
		var q int64
		var pos int
		if e = rows.Scan(&n, &q, &pos); e != nil {
			return nil, e
		}
		for c := int64(0); c < q; c++ {
			cards = append(cards, Card{fmt.Sprintf("%d-%d-%d", userID, pos, c), n, userID, userID, "library"})
		}
	}
	return cards, rows.Err()
}
func shuffle(cards []Card) error {
	for i := len(cards) - 1; i > 0; i-- {
		n, e := cryptorand.Int(cryptorand.Reader, big.NewInt(int64(i+1)))
		if e != nil {
			return e
		}
		j := int(n.Int64())
		cards[i], cards[j] = cards[j], cards[i]
	}
	return nil
}
func (s *Service) start(ctx context.Context, id int64, u auth.User) (Match, error) {
	tx, e := s.db.BeginTx(ctx, nil)
	if e != nil {
		return Match{}, e
	}
	defer tx.Rollback()
	r, e := lockedRoom(ctx, tx, id)
	if e != nil {
		return Match{}, e
	}
	if r.CreatorID != u.ID {
		return Match{}, errNotCreator
	}
	if r.Status != "preparing" {
		return Match{}, errRoomStarted
	}
	for _, p := range r.Participants {
		if !p.Ready {
			return Match{}, errNotReady
		}
	}
	var life int
	if e = tx.QueryRowContext(ctx, "SELECT setting_value FROM game_settings WHERE setting_key='initial_life'").Scan(&life); e != nil {
		return Match{}, e
	}
	order, e := drawTurnOrder(r.Participants, s.roll)
	if e != nil {
		return Match{}, e
	}
	m := matchState{RoomID: id, InitialLife: life, TurnOrder: order, Players: make([]playerState, 0, len(r.Participants))}
	for _, p := range r.Participants {
		cards, e := deckCards(ctx, tx, p.DeckID, p.ID)
		if e != nil {
			return Match{}, e
		}
		if len(cards) == 0 {
			return Match{}, errDeckNotFound
		}
		if e = shuffle(cards); e != nil {
			return Match{}, e
		}
		m.Players = append(m.Players, playerState{p.ID, p.Name, life, cards, []Card{}, []Card{}, []Card{}, []Card{}, []Card{}})
	}
	snapshot, e := json.Marshal(m)
	if e != nil {
		return Match{}, e
	}
	if _, e = tx.ExecContext(ctx, "INSERT INTO matches(room_id,snapshot) VALUES (?,?)", id, snapshot); e != nil {
		return Match{}, e
	}
	payload, e := json.Marshal(map[string]any{"turnOrder": order})
	if e != nil {
		return Match{}, e
	}
	if _, e = tx.ExecContext(ctx, "INSERT INTO match_events(room_id,actor_id,action,payload) VALUES (?,?,?,?)", id, u.ID, "started", payload); e != nil {
		return Match{}, e
	}
	r.Status = "started"
	if e = save(ctx, tx, r, u.ID, "started"); e != nil {
		return Match{}, e
	}
	if e = tx.Commit(); e != nil {
		return Match{}, e
	}
	return m.view(), nil
}
func (s *Service) match(ctx context.Context, id int64, u auth.User) (Match, error) {
	var b []byte
	e := s.db.QueryRowContext(ctx, "SELECT m.snapshot FROM matches m JOIN rooms r ON r.id=m.room_id WHERE m.room_id=? AND JSON_CONTAINS(r.snapshot, CAST(? AS JSON), '$.participants')", id, fmt.Sprintf("{\"id\":%d}", u.ID)).Scan(&b)
	if e != nil {
		return Match{}, e
	}
	var m matchState
	if e = json.Unmarshal(b, &m); e != nil {
		return Match{}, e
	}
	return m.view(), nil
}
