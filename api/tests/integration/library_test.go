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
	Type            string `json:"type"`
	LibraryPosition int    `json:"libraryPosition"`
	ID              string `json:"id"`
	Name            string `json:"name"`
	Revealed        bool   `json:"revealed"`
	FaceDown        bool   `json:"faceDown"`
}

type libraryPlayer struct {
	UserID           int64         `json:"userId"`
	ConsultationFrom string        `json:"consultationFrom"`
	Consulting       bool          `json:"consulting"`
	LibraryCount     int           `json:"libraryCount"`
	Consulted        []libraryCard `json:"consulted"`
	Revealed         []libraryCard `json:"revealed"`
	ExposedCards     []libraryCard `json:"exposedCards"`
	Hand             []libraryCard `json:"hand"`
	Battlefield      []libraryCard `json:"battlefield"`
	Graveyard        []libraryCard `json:"graveyard"`
	Exile            []libraryCard `json:"exile"`
	Command          []libraryCard `json:"command"`
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
	for _, source := range []string{"all", "top"} {
		window := libraryPlayers(t, action(owner, fmt.Sprintf(`"kind":"consult","consultFrom":%q,"count":1`, source)))[0]
		if window.LibraryCount != initial.LibraryCount {
			t.Fatalf("%s esvaziou grimório", source)
		}
		requireStatus(t, action(owner, `"kind":"draw","count":1`), 409)
		requireStatus(t, action(owner, `"kind":"close","libraryPlacement":"top"`), 200)
	}

	consult := action(owner, `"kind":"consult","consultFrom":"bottom","count":3`)
	opened := libraryPlayers(t, consult)[0]
	if opened.ConsultationFrom != "bottom" || len(opened.Consulted) != 3 {
		t.Fatalf("consulta: %+v", opened)
	}
	if opened.LibraryCount != initial.LibraryCount {
		t.Fatalf("consultar retirou cartas do grimório: %d, antes %d", opened.LibraryCount, initial.LibraryCount)
	}
	for index, card := range opened.Consulted {
		if card.LibraryPosition != 5+index || card.Type == "" {
			t.Fatalf("posição/tipo da faixa do fundo: %+v", opened.Consulted)
		}
	}
	other := libraryPlayers(t, read(opponent))[0]
	if !other.Consulting || other.LibraryCount != initial.LibraryCount || len(other.Consulted) != 0 {
		t.Fatalf("vista pública da consulta: %+v", other)
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
	if len(seen.Revealed) != 1 || seen.Revealed[0].ID != selectedID || seen.LibraryCount != initial.LibraryCount || len(seen.Consulted) != 0 || seen.ConsultationFrom != "" || bytes.Contains(public.body, []byte(privateID)) {
		t.Fatalf("filtragem da seleção: %s", public.body)
	}
	if seen.Revealed[0].LibraryPosition != 0 || bytes.Contains(public.body, []byte(`"libraryPosition"`)) {
		t.Fatalf("revelação vazou ordem privada: %s", public.body)
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
	if empty.LibraryCount != initial.LibraryCount-3 || len(empty.Consulted) != 0 || empty.ConsultationFrom != "bottom" || len(empty.Hand) != 3 {
		t.Fatalf("consulta vazia: %+v", empty)
	}
	requireStatus(t, action(owner, `"kind":"close","libraryPlacement":"top"`), 200)
	shuffled := action(owner, `"kind":"shuffle","libraryPlacement":"top"`)
	requireStatus(t, shuffled, 200)
	if got := libraryPlayers(t, shuffled)[0]; got.LibraryCount != initial.LibraryCount-3 || len(got.Hand) != 3 {
		t.Fatalf("embaralhar sem consulta: %+v", got)
	}
	// Revealing the top uses the same consultation and cannot start a second one.
	public = action(owner, `"kind":"reveal","count":1`)
	publicID := libraryPlayers(t, public)[0].Revealed[0].ID
	requireStatus(t, action(owner, `"kind":"consult","consultFrom":"top","count":2`), 409)
	requireStatus(t, action(owner, `"kind":"hide_all_revealed"`), 200)
	if seen := libraryPlayers(t, read(opponent))[0]; len(seen.Revealed) != 0 {
		t.Fatal("hidden consultation still public")
	}
	if own := libraryPlayers(t, read(owner))[0]; len(own.Consulted) != 1 || own.Consulted[0].ID != publicID {
		t.Fatal("hiding moved or lost the consulted card")
	}
	requireStatus(t, action(owner, `"kind":"close","libraryPlacement":"bottom"`), 200)
	bottom = action(owner, `"kind":"consult","consultFrom":"bottom","count":1`)
	requireStatus(t, bottom, 200)
	if consultedCardIDs(t, bottom.body)[0] != publicID {
		t.Fatal("return changed library order")
	}
	requireStatus(t, action(owner, `"kind":"close","libraryPlacement":"bottom"`), 200)
	for _, destination := range []string{"hand", "battlefield", "graveyard", "exile", "command"} {
		window := libraryPlayers(t, action(owner, `"kind":"consult","consultFrom":"top","count":1`))[0]
		id := window.Consulted[0].ID
		moved := libraryPlayers(t, action(owner, fmt.Sprintf(`"kind":"move","cardIds":[%q],"to":%q`, id, destination)))[0]
		if moved.LibraryCount != 4-1 || len(moved.Consulted) != 0 {
			t.Fatalf("saída para %s: %+v", destination, moved)
		}
		zones := map[string][]libraryCard{"hand": moved.Hand, "battlefield": moved.Battlefield, "graveyard": moved.Graveyard, "exile": moved.Exile, "command": moved.Command}
		found := false
		for _, card := range zones[destination] {
			if card.ID == id {
				found = true
			}
		}
		if !found {
			t.Fatalf("carta não chegou a %s", destination)
		}
		requireStatus(t, action(owner, fmt.Sprintf(`"kind":"move","cardIds":[%q],"to":"library","libraryPlacement":"bottom"`, id)), 200)
		requireStatus(t, action(owner, `"kind":"close","libraryPlacement":"top"`), 200)
	}
	beforeShuffle := action(owner, `"kind":"consult","consultFrom":"all","count":1`)
	beforeOrder := consultedCardIDs(t, beforeShuffle.body)
	changed := false
	for attempt := 0; attempt < 5; attempt++ {
		requireStatus(t, action(owner, `"kind":"shuffle","libraryPlacement":"top"`), 200)
		afterShuffle := action(owner, `"kind":"consult","consultFrom":"all","count":1`)
		if !slices.Equal(beforeOrder, consultedCardIDs(t, afterShuffle.body)) {
			changed = true
			break
		}
	}
	if !changed {
		t.Fatal("embaralhar e fechar não alterou a ordem do monte")
	}
	persistedOrder := consultedCardIDs(t, read(owner).body)
	requireStatus(t, action(owner, `"kind":"close","libraryPlacement":"top"`), 200)
	e.stop()
	e.start(false)
	restored := action(owner, `"kind":"consult","consultFrom":"all","count":1`)
	if !slices.Equal(persistedOrder, consultedCardIDs(t, restored.body)) {
		t.Fatal("ordem embaralhada não persistiu após reinício")
	}

}
