package rooms

import (
	"context"
	"database/sql"
	"encoding/json"
	"slices"
	"time"
)

// Only references are stored with events. Identity comes from the current
// filtered snapshot, so a historical link cannot expose a now-hidden card.
type logCardReference struct {
	ID      string  `json:"id"`
	Public  bool    `json:"public,omitempty"`
	Viewers []int64 `json:"viewers,omitempty"`
}

type LogCard struct {
	ID   string `json:"id"`
	Name string `json:"name"`
}

func referencesForCards(cards []Card) []logCardReference {
	refs := make([]logCardReference, 0, len(cards))
	for _, card := range cards {
		publicZone := card.Zone == "battlefield" || card.Zone == "graveyard" || card.Zone == "exile" || card.Zone == "command"
		refs = append(refs, logCardReference{ID: card.ID, Public: card.Revealed || publicZone && !card.FaceDown})
	}
	return refs
}

func referencesForIDs(m matchState, ids []string) []logCardReference {
	if len(ids) == 0 {
		return nil
	}
	byID := map[string]Card{}
	for _, player := range m.Players {
		for _, name := range []string{"library", "hand", "battlefield", "graveyard", "exile", "command", "consulted", "revealed"} {
			for _, card := range *zone(&player, name) {
				byID[card.ID] = card
			}
		}
	}
	cards := make([]Card, 0, len(ids))
	for _, id := range ids {
		if card, ok := byID[id]; ok {
			cards = append(cards, card)
		}
	}
	return referencesForCards(cards)
}

func mergeLogReferences(groups ...[]logCardReference) []logCardReference {
	var refs []logCardReference
	index := map[string]int{}
	for _, group := range groups {
		for _, ref := range group {
			if i, exists := index[ref.ID]; exists {
				refs[i].Public = refs[i].Public || ref.Public
				refs[i].Viewers = append(refs[i].Viewers, ref.Viewers...)
			} else {
				index[ref.ID] = len(refs)
				refs = append(refs, ref)
			}
		}
	}
	return refs
}

func currentLogCards(m matchState, viewerID int64) map[string]LogCard {
	cards := map[string]LogCard{}
	for _, player := range m.view(viewerID, nil).Players {
		for _, zone := range [][]VisibleCard{player.Hand, player.Battlefield, player.Graveyard, player.Exile, player.Command, player.Consulted, player.Revealed} {
			for _, card := range zone {
				if card.Name != "" {
					cards[card.ID] = LogCard{ID: card.ID, Name: card.Name}
				}
			}
		}
		for _, card := range player.ExposedCards {
			cards[card.ID] = LogCard{ID: card.ID, Name: card.Name}
		}
	}
	return cards
}

type queryer interface {
	QueryContext(context.Context, string, ...any) (*sql.Rows, error)
	QueryRowContext(context.Context, string, ...any) *sql.Row
}

type matchHistory struct {
	Entries       []MatchLog
	RoomCreatedAt *time.Time
	StartedAt     *time.Time
	FinishedAt    *time.Time
}

func matchLog(ctx context.Context, q queryer, roomID int64, m matchState, viewerID int64) (matchHistory, error) {
	history := matchHistory{Entries: []MatchLog{}}
	var created sql.NullTime
	if err := q.QueryRowContext(ctx, "SELECT MIN(created_at) FROM room_events WHERE room_id=? AND action='created'", roomID).Scan(&created); err != nil {
		return history, err
	}
	if created.Valid {
		history.RoomCreatedAt = &created.Time
	}

	rows, err := q.QueryContext(ctx, "SELECT actor_id,action,payload,created_at FROM match_events WHERE room_id=? ORDER BY id", roomID)
	if err != nil {
		return history, err
	}
	defer rows.Close()
	names := map[int64]string{}
	for _, p := range m.Players {
		names[p.UserID] = p.Name
	}
	visible := currentLogCards(m, viewerID)

	for rows.Next() {
		var actor int64
		var action string
		var raw []byte
		var at time.Time
		if err = rows.Scan(&actor, &action, &raw, &at); err != nil {
			return history, err
		}
		var p actionLogPayload
		if err = json.Unmarshal(raw, &p); err != nil {
			return history, err
		}
		if p.Kind == "" {
			p.Kind = action
		}
		if p.Kind == "started" && history.StartedAt == nil {
			stamp := at
			history.StartedAt = &stamp
		}
		if p.Kind == "finished" {
			stamp := at
			history.FinishedAt = &stamp
		}
		entry := MatchLog{DrawCount: p.DrawCount, LandPlays: p.LandPlays, ActorID: actor, ActorName: names[actor], Kind: p.Kind, From: p.From, To: p.To, Count: p.Count, Result: p.Result}
		for _, ref := range p.Cards {
			if ref.Public || actor == viewerID || slices.Contains(ref.Viewers, viewerID) {
				if card, ok := visible[ref.ID]; ok {
					entry.Cards = append(entry.Cards, card)
				}
			}
		}
		history.Entries = append(history.Entries, entry)
	}
	return history, rows.Err()
}
