package integration_test

import (
	"bytes"
	"encoding/json"
	"fmt"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"sync"
	"testing"
)

type stateCard struct {
	ID        string   `json:"id"`
	Name      string   `json:"name"`
	Tapped    bool     `json:"tapped"`
	FaceDown  bool     `json:"faceDown"`
	FaceIndex int      `json:"faceIndex"`
	Zone      string   `json:"zone"`
	Faces     []string `json:"faces"`
	Revealed  bool     `json:"revealed"`
}
type statePlayer struct {
	Hand         []stateCard `json:"hand"`
	Battlefield  []stateCard `json:"battlefield"`
	Graveyard    []stateCard `json:"graveyard"`
	ExposedCards []stateCard `json:"exposedCards"`
}

func statePlayers(t *testing.T, r response) []statePlayer {
	t.Helper()
	requireStatus(t, r, 200)
	var p struct {
		Match struct {
			Players []statePlayer `json:"players"`
		} `json:"match"`
	}
	if err := json.Unmarshal(r.body, &p); err != nil {
		t.Fatal(err)
	}
	return p.Match.Players
}
func TestCardStatesPrivacyAndRecovery(t *testing.T) {
	e := newEnvironment(t)
	for _, name := range []string{"dono", "outro"} {
		e.mustCreate(name, name, "senha-da-sala")
	}
	e.start(false)
	owner := sessionCookie(t, e.login("dono", "senha-da-sala"))
	other := sessionCookie(t, e.login("outro", "senha-da-sala"))
	created := e.request("POST", "/api/rooms", roomJSON(), owner, nil)
	requireStatus(t, created, 201)
	path := fmt.Sprintf("/api/rooms/%d", decodeRoom(t, created).ID)
	requireStatus(t, e.request("POST", path+"/participants", "{}", other, nil), 200)
	for _, cookie := range []*http.Cookie{owner, other} {
		upload := e.uploadDeck(cookie, []byte(`<cockatrice_deck><zone name="main"><card number="1" name="Day Test"/></zone></cockatrice_deck>`))
		requireStatus(t, upload, 201)
		var p struct {
			Deck struct {
				ID int64 `json:"id"`
			} `json:"deck"`
		}
		json.Unmarshal(upload.body, &p)
		requireStatus(t, e.request("PUT", path+"/participants/me/ready", fmt.Sprintf(`{"deckId":%d}`, p.Deck.ID), cookie, nil), 200)
	}
	requireStatus(t, e.request("POST", path+"/start", "{}", owner, nil), 201)
	returnOpeningHandsToLibrary(t, e, decodeRoom(t, created).ID, owner, other)
	n := 0
	action := func(cookie *http.Cookie, fields string) response {
		n++
		return e.request("POST", path+"/match/actions", fmt.Sprintf(`{"intentId":"%08x-0000-4000-8000-000000000000",%s}`, n, fields), cookie, nil)
	}
	card := statePlayers(t, action(owner, `"kind":"draw","count":1`))[0].Hand[0]
	ids := fmt.Sprintf(`"cardIds":[%q]`, card.ID)
	statePlayers(t, action(owner, `"kind":"move","to":"battlefield",`+ids))
	tapped := statePlayers(t, action(owner, `"kind":"set_tapped","tapped":true,`+ids))[0].Battlefield[0]
	if !tapped.Tapped {
		t.Fatal("carta não foi virada")
	}
	requireStatus(t, action(other, `"kind":"set_tapped","tapped":false,`+ids), 409)
	statePlayers(t, action(owner, `"kind":"untap_all"`))
	if statePlayers(t, e.request("GET", path+"/match", "", owner, nil))[0].Battlefield[0].Tapped {
		t.Fatal("desvirar todas falhou")
	}
	statePlayers(t, action(owner, fmt.Sprintf(`"kind":"set_face","cardId":%q,"faceIndex":1`, card.ID)))
	statePlayers(t, action(owner, `"kind":"set_face_down","faceDown":true,`+ids))
	hidden := statePlayers(t, e.request("GET", path+"/match", "", other, nil))[0].Battlefield[0]
	if hidden.Name != "" || len(hidden.Faces) != 0 || hidden.FaceIndex != 0 || !hidden.FaceDown {
		t.Fatalf("identidade oculta vazou: %+v", hidden)
	}
	own := statePlayers(t, e.request("GET", path+"/match", "", owner, nil))[0].Battlefield[0]
	if own.FaceIndex != 1 || len(own.Faces) != 2 || own.Name != "Day Test" {
		t.Fatalf("face independente: %+v", own)
	}
	requireStatus(t, action(owner, fmt.Sprintf(`"kind":"set_face","cardId":%q,"faceIndex":2`, card.ID)), 409)
	requireStatus(t, action(other, `"kind":"reveal_cards","revealed":true,`+ids), 409)
	requireStatus(t, action(owner, `"kind":"set_face_down","faceDown":false,"cardIds":["missing",`+fmt.Sprintf(`%q]`, card.ID)), 409)
	if !statePlayers(t, e.request("GET", path+"/match", "", owner, nil))[0].Battlefield[0].FaceDown {
		t.Fatal("ação inválida alterou carta parcialmente")
	}
	statePlayers(t, action(owner, `"kind":"reveal_cards","revealed":true,`+ids))
	if statePlayers(t, e.request("GET", path+"/match", "", other, nil))[0].Battlefield[0].Name != "Day Test" {
		t.Fatal("revelação explícita não expôs identidade")
	}
	statePlayers(t, action(owner, `"kind":"move","to":"hand",`+ids))
	exposed := statePlayers(t, e.request("GET", path+"/match", "", other, nil))[0].ExposedCards
	if len(exposed) != 1 || !exposed[0].Revealed || !exposed[0].FaceDown || exposed[0].FaceIndex != 1 {
		t.Fatalf("movimento apagou estados/revelação: %+v", exposed)
	}
	statePlayers(t, action(owner, `"kind":"move","to":"library","libraryPlacement":"bottom",`+ids))
	e.stop()
	e.start(false)
	publicLibrary := e.request("GET", path+"/match", "", other, nil)
	exposed = statePlayers(t, publicLibrary)[0].ExposedCards
	if bytes.Contains(publicLibrary.body, []byte(`"positionX"`)) || bytes.Contains(publicLibrary.body, []byte(`"stackOrder"`)) || bytes.Contains(publicLibrary.body, []byte(`"row"`)) {
		t.Fatalf("metadados posição privados: %s", publicLibrary.body)
	}
	if len(exposed) != 1 || exposed[0].Zone != "library" || exposed[0].FaceIndex != 1 {
		t.Fatalf("reinício apagou estados: %+v", exposed)
	}
	statePlayers(t, action(owner, `"kind":"reveal_cards","revealed":false,`+ids))
	if len(statePlayers(t, e.request("GET", path+"/match", "", other, nil))[0].ExposedCards) != 0 {
		t.Fatal("ocultar explícito não encerrou revelação")
	}
	restored := statePlayers(t, action(owner, `"kind":"draw","count":1`))[0].Hand[0]
	if !restored.FaceDown || restored.FaceIndex != 1 || restored.Revealed {
		t.Fatalf("face/ocultação não persistida: %+v", restored)
	}
	statePlayers(t, action(owner, `"kind":"move","to":"graveyard",`+ids))
	hidden = statePlayers(t, e.request("GET", path+"/match", "", other, nil))[0].Graveyard[0]
	if hidden.Name != "" || len(hidden.Faces) != 0 {
		t.Fatal("cemitério vazou identidade face para baixo")
	}
	requireStatus(t, action(owner, `"kind":"set_tapped","tapped":true,`+ids), 409)
	baseline := e.request("GET", path+"/match", "", owner, nil)
	e.sql("REVOKE INSERT ON " + e.db + ".* FROM '" + e.db + "'@'%'; GRANT INSERT ON " + e.db + ".rooms TO '" + e.db + "'@'%'")
	e.disconnectDatabaseConnections()
	requireStatus(t, action(owner, `"kind":"reveal_cards","revealed":true,`+ids), 500)
	still := e.request("GET", path+"/match", "", owner, nil)
	requireStatus(t, still, 200)
	if !bytes.Equal(still.body, baseline.body) {
		t.Fatal("falha ao persistir confirmou/alterou estado ou log")
	}

}

