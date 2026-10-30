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

// The library requires a side. Graveyard and exile accept one; the others have no order to choose.
func validMovePlacement(to, placement string) bool {
	switch to {
	case "library":
		return placement == "top" || placement == "bottom"
	case "graveyard", "exile":
		return placement == "" || placement == "top" || placement == "bottom"
	}
	return placement == ""
}

// The library's top is its first card; the top of graveyard and exile is their last.
func placesAtStart(to, placement string) bool {
	if to == "library" {
		return placement == "top"
	}
	return (to == "graveyard" || to == "exile") && placement == "bottom"
}

func reorderZone(p *playerState, to string, ids []string) (actionLogPayload, error) {
	destination := zone(p, to)
	if destination == nil || len(ids) != len(*destination) {
		return actionLogPayload{}, errCardNotFound
	}
	byID := make(map[string]Card, len(ids))
	for _, card := range *destination {
		byID[card.ID] = card
	}
	ordered := make([]Card, 0, len(ids))
	for _, id := range ids {
		card, ok := byID[id]
		if !ok {
			return actionLogPayload{}, errCardNotFound
		}
		delete(byID, id)
		ordered = append(ordered, card)
	}
	*destination = ordered
	return actionLogPayload{Kind: "reorder_zone", To: to, Count: len(ids)}, nil
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
	if input.To == "battlefield" && from != "battlefield" {
		for destination, moved := range destinations {
			positions, err := planBattlefieldEntry(destination.Battlefield, len(moved), input.HasPosition, input.PositionX, input.Row)
			if err != nil {
				return actionLogPayload{}, err
			}
			for i := range moved {
				moved[i].PositionX = positions[i][0]
				moved[i].Row = positions[i][1]
				m.NextStackOrder++
				moved[i].StackOrder = m.NextStackOrder
			}
		}
	}
	source := zone(p, from)
	remaining := make([]Card, 0, len(*source)-len(cards))
	for _, card := range *source {
		if !seen[card.ID] {
			remaining = append(remaining, card)
		}
	}
	*source = remaining
	if from == "library" {
		kept := p.ConsultationIDs[:0]
		for _, id := range p.ConsultationIDs {
			if !seen[id] {
				kept = append(kept, id)
			}
		}
		p.ConsultationIDs = kept
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
		kept = append(kept, card)
	}
	if placesAtStart(to, placement) {
		*destination = append(kept, *destination...)
	} else {
		*destination = append(*destination, kept...)
	}
}

// firstFreeCell is the leftmost stack on row 0 with fewer than three cards.
func firstFreeCell(cards []Card) (int, int) {
	counts := map[int]int{}
	maxCol := -1
	for _, card := range cards {
		if card.Row != 0 {
			continue
		}
		counts[card.PositionX]++
		if card.PositionX > maxCol {
			maxCol = card.PositionX
		}
	}
	for column := 0; column <= maxCol; column++ {
		if counts[column] < 3 {
			return column, 0
		}
	}
	return maxCol + 1, 0
}

func planBattlefieldEntry(existing []Card, count int, explicit bool, column, row int) ([][2]int, error) {
	plan := make([][2]int, count)
	if explicit {
		if column < 0 || column > 20000 || row < 0 || row > 2000 {
			return nil, errInvalidPosition
		}
		occupied := 0
		for _, card := range existing {
			if card.PositionX == column && card.Row == row {
				occupied++
			}
		}
		if occupied+count > 3 {
			return nil, errStackFull
		}
		for i := range plan {
			plan[i] = [2]int{column, row}
		}
		return plan, nil
	}
	virtual := append([]Card{}, existing...)
	for i := 0; i < count; i++ {
		x, y := firstFreeCell(virtual)
		if x > 20000 || y > 2000 {
			return nil, errInvalidPosition
		}
		plan[i] = [2]int{x, y}
		virtual = append(virtual, Card{PositionX: x, Row: y})
	}
	return plan, nil
}

func isToken(card Card) bool {
	return card.IsToken || card.InstanceKind == "token" || card.InstanceKind == "custom-token" || card.InstanceKind == "copy"
}
