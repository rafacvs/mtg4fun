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
	"time"
)

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
	persisted := decodeListedDeck(t, list.body)
	if persisted.Commander != "" || persisted.ColorIdentity != "" {
		t.Fatalf("deck antigo deveria nascer sem comandante: %s", list.body)
	}
	if !hasCard(persisted.Groups.Lands, "Island", 5) || !hasCard(persisted.Groups.Spells, "Fire // Ice", 1) || !hasCard(persisted.Groups.Lands, "Urza's Saga", 1) {
		t.Fatalf("listagem deveria resolver grupos no catálogo: %s", list.body)
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
	e.stop()
	e.cards = dataset
	e.start(false)
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
	requireStatus(t, e.uploadDeck(cookie, nested), 201)
}

func TestServerRefusesInvalidCatalog(t *testing.T) {
	e := newEnvironment(t)
	invalid := e.command("serve", "--addr", "127.0.0.1:0", "--web", e.web, "--cards", "testdata/cockatrice-deck.cod", "--tokens", e.tokens)
	var output bytes.Buffer
	invalid.Stdout, invalid.Stderr = &output, &output
	if err := invalid.Start(); err != nil {
		t.Fatal(err)
	}
	done := make(chan error, 1)
	go func() { done <- invalid.Wait() }()
	select {
	case err := <-done:
		if err == nil || !strings.Contains(output.String(), "esperado cockatrice_carddatabase") {
			t.Fatalf("catálogo inválido aceito: %v; %s", err, output.String())
		}
	case <-time.After(10 * time.Second):
		_ = invalid.Process.Kill()
		<-done
		t.Fatalf("servidor iniciou com catálogo inválido: %s", output.String())
	}
}

func TestBundledCatalogResolvesPlayedDecks(t *testing.T) {
	e := newEnvironment(t)
	e.mustCreate("rafa", "Rafa", "senha-segura-de-teste")
	e.cards, e.tokens = "../../catalog/cards.xml", "../../catalog/tokens.xml"
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
	e.tokens = "testdata/magic-token-excerpt.xml"
	e.start(false)
	cookie := sessionCookie(t, e.login("rafa", "senha-segura-de-teste"))
	contents := []byte(`<cockatrice_deck version="1"><zone name="main"><card number="1" name="Bird Soldier Token"/><card number="1" name="Fire // Ice"/></zone></cockatrice_deck>`)
	result := e.uploadDeck(cookie, contents)
	requireStatus(t, result, 201)
	if !bytes.Contains(result.body, []byte(`"token":true`)) {
		t.Fatalf("ficha oficial não resolvida: %s", result.body)
	}
}

func TestDeckListingResolvesGroupsAndCurveFromCatalog(t *testing.T) {
	e := newEnvironment(t)
	e.mustCreate("rafa", "Rafa", "senha-segura-de-teste")
	e.start(false)
	cookie := sessionCookie(t, e.login("rafa", "senha-segura-de-teste"))
	uploaded := e.uploadDeck(cookie, []byte(`<cockatrice_deck><deckname>Hidras</deckname><zone name="main"><card number="5" name="Island"/><card number="1" name="Fire // Ice"/><card number="1" name="Gargos, Vicious Watcher"/></zone></cockatrice_deck>`))
	requireStatus(t, uploaded, 201)
	listed := e.request("GET", "/api/decks", "", cookie, nil)
	requireStatus(t, listed, 200)
	deck := decodeListedDeck(t, listed.body)
	if deck.Commander != "" || deck.ColorIdentity != "" {
		t.Fatalf("deck sem comandante não pode ter identidade: %s", listed.body)
	}
	if !hasCard(deck.Groups.Lands, "Island", 5) {
		t.Fatalf("Island deveria ser terreno: %s", listed.body)
	}
	if !hasCard(deck.Groups.Spells, "Fire // Ice", 1) {
		t.Fatalf("Instant deveria ser mágica: %s", listed.body)
	}
	if !hasCard(deck.Groups.Creatures, "Gargos, Vicious Watcher", 1) {
		t.Fatalf("Gargos deveria ser criatura até ser comandante: %s", listed.body)
	}
	if len(deck.Groups.Commander) != 0 {
		t.Fatalf("sem comandante o grupo comandante deveria estar vazio: %s", listed.body)
	}
	if len(deck.Curve) != 3 || deck.Curve[0] != (curveBin{CMC: 0, Count: 5}) || deck.Curve[1] != (curveBin{CMC: 4, Count: 1}) || deck.Curve[2] != (curveBin{CMC: 6, Count: 1}) {
		t.Fatalf("curva deveria contar o CMC do catálogo: %s", listed.body)
	}
}