func TestFaceImagesUseControlledProviderAndDurableCache(t *testing.T) {
	requests := map[string]int{}
	var mu sync.Mutex
	source := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.Method != "GET" || r.Header.Get("User-Agent") != "mtg4fun/1.0 (+https://github.com/rafacvs/mtg4fun)" || r.Header.Get("Accept") == "" {
			http.Error(w, "request contract", 400)
			return
		}
		mu.Lock()
		requests[r.URL.RequestURI()]++
		mu.Unlock()
		if r.URL.Path == "/back" && r.URL.Query().Get("face") == "back" {
			http.Redirect(w, r, "/back-image", 302)
			return
		}
		if r.URL.Path != "/front" && r.URL.Path != "/back-image" {
			http.Error(w, "wrong face", 400)
			return
		}
		w.Header().Set("Content-Type", "image/jpeg")
		fmt.Fprint(w, r.URL.Path)
	}))
	defer source.Close()
	e := newEnvironment(t)
	e.mustCreate("faces", "Faces", "senha-da-sala")
	e.cards = filepath.Join(t.TempDir(), "cards.xml")
	e.imageCache = filepath.Join(t.TempDir(), "images")
	data := fmt.Sprintf(`<cockatrice_carddatabase><cards><card><name>Day Test</name><set picURL="%s/front">TST</set><related attach="transform">Night Test</related></card><card><name>Night Test</name><prop><side>back</side></prop><set picURL="%s/back?face=back">TST</set></card></cards></cockatrice_carddatabase>`, source.URL, source.URL)
	if err := os.WriteFile(e.cards, []byte(data), 0600); err != nil {
		t.Fatal(err)
	}
	e.start(false)
	cookie := sessionCookie(t, e.login("faces", "senha-da-sala"))
	front := e.request("GET", "/api/cards/image?name=Day+Test", "", cookie, nil)
	requireStatus(t, front, 200)
	back := e.request("GET", "/api/cards/image?name=Night+Test", "", cookie, nil)
	requireStatus(t, back, 200)
	if string(front.body) != "/front" || string(back.body) != "/back-image" {
		t.Fatalf("faces não distintas: %q %q", front.body, back.body)
	}
	e.stop()
	e.start(false)
	requireStatus(t, e.request("GET", "/api/cards/image?name=Night+Test", "", cookie, nil), 200)
	mu.Lock()
	defer mu.Unlock()
	if requests["/front"] != 1 || requests["/back?face=back"] != 1 || requests["/back-image"] != 1 {
		t.Fatalf("forma da requisição/cache: %v", requests)
	}
}
