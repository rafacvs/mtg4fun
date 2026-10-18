package integration_test

import (
	"bytes"
	"encoding/json"
	"fmt"
	"net/http"
	"testing"
)

func TestTransferredSelectionPreservesZoneRulesAndRollsBack(t *testing.T) {
	e, cookies, path := prepareCreationMatch(t)
	number := 0
	action := func(cookie *http.Cookie, fields string) response {
		t.Helper()
		number++
		return e.request("POST", path+"/actions", fmt.Sprintf(`{"intentId":"%08x-7777-4777-8777-000000000000",%s}`, number, fields), cookie, nil)
	}
	read := func() response { return e.request("GET", path, "", cookies[1], nil) }
	for index, cookie := range cookies[:2] {
		players := creationPlayers(t, action(cookie, `"kind":"draw","count":1`))
		id := players[index].Hand[0].ID
		requireStatus(t, action(cookie, fmt.Sprintf(`"kind":"move","cardIds":[%q],"to":"battlefield"`, id)), 200)
	}
	players := creationPlayers(t, read())
	ownerID, controllerID := players[0].UserID, players[1].UserID
	borrowed, own := players[0].Battlefield[0].ID, players[1].Battlefield[0].ID
	transferFields := fmt.Sprintf(`"kind":"transfer_control","cardId":%q,"controllerId":%d`, borrowed, controllerID)
	requireStatus(t, action(nil, transferFields), 401)
	requireStatus(t, action(cookies[2], transferFields), 404)
	requireStatus(t, action(cookies[0], transferFields+`,"tapped":true`), 400)
	requireStatus(t, action(cookies[0], fmt.Sprintf(`"kind":"draw","count":1,"controllerId":%d`, controllerID)), 400)
	beforeTransfer := read()
	e.sql("REVOKE INSERT ON " + e.db + ".* FROM '" + e.db + "'@'%'")
	e.disconnectDatabaseConnections()
	requireStatus(t, action(cookies[0], transferFields), 500)
	if after := read(); !bytes.Equal(beforeTransfer.body, after.body) {
		t.Fatal("failed transfer changed either battlefield or log")
	}
	e.sql("GRANT INSERT ON " + e.db + ".* TO '" + e.db + "'@'%'")
	e.disconnectDatabaseConnections()
	transferBody := fmt.Sprintf(`{"intentId":"%08x-7777-4777-8777-000000000000",%s}`, number, transferFields)
	requireStatus(t, e.request("POST", path+"/actions", transferBody, cookies[0], nil), 200)
	transferred := read()
	requireStatus(t, e.request("POST", path+"/actions", transferBody, cookies[0], nil), 200)
	if after := read(); !bytes.Equal(transferred.body, after.body) {
		t.Fatal("transfer retry duplicated card or log")
	}
	for _, fields := range []string{
		fmt.Sprintf(`"kind":"set_tapped","cardIds":[%q],"tapped":true`, borrowed),
		fmt.Sprintf(`"kind":"set_face_down","cardIds":[%q],"faceDown":true`, borrowed),
		fmt.Sprintf(`"kind":"counter","target":"card","cardId":%q,"subject":"power","operation":"set","value":4`, borrowed),
		fmt.Sprintf(`"kind":"counter","target":"card","cardId":%q,"subject":"marker","color":"red","operation":"set","value":3`, borrowed),
	} {
		requireStatus(t, action(cookies[1], fields), 200)
	}
	before := read()
	selection := fmt.Sprintf(`"kind":"position","cardIds":[%q,%q],"x":400,"row":2`, own, borrowed)
	requireStatus(t, action(cookies[0], selection), 409)
	requireStatus(t, action(cookies[1], fmt.Sprintf(`"kind":"position","cardIds":[%q,"missing"],"x":400,"row":2`, own)), 409)
	if after := read(); !bytes.Equal(before.body, after.body) {
		t.Fatal("rejected selection changed state or log")
	}
	// A real database failure after mutating both fields must roll back the
	// snapshot, log and intent, allowing the same request to succeed later.
	e.sql("REVOKE INSERT ON " + e.db + ".* FROM '" + e.db + "'@'%'")
	e.disconnectDatabaseConnections()
	failed := action(cookies[1], selection)
	requireStatus(t, failed, 500)
	if after := read(); !bytes.Equal(before.body, after.body) {
		t.Fatal("failed persistence changed state or log")
	}
	e.sql("GRANT INSERT ON " + e.db + ".* TO '" + e.db + "'@'%'")
	e.disconnectDatabaseConnections()
	body := fmt.Sprintf(`{"intentId":"%08x-7777-4777-8777-000000000000",%s}`, number, selection)
	requireStatus(t, e.request("POST", path+"/actions", body, cookies[1], nil), 200)
	positioned := read()
	requireStatus(t, e.request("POST", path+"/actions", body, cookies[1], nil), 200)
	if after := read(); !bytes.Equal(positioned.body, after.body) {
		t.Fatal("retry duplicated the collective action")
	}
	var view struct {
		Match struct {
			Players []struct {
				Battlefield []struct {
					ID           string `json:"id"`
					PositionX    int    `json:"positionX"`
					Row          int    `json:"row"`
					OwnerID      int64  `json:"ownerId"`
					ControllerID int64  `json:"controllerId"`
				} `json:"battlefield"`
			} `json:"players"`
		} `json:"match"`
	}
	if err := json.Unmarshal(positioned.body, &view); err != nil {
		t.Fatal(err)
	}
	cards := view.Match.Players[1].Battlefield
	if len(cards) != 2 || cards[0].PositionX != 400 || cards[1].PositionX != 520 || cards[0].Row != 2 || cards[1].Row != 2 || cards[1].OwnerID != ownerID || cards[1].ControllerID != controllerID {
		t.Fatalf("mixed ownership selection: %s", positioned.body)
	}
	e.stop()
	e.start(false)
	if after := read(); !bytes.Equal(positioned.body, after.body) {
		t.Fatal("restart lost positions, ownership, states or log")
	}
	returned := action(cookies[1], fmt.Sprintf(`"kind":"move","cardIds":[%q,%q],"to":"graveyard"`, own, borrowed))
	players = creationPlayers(t, returned)
	if len(players[0].Battlefield) != 0 || len(players[1].Battlefield) != 0 || len(players[0].Graveyard) != 1 || len(players[1].Graveyard) != 1 || players[0].Graveyard[0].ControllerID != ownerID || players[0].Graveyard[0].Power != 0 {
		t.Fatalf("mixed selection did not return to each owner: %s", returned.body)
	}
	if bytes.Contains(returned.body, []byte(`"tapped":true`)) || bytes.Contains(returned.body, []byte(`"faceDown":true`)) || bytes.Contains(returned.body, []byte(`"red":3`)) {
		t.Fatalf("current graveyard reset was lost: %s", returned.body)
	}
	// Transferred tokens/copies still disappear outside the battlefield.
	for _, fields := range []string{`"kind":"create-custom-token","name":"Ficha emprestada"`, fmt.Sprintf(`"kind":"copy-card","cardId":%q`, borrowed)} {
		created := creationPlayers(t, action(cookies[0], fields))[0].Battlefield[0]
		requireStatus(t, action(cookies[0], fmt.Sprintf(`"kind":"transfer_control","cardId":%q,"controllerId":%d`, created.ID, controllerID)), 200)
		requireStatus(t, action(cookies[1], fmt.Sprintf(`"kind":"move","cardIds":[%q],"to":"hand"`, created.ID)), 200)
		if after := read(); bytes.Contains(after.body, []byte(created.ID)) {
			t.Fatalf("transferred token/copy survived outside battlefield: %s", after.body)
		}
	}
	// Every offered destination belongs to the original owner, including top
	// and bottom of the private library. The former controller loses access.
	for _, destination := range []string{"hand", "exile", "command", "library"} {
		placements := []string{""}
		if destination == "library" {
			placements = []string{"top", "bottom"}
		}
		for _, placement := range placements {
			requireStatus(t, action(cookies[0], fmt.Sprintf(`"kind":"move","cardIds":[%q],"to":"battlefield"`, borrowed)), 200)
			requireStatus(t, action(cookies[0], transferFields), 200)
			fields := fmt.Sprintf(`"kind":"move","cardIds":[%q],"to":%q`, borrowed, destination)
			if placement != "" {
				fields += fmt.Sprintf(`,"libraryPlacement":%q`, placement)
			}
			requireStatus(t, action(cookies[1], fields), 200)
			requireStatus(t, action(cookies[1], fmt.Sprintf(`"kind":"move","cardIds":[%q],"to":"battlefield"`, borrowed)), 409)
			if destination == "library" {
				consulted := creationPlayers(t, action(cookies[0], `"kind":"consult","consultFrom":"all","count":1`))[0].Consulted
				index := 0
				if placement == "bottom" {
					index = len(consulted) - 1
				}
				if len(consulted) < 2 || consulted[index].ID != borrowed {
					t.Fatal("borrowed card returned to wrong library position")
				}
				requireStatus(t, action(cookies[0], `"kind":"close","libraryPlacement":"top"`), 200)
			}
			if destination == "hand" || destination == "library" {
				if after := read(); bytes.Contains(after.body, []byte(borrowed)) {
					t.Fatal("returned private card leaked through view or log")
				}
			}
		}
	}
}
