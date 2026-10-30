package rooms

// Enrich only the owner's consultation. Public reveals never disclose library order.
func (s *Service) libraryView(state matchState, viewerID int64, log []MatchLog) Match {
	view := state.view(viewerID, log)
	for i := range view.Players {
		player := &view.Players[i]
		for _, cards := range [][]VisibleCard{player.Hand, player.Battlefield, player.Graveyard, player.Exile, player.Command, player.Consulted, player.Revealed} {
			for j := range cards {
				s.addCreatedTokens(cards[j].Name, &cards[j].CreatedTokens)
			}
		}
		for j := range player.ExposedCards {
			s.addCreatedTokens(player.ExposedCards[j].Name, &player.ExposedCards[j].CreatedTokens)
		}
		if player.UserID != viewerID {
			continue
		}
		source := playerByID(&state, viewerID)
		for j := range player.Consulted {
			card := &player.Consulted[j]
			if s.catalog != nil {
				entry, _ := s.catalog.Lookup(card.Name)
				card.Type = entry.Type
			}
			for position, original := range source.Library {
				if original.ID == card.ID {
					card.LibraryPosition = position + 1
					break
				}
			}
		}
	}
	return view
}

func (s *Service) addCreatedTokens(name string, target *[]string) {
	if s.catalog == nil || name == "" {
		return
	}
	entry, ok := s.catalog.Lookup(name)
	if ok {
		*target = append([]string(nil), entry.CreatedTokens...)
	}
}
