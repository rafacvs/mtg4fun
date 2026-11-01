package rooms

import (
	"database/sql"
	"errors"
	"mtg4fun/internal/httpserver"
	"net/http"
	"slices"
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
	match, err := s.match(r.Context(), id, user)
	if err != nil && !errors.Is(err, sql.ErrNoRows) {
		httpserver.InternalError(w, err)
		return
	}
	// Reading the match is open to spectators; creating tokens is not.
	seated := slices.ContainsFunc(match.Players, func(p MatchPlayer) bool { return p.UserID == user.ID })
	if err != nil || !seated {
		httpserver.WriteError(w, 404, "Partida não encontrada.")
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
