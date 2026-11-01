package integration_test

import (
	"bytes"
	"encoding/json"
	"fmt"
	"net/http"
	"os"
	"strconv"
	"testing"
)

func TestPreparationDiceHTTPPersistenceAndTies(t *testing.T) {
	e := newEnvironment(t)
	for _, name := range []string{"ana", "bia", "fora"} {
		e.mustCreate(name, name, "senha-da-sala")
	}
	e.rolls = "7,17,17,9"
	e.start(false)
	ana := sessionCookie(t, e.login("ana", "senha-da-sala"))
	bia := sessionCookie(t, e.login("bia", "senha-da-sala"))
	outsider := sessionCookie(t, e.login("fora", "senha-da-sala"))
	deck, err := os.ReadFile("testdata/cockatrice-deck.cod")
	if err != nil {
		t.Fatal(err)
	}
	ids := []int64{}
	for _, cookie := range []*http.Cookie{ana, bia} {
		result := e.uploadDeck(cookie, deck)
		requireStatus(t, result, 201)
		var payload struct{ Deck struct{ ID int64 } }
		if err = json.Unmarshal(result.body, &payload); err != nil {
			t.Fatal(err)
		}
		ids = append(ids, payload.Deck.ID)
	}
	created := e.request("POST", "/api/rooms", roomJSON(), ana, nil)
	requireStatus(t, created, 201)
	path := fmt.Sprintf("/api/rooms/%d", decodeRoom(t, created).ID)
	requireStatus(t, e.request("POST", path+"/participants", "{}", bia, nil), 200)
	action := func(cookie *http.Cookie, n int, kind, rollID string) response {
		// A rolagem 1 usa força alta; a 2 pede força máxima já na etapa que vale.
		power := map[int]int{1: 9, 2: 10}[n]
		return e.request("POST", path+"/preparation/actions", fmt.Sprintf(`{"intentId":"00000000-0000-4000-8000-%012d","kind":%q,"rollId":%q,"power":%d}`, n, kind, rollID, power), cookie, nil)
	}
	requireStatus(t, e.request("GET", path+"/preparation", "", outsider, nil), 404)
	requireStatus(t, action(outsider, 1, "roll", ""), 404)
	requireStatus(t, e.request("POST", path+"/preparation/actions", `{"intentId":"00000000-0000-4000-8000-000000000099","kind":"roll","power":11}`, ana, nil), 400)
	requireStatus(t, e.request("POST", path+"/preparation/actions", `{"intentId":"00000000-0000-4000-8000-000000000099","kind":"roll","power":-1}`, ana, nil), 400)
	requireStatus(t, action(ana, 1, "roll", ""), 200)
	requireStatus(t, action(ana, 1, "roll", ""), 200)
	state := e.request("GET", path+"/preparation", "", bia, nil)
	if bytes.Count(state.body, []byte(`"value":7`)) != 1 {
		t.Fatalf("rolagem duplicada: %s", state.body)
	}
	if !bytes.Contains(state.body, []byte(`"power":9`)) {
		t.Fatalf("força do lançamento não foi sincronizada: %s", state.body)
	}
	for i, cookie := range []*http.Cookie{ana, bia} {
		requireStatus(t, e.request("PUT", path+"/participants/me/ready", fmt.Sprintf(`{"deckId":%d}`, ids[i]), cookie, nil), 200)
	}
	requireStatus(t, e.request("POST", path+"/preparation/start", "{}", bia, nil), 403)
	requireStatus(t, e.request("POST", path+"/preparation/start", "{}", ana, nil), 200)
	requireStatus(t, e.request("GET", path+"/match", "", ana, nil), 404)
	requireStatus(t, action(ana, 2, "roll", ""), 200)
	ordered := e.request("GET", path+"/preparation", "", bia, nil)
	if bytes.Contains(ordered.body, []byte(`"power":10`)) {
		t.Fatalf("rolagem que vale aceitou força: %s", ordered.body)
	}
	requireStatus(t, action(ana, 3, "confirm", "00000000-0000-4000-8000-000000000002"), 409)
	requireStatus(t, action(bia, 4, "roll", ""), 200)
	requireStatus(t, action(bia, 5, "confirm", "00000000-0000-4000-8000-000000000004"), 409)
	e.stop()
	e.rolls = "9"
	e.start(false)
	recovered := e.request("GET", path+"/preparation", "", bia, nil)
	if !bytes.Contains(recovered.body, []byte(`"value":17`)) {
		t.Fatalf("perdeu rolagens: %s", recovered.body)
	}
	requireStatus(t, action(bia, 7, "roll", ""), 200)
	requireStatus(t, action(ana, 8, "confirm", "00000000-0000-4000-8000-000000000002"), 200)
	requireStatus(t, action(ana, 8, "confirm", "00000000-0000-4000-8000-000000000002"), 200)
	game := e.request("GET", path+"/match", "", ana, nil)
	requireStatus(t, game, 200)
	var payload struct {
		Match struct{ TurnOrder []struct{ Roll int } }
	}
	if err = json.Unmarshal(game.body, &payload); err != nil {
		t.Fatal(err)
	}
	if len(payload.Match.TurnOrder) != 2 || payload.Match.TurnOrder[0].Roll != 17 || payload.Match.TurnOrder[1].Roll != 9 {
		t.Fatalf("ordem incorreta: %s", game.body)
	}
	e.stop()
	e.start(false)
	again := e.request("GET", path+"/match", "", ana, nil)
	requireStatus(t, again, 200)
	if !bytes.Equal(game.body, again.body) {
		t.Fatal("retomada alterou a partida")
	}
}

