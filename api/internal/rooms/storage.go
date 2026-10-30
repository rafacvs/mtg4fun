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
	"os"
	"sort"
	"strconv"
	"strings"

	"mtg4fun/internal/auth"
	"mtg4fun/internal/catalog"
)

const capacity = 6

type Participant struct {
	ID     int64  `json:"id"`
	Name   string `json:"name"`
	Ready  bool   `json:"ready"`
	DeckID int64  `json:"deckId,omitempty"`
}
type Room struct {
	CommanderToCommand bool          `json:"commanderToCommand"`
	DrawOpeningHand    bool          `json:"drawOpeningHand"`
	ID                 int64         `json:"id"`
	Title              string        `json:"title"`
	Format             string        `json:"format,omitempty"`
	Seats              int           `json:"seats"`
	Life               int           `json:"life"`
	MulliganMode       string        `json:"mulliganMode"`
	CreatorID          int64         `json:"creatorId"`
	Status             string        `json:"status"`
	Participants       []Participant `json:"participants"`
	Vacancies          int           `json:"vacancies"`
}
type participantState struct {
	ID     int64  `json:"id"`
	Name   string `json:"name"`
	DeckID int64  `json:"deckId"`
	Ready  bool   `json:"ready"`
}
type roomState struct {
	CommanderToCommand *bool              `json:"commanderToCommand,omitempty"`
	DrawOpeningHand    *bool              `json:"drawOpeningHand,omitempty"`
	ID                 int64              `json:"id"`
	Title              string             `json:"title"`
	Format             string             `json:"format,omitempty"`
	Seats              int                `json:"seats"`
	Life               int                `json:"life"`
	MulliganMode       string             `json:"mulliganMode"`
	CreatorID          int64              `json:"creatorId"`
	Status             string             `json:"status"`
	Participants       []participantState `json:"participants"`
	Vacancies          int                `json:"vacancies"`
}

type roomDraft struct {
	Name   string
	Format string
	Seats  int
	Life   int
	DeckID int64
}

func enabledSetting(setting *bool) bool { return setting == nil || *setting }

func (r roomState) view() Room {
	p := make([]Participant, len(r.Participants))
	for i, v := range r.Participants {
		p[i] = Participant{v.ID, v.Name, v.Ready, v.DeckID}
	}
	mode := r.MulliganMode
	if mode == "" {
		mode = "standard"
	}
	return Room{CommanderToCommand: enabledSetting(r.CommanderToCommand), DrawOpeningHand: enabledSetting(r.DrawOpeningHand), ID: r.ID, Title: r.Title, Format: r.Format, Seats: r.Seats, Life: r.Life, MulliganMode: mode, CreatorID: r.CreatorID, Status: r.Status, Participants: p, Vacancies: r.Vacancies}
}

