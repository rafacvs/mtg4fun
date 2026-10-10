package decks

import (
	"encoding/xml"
	"errors"
	"io"
	"strconv"
	"strings"
)

type entry struct {
	Name   string `xml:"name,attr"`
	Number string `xml:"number,attr"`
}
type zone struct {
	Name  string  `xml:"name,attr"`
	Cards []entry `xml:"card"`
	Zones []zone  `xml:"zone"`
}

func parse(reader io.Reader, fallback string) (Deck, error) {
	var document struct {
		XMLName xml.Name `xml:"cockatrice_deck"`
		Name    string   `xml:"deckname"`
		Zones   []zone   `xml:"zone"`
	}
	decoder := xml.NewDecoder(reader)
	if err := decoder.Decode(&document); err != nil {
		return Deck{}, errors.New("Arquivo .cod inválido: esperado XML Cockatrice.")
	}
	for {
		token, err := decoder.Token()
		if err == io.EOF {
			break
		}
		if err != nil {
			return Deck{}, errors.New("Arquivo .cod inválido.")
		}
		if _, ok := token.(xml.Comment); ok {
			continue
		}
		if _, ok := token.(xml.ProcInst); ok {
			continue
		}
		if data, ok := token.(xml.CharData); !ok || strings.TrimSpace(string(data)) != "" {
			return Deck{}, errors.New("Arquivo .cod contém dados após o deck.")
		}
	}
	deck := Deck{Name: strings.TrimSpace(document.Name), Cards: []Card{}}
	if deck.Name == "" {
		deck.Name = fallback
	}
	positions := map[string]int{}
	var collect func(zone) error
	collect = func(z zone) error {
		for _, input := range z.Cards {
			quantity, err := strconv.ParseInt(input.Number, 10, 32)
			if err != nil || quantity <= 0 || strings.TrimSpace(input.Name) == "" {
				return errors.New("Carta sem nome ou quantidade inválida na seção principal.")
			}
			if position, ok := positions[input.Name]; ok {
				deck.Cards[position].Quantity += quantity
			} else {
				positions[input.Name] = len(deck.Cards)
				deck.Cards = append(deck.Cards, Card{Name: input.Name, Quantity: quantity})
			}
		}
		for _, child := range z.Zones {
			if err := collect(child); err != nil {
				return err
			}
		}
		return nil
	}
	for _, z := range document.Zones {
		if z.Name == "main" {
			if err := collect(z); err != nil {
				return Deck{}, err
			}
		}
	}
	if len(deck.Cards) == 0 {
		return Deck{}, errors.New("O deck precisa de cartas na seção principal (main).")
	}
	return deck, nil
}
