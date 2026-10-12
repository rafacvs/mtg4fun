package rooms

import (
	"errors"
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