type Turn struct {
	UserID int64  `json:"userId"`
	Name   string `json:"name"`
	Roll   int    `json:"roll"`
}
type colorCounts struct {
	Red    int64 `json:"red,omitempty"`
	Yellow int64 `json:"yellow,omitempty"`
	Green  int64 `json:"green,omitempty"`
	Blue   int64 `json:"blue,omitempty"`
	Purple int64 `json:"purple,omitempty"`
}
type Card struct {
	IsToken          bool        `json:"isToken,omitempty"`
	Tapped           bool        `json:"tapped,omitempty"`
	FaceDown         bool        `json:"faceDown,omitempty"`
	Faces            []string    `json:"faces,omitempty"`
	FaceIndex        int         `json:"faceIndex,omitempty"`
	ID               string      `json:"id"`
	Name             string      `json:"name"`
	OwnerID          int64       `json:"ownerId"`
	ControllerID     int64       `json:"controllerId"`
	Zone             string      `json:"zone"`
	PositionX        int         `json:"positionX"`
	Row              int         `json:"row"`
	StackOrder       int         `json:"stackOrder"`
	Revealed         bool        `json:"revealed,omitempty"`
	Text             string      `json:"text,omitempty"`
	ImageName        string      `json:"imageName,omitempty"`
	InstanceKind     string      `json:"instanceKind,omitempty"`
	PrintedPower     string      `json:"printedPower,omitempty"`
	PrintedToughness string      `json:"printedToughness,omitempty"`
	Power            int64       `json:"power,omitempty"`
	Toughness        int64       `json:"toughness,omitempty"`
	Markers          colorCounts `json:"markers,omitempty"`
}
type playerState struct {
	UserID           int64       `json:"userId"`
	Name             string      `json:"name"`
	Life             int         `json:"life"`
	Markers          colorCounts `json:"markers,omitempty"`
	Mulligans        int         `json:"mulligans,omitempty"`
	MulliganKept     bool        `json:"mulliganKept,omitempty"`
	Library          []Card      `json:"library"`
	Hand             []Card      `json:"hand"`
	Battlefield      []Card      `json:"battlefield"`
	Graveyard        []Card      `json:"graveyard"`
	Exile            []Card      `json:"exile"`
	Command          []Card      `json:"command"`
	ConsultationIDs  []string    `json:"consultationIds,omitempty"`
	Consulted        []Card      `json:"consulted,omitempty"`
	Revealed         []Card      `json:"revealed,omitempty"`
	ConsultationFrom string      `json:"consultationFrom,omitempty"`
}
type matchState struct {
	Finished       bool          `json:"finished,omitempty"`
	FinishVotes    []int64       `json:"finishVotes,omitempty"`
	RoomID         int64         `json:"roomId"`
	InitialLife    int           `json:"initialLife"`
	TurnOrder      []Turn        `json:"turnOrder"`
	TurnIndex      int           `json:"turnIndex"`
	MulliganMode   string        `json:"mulliganMode"`
	MulliganOpen   bool          `json:"mulliganOpen"`
	NextStackOrder int           `json:"nextStackOrder"`
	Players        []playerState `json:"players"`
}
type Match struct {
	Finished       bool          `json:"finished"`
	FinishVotes    []int64       `json:"finishVotes"`
	FinishRequired int           `json:"finishRequired"`
	RoomID         int64         `json:"roomId"`
	ViewerID       int64         `json:"viewerId"`
	InitialLife    int           `json:"initialLife"`
	TurnOrder      []Turn        `json:"turnOrder"`
	CurrentTurn    Turn          `json:"currentTurn"`
	MulliganMode   string        `json:"mulliganMode"`
	MulliganOpen   bool          `json:"mulliganOpen"`
	Players        []MatchPlayer `json:"players"`
	Log            []MatchLog    `json:"log"`
}
type MatchPlayer struct {
	Consulting       bool          `json:"consulting"`
	ExposedCards     []ExposedCard `json:"exposedCards,omitempty"`
	UserID           int64         `json:"userId"`
	Name             string        `json:"name"`
	Life             int           `json:"life"`
	Markers          colorCounts   `json:"markers,omitempty"`
	Mulligans        int           `json:"mulligans,omitempty"`
	MulliganKept     bool          `json:"mulliganKept,omitempty"`
	LibraryCount     int           `json:"libraryCount"`
	HandCount        int           `json:"handCount"`
	BattlefieldCount int           `json:"battlefieldCount"`
	GraveyardCount   int           `json:"graveyardCount"`
	ExileCount       int           `json:"exileCount"`
	CommandCount     int           `json:"commandCount"`
	Hand             []VisibleCard `json:"hand,omitempty"`
	Battlefield      []VisibleCard `json:"battlefield,omitempty"`
	Graveyard        []VisibleCard `json:"graveyard,omitempty"`
	Exile            []VisibleCard `json:"exile,omitempty"`
	Command          []VisibleCard `json:"command,omitempty"`
	Consulted        []VisibleCard `json:"consulted,omitempty"`
	Revealed         []VisibleCard `json:"revealed,omitempty"`
	ConsultationFrom string        `json:"consultationFrom,omitempty"`
}
type VisibleCard struct {
	Type             string      `json:"type,omitempty"`
	LibraryPosition  int         `json:"libraryPosition,omitempty"`
	IsToken          bool        `json:"isToken,omitempty"`
	Tapped           bool        `json:"tapped,omitempty"`
	FaceDown         bool        `json:"faceDown,omitempty"`
	Faces            []string    `json:"faces,omitempty"`
	FaceIndex        int         `json:"faceIndex,omitempty"`
	ID               string      `json:"id"`
	Name             string      `json:"name,omitempty"`
	Text             string      `json:"text,omitempty"`
	ImageName        string      `json:"imageName,omitempty"`
	InstanceKind     string      `json:"instanceKind,omitempty"`
	OwnerID          int64       `json:"ownerId"`
	ControllerID     int64       `json:"controllerId"`
	Zone             string      `json:"zone"`
	PositionX        int         `json:"positionX"`
	Row              int         `json:"row"`
	StackOrder       int         `json:"stackOrder"`
	Revealed         bool        `json:"revealed,omitempty"`
	PrintedPower     string      `json:"printedPower,omitempty"`
	PrintedToughness string      `json:"printedToughness,omitempty"`
	Power            int64       `json:"power,omitempty"`
	Toughness        int64       `json:"toughness,omitempty"`
	Markers          colorCounts `json:"markers,omitempty"`
	CreatedTokens    []string    `json:"createdTokens,omitempty"`
}

