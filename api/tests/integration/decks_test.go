package integration_test

import (
	"bytes"
	"encoding/json"
	"encoding/xml"
	"mime/multipart"
	"net/http"
	"os"
	"path/filepath"
	"strconv"
	"strings"
	"testing"
)

func (e *environment) importCatalog(cards string) {
	e.t.Helper()
	output, err := e.command("import-catalog", "--cards", cards, "--tokens", "testdata/tokens.xml").CombinedOutput()
	if err != nil {
		e.t.Fatalf("importar catálogo: %v; %s", err, output)
	}
}
func (e *environment) uploadDeck(cookie *http.Cookie, contents []byte) response {
	var body bytes.Buffer
	writer := multipart.NewWriter(&body)
	part, _ := writer.CreateFormFile("file", "amigos.cod")
	_, _ = part.Write(contents)
	_ = writer.Close()
	return e.request("POST", "/api/decks", body.String(), cookie, map[string]string{"Content-Type": writer.FormDataContentType()})
}
func TestDeckImportIsolationAndPersistence(t *testing.T) {
	e := newEnvironment(t)
	e.mustCreate("rafa", "Rafa", "senha-segura-de-teste")
	e.mustCreate("amigo", "Amigo", "senha-segura-de-teste")
	e.importCatalog("testdata/cards.xml")
	e.start(false)
	owner := sessionCookie(t, e.login("rafa", "senha-segura-de-teste"))
	other := sessionCookie(t, e.login("amigo", "senha-segura-de-teste"))
	contents, err := os.ReadFile("testdata/cockatrice-deck.cod")
	if err != nil {
		t.Fatal(err)
	}
	requireStatus(t, e.uploadDeck(nil, contents), 401)
	uploaded := e.uploadDeck(owner, contents)
	requireStatus(t, uploaded, 201)
	var payload struct {
		Deck struct {
			ID    int64  `json:"id"`
			Name  string `json:"name"`
			Cards []struct {
				Name     string `json:"name"`
				Quantity int64  `json:"quantity"`
				Text     string `json:"text"`
			} `json:"cards"`
		} `json:"deck"`
	}
	if err := json.Unmarshal(uploaded.body, &payload); err != nil {
		t.Fatal(err)
	}
	if payload.Deck.Name != "Amigos & mágicas" || len(payload.Deck.Cards) != 3 || payload.Deck.Cards[0].Name != "Island" || payload.Deck.Cards[0].Quantity != 5 || payload.Deck.Cards[0].Text != "Add U." {
		t.Fatalf("importação incorreta: %s", uploaded.body)
	}
	path := "/api/decks/" + strconv.FormatInt(payload.Deck.ID, 10)
	requireStatus(t, e.request("DELETE", path, "", other, nil), 404)
	if list := e.request("GET", "/api/decks", "", other, nil); string(list.body) != "{\"decks\":[]}\n" {
		t.Fatalf("biblioteca privada vazou: %s", list.body)
	}
	e.stop()
	e.start(false)
	list := e.request("GET", "/api/decks", "", owner, nil)
	requireStatus(t, list, 200)
	if !bytes.Contains(list.body, []byte("Island")) {
		t.Fatalf("deck perdido: %s", list.body)
	}
	original, err := os.ReadFile("testdata/cards.xml")
	if err != nil {
		t.Fatal(err)
	}
	updated := strings.ReplaceAll(string(original), "Add U.", "Updated Island text.")
	start := strings.Index(updated, "<card><name>Fire // Ice")
	end := strings.Index(updated[start:], "</card>") + start + len("</card>")
	updated = updated[:start] + updated[end:]
	dataset := filepath.Join(t.TempDir(), "updated.xml")
	if err := os.WriteFile(dataset, []byte(updated), 0600); err != nil {
		t.Fatal(err)
	}
	e.importCatalog(dataset)
	changed := e.request("GET", "/api/decks", "", owner, nil)
	requireStatus(t, changed, 200)
	if !bytes.Contains(changed.body, []byte("Updated Island text.")) || !bytes.Contains(changed.body, []byte(`"name":"Fire // Ice","quantity":1,"text":"","token":false,"available":false`)) {
		t.Fatalf("atualização perdeu biblioteca: %s", changed.body)
	}
	e.stop()
	e.start(false)
	changed = e.request("GET", "/api/decks", "", owner, nil)
	requireStatus(t, changed, 200)
	if !bytes.Contains(changed.body, []byte("Updated Island text.")) {
		t.Fatalf("catálogo não durável: %s", changed.body)
	}
	requireStatus(t, e.request("DELETE", path, "", owner, nil), 204)
	if list := e.request("GET", "/api/decks", "", owner, nil); string(list.body) != "{\"decks\":[]}\n" {
		t.Fatalf("deck não excluído: %s", list.body)
	}
}

