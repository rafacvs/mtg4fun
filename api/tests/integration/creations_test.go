package integration_test

import (
	"bytes"
	"encoding/json"
	"fmt"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"strings"
	"sync/atomic"
	"testing"
)

type creationCard struct {
	ID           string `json:"id"`
	Name         string `json:"name"`
	Text         string `json:"text"`
	Power        int64  `json:"power"`
	Toughness    int64  `json:"toughness"`
	ImageName    string `json:"imageName"`
	InstanceKind string `json:"instanceKind"`
	OwnerID      int64  `json:"ownerId"`
	ControllerID int64  `json:"controllerId"`
	Zone         string `json:"zone"`
}
type creationPlayer struct {
	UserID      int64          `json:"userId"`
	Battlefield []creationCard `json:"battlefield"`
	Graveyard   []creationCard `json:"graveyard"`
	Hand        []creationCard `json:"hand"`
	Consulted   []creationCard `json:"consulted"`
}

func creationPlayers(t *testing.T, result response) []creationPlayer {
	t.Helper()
	requireStatus(t, result, 200)
	var payload struct {
		Match struct {
			Players []creationPlayer `json:"players"`
		} `json:"match"`
	}
	if err := json.Unmarshal(result.body, &payload); err != nil {
		t.Fatal(err)
	}
	return payload.Match.Players
}
func prepareCreationMatch(t *testing.T) (*environment, []*http.Cookie, string) {
	t.Helper()
	e := newEnvironment(t)
	for _, name := range []string{"criador", "oponente", "fora"} {
		e.mustCreate(name, name, "senha-da-mesa")
	}
	e.start(false)
	cookies := []*http.Cookie{}
	for _, name := range []string{"criador", "oponente", "fora"} {
		cookies = append(cookies, sessionCookie(t, e.login(name, "senha-da-mesa")))
	}
	room := e.request("POST", "/api/rooms", "{}", cookies[0], nil)
	requireStatus(t, room, 201)
	path := fmt.Sprintf("/api/rooms/%d", decodeRoom(t, room).ID)
	requireStatus(t, e.request("POST", path+"/participants", "{}", cookies[1], nil), 200)
	for _, cookie := range cookies[:2] {
		result := e.uploadDeck(cookie, []byte(`<cockatrice_deck><zone name="main"><card number="2" name="Island"/></zone></cockatrice_deck>`))
		requireStatus(t, result, 201)
		var payload struct {
			Deck struct {
				ID int64 `json:"id"`
			} `json:"deck"`
		}
		if err := json.Unmarshal(result.body, &payload); err != nil {
			t.Fatal(err)
		}
		requireStatus(t, e.request("PUT", path+"/participants/me/ready", fmt.Sprintf(`{"deckId":%d}`, payload.Deck.ID), cookie, nil), 200)
	}
	requireStatus(t, e.request("POST", path+"/start", "{}", cookies[0], nil), 201)
	return e, cookies, path + "/match"
}
func TestCatalogTokenCreationIsPublicAndDurable(t *testing.T) {
	e, cookies, path := prepareCreationMatch(t)
	requireStatus(t, e.request("GET", path+"/tokens?q=Soldier", "", nil, nil), 401)
	requireStatus(t, e.request("GET", path+"/tokens?q=Soldier", "", cookies[2], nil), 404)
	result := e.request("GET", path+"/tokens?q=soldier", "", cookies[0], nil)
	requireStatus(t, result, 200)
	var payload struct {
		Tokens []struct {
			Name      string `json:"name"`
			Power     string `json:"power"`
			Toughness string `json:"toughness"`
		} `json:"tokens"`
	}
	if err := json.Unmarshal(result.body, &payload); err != nil {
		t.Fatal(err)
	}
	if len(payload.Tokens) != 1 || payload.Tokens[0].Name != "Soldier Token" || payload.Tokens[0].Power != "1" || payload.Tokens[0].Toughness != "1" {
		t.Fatalf("catálogo: %s", result.body)
	}
	body := `{"intentId":"10000000-0000-4000-8000-000000000001","kind":"create-token","tokenName":"Soldier Token"}`
	requireStatus(t, e.request("POST", path+"/actions", body, cookies[2], nil), 404)
	first := creationPlayers(t, e.request("POST", path+"/actions", body, cookies[0], nil))[0]
	if len(first.Battlefield) != 1 {
		t.Fatalf("criação: %+v", first)
	}
	card := first.Battlefield[0]
	if card.ID == "" || card.OwnerID != first.UserID || card.ControllerID != first.UserID || card.Zone != "battlefield" || card.ImageName != "Soldier Token" || card.InstanceKind != "token" || card.Power != 1 {
		t.Fatalf("ficha: %+v", card)
	}
	observer := creationPlayers(t, e.request("GET", path, "", cookies[1], nil))[0]
	if len(observer.Battlefield) != 1 || observer.Battlefield[0] != card {
		t.Fatalf("sincronização: %+v", observer)
	}
	before := e.request("GET", path, "", cookies[0], nil)
	e.stop()
	e.start(false)
	replayed := e.request("POST", path+"/actions", body, cookies[0], nil)
	if !bytes.Equal(before.body, replayed.body) {
		t.Fatalf("reenvio alterou estado/log: antes=%s depois=%s", before.body, replayed.body)
	}
	repeated := creationPlayers(t, e.request("POST", path+"/actions", body, cookies[0], nil))[0]
	if len(repeated.Battlefield) != 1 || repeated.Battlefield[0] != card {
		t.Fatalf("recuperação/reenvio: %+v", repeated)
	}
}