// ExposedCard shares a revealed identity without disclosing private zone order or positions.
type ExposedCard struct {
	IsToken          bool        `json:"isToken,omitempty"`
	ID               string      `json:"id"`
	Name             string      `json:"name"`
	Text             string      `json:"text,omitempty"`
	ImageName        string      `json:"imageName,omitempty"`
	InstanceKind     string      `json:"instanceKind,omitempty"`
	OwnerID          int64       `json:"ownerId"`
	ControllerID     int64       `json:"controllerId"`
	Zone             string      `json:"zone"`
	Tapped           bool        `json:"tapped,omitempty"`
	FaceDown         bool        `json:"faceDown,omitempty"`
	Faces            []string    `json:"faces,omitempty"`
	FaceIndex        int         `json:"faceIndex,omitempty"`
	Revealed         bool        `json:"revealed"`
	PrintedPower     string      `json:"printedPower,omitempty"`
	PrintedToughness string      `json:"printedToughness,omitempty"`
	Power            int64       `json:"power,omitempty"`
	Toughness        int64       `json:"toughness,omitempty"`
	Markers          colorCounts `json:"markers,omitempty"`
	CreatedTokens    []string    `json:"createdTokens,omitempty"`
}
type MatchLog struct {
	Cards     []LogCard `json:"cards,omitempty"`
	ActorID   int64     `json:"actorId"`
	ActorName string    `json:"actorName"`
	Kind      string    `json:"kind"`
	From      string    `json:"from,omitempty"`
	To        string    `json:"to,omitempty"`
	Count     int       `json:"count,omitempty"`
	Result    string    `json:"result,omitempty"`
}

func hideCardModifiers(c Card, viewerID int64) bool {
	if c.FaceDown && !c.Revealed && c.OwnerID != viewerID && c.ControllerID != viewerID {
		return true
	}
	return (c.Zone == "hand" || c.Zone == "consulted") && c.OwnerID != viewerID && !c.Revealed
}

