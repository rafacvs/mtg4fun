// Package decks owns each user's reusable deck library.
package decks

import (
	"context"
	"database/sql"
	"errors"
	"fmt"

	"mtg4fun/internal/catalog"
)

type Card struct {
	Name      string `json:"name"`
	Quantity  int64  `json:"quantity"`
	Text      string `json:"text"`
	Token     bool   `json:"token"`
	Available bool   `json:"available"`
}
type Deck struct {
	ID    int64  `json:"id"`
	Name  string `json:"name"`
	Cards []Card `json:"cards"`
}
type Service struct {
	db      *sql.DB
	catalog *catalog.Catalog
}

func New(db *sql.DB, cards *catalog.Catalog) *Service {
	return &Service{db: db, catalog: cards}
}

var errInvalidDeck = errors.New("deck inválido")

func (s *Service) resolve(card *Card) {
	entry, ok := s.catalog.Lookup(card.Name)
	card.Text, card.Token, card.Available = entry.Text, entry.Token, ok
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
	return deck, nil
}
func (s *Service) list(ctx context.Context, userID int64) ([]Deck, error) {
	rows, err := s.db.QueryContext(ctx, `SELECT d.id,d.name,c.name,c.quantity FROM decks d JOIN deck_cards c ON c.deck_id=d.id WHERE d.user_id=? ORDER BY d.id DESC,c.position`, userID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	decks := []Deck{}
	for rows.Next() {
		var id int64
		var name string
		var card Card
		if err = rows.Scan(&id, &name, &card.Name, &card.Quantity); err != nil {
			return nil, err
		}
		s.resolve(&card)
		if len(decks) == 0 || decks[len(decks)-1].ID != id {
			decks = append(decks, Deck{ID: id, Name: name, Cards: []Card{}})
		}
		decks[len(decks)-1].Cards = append(decks[len(decks)-1].Cards, card)
	}
	return decks, rows.Err()
}
