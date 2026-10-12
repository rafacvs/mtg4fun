package rooms

import (
	"crypto/rand"
	"encoding/hex"
	"unicode/utf8"
)

func (s *Service) createCatalogToken(p *playerState, name string) (actionLogPayload, error) {
	if s.catalog == nil {
		return actionLogPayload{}, errCardNotFound
	}
	definition, ok := s.catalog.Lookup(name)
	if !ok || !definition.Token {
		return actionLogPayload{}, errCardNotFound
	}
	card := Card{
		Name: name, Text: definition.Text, Power: definition.Power,
		Toughness: definition.Toughness, ImageName: name, InstanceKind: "token",
	}
	return addCreatedCard(p, card, "create-token")
}

func addCreatedCard(p *playerState, card Card, kind string) (actionLogPayload, error) {
	var identifier [16]byte
	if _, err := rand.Read(identifier[:]); err != nil {
		return actionLogPayload{}, err
	}
	card.ID = "created-" + hex.EncodeToString(identifier[:])
	card.OwnerID = p.UserID
	card.ControllerID = p.UserID
	card.Zone = "battlefield"
	card.PositionX = len(p.Battlefield) * 80
	p.Battlefield = append(p.Battlefield, card)
	return actionLogPayload{Kind: kind, To: "battlefield", Count: 1, Result: card.Name}, nil
}

func creationFieldsOnly(input matchAction) bool {
	return input.Count == 0 && len(input.CardIDs) == 0 && input.To == "" &&
		input.LibraryPlacement == "" && input.Sides == 0 && input.Direction == "" &&
		input.PositionX == 0 && input.Row == 0 && input.ConsultFrom == "" && input.TokenName == ""
}

func validCustomToken(input matchAction) bool {
	return input.CustomName != "" && utf8.RuneCountInString(input.CustomName) <= 200 &&
		utf8.RuneCountInString(input.Description) <= 5000 &&
		utf8.RuneCountInString(input.Power) <= 32 && utf8.RuneCountInString(input.Toughness) <= 32
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
					ImageName: source.ImageName, Faces: append([]string(nil), source.Faces...),
					FaceIndex: source.FaceIndex, InstanceKind: "copy",
				}
				// Deck cards from older snapshots have only their catalogue name.
				if source.InstanceKind == "" && source.ImageName == "" && s.catalog != nil {
					if definition, ok := s.catalog.Lookup(source.Name); ok {
						card.Text = definition.Text
						card.Power = definition.Power
						card.Toughness = definition.Toughness
						card.ImageName = source.Name
					}
				}
				return addCreatedCard(p, card, "copy-card")
			}
		}
	}
	return actionLogPayload{}, errCardNotFound
}