func visible(cards []Card, viewerID int64) []VisibleCard {
	out := make([]VisibleCard, len(cards))
	for i, c := range cards {
		v := VisibleCard{ID: c.ID, OwnerID: c.OwnerID, ControllerID: c.ControllerID, Zone: c.Zone, PositionX: c.PositionX, Row: c.Row, StackOrder: c.StackOrder, Tapped: c.Tapped, FaceDown: c.FaceDown, Revealed: c.Revealed}
		if !c.FaceDown || c.Revealed || viewerID == c.ControllerID || viewerID == c.OwnerID {
			v.Name = c.Name
			v.PrintedPower, v.PrintedToughness = c.PrintedPower, c.PrintedToughness
			v.Text = c.Text
			v.ImageName = c.ImageName
			v.InstanceKind = c.InstanceKind
			v.IsToken = isToken(c)
			v.Faces = c.Faces
			v.FaceIndex = c.FaceIndex
		}
		if !hideCardModifiers(c, viewerID) {
			v.Power, v.Toughness, v.Markers = c.Power, c.Toughness, c.Markers
		}
		out[i] = v
	}
	return out
}
func (m matchState) view(viewerID int64, log []MatchLog) Match {
	p := make([]MatchPlayer, len(m.Players))
	for i, v := range m.Players {
		p[i] = MatchPlayer{Consulting: v.ConsultationFrom != "", UserID: v.UserID, Name: v.Name, Life: v.Life, Markers: v.Markers, Mulligans: v.Mulligans, MulliganKept: v.MulliganKept, LibraryCount: len(v.Library), HandCount: len(v.Hand), BattlefieldCount: len(v.Battlefield), GraveyardCount: len(v.Graveyard), ExileCount: len(v.Exile), CommandCount: len(v.Command), Battlefield: visible(v.Battlefield, viewerID), Graveyard: visible(v.Graveyard, viewerID), Exile: visible(v.Exile, viewerID), Command: visible(v.Command, viewerID)}
		for _, cards := range [][]Card{v.Hand, v.Library, v.Battlefield, v.Command, v.Graveyard, v.Exile} {
			for _, card := range cards {
				if card.Revealed {
					inConsultation := false
					for _, id := range v.ConsultationIDs {
						if card.ID == id {
							inConsultation = true
							break
						}
					}
					if inConsultation {
						continue
					}
					view := ExposedCard{PrintedPower: card.PrintedPower, PrintedToughness: card.PrintedToughness, IsToken: isToken(card), Text: card.Text, ImageName: card.ImageName, InstanceKind: card.InstanceKind, ID: card.ID, Name: card.Name, OwnerID: card.OwnerID, ControllerID: card.ControllerID, Zone: card.Zone, Tapped: card.Tapped, FaceDown: card.FaceDown, Faces: card.Faces, FaceIndex: card.FaceIndex, Revealed: true, Power: card.Power, Toughness: card.Toughness, Markers: card.Markers}
					p[i].ExposedCards = append(p[i].ExposedCards, view)
				}
			}
		}
		sort.Slice(p[i].ExposedCards, func(a, b int) bool { return p[i].ExposedCards[a].ID < p[i].ExposedCards[b].ID })
		for _, card := range consultationCards(&v) {
			if card.Revealed {
				p[i].Revealed = append(p[i].Revealed, visible([]Card{card}, viewerID)[0])
			}
		}
		sort.Slice(p[i].Revealed, func(a, b int) bool { return p[i].Revealed[a].ID < p[i].Revealed[b].ID })
		if v.UserID == viewerID {
			p[i].Hand = visible(v.Hand, viewerID)
			p[i].Consulted = visible(consultationCards(&v), viewerID)
			for _, card := range v.Revealed {
				if !card.Revealed {
					p[i].Consulted = append(p[i].Consulted, visible([]Card{card}, viewerID)[0])
				}
			}
			p[i].ConsultationFrom = v.ConsultationFrom
		}
	}
	current := Turn{}
	if len(m.TurnOrder) > 0 {
		current = m.TurnOrder[m.TurnIndex%len(m.TurnOrder)]
	}
	return Match{Finished: m.Finished, FinishVotes: append([]int64{}, m.FinishVotes...), FinishRequired: (len(m.Players) + 1) / 2, RoomID: m.RoomID, ViewerID: viewerID, InitialLife: m.InitialLife, TurnOrder: m.TurnOrder, CurrentTurn: current, MulliganMode: m.MulliganMode, MulliganOpen: m.MulliganOpen, Players: p, Log: log}
}

