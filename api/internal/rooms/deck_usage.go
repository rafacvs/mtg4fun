package rooms

import "context"

// roomsUsingDeck lists the rooms still before the match where the player chose this deck.
func (s *Service) roomsUsingDeck(ctx context.Context, userID, deckID int64) ([]roomState, error) {
	rows, err := s.db.QueryContext(ctx, "SELECT snapshot FROM rooms")
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	found := []roomState{}
	for rows.Next() {
		room, err := readRoom(rows)
		if err != nil {
			return nil, err
		}
		if room.Status != "preparing" && room.Status != "determining_order" {
			continue
		}
		for _, player := range room.Participants {
			if player.ID == userID && player.DeckID == deckID {
				found = append(found, room)
				break
			}
		}
	}
	return found, rows.Err()
}

// DeckLocked reports whether a room already counts on the deck as it is: the
// commander is read when the match starts, so a ready player must undo it first.
func (s *Service) DeckLocked(ctx context.Context, userID, deckID int64) (bool, error) {
	rooms, err := s.roomsUsingDeck(ctx, userID, deckID)
	if err != nil {
		return false, err
	}
	for _, room := range rooms {
		if room.Status == "determining_order" {
			return true, nil
		}
		for _, player := range room.Participants {
			if player.ID == userID && player.Ready {
				return true, nil
			}
		}
	}
	return false, nil
}

// DeckChanged bumps the revision in the room snapshot, which the room events
// already deliver, so the members reload the deck's public view.
func (s *Service) DeckChanged(ctx context.Context, userID, deckID int64) error {
	rooms, err := s.roomsUsingDeck(ctx, userID, deckID)
	if err != nil {
		return err
	}
	for _, room := range rooms {
		if err := s.bumpDeckRevision(ctx, room.ID, userID, deckID); err != nil {
			return err
		}
	}
	return nil
}

func (s *Service) bumpDeckRevision(ctx context.Context, id, userID, deckID int64) error {
	tx, err := s.db.BeginTx(ctx, nil)
	if err != nil {
		return err
	}
	defer tx.Rollback()
	room, err := lockedRoom(ctx, tx, id)
	if err != nil {
		return err
	}
	for i := range room.Participants {
		if room.Participants[i].ID == userID && room.Participants[i].DeckID == deckID {
			room.Participants[i].DeckRevision++
		}
	}
	if err = save(ctx, tx, room, userID, "deck-changed"); err != nil {
		return err
	}
	return tx.Commit()
}