func TestDeckCommanderPersistsAndLeavesTypeGroup(t *testing.T) {
	e := newEnvironment(t)
	e.mustCreate("rafa", "Rafa", "senha-segura-de-teste")
	e.start(false)
	cookie := sessionCookie(t, e.login("rafa", "senha-segura-de-teste"))
	uploaded := e.uploadDeck(cookie, []byte(`<cockatrice_deck><deckname>Hidras</deckname><zone name="main"><card number="5" name="Island"/><card number="1" name="Fire // Ice"/><card number="1" name="Gargos, Vicious Watcher"/></zone></cockatrice_deck>`))
	requireStatus(t, uploaded, 201)
	var created struct {
		Deck struct {
			ID int64 `json:"id"`
		} `json:"deck"`
	}
	if err := json.Unmarshal(uploaded.body, &created); err != nil {
		t.Fatal(err)
	}
	marked := e.request("PUT", "/api/decks/"+strconv.FormatInt(created.Deck.ID, 10)+"/commander", `{"name":"Gargos, Vicious Watcher"}`, cookie, nil)
	requireStatus(t, marked, 200)
	e.stop()
	e.start(false)
	listed := e.request("GET", "/api/decks", "", cookie, nil)
	requireStatus(t, listed, 200)
	deck := decodeListedDeck(t, listed.body)
	if deck.Commander != "Gargos, Vicious Watcher" || deck.ColorIdentity != "G" {
		t.Fatalf("comandante deveria persistir com a identidade do catálogo: %s", listed.body)
	}
	if !hasCard(deck.Groups.Commander, "Gargos, Vicious Watcher", 1) {
		t.Fatalf("Gargos deveria estar no grupo comandante: %s", listed.body)
	}
	if hasCard(deck.Groups.Creatures, "Gargos, Vicious Watcher", 1) {
		t.Fatalf("comandante não pode permanecer no grupo do tipo: %s", listed.body)
	}
	if len(deck.Curve) != 2 || deck.Curve[0] != (curveBin{CMC: 0, Count: 5}) || deck.Curve[1] != (curveBin{CMC: 4, Count: 1}) {
		t.Fatalf("curva do 99 não inclui o comandante: %s", listed.body)
	}
}

func TestDeckRejectsCommanderMissingFromList(t *testing.T) {
	e := newEnvironment(t)
	e.mustCreate("rafa", "Rafa", "senha-segura-de-teste")
	e.start(false)
	cookie := sessionCookie(t, e.login("rafa", "senha-segura-de-teste"))
	uploaded := e.uploadDeck(cookie, []byte(`<cockatrice_deck><deckname>Hidras</deckname><zone name="main"><card number="5" name="Island"/><card number="1" name="Fire // Ice"/><card number="1" name="Gargos, Vicious Watcher"/></zone></cockatrice_deck>`))
	requireStatus(t, uploaded, 201)
	var created struct {
		Deck struct {
			ID int64 `json:"id"`
		} `json:"deck"`
	}
	if err := json.Unmarshal(uploaded.body, &created); err != nil {
		t.Fatal(err)
	}
	rejected := e.request("PUT", "/api/decks/"+strconv.FormatInt(created.Deck.ID, 10)+"/commander", `{"name":"Urza's Saga"}`, cookie, nil)
	requireStatus(t, rejected, 400)
	if !bytes.Contains(rejected.body, []byte("Carta não encontrada neste deck.")) {
		t.Fatalf("nome fora da lista deveria ser recusado: %s", rejected.body)
	}
	listed := e.request("GET", "/api/decks", "", cookie, nil)
	requireStatus(t, listed, 200)
	deck := decodeListedDeck(t, listed.body)
	if deck.Commander != "" || deck.ColorIdentity != "" || hasCard(deck.Groups.Commander, "Urza's Saga", 1) {
		t.Fatalf("comandante fantasma foi gravado: %s", listed.body)
	}
}

