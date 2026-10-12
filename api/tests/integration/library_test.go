package integration_test

import (
	"bytes"
	"encoding/json"
	"fmt"
	"net/http"
	"os"
	"slices"
	"testing"
)

type libraryCard struct {
	ID       string `json:"id"`
	Name     string `json:"name"`
	Revealed bool   `json:"revealed"`
	FaceDown bool   `json:"faceDown"`
}

type libraryPlayer struct {
	UserID           int64         `json:"userId"`
	ConsultationFrom string        `json:"consultationFrom"`
	LibraryCount     int           `json:"libraryCount"`
	Consulted        []libraryCard `json:"consulted"`
	Revealed         []libraryCard `json:"revealed"`
	ExposedCards     []libraryCard `json:"exposedCards"`
	Hand             []libraryCard `json:"hand"`
}

func libraryPlayers(t *testing.T, result response) []libraryPlayer {
	t.Helper()
	requireStatus(t, result, 200)
	var payload struct {
		Match struct {
			Players []libraryPlayer `json:"players"`
		} `json:"match"`
	}
	if err := json.Unmarshal(result.body, &payload); err != nil {
		t.Fatal(err)
	}
	return payload.Match.Players
}

func TestLibrarySelectionVisibilityReturnAndRecovery(t *testing.T) {
	e := newEnvironment(t)
	for _, login := range []string{"dono", "oponente", "fora"} {
		e.mustCreate(login, login, "senha-da-sala")
	}
	e.start(false)
	owner := sessionCookie(t, e.login("dono", "senha-da-sala"))
	opponent := sessionCookie(t, e.login("oponente", "senha-da-sala"))
	outsider := sessionCookie(t, e.login("fora", "senha-da-sala"))
	deck, err := os.ReadFile("testdata/cockatrice-deck.cod")
	if err != nil {
		t.Fatal(err)
	}
	created := e.request("POST", "/api/rooms", "{}", owner, nil)
	requireStatus(t, created, 201)
	roomID := decodeRoom(t, created).ID
	path := fmt.Sprintf("/api/rooms/%d", roomID)
	requireStatus(t, e.request("POST", path+"/participants", "{}", opponent, nil), 200)
	for _, cookie := range []*http.Cookie{owner, opponent} {
		upload := e.uploadDeck(cookie, deck)
		requireStatus(t, upload, 201)
		var payload struct {
			Deck struct {
				ID int64 `json:"id"`
			} `json:"deck"`
		}
		if err := json.Unmarshal(upload.body, &payload); err != nil {
			t.Fatal(err)
		}
		requireStatus(t, e.request("PUT", path+"/participants/me/ready", fmt.Sprintf(`{"deckId":%d}`, payload.Deck.ID), cookie, nil), 200)
	}
	requireStatus(t, e.request("POST", path+"/start", "{}", owner, nil), 201)
	number := 0
	action := func(cookie *http.Cookie, fields string) response {
		number++
		return e.request("POST", path+"/match/actions", fmt.Sprintf(`{"intentId":"%08x-0000-4000-8000-000000000000",%s}`, number, fields), cookie, nil)
	}
	read := func(cookie *http.Cookie) response { return e.request("GET", path+"/match", "", cookie, nil) }
	initial := libraryPlayers(t, read(owner))[0]
	consult := action(owner, `"kind":"consult","consultFrom":"bottom","count":3`)
	opened := libraryPlayers(t, consult)[0]
	if opened.ConsultationFrom != "bottom" || len(opened.Consulted) != 3 {
		t.Fatalf("consulta: %+v", opened)
	}
	selectedID := opened.Consulted[1].ID
	privateID := opened.Consulted[0].ID
	revealFields := fmt.Sprintf(`"kind":"reveal","cardIds":[%q]`, selectedID)
	requireStatus(t, action(outsider, revealFields), 404)
	requireStatus(t, action(opponent, revealFields), 409)
	requireStatus(t, action(owner, fmt.Sprintf(`"kind":"reveal","cardIds":[%q,%q]`, selectedID, selectedID)), 409)
	if player := libraryPlayers(t, read(opponent))[0]; len(player.Revealed) != 0 {
		t.Fatal("seleção inválida revelou parcialmente")
	}
	requireStatus(t, action(owner, revealFields), 200)
	public := read(opponent)
	seen := libraryPlayers(t, public)[0]
	if len(seen.Revealed) != 1 || seen.Revealed[0].ID != selectedID || len(seen.Consulted) != 0 || seen.ConsultationFrom != "" || bytes.Contains(public.body, []byte(privateID)) {
		t.Fatalf("filtragem da seleção: %s", public.body)
	}
	// Revealing a selection leaves the private sequence intact.
	if got := consultedCardIDs(t, read(owner).body); !slices.Equal(got, consultedCardIDs(t, consult.body)) {
		t.Fatal("revelação alterou a sequência")
	}
	order := []string{opened.Consulted[2].ID, selectedID, privateID}
	encoded, _ := json.Marshal(order)
	requireStatus(t, action(owner, `"kind":"reorder","cardIds":`+string(encoded)), 200)
	e.stop()
	e.start(false)
	if restored := libraryPlayers(t, read(owner))[0]; restored.ConsultationFrom != "bottom" || !restored.Consulted[1].Revealed {
		t.Fatalf("retomada: %+v", restored)
	}
	if seen := libraryPlayers(t, read(opponent))[0]; len(seen.Revealed) != 1 || seen.Revealed[0].ID != selectedID {
		t.Fatal("revelação não persistiu")
	}
	requireStatus(t, action(owner, `"kind":"close","libraryPlacement":"bottom"`), 200)
	closed := libraryPlayers(t, read(owner))[0]
	if closed.LibraryCount != initial.LibraryCount || closed.ConsultationFrom != "" || len(closed.Revealed) != 0 || len(closed.Consulted) != 0 {
		t.Fatalf("finalização: %+v", closed)
	}
	if exposed := libraryPlayers(t, read(opponent))[0].ExposedCards; len(exposed) != 1 || exposed[0].ID != selectedID {
		t.Fatal("devolver encerrou revelação sem ocultar explicitamente")
	}
	bottom := action(owner, `"kind":"consult","consultFrom":"bottom","count":3`)
	requireStatus(t, bottom, 200)
	if !slices.Equal(consultedCardIDs(t, bottom.body), order) {
		t.Fatal("retorno ao fundo perdeu a ordem")
	}
	requireStatus(t, action(owner, `"kind":"close","libraryPlacement":"top"`), 200)
	top := action(owner, `"kind":"consult","consultFrom":"top","count":3`)
	requireStatus(t, top, 200)
	if !slices.Equal(consultedCardIDs(t, top.body), order) {
		t.Fatal("retorno ao topo perdeu a ordem")
	}
	requireStatus(t, action(owner, `"kind":"close","libraryPlacement":"top"`), 200)
	// Existing top-reveal clients retain their payload and can now finalize it.
	publicTop := libraryPlayers(t, action(owner, `"kind":"reveal","count":3`))[0]
	if len(publicTop.Revealed) != 3 {
		t.Fatal("revelação do topo ausente")
	}
	hiddenID := publicTop.Revealed[0].ID
	requireStatus(t, action(owner, fmt.Sprintf(`"kind":"reveal_cards","revealed":false,"cardIds":[%q]`, hiddenID)), 200)
	seenHidden := libraryPlayers(t, read(opponent))[0]
	for _, card := range append(seenHidden.Revealed, seenHidden.ExposedCards...) {
		if card.ID == hiddenID {
			t.Fatalf("ocultar manteve a carta da zona revelada: %+v", seenHidden)
		}
	}
	if len(seenHidden.Revealed) != 2 {
		t.Fatalf("revelação do topo incompleta após ocultar: %+v", seenHidden.Revealed)
	}
	held := libraryPlayers(t, read(owner))[0]
	var concealed *libraryCard
	for i := range held.Consulted {
		if held.Consulted[i].ID == hiddenID {
			concealed = &held.Consulted[i]
		}
	}
	if concealed == nil || concealed.Revealed || concealed.FaceDown {
		t.Fatalf("ocultar não preservou a consulta privada: %+v", held)
	}
	requireStatus(t, action(owner, `"kind":"reorder","cardIds":`+string(encoded)), 200)
	requireStatus(t, action(owner, `"kind":"close","libraryPlacement":"bottom"`), 200)
	bottom = action(owner, `"kind":"consult","consultFrom":"bottom","count":3`)
	requireStatus(t, bottom, 200)
	if !slices.Equal(consultedCardIDs(t, bottom.body), order) {
		t.Fatal("retorno das reveladas perdeu a ordem")
	}
	// Moving the last card still leaves a resumable consultation to finalize.
	requireStatus(t, action(owner, `"kind":"move","cardIds":`+string(encoded)+`,"to":"hand"`), 200)
	empty := libraryPlayers(t, read(owner))[0]
	if len(empty.Consulted) != 0 || empty.ConsultationFrom != "bottom" || len(empty.Hand) != 3 {
		t.Fatalf("consulta vazia: %+v", empty)
	}
	requireStatus(t, action(owner, `"kind":"close","libraryPlacement":"top"`), 200)
	shuffled := action(owner, `"kind":"shuffle","libraryPlacement":"top"`)
	requireStatus(t, shuffled, 200)
	if got := libraryPlayers(t, shuffled)[0]; got.LibraryCount != initial.LibraryCount-3 || len(got.Hand) != 3 {
		t.Fatalf("embaralhar sem consulta: %+v", got)
	}
	// Legacy snapshots/clients can have private and public temporary cards
	// simultaneously. Their private-only reorder remains valid, while the new
	// client can order the entire block without hiding the public card.
	legacyPublic := libraryPlayers(t, action(owner, `"kind":"reveal","count":1`))[0].Revealed[0].ID
	legacyConsult := action(owner, `"kind":"consult","consultFrom":"top","count":2`)
	requireStatus(t, legacyConsult, 200)
	privateOrder := consultedCardIDs(t, legacyConsult.body)
	slices.Reverse(privateOrder)
	encoded, _ = json.Marshal(privateOrder)
	requireStatus(t, action(owner, `"kind":"reorder","cardIds":`+string(encoded)), 200)
	combined := append([]string{legacyPublic}, privateOrder...)
	encoded, _ = json.Marshal(combined)
	requireStatus(t, action(owner, `"kind":"reorder","cardIds":`+string(encoded)), 200)
	if seen := libraryPlayers(t, read(opponent))[0]; len(seen.Revealed) != 1 || seen.Revealed[0].ID != legacyPublic {
		t.Fatal("reordenação perdeu a exposição pública")
	}
	requireStatus(t, action(owner, `"kind":"close","libraryPlacement":"bottom"`), 200)
	legacyBottom := action(owner, `"kind":"consult","consultFrom":"bottom","count":3`)
	requireStatus(t, legacyBottom, 200)
	if !slices.Equal(consultedCardIDs(t, legacyBottom.body), combined) {
		t.Fatal("consulta antiga perdeu cartas ou ordem ao finalizar")
	}
}