func TestPreparationUnconfirmAllowsRollingAgain(t *testing.T) {
	e := newEnvironment(t)
	for _, name := range []string{"ana", "bia", "fora"} {
		e.mustCreate(name, name, "senha-da-sala")
	}
	e.rolls = "7,7,12,3"
	e.start(false)
	ana := sessionCookie(t, e.login("ana", "senha-da-sala"))
	bia := sessionCookie(t, e.login("bia", "senha-da-sala"))
	outsider := sessionCookie(t, e.login("fora", "senha-da-sala"))
	deck, err := os.ReadFile("testdata/cockatrice-deck.cod")
	if err != nil {
		t.Fatal(err)
	}
	created := e.request("POST", "/api/rooms", roomJSON(), ana, nil)
	requireStatus(t, created, 201)
	path := fmt.Sprintf("/api/rooms/%d", decodeRoom(t, created).ID)
	requireStatus(t, e.request("POST", path+"/participants", "{}", bia, nil), 200)
	for _, cookie := range []*http.Cookie{ana, bia} {
		result := e.uploadDeck(cookie, deck)
		requireStatus(t, result, 201)
		var payload struct{ Deck struct{ ID int64 } }
		if err = json.Unmarshal(result.body, &payload); err != nil {
			t.Fatal(err)
		}
		requireStatus(t, e.request("PUT", path+"/participants/me/ready", fmt.Sprintf(`{"deckId":%d}`, payload.Deck.ID), cookie, nil), 200)
	}
	action := func(cookie *http.Cookie, n int, kind, rollID string) response {
		return e.request("POST", path+"/preparation/actions", fmt.Sprintf(`{"intentId":"00000000-0000-4000-8000-%012d","kind":%q,"rollId":%q}`, n, kind, rollID), cookie, nil)
	}
	roll := func(n int) string { return fmt.Sprintf("00000000-0000-4000-8000-%012d", n) }
	confirmedBy := func(cookie *http.Cookie) map[string]string {
		state := e.request("GET", path+"/preparation", "", cookie, nil)
		requireStatus(t, state, 200)
		var payload struct {
			Confirmed map[string]string `json:"confirmed"`
		}
		if err := json.Unmarshal(state.body, &payload); err != nil {
			t.Fatal(err)
		}
		return payload.Confirmed
	}

	// Antes da etapa que vale não há o que desfazer.
	requireStatus(t, action(ana, 90, "unconfirm", ""), 409)
	requireStatus(t, e.request("POST", path+"/preparation/start", "{}", ana, nil), 200)
	requireStatus(t, action(outsider, 91, "unconfirm", ""), 404)
	requireStatus(t, action(ana, 92, "unconfirm", ""), 409)

	// Sem empate, rolar já confirma: só dá para rolar de novo depois de desconfirmar.
	requireStatus(t, action(ana, 1, "roll", ""), 200)
	requireStatus(t, action(ana, 2, "confirm", roll(1)), 409)
	requireStatus(t, action(ana, 3, "roll", ""), 409)
	if confirmedBy(bia)[strconv.FormatInt(sessionUserID(t, e, ana), 10)] != roll(1) {
		t.Fatal("rolar não confirmou")
	}

	// Bia empata: as duas perdem a confirmação e nenhuma confirma enquanto durar.
	requireStatus(t, action(bia, 4, "roll", ""), 200)
	if len(confirmedBy(bia)) != 0 {
		t.Fatal("o empate não desfez as confirmações")
	}
	requireStatus(t, action(bia, 5, "confirm", roll(4)), 409)
	requireStatus(t, action(ana, 13, "confirm", roll(1)), 409)
	requireStatus(t, action(ana, 7, "unconfirm", ""), 409)

	// Rolar de novo vale e confirma; desconfirmar continua liberado.
	requireStatus(t, action(ana, 8, "roll", ""), 200)
	requireStatus(t, action(ana, 6, "unconfirm", ""), 200)
	requireStatus(t, action(ana, 6, "unconfirm", ""), 200)
	if len(confirmedBy(bia)) != 0 {
		t.Fatal("desconfirmar não apareceu para os outros")
	}
	requireStatus(t, action(ana, 9, "confirm", roll(1)), 409)
	requireStatus(t, action(ana, 10, "confirm", roll(8)), 200)
	e.stop()
	e.start(false)
	confirmed := confirmedBy(bia)
	if len(confirmed) != 1 {
		t.Fatalf("confirmação depois de desconfirmar se perdeu: %v", confirmed)
	}
	for _, rollID := range confirmed {
		if rollID != roll(8) {
			t.Fatalf("confirmou a rolagem errada: %v", confirmed)
		}
	}

	// Com todos confirmados a partida começa e não há mais volta.
	requireStatus(t, action(bia, 11, "confirm", roll(4)), 200)
	requireStatus(t, action(ana, 12, "unconfirm", ""), 409)
	match := e.request("GET", path+"/match", "", bia, nil)
	requireStatus(t, match, 200)
	var started struct {
		Match struct {
			TurnOrder []struct {
				Roll int `json:"roll"`
			} `json:"turnOrder"`
		} `json:"match"`
	}
	if err = json.Unmarshal(match.body, &started); err != nil {
		t.Fatal(err)
	}
	if len(started.Match.TurnOrder) != 2 || started.Match.TurnOrder[0].Roll != 12 || started.Match.TurnOrder[1].Roll != 7 {
		t.Fatalf("ordem final ignorou a nova rolagem: %s", match.body)
	}
}