func TestDeckClearingCommanderRestoresTypeGroup(t *testing.T) {
	e := newEnvironment(t)
	e.mustCreate("rafa", "Rafa", "senha-segura-de-teste")
	e.start(false)
	cookie := sessionCookie(t, e.login("rafa", "senha-segura-de-teste"))
	uploaded := e.uploadDeck(cookie, []byte(`<cockatrice_deck><deckname>Hidras</deckname><zone name="main"><card number="5" name="Island"/><card number="1" name="Fire // Ice"/><card number="1" name="Gargos, Vicious Watcher"/></zone></cockatrice_deck>`))
	requireStatus(t, uploaded, 201)
	var created struct {
		Deck struct {
			ID int64 `json:"id"`
		} `json:"deck"`
	}
	if err := json.Unmarshal(uploaded.body, &created); err != nil {
		t.Fatal(err)
	}
	path := "/api/decks/" + strconv.FormatInt(created.Deck.ID, 10) + "/commander"
	requireStatus(t, e.request("PUT", path, `{"name":"Gargos, Vicious Watcher"}`, cookie, nil), 200)
	cleared := e.request("PUT", path, `{"name":""}`, cookie, nil)
	requireStatus(t, cleared, 200)
	listed := e.request("GET", "/api/decks", "", cookie, nil)
	requireStatus(t, listed, 200)
	deck := decodeListedDeck(t, listed.body)
	if deck.Commander != "" || deck.ColorIdentity != "" {
		t.Fatalf("limpar deveria tirar identidade: %s", listed.body)
	}
	if len(deck.Groups.Commander) != 0 {
		t.Fatalf("grupo comandante deveria ficar vazio: %s", listed.body)
	}
	if !hasCard(deck.Groups.Creatures, "Gargos, Vicious Watcher", 1) {
		t.Fatalf("Gargos deveria voltar às criaturas: %s", listed.body)
	}
}

type listedCard struct {
	Name     string `json:"name"`
	Quantity int64  `json:"quantity"`
}

type listedGroups struct {
	Commander []listedCard `json:"commander"`
	Creatures []listedCard `json:"creatures"`
	Spells    []listedCard `json:"spells"`
	Artifacts []listedCard `json:"artifacts"`
	Lands     []listedCard `json:"lands"`
	Other     []listedCard `json:"other"`
}

type curveBin struct {
	CMC   int   `json:"cmc"`
	Count int64 `json:"count"`
}

type listedDeck struct {
	Name          string       `json:"name"`
	Commander     string       `json:"commander"`
	ColorIdentity string       `json:"colorIdentity"`
	Curve         []curveBin   `json:"curve"`
	Groups        listedGroups `json:"groups"`
}

func decodeListedDeck(t *testing.T, body []byte) listedDeck {
	t.Helper()
	var payload struct {
		Decks []listedDeck `json:"decks"`
	}
	if err := json.Unmarshal(body, &payload); err != nil {
		t.Fatal(err)
	}
	if len(payload.Decks) != 1 {
		t.Fatalf("esperado 1 deck, veio %d: %s", len(payload.Decks), body)
	}
	return payload.Decks[0]
}

func hasCard(cards []listedCard, name string, quantity int64) bool {
	for _, card := range cards {
		if card.Name == name && card.Quantity == quantity {
			return true
		}
	}
	return false
}
