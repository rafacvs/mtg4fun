package catalog

import "strings"

// A small, deterministic starting shelf keeps an empty search useful instead of
// opening on alphabetic novelty entries. These are examples, not deck rules or
// recommendations; filtering still searches every definition in the catalogue.
var starterCardOrder = func() map[string]int {
	names := []string{
		"Sol Ring", "Arcane Signet", "Command Tower", "Exotic Orchard",
		"Swords to Plowshares", "Path to Exile", "Counterspell", "Negate",
		"Arcane Denial", "Swan Song", "Beast Within", "Generous Gift",
		"Chaos Warp", "Nature's Claim", "Disenchant", "Return to Nature",
		"Cultivate", "Kodama's Reach", "Rampant Growth", "Farseek",
		"Nature's Lore", "Three Visits", "Sakura-Tribe Elder", "Llanowar Elves",
		"Elvish Mystic", "Birds of Paradise", "Lightning Bolt", "Brainstorm",
		"Ponder", "Preordain", "Opt", "Faithless Looting", "Read the Bones",
		"Sign in Blood", "Night's Whisper", "Harmonize", "Fact or Fiction",
		"Eternal Witness", "Solemn Simulacrum", "Swiftfoot Boots", "Lightning Greaves",
		"Wayfarer's Bauble", "Fellwar Stone", "Mind Stone", "Reliquary Tower",
		"Island", "Plains", "Swamp", "Mountain", "Forest",
	}
	order := make(map[string]int, len(names))
	for index, name := range names {
		order[name] = index
	}
	return order
}()

type SearchCard struct {
	Name          string `json:"name"`
	Type          string `json:"type"`
	MainType      string `json:"mainType"`
	CMC           int    `json:"cmc"`
	Colors        string `json:"colors"`
	ColorIdentity string `json:"colorIdentity"`
	Text          string `json:"text"`
	Token         bool   `json:"token"`
}

type SearchPage struct {
	Cards   []SearchCard `json:"cards"`
	Total   int          `json:"total"`
	Offset  int          `json:"offset"`
	Limit   int          `json:"limit"`
	HasMore bool         `json:"hasMore"`
}

// Search scans the shared catalogue without copying or sorting the matching set.
// Only the requested page is materialized. The ordered name index is built once
// at load time and reuses the catalogue's existing name strings.
func (c *Catalog) Search(query, mainType, color string, cmc *int, offset, limit int) SearchPage {
	if offset < 0 {
		offset = 0
	}
	if limit < 1 || limit > 50 {
		limit = 50
	}
	page := SearchPage{Cards: make([]SearchCard, 0, limit), Offset: offset, Limit: limit}
	query = strings.ToLower(strings.TrimSpace(query))
	mainType = strings.ToLower(strings.TrimSpace(mainType))
	color = strings.ToUpper(strings.TrimSpace(color))
	for _, name := range c.names {
		card := c.cards[name]
		if query != "" && !strings.Contains(strings.ToLower(name), query) && !strings.Contains(strings.ToLower(card.Text), query) {
			continue
		}
		if mainType != "" && !strings.EqualFold(card.Maintype, mainType) && !strings.Contains(strings.ToLower(card.Type), mainType) {
			continue
		}
		identity := strings.ToUpper(card.ColorIdentity)
		if (color == "C" && identity != "") || (color == "M" && len(identity) < 2) ||
			(color != "" && color != "C" && color != "M" && !strings.Contains(identity, color)) {
			continue
		}
		if cmc != nil && ((*cmc == -1 && card.CMC < 12) || (*cmc >= 0 && card.CMC != *cmc)) {
			continue
		}
		position := page.Total
		page.Total++
		if position < offset || len(page.Cards) == limit {
			continue
		}
		page.Cards = append(page.Cards, SearchCard{Name: name, Type: card.Type,
			MainType: card.Maintype, CMC: card.CMC, Colors: card.Colors,
			ColorIdentity: card.ColorIdentity, Text: card.Text, Token: card.Token})
	}
	page.HasMore = page.Offset+len(page.Cards) < page.Total
	return page
}
