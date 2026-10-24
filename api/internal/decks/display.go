package decks

import (
	"sort"

	"mtg4fun/internal/catalog"
)

func summarize(cards []Card, commander string, cardsCatalog *catalog.Catalog) (Groups, []CurveBin, string) {
	groups := Groups{
		Commander: []Card{},
		Creatures: []Card{},
		Spells:    []Card{},
		Artifacts: []Card{},
		Lands:     []Card{},
		Other:     []Card{},
	}
	counts := map[int]int64{}
	identity := ""
	for _, card := range cards {
		entry, _ := cardsCatalog.Lookup(card.Name)
		remaining := card
		if commander != "" && card.Name == commander && remaining.Quantity > 0 {
			marked := card
			marked.Quantity = 1
			groups.Commander = append(groups.Commander, marked)
			remaining.Quantity--
			identity = entry.ColorIdentity
		}
		if remaining.Quantity == 0 {
			continue
		}
		switch entry.Maintype {
		case "Creature":
			groups.Creatures = append(groups.Creatures, remaining)
		case "Instant", "Sorcery":
			groups.Spells = append(groups.Spells, remaining)
		case "Artifact":
			groups.Artifacts = append(groups.Artifacts, remaining)
		case "Land":
			groups.Lands = append(groups.Lands, remaining)
		default:
			groups.Other = append(groups.Other, remaining)
		}
		counts[entry.CMC] += remaining.Quantity
	}
	cmcs := make([]int, 0, len(counts))
	for cmc := range counts {
		cmcs = append(cmcs, cmc)
	}
	sort.Ints(cmcs)
	curve := make([]CurveBin, 0, len(cmcs))
	for _, cmc := range cmcs {
		curve = append(curve, CurveBin{CMC: cmc, Count: counts[cmc]})
	}
	return groups, curve, identity
}

func (s *Service) present(deck *Deck) {
	deck.Groups, deck.Curve, deck.ColorIdentity = summarize(deck.Cards, deck.Commander, s.catalog)
}
