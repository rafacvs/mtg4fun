package integration_test

import (
	"bytes"
	"encoding/json"
	"fmt"
	"net/http"
	"testing"
)

func TestZoneCleanupAndTurnDisclosureAreDurableAndPublic(t *testing.T) {
	e, cookies, path := prepareCreationMatch(t)
	number := 0
	action := func(cookie *http.Cookie, fields string) response {
		number++
		result := e.request("POST", path+"/actions", fmt.Sprintf(`{"intentId":"%08x-2222-4000-8000-000000000000",%s}`, number, fields), cookie, nil)
		requireStatus(t, result, 200)
		return result
	}
	// Real cards leave the field with all manual modifiers cleared.
	card := creationPlayers(t, action(cookies[0], `"kind":"draw","count":1`))[0].Hand[0]
	ids := fmt.Sprintf(`"cardIds":[%q]`, card.ID)
	action(cookies[0], `"kind":"move","to":"battlefield",`+ids)
	action(cookies[0], `"kind":"set_tapped","tapped":true,`+ids)
	action(cookies[0], `"kind":"set_face_down","faceDown":true,`+ids)
	for _, subject := range []string{"power", "toughness", "marker"} {
		color := ""
		if subject == "marker" {
			color = `,"color":"red"`
		}
		action(cookies[0], fmt.Sprintf(`"kind":"counter","target":"card","cardId":%q,"subject":%q,"operation":"set","value":-3%s`, card.ID, subject, color))
	}
	action(cookies[0], `"kind":"move","to":"graveyard",`+ids)
	var body struct {
		Match struct {
			Players []struct {
				Graveyard []struct {
					ID        string
					Name      string
					Tapped    bool
					FaceDown  bool
					Power     int
					Toughness int
					Markers   map[string]int
				}
			}
		}
	}
	result := e.request("GET", path, "", cookies[1], nil)
	requireStatus(t, result, 200)
	if err := json.Unmarshal(result.body, &body); err != nil {
		t.Fatal(err)
	}
	dead := body.Match.Players[0].Graveyard[0]
	if dead.ID != card.ID || dead.Name != "Island" || dead.Tapped || dead.FaceDown || dead.Power != 0 || dead.Toughness != 0 || dead.Markers["red"] != 0 {
		t.Fatalf("cleanup: %s", result.body)
	}
	// Both participants reveal private cards, then either participant advances.
	for _, cookie := range cookies[:2] {
		result := action(cookie, `"kind":"draw","count":1`)
		players := creationPlayers(t, result)
		var id string
		for _, p := range players {
			if len(p.Hand) > 0 {
				id = p.Hand[0].ID
			}
		}
		action(cookie, fmt.Sprintf(`"kind":"reveal_cards","revealed":true,"cardIds":[%q]`, id))
	}
	action(cookies[0], `"kind":"hide_all_revealed"`)
	revealed := e.request("GET", path, "", cookies[0], nil)
	if !bytes.Contains(revealed.body, []byte(`"exposedCards"`)) {
		t.Fatal("hiding own cards hid the opponent too")
	}
	action(cookies[1], `"kind":"turn","direction":"next"`)
	for _, cookie := range cookies[:2] {
		result := e.request("GET", path, "", cookie, nil)
		if bytes.Contains(result.body, []byte(`"exposedCards"`)) || bytes.Contains(result.body, []byte(`"revealed":true`)) {
			t.Fatalf("revelation survived turn: %s", result.body)
		}
	}
	// Token deletion and state/log are persisted atomically and survive restart.
	token := creationPlayers(t, action(cookies[0], `"kind":"create-token","tokenName":"Soldier Token"`))[0].Battlefield[0]
	moved := action(cookies[0], fmt.Sprintf(`"kind":"move","to":"exile","cardIds":[%q]`, token.ID))
	if bytes.Contains(moved.body, []byte(token.ID)) {
		t.Fatal("token remains in destination")
	}
	before := e.request("GET", path, "", cookies[0], nil)
	e.stop()
	e.start(false)
	after := e.request("GET", path, "", cookies[0], nil)
	if !bytes.Equal(before.body, after.body) {
		t.Fatal("cleanup or log not durable")
	}
	requireStatus(t, e.request("POST", path+"/actions", `{"intentId":"11111111-2222-4000-8000-000000000000","kind":"hide_all_revealed"}`, cookies[2], nil), 404)
}