type Service struct {
	db      *sql.DB
	users   *auth.Service
	roll    func() (int, error)
	catalog *catalog.Catalog
}

func New(db *sql.DB, users *auth.Service, cards ...*catalog.Catalog) *Service {
	s := &Service{db: db, users: users, roll: configuredRoller()}
	if len(cards) > 0 {
		s.catalog = cards[0]
	}
	return s
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
	if e == nil {
		if r.Seats == 0 {
			r.Seats = capacity
		}
		if r.Life == 0 {
			r.Life = 40
		}
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
		if r.Status != "finished" {
			out = append(out, r.view())
		}
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
func (s *Service) create(ctx context.Context, u auth.User, draft roomDraft) (Room, error) {
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
	creator := participantState{ID: u.ID, Name: u.Name}
	if draft.DeckID > 0 {
		var found int
		if e = tx.QueryRowContext(ctx, "SELECT 1 FROM decks WHERE id=? AND user_id=?", draft.DeckID, u.ID).Scan(&found); e != nil {
			if errors.Is(e, sql.ErrNoRows) {
				return Room{}, errDeckNotFound
			}
			return Room{}, e
		}
		creator.DeckID = draft.DeckID
	}
	r := roomState{ID: id, Title: draft.Name, Format: draft.Format, Seats: draft.Seats, Life: draft.Life, MulliganMode: "standard", CreatorID: u.ID, Status: "preparing", Participants: []participantState{creator}, Vacancies: draft.Seats - 1}
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
var errDeckRequired = errors.New("Selecione um deck antes de confirmar.")
var errReadyLocked = errors.New("Desfaça a prontidão para trocar de deck.")

func (s *Service) setMulliganMode(ctx context.Context, id int64, mode string, u auth.User) (Room, error) {
	tx, e := s.db.BeginTx(ctx, nil)
	if e != nil {
		return Room{}, e
	}
	defer tx.Rollback()
	r, e := lockedRoom(ctx, tx, id)
	if e != nil {
		return Room{}, e
	}
	if r.CreatorID != u.ID {
		return Room{}, errNotCreator
	}
	if r.Status != "preparing" {
		return Room{}, errRoomStarted
	}
	if mode != "standard" && mode != "aconchegaz" {
		return Room{}, errCardNotFound
	}
	r.MulliganMode = mode
	if e = save(ctx, tx, r, u.ID, "mulligan-mode"); e != nil {
		return Room{}, e
	}
	e = tx.Commit()
	return r.view(), e
}

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
	if r.Status == "finished" {
		return Room{}, errMatchFinished
	}
	for _, p := range r.Participants {
		if p.ID == u.ID {
			return r.view(), nil
		}
	}
	if r.Status != "preparing" {
		return Room{}, errRoomStarted
	}
	if len(r.Participants) >= r.Seats {
		return Room{}, errRoomFull
	}
	r.Participants = append(r.Participants, participantState{ID: u.ID, Name: u.Name})
	r.Vacancies = r.Seats - len(r.Participants)
	if e = save(ctx, tx, r, u.ID, "joined"); e != nil {
		return Room{}, e
	}
	e = tx.Commit()
	return r.view(), e
}
func (s *Service) selectParticipantDeck(ctx context.Context, id, deckID int64, u auth.User) (Room, error) {
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
			if r.Participants[i].Ready {
				return Room{}, errReadyLocked
			}
			r.Participants[i].DeckID = deckID
			if e = save(ctx, tx, r, u.ID, "selected-deck"); e != nil {
				return Room{}, e
			}
			e = tx.Commit()
			return r.view(), e
		}
	}
	return Room{}, sql.ErrNoRows
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
	if deckID > 0 {
		var found int
		if e = tx.QueryRowContext(ctx, "SELECT 1 FROM decks WHERE id=? AND user_id=?", deckID, u.ID).Scan(&found); e != nil {
			if errors.Is(e, sql.ErrNoRows) {
				return Room{}, errDeckNotFound
			}
			return Room{}, e
		}
	}
	for i := range r.Participants {
		if r.Participants[i].ID == u.ID {
			if r.Participants[i].Ready && deckID > 0 && deckID != r.Participants[i].DeckID {
				return Room{}, errReadyLocked
			}
			if deckID > 0 {
				r.Participants[i].DeckID = deckID
			}
			if r.Participants[i].DeckID == 0 {
				return Room{}, errDeckRequired
			}
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

func (s *Service) unready(ctx context.Context, id int64, u auth.User) (Room, error) {
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
	for i := range r.Participants {
		if r.Participants[i].ID == u.ID {
			r.Participants[i].Ready = false
			if e = save(ctx, tx, r, u.ID, "unready"); e != nil {
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
			cards = append(cards, Card{ID: fmt.Sprintf("%d-%d-%d", userID, pos, c), Name: n, OwnerID: userID, ControllerID: userID, Zone: "library"})
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
	life := r.Life
	order, e := drawTurnOrder(r.Participants, s.roll)
	if e != nil {
		return Match{}, e
	}
	mode := r.MulliganMode
	if mode == "" {
		mode = "standard"
	}
	m := matchState{RoomID: id, InitialLife: life, TurnOrder: order, MulliganMode: mode, MulliganOpen: true, Players: make([]playerState, 0, len(r.Participants))}
	for _, p := range r.Participants {
		cards, e := deckCards(ctx, tx, p.DeckID, p.ID)
		if e != nil {
			return Match{}, e
		}
		if len(cards) == 0 {
			return Match{}, errDeckNotFound
		}
		if s.catalog != nil {
			for i := range cards {
				entry, _ := s.catalog.Lookup(cards[i].Name)
				cards[i].PrintedPower, cards[i].PrintedToughness = entry.Power, entry.Toughness
				cards[i].Faces = append([]string(nil), entry.Faces...)
			}
		}
		if e = shuffle(cards); e != nil {
			return Match{}, e
		}
		var commander sql.NullString
		if e = tx.QueryRowContext(ctx, "SELECT commander FROM decks WHERE id=? AND user_id=?", p.DeckID, p.ID).Scan(&commander); e != nil {
			return Match{}, e
		}
		command := []Card{}
		if enabledSetting(r.CommanderToCommand) && commander.String != "" {
			for i, card := range cards {
				if card.Name == commander.String {
					card.Zone = "command"
					command = append(command, card)
					cards = append(cards[:i], cards[i+1:]...)
					break
				}
			}
		}
		drawn := 0
		if enabledSetting(r.DrawOpeningHand) {
			drawn = 7
		}
		if drawn > len(cards) {
			drawn = len(cards)
		}
		hand := append([]Card(nil), cards[:drawn]...)
		for i := range hand {
			hand[i].Zone = "hand"
		}
		m.Players = append(m.Players, playerState{UserID: p.ID, Name: p.Name, Life: life, Library: append([]Card(nil), cards[drawn:]...), Hand: hand, Battlefield: []Card{}, Graveyard: []Card{}, Exile: []Card{}, Command: command, Consulted: []Card{}})
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
	log, e := matchLog(ctx, tx, id, m, u.ID)
	if e != nil {
		return Match{}, e
	}
	if e = tx.Commit(); e != nil {
		return Match{}, e
	}
	return s.libraryView(m, u.ID, log), nil
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
	if playerByID(&m, u.ID) == nil {
		return Match{}, errNotParticipant
	}
	log, e := matchLog(ctx, s.db, id, m, u.ID)
	if e != nil {
		return Match{}, e
	}
	return s.libraryView(m, u.ID, log), nil
}
