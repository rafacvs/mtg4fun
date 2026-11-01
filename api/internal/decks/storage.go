// Package decks owns each user's reusable deck library.
package decks

import (
	"context"
	"database/sql"
	"errors"
	"fmt"
	"log"

	"mtg4fun/internal/catalog"
)

type Card struct {
	Name      string `json:"name"`
	Quantity  int64  `json:"quantity"`
	Text      string `json:"text"`
	Colors    string `json:"colors,omitempty"`
	Token     bool   `json:"token"`
	Available bool   `json:"available"`
}

type Groups struct {
	Commander []Card `json:"commander"`
	Creatures []Card `json:"creatures"`
	Spells    []Card `json:"spells"`
	Artifacts []Card `json:"artifacts"`
	Lands     []Card `json:"lands"`
	Other     []Card `json:"other"`
}

type CurveBin struct {
	CMC   int   `json:"cmc"`
	Count int64 `json:"count"`
}

type Deck struct {
	ID            int64      `json:"id"`
	Name          string     `json:"name"`
	Commander     string     `json:"commander,omitempty"`
	ColorIdentity string     `json:"colorIdentity,omitempty"`
	Curve         []CurveBin `json:"curve"`
	Groups        Groups     `json:"groups"`
	Cards         []Card     `json:"cards"`
}

// RoomUsage is how rooms take part in deck edits, without decks depending on them.
type RoomUsage interface {
	DeckLocked(ctx context.Context, userID, deckID int64) (bool, error)
	DeckChanged(ctx context.Context, userID, deckID int64) error
}

type Service struct {
	db      *sql.DB
	catalog *catalog.Catalog
	rooms   RoomUsage
}

func New(db *sql.DB, cards *catalog.Catalog) *Service {
	return &Service{db: db, catalog: cards}
}

var errInvalidDeck = errors.New("deck inválido")
var errUnknownCommander = errors.New("Carta não encontrada neste deck.")
var errDeckLocked = errors.New("Desfaça o pronto na sala para editar este deck.")

// UseRooms connects deck edits to the rooms that are using the deck.
func (s *Service) UseRooms(rooms RoomUsage) { s.rooms = rooms }

func (s *Service) resolve(card *Card) {
	entry, ok := s.catalog.Lookup(card.Name)
	card.Text, card.Colors, card.Token, card.Available = entry.Text, entry.Colors, entry.Token, ok
}

func (s *Service) save(ctx context.Context, userID int64, deck Deck) (Deck, error) {
	for i := range deck.Cards {
		if s.resolve(&deck.Cards[i]); !deck.Cards[i].Available {
			return Deck{}, fmt.Errorf("%w: Carta não encontrada no catálogo: %s.", errInvalidDeck, deck.Cards[i].Name)
		}
	}
	tx, err := s.db.BeginTx(ctx, nil)
	if err != nil {
		return Deck{}, err
	}
	defer tx.Rollback()
	result, err := tx.ExecContext(ctx, "INSERT INTO decks(user_id,name) VALUES (?,?)", userID, deck.Name)
	if err != nil {
		return Deck{}, err
	}
	deck.ID, err = result.LastInsertId()
	if err != nil {
		return Deck{}, err
	}
	for i, card := range deck.Cards {
		if _, err = tx.ExecContext(ctx, "INSERT INTO deck_cards(deck_id,position,name,quantity) VALUES (?,?,?,?)", deck.ID, i, card.Name, card.Quantity); err != nil {
			return Deck{}, err
		}
	}
	if err = tx.Commit(); err != nil {
		return Deck{}, err
	}
	s.present(&deck)
	return deck, nil
}
func (s *Service) list(ctx context.Context, userID int64) ([]Deck, error) {
	rows, err := s.db.QueryContext(ctx, `SELECT d.id,d.name,d.commander,c.name,c.quantity FROM decks d JOIN deck_cards c ON c.deck_id=d.id WHERE d.user_id=? ORDER BY d.id DESC,c.position`, userID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	decks := []Deck{}
	for rows.Next() {
		var id int64
		var name string
		var commander sql.NullString
		var card Card
		if err = rows.Scan(&id, &name, &commander, &card.Name, &card.Quantity); err != nil {
			return nil, err
		}
		s.resolve(&card)
		if len(decks) == 0 || decks[len(decks)-1].ID != id {
			decks = append(decks, Deck{ID: id, Name: name, Commander: commander.String, Cards: []Card{}})
		}
		decks[len(decks)-1].Cards = append(decks[len(decks)-1].Cards, card)
	}
	if err = rows.Err(); err != nil {
		return nil, err
	}
	for i := range decks {
		s.present(&decks[i])
	}
	return decks, nil
}

func (s *Service) get(ctx context.Context, userID, deckID int64) (Deck, error) {
	row := s.db.QueryRowContext(ctx, "SELECT id,name,commander FROM decks WHERE id=? AND user_id=?", deckID, userID)
	var deck Deck
	var commander sql.NullString
	if err := row.Scan(&deck.ID, &deck.Name, &commander); err != nil {
		return Deck{}, err
	}
	deck.Commander = commander.String
	rows, err := s.db.QueryContext(ctx, "SELECT name,quantity FROM deck_cards WHERE deck_id=? ORDER BY position", deckID)
	if err != nil {
		return Deck{}, err
	}
	defer rows.Close()
	deck.Cards = []Card{}
	for rows.Next() {
		var card Card
		if err = rows.Scan(&card.Name, &card.Quantity); err != nil {
			return Deck{}, err
		}
		s.resolve(&card)
		deck.Cards = append(deck.Cards, card)
	}
	if err = rows.Err(); err != nil {
		return Deck{}, err
	}
	s.present(&deck)
	return deck, nil
}

func (s *Service) setCommander(ctx context.Context, userID, deckID int64, name string) (Deck, error) {
	deck, err := s.get(ctx, userID, deckID)
	if err != nil {
		return Deck{}, err
	}
	if name != "" {
		found := false
		for _, card := range deck.Cards {
			if card.Name == name {
				found = true
				break
			}
		}
		if !found {
			return Deck{}, errUnknownCommander
		}
	}
	if s.rooms != nil {
		locked, err := s.rooms.DeckLocked(ctx, userID, deckID)
		if err != nil {
			return Deck{}, err
		}
		if locked {
			return Deck{}, errDeckLocked
		}
	}
	var stored any
	if name != "" {
		stored = name
	}
	if _, err = s.db.ExecContext(ctx, "UPDATE decks SET commander=? WHERE id=? AND user_id=?", stored, deckID, userID); err != nil {
		return Deck{}, err
	}
	if s.rooms != nil {
		// The edit is already saved; failing here would only misreport it.
		if err := s.rooms.DeckChanged(ctx, userID, deckID); err != nil {
			log.Printf("avisar salas sobre o deck %d: %v", deckID, err)
		}
	}
	deck.Commander = name
	s.present(&deck)
	return deck, nil
}
