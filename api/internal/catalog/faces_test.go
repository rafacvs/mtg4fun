package catalog_test

import (
	"os"
	"path/filepath"
	"reflect"
	"testing"

	"mtg4fun/internal/catalog"
)

func TestDatasetFacesResolveExistingTransformTargetsAndBackImage(t *testing.T) {
	directory := t.TempDir()
	cards := filepath.Join(directory, "cards.xml")
	tokens := filepath.Join(directory, "tokens.xml")
	data := `<cockatrice_carddatabase><cards><card><name>Day</name><set uuid="printing-id">TST</set><related attach="transform">Night</related><related attach="transform">Missing</related><related attach="token">Unrelated</related></card><card><name>Night</name><set uuid="printing-id">TST</set><prop><side>back</side></prop><related attach="transform">Day</related></card><card><name>Unrelated</name></card></cards></cockatrice_carddatabase>`
	if err := os.WriteFile(cards, []byte(data), 0600); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(tokens, []byte(`<cockatrice_carddatabase><cards/></cockatrice_carddatabase>`), 0600); err != nil {
		t.Fatal(err)
	}
	source, err := catalog.Load(cards, tokens)
	if err != nil {
		t.Fatal(err)
	}
	front, _ := source.Lookup("Day")
	back, _ := source.Lookup("Night")
	if !reflect.DeepEqual(front.Faces, []string{"Day", "Night"}) {
		t.Fatalf("faces: %v", front.Faces)
	}
	if front.ImageURL != "https://api.scryfall.com/cards/printing-id?format=image&face=front" || back.ImageURL != "https://api.scryfall.com/cards/printing-id?format=image&face=back" {
		t.Fatalf("imagem frente/verso: %q %q", front.ImageURL, back.ImageURL)
	}
}

func TestDatasetLinksTokensToTheirCreatingCards(t *testing.T) {
	directory := t.TempDir()
	cards := filepath.Join(directory, "cards.xml")
	tokens := filepath.Join(directory, "tokens.xml")
	if err := os.WriteFile(cards, []byte(`<cockatrice_carddatabase><cards><card><name>Mabel</name></card></cards></cockatrice_carddatabase>`), 0600); err != nil {
		t.Fatal(err)
	}
	data := `<cockatrice_carddatabase><cards><card><name>Cragflame</name><reverse-related>Mabel</reverse-related><reverse-related>Mabel</reverse-related><token>1</token></card><card><name>Missing creator token</name><reverse-related>Missing</reverse-related><token>1</token></card></cards></cockatrice_carddatabase>`
	if err := os.WriteFile(tokens, []byte(data), 0600); err != nil {
		t.Fatal(err)
	}
	source, err := catalog.Load(cards, tokens)
	if err != nil {
		t.Fatal(err)
	}
	mabel, _ := source.Lookup("Mabel")
	if !reflect.DeepEqual(mabel.CreatedTokens, []string{"Cragflame"}) {
		t.Fatalf("created tokens: %v", mabel.CreatedTokens)
	}
}
