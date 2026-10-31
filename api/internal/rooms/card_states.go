package rooms

import (
	"errors"
	"slices"
	"strings"
)

var errInvalidCardState = errors.New("Estado inválido para esta carta.")

func stateCards(p *playerState, ids []string, fieldOnly bool) ([]*Card, error) {
	cards := make([]*Card, 0, len(ids))
	seen := map[string]bool{}
	for _, id := range ids {
		if seen[id] {
			return nil, errCardNotFound
		}
		seen[id] = true
		found := false
		for _, name := range []string{"battlefield", "hand", "graveyard", "exile", "command", "consulted", "revealed", "library"} {
			if fieldOnly && name != "battlefield" {
				continue
			}
			for i := range *zone(p, name) {
				card := &(*zone(p, name))[i]
				if card.ID == id {
					if card.ControllerID != p.UserID {
						return nil, errNotController
					}
					cards = append(cards, card)
					found = true
					break
				}
			}
			if found {
				break
			}
		}
		if !found {
			return nil, errCardNotFound
		}
	}
	return cards, nil
}
func changeCardState(p *playerState, input matchAction) (actionLogPayload, error) {
	if input.Kind == "untap_all" {
		count := 0
		for i := range p.Battlefield {
			card := &p.Battlefield[i]
			if card.ControllerID == p.UserID {
				card.Tapped = false
				count++
			}
		}
		return actionLogPayload{Kind: input.Kind, Count: count}, nil
	}
	ids := input.CardIDs
	if input.Kind == "set_face" {
		ids = []string{input.CardID}
	}
	cards, err := stateCards(p, ids, input.Kind == "set_tapped")
	if err != nil {
		return actionLogPayload{}, err
	}
	if input.Kind == "set_face" && (input.FaceIndex < 0 || input.FaceIndex >= len(cards[0].Faces)) {
		return actionLogPayload{}, errInvalidCardState
	}
	names := []string{}
	for _, card := range cards {
		switch input.Kind {
		case "set_tapped":
			card.Tapped = input.Tapped
		case "set_face":
			card.FaceIndex = input.FaceIndex
		case "set_face_down":
			card.FaceDown = input.FaceDown
		case "reveal_cards":
			card.Revealed = input.Revealed
			card.RevealedTo = nil
			if input.Revealed {
				names = append(names, card.Name)
			}
		}
	}
	result := ""
	if input.Kind == "reveal_cards" && input.Revealed {
		result = strings.Join(names, ", ")
	}
	return actionLogPayload{Kind: input.Kind, Count: len(cards), Result: result}, nil
}

func (c Card) revealedToViewer(viewerID int64) bool {
	if c.Zone != "hand" || len(c.RevealedTo) == 0 {
		return false
	}
	return c.OwnerID == viewerID || slices.Contains(c.RevealedTo, viewerID)
}

// A reveal to chosen opponents replaces any earlier reveal of the same cards,
// including a public one, and only the recipients get the identity.
func revealHandCardsTo(m *matchState, p *playerState, input matchAction) (actionLogPayload, error) {
	names := make([]string, 0, len(input.RevealedTo))
	seen := map[int64]bool{}
	for _, id := range input.RevealedTo {
		name := ""
		for _, player := range m.Players {
			if player.UserID == id && id != p.UserID {
				name = player.Name
			}
		}
		if name == "" || seen[id] {
			return actionLogPayload{}, errInvalidCardState
		}
		seen[id] = true
		names = append(names, name)
	}
	cards, err := stateCards(p, input.CardIDs, false)
	if err != nil {
		return actionLogPayload{}, err
	}
	refs := make([]logCardReference, 0, len(cards))
	for _, card := range cards {
		if card.Zone != "hand" {
			return actionLogPayload{}, errInvalidCardState
		}
	}
	for _, card := range cards {
		card.Revealed = false
		card.RevealedTo = slices.Clone(input.RevealedTo)
		refs = append(refs, logCardReference{ID: card.ID, Viewers: card.RevealedTo})
	}
	return actionLogPayload{Kind: "reveal_cards_to", Count: len(cards), Result: strings.Join(names, ", "), Cards: refs}, nil
}

// A chosen audience only makes sense in the hand: public zones show the card to
// everyone, and a card back in the library must not keep exposing its identity.
func endHandRevelationsOutsideHand(m *matchState) {
	for i := range m.Players {
		for _, name := range []string{"battlefield", "graveyard", "exile", "command", "consulted", "revealed", "library"} {
			for j := range *zone(&m.Players[i], name) {
				(*zone(&m.Players[i], name))[j].RevealedTo = nil
			}
		}
	}
}

// Clearing a disclosure never changes a card's zone or library order.
func clearRevelations(p *playerState) int {
	count := 0
	for _, name := range []string{"battlefield", "hand", "graveyard", "exile", "command", "consulted", "revealed", "library"} {
		for i := range *zone(p, name) {
			card := &(*zone(p, name))[i]
			if card.Revealed || len(card.RevealedTo) > 0 {
				count++
			}
			card.Revealed = false
			card.RevealedTo = nil
		}
	}
	return count
}
