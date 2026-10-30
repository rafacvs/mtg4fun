package rooms

import (
	"crypto/rand"
	"encoding/hex"
	"strconv"
	"strings"
	"unicode/utf8"
)

func modifierFromText(raw string) (int64, bool) {
	raw = strings.TrimSpace(raw)
	if raw == "" {
		return 0, true
	}
	value, err := strconv.ParseInt(raw, 10, 64)
	if err != nil || value < -maxCounterValue || value > maxCounterValue {
		return 0, false
	}
	return value, true
}

func (s *Service) createCatalogToken(m *matchState, p *playerState, name string) (actionLogPayload, error) {
	if s.catalog == nil {
		return actionLogPayload{}, errCardNotFound
	}
	definition, ok := s.catalog.Lookup(name)
	if !ok || !definition.Token {
		return actionLogPayload{}, errCardNotFound
	}
	card := Card{
		Name: name, Text: definition.Text, PrintedPower: definition.Power,
		PrintedToughness: definition.Toughness, ImageName: name, InstanceKind: "token",
	}
	return addCreatedCard(m, p, card, "create-token")
}

func addCreatedCard(m *matchState, p *playerState, card Card, kind string) (actionLogPayload, error) {
	var identifier [16]byte
	if _, err := rand.Read(identifier[:]); err != nil {
		return actionLogPayload{}, err
	}
	card.ID = "created-" + hex.EncodeToString(identifier[:])
	card.OwnerID = p.UserID
	card.ControllerID = p.UserID
	card.IsToken = true
	x, row := firstCreatedTokenCell(p.Battlefield, card)
	if x > 20000 || row > 2000 {
		return actionLogPayload{}, errInvalidPosition
	}
	card.Zone = "battlefield"
	card.PositionX = x
	card.Row = row
	m.NextStackOrder++
	card.StackOrder = m.NextStackOrder
	p.Battlefield = append(p.Battlefield, card)
	return actionLogPayload{Kind: kind, To: "battlefield", Count: 1, Result: card.Name, Cards: referencesForCards([]Card{card})}, nil
}

// firstCreatedTokenCell keeps repeated equivalent tokens together, but never
// starts their stack on top of an unrelated card.
func firstCreatedTokenCell(cards []Card, created Card) (int, int) {
	type cell struct {
		count       int
		matching    bool
		onlyMatches bool
		matchingTop int
	}
	cells := make(map[int]cell)
	maxCol := -1
	for _, card := range cards {
		if card.Row != 0 {
			continue
		}
		current := cells[card.PositionX]
		if current.count == 0 {
			current.onlyMatches = true
		}
		current.count++
		if card.Name == created.Name && card.InstanceKind == created.InstanceKind {
			current.matching = true
			if card.StackOrder > current.matchingTop {
				current.matchingTop = card.StackOrder
			}
		} else {
			current.onlyMatches = false
		}
		cells[card.PositionX] = current
		if card.PositionX > maxCol {
			maxCol = card.PositionX
		}
	}
	matchingCol, matchingOrder := -1, -1
	for column, current := range cells {
		if current.count < 3 && current.matching && current.onlyMatches && current.matchingTop > matchingOrder {
			matchingCol, matchingOrder = column, current.matchingTop
		}
	}
	if matchingCol >= 0 {
		return matchingCol, 0
	}
	for column := 0; column <= maxCol; column++ {
		if cells[column].count == 0 {
			return column, 0
		}
	}
	return maxCol + 1, 0
}

func creationFieldsOnly(input matchAction) bool {
	return input.Count == 0 && len(input.CardIDs) == 0 && input.To == "" &&
		input.LibraryPlacement == "" && input.Sides == 0 && input.Direction == "" &&
		input.PositionX == 0 && input.Row == 0 && input.ConsultFrom == "" && input.TokenName == ""
}

func validCustomToken(input matchAction) bool {
	_, powerOK := modifierFromText(input.Power)
	_, toughnessOK := modifierFromText(input.Toughness)
	return input.CustomName != "" && utf8.RuneCountInString(input.CustomName) <= 200 &&
		utf8.RuneCountInString(input.Description) <= 5000 && powerOK && toughnessOK
}

func (s *Service) copyCard(m *matchState, p *playerState, id string) (actionLogPayload, error) {
	// Search only the same filtered view the requesting participant can read.
	for _, player := range m.view(p.UserID, nil).Players {
		for _, cards := range [][]VisibleCard{player.Hand, player.Battlefield, player.Graveyard, player.Exile, player.Command, player.Consulted, player.Revealed} {
			for _, source := range cards {
				if source.ID != id || source.Name == "" {
					continue
				}
				card := Card{
					Name: source.Name, Text: source.Text, Power: source.Power, Toughness: source.Toughness,
					PrintedPower: source.PrintedPower, PrintedToughness: source.PrintedToughness,
					ImageName: source.ImageName, Faces: append([]string(nil), source.Faces...),
					FaceIndex: source.FaceIndex, InstanceKind: "copy",
				}
				// Deck cards from older snapshots have only their catalogue name.
				if source.InstanceKind == "" && source.ImageName == "" && s.catalog != nil {
					if definition, ok := s.catalog.Lookup(source.Name); ok {
						card.Text = definition.Text
						card.PrintedPower, card.PrintedToughness = definition.Power, definition.Toughness
						card.ImageName = source.Name
						if len(definition.Faces) > 1 {
							card.Faces = append([]string(nil), definition.Faces...)
						}
					}
				}
				return addCreatedCard(m, p, card, "copy-card")
			}
		}
	}
	return actionLogPayload{}, errCardNotFound
}
