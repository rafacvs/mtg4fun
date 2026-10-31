package integration_test

import (
	"bytes"
	"encoding/json"
	"fmt"
	"net/http"
	"testing"
)

type handRevealCard struct {
	ID         string  `json:"id"`
	Name       string  `json:"name"`
	RevealedTo []int64 `json:"revealedTo"`
}
type handRevealPlayer struct {
	UserID       int64            `json:"userId"`
	Name         string           `json:"name"`
	Hand         []handRevealCard `json:"hand"`
	ExposedCards []handRevealCard `json:"exposedCards"`
}
type handRevealLog struct {
	Kind   string           `json:"kind"`
	Count  int              `json:"count"`
	Result string           `json:"result"`
	Cards  []handRevealCard `json:"cards"`
}
type handRevealMatch struct {
	Players []handRevealPlayer `json:"players"`
	Log     []handRevealLog    `json:"log"`
}

func decodeHandReveal(t *testing.T, r response) handRevealMatch {
	t.Helper()
	requireStatus(t, r, 200)
	var payload struct {
		Match handRevealMatch `json:"match"`
	}
	if err := json.Unmarshal(r.body, &payload); err != nil {
		t.Fatal(err)
	}
	return payload.Match
}

func (m handRevealMatch) player(t *testing.T, name string) handRevealPlayer {
	t.Helper()
	for _, player := range m.Players {
		if player.Name == name {
			return player
		}
	}
	t.Fatalf("jogador %s ausente", name)
	return handRevealPlayer{}
}

