package rooms

import "fmt"

func zone(p *playerState, name string) *[]Card {
	switch name {
	case "library":
		return &p.Library
	case "hand":
		return &p.Hand
	case "battlefield":
		return &p.Battlefield
	case "graveyard":
		return &p.Graveyard
	case "exile":
		return &p.Exile
	case "command":
		return &p.Command
	case "consulted":
		return &p.Consulted
	case "revealed":
		return &p.Revealed
	}
	return nil
}

func moveCards(p *playerState, input matchAction) (actionLogPayload, error) {
	if zone(p, input.To) == nil || input.To == "library" && input.LibraryPlacement != "top" && input.LibraryPlacement != "bottom" {
		return actionLogPayload{}, errCardNotFound
	}
	seen := map[string]bool{}
	cards := []Card{}
	from := ""
	for _, id := range input.CardIDs {
		if seen[id] {
			return actionLogPayload{}, errCardNotFound
		}
		seen[id] = true
		found := false
		for _, name := range []string{"hand", "battlefield", "graveyard", "exile", "command", "consulted", "revealed", "library"} {
			cardsInZone := zone(p, name)
			for i, c := range *cardsInZone {
				if c.ID != id {
					continue
				}
				if c.ControllerID != p.UserID {
					return actionLogPayload{}, errNotController
				}
				if from == "" {
					from = name
				}
				if from != name {
					return actionLogPayload{}, errCardNotFound
				}
				*cardsInZone = append((*cardsInZone)[:i], (*cardsInZone)[i+1:]...)
				cards = append(cards, c)
				found = true
				break
			}
			if found {
				break
			}
		}
		if !found {
			return actionLogPayload{}, errCardNotFound
		}
	}
	count := len(cards)
	removed := 0
	for _, card := range cards {
		if isToken(card) && input.To != "battlefield" {
			removed++
		}
	}
	result := ""
	if removed > 0 {
		result = fmt.Sprintf("%d ficha(s)/cópia(s) removida(s) do jogo", removed)
	}
	placeCards(p, cards, from, input.To, input.LibraryPlacement)
	return actionLogPayload{Kind: "move", From: from, To: input.To, Count: count, Result: result}, nil
}

// All zone transitions use this function, including draws and consultations.
// InstanceKind recognizes tokens in snapshots written before IsToken existed.
func placeCards(p *playerState, cards []Card, from, to, placement string) {
	destination := zone(p, to)
	kept := make([]Card, 0, len(cards))
	for _, card := range cards {
		if isToken(card) && to != "battlefield" {
			continue
		}
		if from == "battlefield" && (to == "graveyard" || to == "exile") {
			card.Markers = colorCounts{}
			card.Power, card.Toughness = 0, 0
			card.Tapped, card.FaceDown = false, false
		}
		card.Zone = to
		if to == "battlefield" && from != to {
			card.PositionX = (len(p.Battlefield) + len(kept)) * 120
			card.Row = 0
		}
		kept = append(kept, card)
	}
	if to == "library" && placement == "top" {
		*destination = append(kept, *destination...)
	} else {
		*destination = append(*destination, kept...)
	}
}

func isToken(card Card) bool {
	return card.IsToken || card.InstanceKind == "token" || card.InstanceKind == "custom-token" || card.InstanceKind == "copy"
}
