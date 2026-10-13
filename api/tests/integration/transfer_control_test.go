package integration_test

import (
	"encoding/json"
	"fmt"
	"net/http"
	"testing"
)

type transferredCard struct {
	ID           string `json:"id"`
	OwnerID      int64  `json:"ownerId"`
	ControllerID int64  `json:"controllerId"`
	Zone         string `json:"zone"`
}

type transferPlayer struct {
	UserID      int64             `json:"userId"`
	Hand        []transferredCard `json:"hand"`
	Battlefield []transferredCard `json:"battlefield"`
	Graveyard   []transferredCard `json:"graveyard"`
}

func transferPlayers(t *testing.T, r response) ([]transferPlayer, []struct {
	Kind string `json:"kind"`
}) {
	t.Helper()
	requireStatus(t, r, 200)
	var payload struct {
		Match struct {
			Players []transferPlayer `json:"players"`
			Log     []struct {
				Kind string `json:"kind"`
			} `json:"log"`
		} `json:"match"`
	}
	if err := json.Unmarshal(r.body, &payload); err != nil {
		t.Fatal(err)
	}
	return payload.Match.Players, payload.Match.Log
}

func TestTransferControlKeepsOwnerAndReturnsCardsToOwnerZones(t *testing.T) {
	e := newEnvironment(t)
	for _, login := range []string{"dona", "controlador"} {
		e.mustCreate(login, login, "senha-da-sala")
	}
	e.start(false)
	owner := sessionCookie(t, e.login("dona", "senha-da-sala"))
	controller := sessionCookie(t, e.login("controlador", "senha-da-sala"))
	created := e.request("POST", "/api/rooms", "{}", owner, nil)
	requireStatus(t, created, 201)
	roomID := decodeRoom(t, created).ID
	path := fmt.Sprintf("/api/rooms/%d", roomID)
	requireStatus(t, e.request("POST", path+"/participants", "{}", controller, nil), 200)
	for _, cookie := range []*http.Cookie{owner, controller} {
		upload := e.uploadDeck(cookie, []byte(`<cockatrice_deck><zone name="main"><card number="1" name="Island"/></zone></cockatrice_deck>`))
		requireStatus(t, upload, 201)
		var result struct {
			Deck struct {
				ID int64 `json:"id"`
			} `json:"deck"`
		}
		if err := json.Unmarshal(upload.body, &result); err != nil {
			t.Fatal(err)
		}
		requireStatus(t, e.request("PUT", path+"/participants/me/ready", fmt.Sprintf(`{"deckId":%d}`, result.Deck.ID), cookie, nil), 200)
	}
	requireStatus(t, e.request("POST", path+"/start", "{}", owner, nil), 201)
	actionPath := path + "/match/actions"
	action := func(cookie *http.Cookie, intent, fields string) response {
		return e.request("POST", actionPath, fmt.Sprintf(`{"intentId":%q,%s}`, intent, fields), cookie, nil)
	}
	players, _ := transferPlayers(t, action(owner, "11111111-1111-4111-8111-111111111111", `"kind":"draw","count":1`))
	ownerID, controllerID := players[0].UserID, players[1].UserID
	cardID := players[0].Hand[0].ID
	transferPlayers(t, action(owner, "22222222-2222-4222-8222-222222222222", fmt.Sprintf(`"kind":"move","cardIds":[%q],"to":"battlefield"`, cardID)))

	// The current controller chooses another participant. The card moves between
	// fields, keeps its owner, and the new controller alone can act on it.
	transferred := action(owner, "33333333-3333-4333-8333-333333333333", fmt.Sprintf(`"kind":"transfer_control","cardId":%q,"controllerId":%d`, cardID, controllerID))
	players, log := transferPlayers(t, transferred)
	if len(players[0].Battlefield) != 0 || len(players[1].Battlefield) != 1 {
		t.Fatalf("campos após transferência: %s", transferred.body)
	}
	card := players[1].Battlefield[0]
	if card.ID != cardID || card.OwnerID != ownerID || card.ControllerID != controllerID || card.Zone != "battlefield" || len(log) == 0 || log[len(log)-1].Kind != "transfer_control" {
		t.Fatalf("controle/dono/log incorretos: %s", transferred.body)
	}
	requireStatus(t, action(owner, "44444444-4444-4444-8444-444444444444", fmt.Sprintf(`"kind":"set_tapped","tapped":true,"cardIds":[%q]`, cardID)), 409)
	requireStatus(t, action(controller, "55555555-5555-4555-8555-555555555555", fmt.Sprintf(`"kind":"set_tapped","tapped":true,"cardIds":[%q]`, cardID)), 200)
	requireStatus(t, action(controller, "dddddddd-dddd-4ddd-8ddd-dddddddddddd", fmt.Sprintf(`"kind":"transfer_control","cardId":%q,"controllerId":%d`, cardID, controllerID)), 409)
	requireStatus(t, action(controller, "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee", fmt.Sprintf(`"kind":"transfer_control","cardId":%q,"controllerId":999999`, cardID)), 409)
	kept, _ := transferPlayers(t, e.request("GET", path+"/match", "", controller, nil))
	if len(kept[1].Battlefield) != 1 || kept[1].Battlefield[0].ID != cardID || kept[1].Battlefield[0].OwnerID != ownerID || kept[1].Battlefield[0].ControllerID != controllerID {
		t.Fatalf("autotransferência ou alvo inválido alterou o campo: %+v", kept)
	}

	// Recovery returns the authorized controller and durable action log, rather
	// than relying on a connection that saw the original response.
	e.stop()
	e.start(false)
	recovered := e.request("GET", path+"/match", "", controller, nil)
	players, log = transferPlayers(t, recovered)
	if len(players[1].Battlefield) != 1 || players[1].Battlefield[0].ControllerID != controllerID || players[1].Battlefield[0].OwnerID != ownerID || log[len(log)-1].Kind != "set_tapped" {
		t.Fatalf("transferência não recuperada: %s", recovered.body)
	}

	// Leaving the borrowed field never grants access to the controller's private
	// zones: the requested owner zone receives the card and control returns home.
	returned := action(controller, "66666666-6666-4666-8666-666666666666", fmt.Sprintf(`"kind":"move","cardIds":[%q],"to":"graveyard"`, cardID))
	players, _ = transferPlayers(t, returned)
	if len(players[1].Graveyard) != 0 || len(players[0].Graveyard) != 1 || players[0].Graveyard[0].OwnerID != ownerID || players[0].Graveyard[0].ControllerID != ownerID {
		t.Fatalf("retorno não foi para a zona do dono: %s", returned.body)
	}
	requireStatus(t, action(controller, "77777777-7777-4777-8777-777777777777", fmt.Sprintf(`"kind":"move","cardIds":[%q],"to":"hand"`, cardID)), 409)
	requireStatus(t, action(owner, "88888888-8888-4888-8888-888888888888", fmt.Sprintf(`"kind":"move","cardIds":[%q],"to":"hand"`, cardID)), 200)
	// Possession of the public ID from the earlier battlefield is not authority
	// over the owner's private hand or library.
	requireStatus(t, action(controller, "99999999-9999-4999-8999-999999999999", fmt.Sprintf(`"kind":"move","cardIds":[%q],"to":"graveyard"`, cardID)), 409)
	requireStatus(t, action(owner, "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa", fmt.Sprintf(`"kind":"move","cardIds":[%q],"to":"library","libraryPlacement":"bottom"`, cardID)), 200)
	requireStatus(t, action(controller, "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb", fmt.Sprintf(`"kind":"move","cardIds":[%q],"to":"hand"`, cardID)), 409)

	// A card already returned to the owner's library is not on a battlefield, so
	// transfer cannot pull it back out.
	requireStatus(t, action(owner, "cccccccc-cccc-4ccc-8ccc-cccccccccccc", fmt.Sprintf(`"kind":"transfer_control","cardId":%q,"controllerId":%d`, cardID, controllerID)), 409)
}