func TestOrderRollConfirmsUnlessTied(t *testing.T) {
	e := newEnvironment(t)
	for _, name := range []string{"ana", "bia", "cida"} {
		e.mustCreate(name, name, "senha-da-sala")
	}
	e.rolls = "10,15,10,3"
	e.start(false)
	cookies := []*http.Cookie{}
	for _, name := range []string{"ana", "bia", "cida"} {
		cookies = append(cookies, sessionCookie(t, e.login(name, "senha-da-sala")))
	}
	ana, bia, cida := cookies[0], cookies[1], cookies[2]
	deck, err := os.ReadFile("testdata/cockatrice-deck.cod")
	if err != nil {
		t.Fatal(err)
	}
	created := e.request("POST", "/api/rooms", roomJSON(), ana, nil)
	requireStatus(t, created, 201)
	path := fmt.Sprintf("/api/rooms/%d", decodeRoom(t, created).ID)
	for i, cookie := range cookies {
		if i > 0 {
			requireStatus(t, e.request("POST", path+"/participants", "{}", cookie, nil), 200)
		}
		result := e.uploadDeck(cookie, deck)
		requireStatus(t, result, 201)
		var payload struct{ Deck struct{ ID int64 } }
		if err = json.Unmarshal(result.body, &payload); err != nil {
			t.Fatal(err)
		}
		requireStatus(t, e.request("PUT", path+"/participants/me/ready", fmt.Sprintf(`{"deckId":%d}`, payload.Deck.ID), cookie, nil), 200)
	}
	requireStatus(t, e.request("POST", path+"/preparation/start", "{}", ana, nil), 200)
	roll := func(n int) string { return fmt.Sprintf("00000000-0000-4000-8000-%012d", n) }
	action := func(cookie *http.Cookie, n int, kind, rollID string) response {
		return e.request("POST", path+"/preparation/actions", fmt.Sprintf(`{"intentId":%q,"kind":%q,"rollId":%q}`, roll(n), kind, rollID), cookie, nil)
	}
	confirmed := func() map[string]string {
		state := e.request("GET", path+"/preparation", "", ana, nil)
		requireStatus(t, state, 200)
		var payload struct {
			Confirmed map[string]string `json:"confirmed"`
		}
		if err := json.Unmarshal(state.body, &payload); err != nil {
			t.Fatal(err)
		}
		return payload.Confirmed
	}
	id := func(cookie *http.Cookie) string { return strconv.FormatInt(sessionUserID(t, e, cookie), 10) }

	requireStatus(t, action(ana, 1, "roll", ""), 200)
	requireStatus(t, action(bia, 2, "roll", ""), 200)
	if got := confirmed(); got[id(ana)] != roll(1) || got[id(bia)] != roll(2) {
		t.Fatalf("rolagens sem empate não confirmaram: %v", got)
	}
	// Cida empata com Ana: só as duas saem, e Bia continua confirmada.
	requireStatus(t, action(cida, 3, "roll", ""), 200)
	if got := confirmed(); len(got) != 1 || got[id(bia)] != roll(2) {
		t.Fatalf("empate mexeu nas confirmações erradas: %v", got)
	}
	// Ana rola de novo e confirma; sem o empate, Cida escolhe confirmar ou rolar.
	requireStatus(t, action(ana, 4, "roll", ""), 200)
	if got := confirmed(); len(got) != 2 || got[id(ana)] != roll(4) || got[id(cida)] != "" {
		t.Fatalf("depois de desempatar: %v", got)
	}
	requireStatus(t, action(cida, 5, "confirm", roll(3)), 200)
	match := e.request("GET", path+"/match", "", ana, nil)
	requireStatus(t, match, 200)
	var started struct {
		Match struct {
			TurnOrder []struct {
				Roll int `json:"roll"`
			} `json:"turnOrder"`
		} `json:"match"`
	}
	if err = json.Unmarshal(match.body, &started); err != nil {
		t.Fatal(err)
	}
	if order := started.Match.TurnOrder; len(order) != 3 || order[0].Roll != 15 || order[1].Roll != 10 || order[2].Roll != 3 {
		t.Fatalf("ordem incorreta: %s", match.body)
	}
}
