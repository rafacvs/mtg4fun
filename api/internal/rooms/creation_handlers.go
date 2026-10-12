package rooms

import (
	"database/sql"
	"errors"
	"mtg4fun/internal/httpserver"
	"net/http"
)

type catalogToken struct {
	Name      string `json:"name"`
	Text      string `json:"text"`
	Power     string `json:"power,omitempty"`
	Toughness string `json:"toughness,omitempty"`
	ImageName string `json:"imageName"`
}

func (s *Service) listTokens(w http.ResponseWriter, r *http.Request) {
	id, ok := roomID(w, r)
	if !ok {
		return
	}
	user, ok := s.requireUser(w, r)
	if !ok {
		return
	}
	if _, err := s.match(r.Context(), id, user); err != nil {
		if errors.Is(err, errNotParticipant) || errors.Is(err, sql.ErrNoRows) {
			httpserver.WriteError(w, 404, "Partida não encontrada.")
			return
		}
		httpserver.InternalError(w, err)
		return
	}
	tokens := []catalogToken{}
	if s.catalog != nil {
		for _, name := range s.catalog.Tokens(r.URL.Query().Get("q")) {
			card, _ := s.catalog.Lookup(name)
			tokens = append(tokens, catalogToken{Name: name, Text: card.Text, Power: card.Power, Toughness: card.Toughness, ImageName: name})
		}
	}
	httpserver.WriteJSON(w, 200, map[string]any{"tokens": tokens})
}