func TestCustomTokensAndCopiesAreIndependentAndRecoverable(t *testing.T) {
	e, cookies, path := prepareCreationMatch(t)
	number := 0
	action := func(cookie *http.Cookie, fields string) response {
		number++
		return e.request("POST", path+"/actions", fmt.Sprintf(`{"intentId":"%08x-0000-4000-8000-000000000000",%s}`, number, fields), cookie, nil)
	}
	source := creationPlayers(t, action(cookies[0], `"kind":"create-custom-token","name":"Dragão amigo","description":"Voa sobre a mesa.","power":"-1","toughness":"4"`))[0].Battlefield[0]
	if source.Name != "Dragão amigo" || source.Text != "Voa sobre a mesa." || source.Power != -1 || source.Toughness != 4 || source.ImageName != "" || source.InstanceKind != "custom-token" {
		t.Fatalf("personalização: %+v", source)
	}
	copied := creationPlayers(t, action(cookies[1], fmt.Sprintf(`"kind":"copy-card","cardId":%q`, source.ID)))[1]
	if len(copied.Battlefield) != 1 {
		t.Fatalf("cópia: %+v", copied)
	}
	copy := copied.Battlefield[0]
	if copy.ID == source.ID || copy.OwnerID != copied.UserID || copy.ControllerID != copied.UserID || copy.InstanceKind != "copy" || copy.Name != source.Name || copy.Text != source.Text || copy.Power != source.Power || copy.Toughness != source.Toughness || copy.ImageName != "" {
		t.Fatalf("atributos: %+v", copy)
	}
	requireStatus(t, action(cookies[0], fmt.Sprintf(`"kind":"move","cardIds":[%q],"to":"graveyard"`, source.ID)), 200)
	if actual := creationPlayers(t, e.request("GET", path, "", cookies[1], nil))[1].Battlefield[0]; actual != copy {
		t.Fatalf("original alterou cópia: %+v", actual)
	}
	requireStatus(t, action(cookies[1], fmt.Sprintf(`"kind":"move","cardIds":[%q],"to":"hand"`, copy.ID)), 200)
	requireStatus(t, action(cookies[0], fmt.Sprintf(`"kind":"copy-card","cardId":%q`, copy.ID)), 409)
	requireStatus(t, action(cookies[1], fmt.Sprintf(`"kind":"move","cardIds":[%q],"to":"graveyard"`, copy.ID)), 409)
	e.stop()
	e.start(false)
	restored := creationPlayers(t, e.request("GET", path, "", cookies[1], nil))
	if len(restored[0].Graveyard) != 0 || len(restored[1].Graveyard) != 0 || len(restored[1].Hand) != 0 {
		t.Fatalf("persistência: %+v", restored)
	}
	// Private own cards can be copied without moving or exposing the original.
	own := creationPlayers(t, action(cookies[0], `"kind":"draw","count":1`))[0].Hand[0]
	requireStatus(t, action(cookies[1], fmt.Sprintf(`"kind":"copy-card","cardId":%q`, own.ID)), 409)
	ownCopy := creationPlayers(t, action(cookies[0], fmt.Sprintf(`"kind":"copy-card","cardId":%q`, own.ID)))[0]
	if len(ownCopy.Hand) != 1 || len(ownCopy.Battlefield) != 1 || ownCopy.Battlefield[0].Text != "Add U." || ownCopy.Battlefield[0].ImageName != "Island" {
		t.Fatalf("cópia de mão: %+v", ownCopy)
	}
	requireStatus(t, action(cookies[0], `"kind":"create-token","tokenName":"Island"`), 409)
	requireStatus(t, action(cookies[0], `"kind":"create-custom-token","name":"   "`), 400)
	requireStatus(t, action(cookies[0], `"kind":"create-custom-token","name":"Ficha","imageName":"url arbitrária"`), 400)
	requireStatus(t, action(cookies[0], `"kind":"draw","count":1,"name":"campo indevido"`), 400)
	for _, fields := range []string{
		`"kind":"create-custom-token","name":` + fmt.Sprintf("%q", strings.Repeat("á", 201)),
		`"kind":"create-custom-token","name":"Ficha","description":` + fmt.Sprintf("%q", strings.Repeat("a", 5001)),
		`"kind":"create-custom-token","name":"Ficha","power":` + fmt.Sprintf("%q", strings.Repeat("a", 33)),
		`"kind":"create-custom-token","name":"Ficha","toughness":` + fmt.Sprintf("%q", strings.Repeat("a", 33)),
	} {
		requireStatus(t, action(cookies[0], fields), 400)
	}
	requireStatus(t, action(cookies[0], `"kind":"create-custom-token","name":"Sem atributos"`), 200)

}

