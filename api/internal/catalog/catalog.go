// Package catalog loads the shared Cockatrice XML card and token datasets into memory.
package catalog

import (
	"encoding/xml"
	"errors"
	"fmt"
	"io"
	"os"
	"strings"
)

type Card struct {
	Text  string
	Token bool
}

type Catalog struct {
	cards map[string]Card
}

type datasetCard struct {
	Name  string `xml:"name"`
	Text  string `xml:"text"`
	Token string `xml:"token"`
}

// Load reads both datasets. Like Cockatrice, the first definition of a repeated name wins.
func Load(cardsPath, tokensPath string) (*Catalog, error) {
	catalog := &Catalog{cards: map[string]Card{}}
	for _, path := range []string{cardsPath, tokensPath} {
		if err := readDataset(path, func(card datasetCard) {
			if _, ok := catalog.cards[card.Name]; !ok {
				catalog.cards[card.Name] = Card{Text: card.Text, Token: card.Token == "1"}
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
