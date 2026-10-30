package rooms

import (
	"database/sql"
	"errors"
	"net/http"

	"mtg4fun/internal/httpserver"
)

type preparationDeck struct {
	PlayerID int64  `json:"playerId"`
	Name     string `json:"name"`
	Image    string `json:"image,omitempty"`
}

// preparationDecks shares only the selected deck's name and one card image
// with members of this room, never the deck's card list.
func (s *Service) preparationDecks(w http.ResponseWriter, r *http.Request) {
	id, ok := roomID(w, r)
	if !ok {
		return
	}
	user, ok := s.requireUser(w, r)
	if !ok {
		return
	}
	room, err := readRoom(s.db.QueryRowContext(r.Context(), "SELECT snapshot FROM rooms WHERE id=?", id))
	if errors.Is(err, sql.ErrNoRows) {
		httpserver.WriteError(w, 404, "Sala não encontrada.")
		return
	}
	if err != nil {
		httpserver.InternalError(w, err)
		return
	}
	member := false
	for _, player := range room.Participants {
		if player.ID == user.ID {
			member = true
			break
		}
	}
	if !member || (room.Status != "preparing" && room.Status != "determining_order") {
		httpserver.WriteError(w, 404, "Sala não encontrada.")
		return
	}
	result := []preparationDeck{}
	for _, player := range room.Participants {
		if player.DeckID == 0 {
			continue
		}
		var name string
		var commander, firstCard sql.NullString
		err = s.db.QueryRowContext(r.Context(), `SELECT d.name,d.commander,(SELECT c.name FROM deck_cards c WHERE c.deck_id=d.id ORDER BY c.position LIMIT 1) FROM decks d WHERE d.id=? AND d.user_id=?`, player.DeckID, player.ID).Scan(&name, &commander, &firstCard)
		if errors.Is(err, sql.ErrNoRows) {
			continue
		}
		if err != nil {
			httpserver.InternalError(w, err)
			return
		}
		image := commander.String
		if image == "" {
			image = firstCard.String
		}
		result = append(result, preparationDeck{PlayerID: player.ID, Name: name, Image: image})
	}
	w.Header().Set("Cache-Control", "no-store")
	httpserver.WriteJSON(w, 200, map[string]any{"decks": result})
}