func TestTokenCatalogIsBoundedSortedAndUsesExistingImageCache(t *testing.T) {
	e := newEnvironment(t)
	e.mustCreate("criador", "Criador", "senha-da-mesa")
	var downloads atomic.Int32
	source := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.Method != "GET" || r.URL.Path != "/token.png" || r.URL.RawQuery != "" || r.Header.Get("User-Agent") != "mtg4fun/1.0 (+https://github.com/rafacvs/mtg4fun)" || r.Header.Get("Accept") != "image/avif,image/webp,image/apng,image/*,*/*;q=0.8" {
			http.Error(w, "requisição inválida", 400)
			return
		}
		downloads.Add(1)
		w.Header().Set("Content-Type", "image/png")
		_, _ = w.Write([]byte("imagem-controlada"))
	}))
	defer source.Close()
	xml := `<cockatrice_carddatabase><cards>`
	for i := 104; i >= 0; i-- {
		xml += fmt.Sprintf(`<card><name>Ficha %03d</name><text>Texto compartilhado.</text><token>1</token><set picURL="%s/token.png">TST</set><prop><pt>2/3</pt></prop></card>`, i, source.URL)
	}
	xml += `</cards></cockatrice_carddatabase>`
	e.tokens = filepath.Join(t.TempDir(), "tokens.xml")
	if err := os.WriteFile(e.tokens, []byte(xml), 0600); err != nil {
		t.Fatal(err)
	}
	e.imageCache = filepath.Join(t.TempDir(), "images")
	e.start(false)
	cookie := sessionCookie(t, e.login("criador", "senha-da-mesa"))
	upload := e.uploadDeck(cookie, []byte(`<cockatrice_deck><zone name="main"><card number="1" name="Island"/></zone></cockatrice_deck>`))
	requireStatus(t, upload, 201)
	var deck struct {
		Deck struct {
			ID int64 `json:"id"`
		} `json:"deck"`
	}
	if err := json.Unmarshal(upload.body, &deck); err != nil {
		t.Fatal(err)
	}
	room := e.request("POST", "/api/rooms", "{}", cookie, nil)
	requireStatus(t, room, 201)
	path := fmt.Sprintf("/api/rooms/%d", decodeRoom(t, room).ID)
	requireStatus(t, e.request("PUT", path+"/participants/me/ready", fmt.Sprintf(`{"deckId":%d}`, deck.Deck.ID), cookie, nil), 200)
	requireStatus(t, e.request("POST", path+"/start", "{}", cookie, nil), 201)
	read := e.request("GET", path+"/match/tokens?q=ficha", "", cookie, nil)
	requireStatus(t, read, 200)
	var tokens struct {
		Tokens []struct {
			Name string `json:"name"`
			Text string `json:"text"`
		} `json:"tokens"`
	}
	if err := json.Unmarshal(read.body, &tokens); err != nil {
		t.Fatal(err)
	}
	if len(tokens.Tokens) != 100 || tokens.Tokens[0].Name != "Ficha 000" || tokens.Tokens[99].Name != "Ficha 099" || tokens.Tokens[0].Text != "Texto compartilhado." {
		t.Fatalf("limite/ordem/texto: %s", read.body)
	}
	image := e.request("GET", "/api/cards/image?name=Ficha+000", "", cookie, nil)
	requireStatus(t, image, 200)
	if image.header.Get("Content-Type") != "image/png" || string(image.body) != "imagem-controlada" {
		t.Fatalf("imagem: %+v", image)
	}
	requireStatus(t, e.request("POST", path+"/match/actions", `{"intentId":"20000000-0000-4000-8000-000000000001","kind":"create-token","tokenName":"Ficha 000"}`, cookie, nil), 200)
	e.stop()
	e.start(false)
	requireStatus(t, e.request("GET", "/api/cards/image?name=Ficha+000", "", cookie, nil), 200)
	if downloads.Load() != 1 {
		t.Fatalf("cache não persistiu: %d", downloads.Load())
	}
	if card := creationPlayers(t, e.request("GET", path+"/match", "", cookie, nil))[0].Battlefield[0]; card.Text != "Texto compartilhado." || card.Power != 2 || card.Toughness != 3 {
		t.Fatalf("atributos persistidos: %+v", card)
	}
}