func TestDeckRejectsInvalidFilesAndFailedWrites(t *testing.T) {
	e := newEnvironment(t)
	e.mustCreate("rafa", "Rafa", "senha-segura-de-teste")
	e.importCatalog("testdata/cards.xml")
	e.start(false)
	cookie := sessionCookie(t, e.login("rafa", "senha-segura-de-teste"))
	for _, contents := range []string{
		"not xml", `<cockatrice_deck><zone name="main"><card number="0" name="Island"/></zone></cockatrice_deck>`,
		`<cockatrice_deck><zone name="main"><card number="-1" name="Island"/></zone></cockatrice_deck>`,
		`<cockatrice_deck><zone name="main"><card number="many" name="Island"/></zone></cockatrice_deck>`,
		`<cockatrice_deck><zone name="main"><card number="1" name="Unknown"/></zone></cockatrice_deck>`,
		`<cockatrice_deck><zone name="side"><card number="1" name="Island"/></zone></cockatrice_deck>`,
		`<cockatrice_deck/> <cockatrice_deck/>`,
		string(bytes.Repeat([]byte("x"), 2*1024*1024+1)),
	} {
		requireStatus(t, e.uploadDeck(cookie, []byte(contents)), 400)
	}
	requireStatus(t, e.request("POST", "/api/decks", "{}", cookie, nil), 400)
	fixture, err := os.ReadFile("testdata/cockatrice-deck.cod")
	if err != nil {
		t.Fatal(err)
	}
	requireStatus(t, e.request("POST", "/api/decks", "", cookie, map[string]string{"Origin": "https://evil.invalid"}), 403)
	e.sql("REVOKE INSERT ON " + e.db + ".* FROM '" + e.db + "'@'%'")
	e.sql("GRANT INSERT ON " + e.db + ".decks TO '" + e.db + "'@'%'")
	e.disconnectDatabaseConnections()
	requireStatus(t, e.uploadDeck(cookie, fixture), 500)
	list := e.request("GET", "/api/decks", "", cookie, nil)
	requireStatus(t, list, 200)
	if string(list.body) != "{\"decks\":[]}\n" {
		t.Fatalf("falha persistiu deck parcial: %s", list.body)
	}
	e.sql("GRANT INSERT ON " + e.db + ".* TO '" + e.db + "'@'%'")
	e.disconnectDatabaseConnections()
	nested := []byte(`<cockatrice_deck><deckname>Categorias</deckname><zone name="main"><zone name="Lands"><card number="2" name="Island"/></zone><card number="1" name="Soldier Token"/></zone></cockatrice_deck>`)
	result := e.uploadDeck(cookie, nested)
	requireStatus(t, result, 201)
	if !bytes.Contains(result.body, []byte(`"token":true`)) {
		t.Fatalf("fichas não resolvidas: %s", result.body)
	}
	invalid := e.command("import-catalog", "--cards", "testdata/cockatrice-deck.cod", "--tokens", "testdata/tokens.xml")
	if output, err := invalid.CombinedOutput(); err == nil {
		t.Fatalf("catálogo inválido aceito: %s", output)
	}
	requireStatus(t, e.uploadDeck(cookie, nested), 201)
}

func TestBundledCatalogResolvesPlayedDecks(t *testing.T) {
	e := newEnvironment(t)
	e.mustCreate("rafa", "Rafa", "senha-segura-de-teste")
	output, err := e.command("import-catalog", "--cards", "../../catalog/cards.xml", "--tokens", "../../catalog/tokens.xml").CombinedOutput()
	if err != nil {
		t.Fatalf("catálogo do repositório: %v; %s", err, output)
	}
	e.start(false)
	cookie := sessionCookie(t, e.login("rafa", "senha-segura-de-teste"))
	paths, err := filepath.Glob("testdata/decks/*.cod")
	if err != nil || len(paths) == 0 {
		t.Fatalf("decks de referência ausentes: %v", err)
	}
	for _, path := range paths {
		contents, err := os.ReadFile(path)
		if err != nil {
			t.Fatal(err)
		}
		var file struct {
			Zones []struct {
				Name  string `xml:"name,attr"`
				Cards []struct {
					Number int64 `xml:"number,attr"`
				} `xml:"card"`
			} `xml:"zone"`
		}
		if err := xml.Unmarshal(contents, &file); err != nil {
			t.Fatalf("%s: %v", path, err)
		}
		var expected int64
		for _, zone := range file.Zones {
			if zone.Name == "main" {
				for _, card := range zone.Cards {
					expected += card.Number
				}
			}
		}
		result := e.uploadDeck(cookie, contents)
		if result.status != 201 {
			t.Fatalf("%s: status %d; %s", path, result.status, result.body)
		}
		var payload struct {
			Deck struct {
				Cards []struct {
					Quantity  int64 `json:"quantity"`
					Available bool  `json:"available"`
				} `json:"cards"`
			} `json:"deck"`
		}
		if err := json.Unmarshal(result.body, &payload); err != nil {
			t.Fatal(err)
		}
		var total int64
		for _, card := range payload.Deck.Cards {
			if !card.Available {
				t.Fatalf("%s: carta indisponível; %s", path, result.body)
			}
			total += card.Quantity
		}
		if total != expected {
			t.Fatalf("%s: %d cartas importadas, esperado %d", path, total, expected)
		}
	}
}

func TestOfficialCockatriceDatasetsResolveCardsAndTokens(t *testing.T) {
	e := newEnvironment(t)
	e.mustCreate("rafa", "Rafa", "senha-segura-de-teste")
	output, err := e.command("import-catalog", "--cards", "testdata/cards.xml", "--tokens", "testdata/magic-token-excerpt.xml").CombinedOutput()
	if err != nil {
		t.Fatalf("dataset oficial: %v; %s", err, output)
	}
	e.start(false)
	cookie := sessionCookie(t, e.login("rafa", "senha-segura-de-teste"))
	contents := []byte(`<cockatrice_deck version="1"><zone name="main"><card number="1" name="Bird Soldier Token"/><card number="1" name="Fire // Ice"/></zone></cockatrice_deck>`)
	result := e.uploadDeck(cookie, contents)
	requireStatus(t, result, 201)
	if !bytes.Contains(result.body, []byte(`"token":true`)) {
		t.Fatalf("ficha oficial não resolvida: %s", result.body)
	}
}
