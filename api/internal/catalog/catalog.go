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

type entry struct {
	name  string
	text  string
	token bool
	xml   strings.Builder
}

const (
	batchRows  = 500
	batchBytes = 1 << 20
)

// Import replaces the shared dataset atomically. Deck names and quantities remain intact.
// The full dataset exceeds MySQL's default redo log capacity, so rows are written in
// small committed batches to a staging table that replaces the current one by RENAME.
func Import(ctx context.Context, db *sql.DB, cardsPath, tokensPath string) error {
	entries, err := read(cardsPath, tokensPath)
	if err != nil {
		return err
	}
	for _, statement := range []string{
		"DROP TABLE IF EXISTS catalog_cards_import, catalog_cards_previous",
		"CREATE TABLE catalog_cards_import LIKE catalog_cards",
	} {
		if _, err := db.ExecContext(ctx, statement); err != nil {
			return err
		}
	}
	defer db.ExecContext(context.Background(), "DROP TABLE IF EXISTS catalog_cards_import")
	for start := 0; start < len(entries); {
		end, size := start, 0
		for end < len(entries) && end-start < batchRows && (end == start || size < batchBytes) {
			size += entries[end].xml.Len()
			end++
		}
		values := make([]any, 0, (end-start)*4)
		for _, entry := range entries[start:end] {
			values = append(values, entry.name, entry.text, entry.token, entry.xml.String())
		}
		placeholders := strings.TrimSuffix(strings.Repeat("(?,?,?,?),", end-start), ",")
		if _, err := db.ExecContext(ctx, "INSERT INTO catalog_cards_import (name, text, is_token, card_xml) VALUES "+placeholders, values...); err != nil {
			return err
		}
		start = end
	}
	if _, err := db.ExecContext(ctx, "RENAME TABLE catalog_cards TO catalog_cards_previous, catalog_cards_import TO catalog_cards"); err != nil {
		return err
	}
	_, err = db.ExecContext(ctx, "DROP TABLE catalog_cards_previous")
	return err
}

func read(cardsPath, tokensPath string) ([]*entry, error) {
	var entries []*entry
	byName := map[string]*entry{}
	for _, path := range []string{cardsPath, tokensPath} {
		if err := readDataset(path, func(card datasetCard) error {
			if existing, ok := byName[card.Name]; ok {
				// Cockatrice keeps the first definition and merges subsequent printings.
				for _, set := range card.Sets {
					data, err := xml.Marshal(set)
					if err != nil {
						return err
					}
					existing.xml.Write(data)
				}
				return nil
			}
			created := &entry{name: card.Name, text: card.Text, token: card.Token == "1"}
			created.xml.WriteString(card.XML)
			byName[card.Name] = created
			entries = append(entries, created)
			return nil
		}); err != nil {
			return nil, fmt.Errorf("catálogo %s: %w", path, err)
		}
	}
	if len(entries) == 0 {
		return nil, errors.New("catálogo vazio")
	}
	return entries, nil
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
