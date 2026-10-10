// Package catalog imports the shared Cockatrice XML card and token datasets.
package catalog

import (
	"context"
	"database/sql"
	"encoding/xml"
	"errors"
	"fmt"
	"io"
	"os"
	"strings"
)

type printing struct {
	XMLName    xml.Name   `xml:"set"`
	Attributes []xml.Attr `xml:",any,attr"`
	Content    string     `xml:",innerxml"`
}

type datasetCard struct {
	Sets  []printing `xml:"set" json:"-"`
	Name  string     `xml:"name" json:"name"`
	Text  string     `xml:"text" json:"text"`
	Token string     `xml:"token" json:"-"`
	XML   string     `xml:",innerxml" json:"-"`
}

// Import replaces the shared dataset atomically. Deck names and quantities remain intact.
func Import(ctx context.Context, db *sql.DB, cardsPath, tokensPath string) error {
	tx, err := db.BeginTx(ctx, nil)
	if err != nil {
		return err
	}
	defer tx.Rollback()
	if _, err = tx.ExecContext(ctx, "DELETE FROM catalog_cards"); err != nil {
		return err
	}
	count := 0
	seen := map[string]bool{}
	for _, path := range []string{cardsPath, tokensPath} {
		if err = readDataset(path, func(card datasetCard) error {
			if seen[card.Name] {
				// Cockatrice keeps the first definition and merges subsequent printings.
				var extra strings.Builder
				for _, set := range card.Sets {
					data, err := xml.Marshal(set)
					if err != nil {
						return err
					}
					extra.Write(data)
				}
				_, err := tx.ExecContext(ctx, "UPDATE catalog_cards SET card_xml=CONCAT(card_xml,?) WHERE name=?", extra.String(), card.Name)
				return err
			}
			seen[card.Name] = true
			_, err := tx.ExecContext(ctx, "INSERT INTO catalog_cards (name, text, is_token, card_xml) VALUES (?, ?, ?, ?)", card.Name, card.Text, card.Token == "1", card.XML)
			count++
			return err
		}); err != nil {
			return fmt.Errorf("catálogo %s: %w", path, err)
		}
	}
	if count == 0 {
		return errors.New("catálogo vazio")
	}
	return tx.Commit()
}

func readDataset(path string, accept func(datasetCard) error) error {
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
				if err := accept(card); err != nil {
					return err
				}
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
