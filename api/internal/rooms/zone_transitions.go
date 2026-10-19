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

func moveCards(m *matchState, p *playerState, input matchAction) (actionLogPayload, error) {
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
			for _, c := range *cardsInZone {
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
	// Resolve every destination before removing any card. Borrowed cards return
	// to their original owner when they leave the battlefield.
	destinations := make(map[*playerState][]Card)
	for _, card := range cards {
		destination := p
		if from == "battlefield" && input.To != "battlefield" && card.OwnerID != p.UserID {
			destination = playerByID(m, card.OwnerID)
			if destination == nil {
				return actionLogPayload{}, errCardNotFound
			}
			card.ControllerID = card.OwnerID
		}
		destinations[destination] = append(destinations[destination], card)
	}
	// Validate all cards before changing any source zone.
	if len(cards) == 0 {
		return actionLogPayload{}, errCardNotFound
	}
	source := zone(p, from)
	remaining := make([]Card, 0, len(*source)-len(cards))
	for _, card := range *source {
		if !seen[card.ID] {
			remaining = append(remaining, card)
		}
	}
	*source = remaining
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
	for destination, moved := range destinations {
		placeCards(destination, moved, from, input.To, input.LibraryPlacement)
	}
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
