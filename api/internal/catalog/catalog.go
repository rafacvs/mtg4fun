// Package catalog loads the shared Cockatrice XML card and token datasets into memory.
package catalog

import (
	"encoding/xml"
	"errors"
	"fmt"
	"io"
	"os"
	"sort"
	"strings"
)

type Card struct {
	Text      string
	Token     bool
	ImageURL  string
	Power     string
	Toughness string
}

type Catalog struct {
	cards map[string]Card
}

type datasetCard struct {
	Name  string       `xml:"name"`
	Text  string       `xml:"text"`
	Token string       `xml:"token"`
	Sets  []datasetSet `xml:"set"`
	Prop  struct {
		PT string `xml:"pt"`
	} `xml:"prop"`
}

type datasetSet struct {
	UUID   string `xml:"uuid,attr"`
	PicURL string `xml:"picURL,attr"`
}

// Load reads both datasets. Like Cockatrice, the first definition of a repeated name wins.
func Load(cardsPath, tokensPath string) (*Catalog, error) {
	catalog := &Catalog{cards: map[string]Card{}}
	for _, path := range []string{cardsPath, tokensPath} {
		if err := readDataset(path, func(card datasetCard) {
			if _, ok := catalog.cards[card.Name]; !ok {
				power, toughness, _ := strings.Cut(card.Prop.PT, "/")
				catalog.cards[card.Name] = Card{Text: card.Text, Token: card.Token == "1", ImageURL: imageURL(card.Sets), Power: power, Toughness: toughness}
			}
		}); err != nil {
			return nil, fmt.Errorf("catálogo %s: %w", path, err)
		}
	}
	if len(catalog.cards) == 0 {
		return nil, errors.New("catálogo vazio")
	}
	return catalog, nil
}

func imageURL(sets []datasetSet) string {
	for _, set := range sets {
		if set.PicURL != "" {
			return set.PicURL
		}
		if set.UUID != "" {
			return "https://api.scryfall.com/cards/" + set.UUID + "?format=image&face=front"
		}
	}
	return ""
}

func (c *Catalog) Lookup(name string) (Card, bool) {
	card, ok := c.cards[name]
	return card, ok
}

func readDataset(path string, accept func(datasetCard)) error {
	file, err := os.Open(path)
	if err != nil {
		return err
	}
	defer file.Close()
	decoder := xml.NewDecoder(file)
	depth := 0
	rootSeen := false
	cardsSeen := false
	for {
		token, err := decoder.Token()
		if err == io.EOF {
			break
		}
		if err != nil {
			return errors.New("XML de catálogo inválido")
		}
		switch node := token.(type) {
		case xml.StartElement:
			depth++
			if depth == 1 {
				if rootSeen || node.Name.Local != "cockatrice_carddatabase" {
					return errors.New("esperado cockatrice_carddatabase")
				}
				rootSeen = true
			}
			if depth == 2 && node.Name.Local == "cards" {
				cardsSeen = true
			}
			if depth == 3 && node.Name.Local == "card" && cardsSeen {
				var card datasetCard
				if err := decoder.DecodeElement(&card, &node); err != nil {
					return errors.New("carta XML inválida")
				}
				depth--
				if strings.TrimSpace(card.Name) == "" {
					return errors.New("carta sem nome")
				}
				accept(card)
			}
		case xml.CharData:
			if depth == 0 && strings.TrimSpace(string(node)) != "" {
				return errors.New("dados fora do XML de catálogo")
			}
		case xml.EndElement:
			depth--
			if depth == 1 {
				cardsSeen = false
			}
		}
	}
	if !rootSeen || depth != 0 {
		return errors.New("XML de catálogo vazio ou incompleto")
	}
	return nil
}

// Tokens returns an ordered, bounded view of the shared token catalogue.
func (c *Catalog) Tokens(query string) []string {
	names := []string{}
	query = strings.ToLower(query)
	for name, card := range c.cards {
		if card.Token && strings.Contains(strings.ToLower(name), query) {
			names = append(names, name)
		}
	}
	sort.Strings(names)
	if len(names) > 100 {
		names = names[:100]
	}
	return names
}