func TestHandRevealReachesOnlyChosenOpponents(t *testing.T) {
	e := newEnvironment(t)
	for _, name := range []string{"ana", "bia", "caio"} {
		e.mustCreate(name, name, "senha-da-sala")
	}
	e.start(false)
	ana := sessionCookie(t, e.login("ana", "senha-da-sala"))
	bia := sessionCookie(t, e.login("bia", "senha-da-sala"))
	caio := sessionCookie(t, e.login("caio", "senha-da-sala"))
	created := e.request("POST", "/api/rooms", roomJSON(), ana, nil)
	requireStatus(t, created, 201)
	roomID := decodeRoom(t, created).ID
	path := fmt.Sprintf("/api/rooms/%d", roomID)
	for _, cookie := range []*http.Cookie{bia, caio} {
		requireStatus(t, e.request("POST", path+"/participants", "{}", cookie, nil), 200)
	}
	for _, cookie := range []*http.Cookie{ana, bia, caio} {
		upload := e.uploadDeck(cookie, []byte(`<cockatrice_deck><zone name="main"><card number="3" name="Day Test"/></zone></cockatrice_deck>`))
		requireStatus(t, upload, 201)
		var deck struct {
			Deck struct {
				ID int64 `json:"id"`
			} `json:"deck"`
		}
		if err := json.Unmarshal(upload.body, &deck); err != nil {
			t.Fatal(err)
		}
		requireStatus(t, e.request("PUT", path+"/participants/me/ready", fmt.Sprintf(`{"deckId":%d}`, deck.Deck.ID), cookie, nil), 200)
	}
	requireStatus(t, e.request("POST", path+"/start", "{}", ana, nil), 201)
	returnOpeningHandsToLibrary(t, e, roomID, ana, bia, caio)
	n := 0
	action := func(cookie *http.Cookie, fields string) response {
		n++
		return e.request("POST", path+"/match/actions", fmt.Sprintf(`{"intentId":"%08x-0000-4000-8000-000000000001",%s}`, n, fields), cookie, nil)
	}
	view := func(cookie *http.Cookie) response { return e.request("GET", path+"/match", "", cookie, nil) }

	drawn := decodeHandReveal(t, action(ana, `"kind":"draw","count":2`))
	hand := drawn.player(t, "ana").Hand
	id, other := hand[0].ID, hand[1].ID
	biaID, caioID, anaID := drawn.player(t, "bia").UserID, drawn.player(t, "caio").UserID, drawn.player(t, "ana").UserID
	revealTo := func(cardID string, players ...int64) string {
		encoded, _ := json.Marshal(players)
		return fmt.Sprintf(`"kind":"reveal_cards","cardIds":[%q],"revealed":true,"revealedTo":%s`, cardID, encoded)
	}

	for label, fields := range map[string]string{
		"o próprio jogador":   revealTo(id, anaID),
		"quem não está":       revealTo(id, 999999),
		"jogador repetido":    revealTo(id, biaID, biaID),
		"carta de outro":      revealTo("nao-existe", biaID),
		"lista vazia":         fmt.Sprintf(`"kind":"reveal_cards","cardIds":[%q],"revealed":true,"revealedTo":[]`, id),
		"ocultar com lista":   fmt.Sprintf(`"kind":"reveal_cards","cardIds":[%q],"revealed":false,"revealedTo":[%d]`, id, biaID),
		"lista em outra ação": fmt.Sprintf(`"kind":"set_face_down","cardIds":[%q],"faceDown":true,"revealedTo":[%d]`, id, biaID),
	} {
		if status := action(ana, fields).status; status < 400 || status >= 500 {
			t.Fatalf("%s: status %d", label, status)
		}
	}
	if len(decodeHandReveal(t, view(bia)).player(t, "ana").ExposedCards) != 0 {
		t.Fatal("tentativa inválida revelou a carta")
	}

	requireStatus(t, action(ana, revealTo(id, biaID)), 200)
	seen := decodeHandReveal(t, view(bia))
	exposed := seen.player(t, "ana").ExposedCards
	if len(exposed) != 1 || exposed[0].ID != id || exposed[0].Name != "Day Test" {
		t.Fatalf("a escolhida não viu a carta: %+v", exposed)
	}
	if len(seen.player(t, "ana").Hand) != 0 {
		t.Fatal("a escolhida recebeu a mão inteira")
	}
	last := seen.Log[len(seen.Log)-1]
	if last.Kind != "reveal_cards_to" || last.Count != 1 || last.Result != "bia" || len(last.Cards) != 1 || last.Cards[0].Name != "Day Test" {
		t.Fatalf("registro da escolhida: %+v", last)
	}

	outsider := view(caio)
	requireStatus(t, outsider, 200)
	if bytes.Contains(outsider.body, []byte(id)) || bytes.Contains(outsider.body, []byte("Day Test")) {
		t.Fatalf("quem não foi escolhido recebeu a carta: %s", outsider.body)
	}
	seenOutside := decodeHandReveal(t, outsider)
	if lastOutside := seenOutside.Log[len(seenOutside.Log)-1]; lastOutside.Kind != "reveal_cards_to" || lastOutside.Result != "bia" || len(lastOutside.Cards) != 0 {
		t.Fatalf("registro de quem não foi escolhido: %+v", lastOutside)
	}

	own := decodeHandReveal(t, view(ana)).player(t, "ana")
	if len(own.Hand) != 2 || len(own.ExposedCards) != 1 || len(own.ExposedCards[0].RevealedTo) != 1 || own.ExposedCards[0].RevealedTo[0] != biaID {
		t.Fatalf("visão da dona: %+v", own)
	}

	// Sem limite de jogadores; refazer substitui quem vê, e reiniciar preserva.
	requireStatus(t, action(ana, revealTo(id, biaID, caioID)), 200)
	e.stop()
	e.start(false)
	for _, cookie := range []*http.Cookie{bia, caio} {
		if len(decodeHandReveal(t, view(cookie)).player(t, "ana").ExposedCards) != 1 {
			t.Fatal("revelação para vários se perdeu após reiniciar")
		}
	}
	requireStatus(t, action(ana, revealTo(id, caioID)), 200)
	if len(decodeHandReveal(t, view(bia)).player(t, "ana").ExposedCards) != 0 {
		t.Fatal("trocar os escolhidos manteve quem saiu")
	}

	// Ocultar é igual para todas as formas de encerrar a revelação.
	requireStatus(t, action(ana, fmt.Sprintf(`"kind":"reveal_cards","cardIds":[%q],"revealed":false`, id)), 200)
	if len(decodeHandReveal(t, view(caio)).player(t, "ana").ExposedCards) != 0 {
		t.Fatal("ocultar manteve a revelação")
	}
	requireStatus(t, action(ana, revealTo(id, biaID)), 200)
	requireStatus(t, action(ana, `"kind":"hide_all_revealed"`), 200)
	if len(decodeHandReveal(t, view(bia)).player(t, "ana").ExposedCards) != 0 {
		t.Fatal("ocultar todas manteve a revelação")
	}
	requireStatus(t, action(ana, revealTo(id, biaID)), 200)
	requireStatus(t, action(ana, `"kind":"turn","direction":"next"`), 200)
	if len(decodeHandReveal(t, view(bia)).player(t, "ana").ExposedCards) != 0 {
		t.Fatal("passar o turno manteve a revelação")
	}

	// Revelar para todos substitui a escolha; sair da mão encerra a escolha sem voltar depois.
	requireStatus(t, action(ana, revealTo(other, biaID)), 200)
	requireStatus(t, action(ana, fmt.Sprintf(`"kind":"reveal_cards","cardIds":[%q],"revealed":true`, other)), 200)
	if exposed := decodeHandReveal(t, view(caio)).player(t, "ana").ExposedCards; len(exposed) != 1 || len(exposed[0].RevealedTo) != 0 {
		t.Fatalf("revelar para todos: %+v", exposed)
	}
	requireStatus(t, action(ana, fmt.Sprintf(`"kind":"reveal_cards","cardIds":[%q],"revealed":false`, other)), 200)
	requireStatus(t, action(ana, revealTo(id, biaID)), 200)
	requireStatus(t, action(ana, fmt.Sprintf(`"kind":"move","cardIds":[%q],"to":"library","libraryPlacement":"top"`, id)), 200)
	if len(decodeHandReveal(t, view(bia)).player(t, "ana").ExposedCards) != 0 {
		t.Fatal("carta no grimório continuou revelada para a escolhida")
	}
	requireStatus(t, action(ana, fmt.Sprintf(`"kind":"move","cardIds":[%q],"to":"hand"`, id)), 200)
	if len(decodeHandReveal(t, view(bia)).player(t, "ana").ExposedCards) != 0 {
		t.Fatal("carta de volta à mão revelou de novo sem pedido")
	}
	requireStatus(t, action(ana, fmt.Sprintf(`"kind":"move","cardIds":[%q],"to":"battlefield"`, id)), 200)
	if status := action(ana, revealTo(id, biaID)).status; status < 400 || status >= 500 {
		t.Fatalf("carta fora da mão aceitou revelação escolhida: %d", status)
	}
}
