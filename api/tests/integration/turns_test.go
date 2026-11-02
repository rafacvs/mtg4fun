package integration_test

import (
	"encoding/json"
	"fmt"
	"net/http"
	"testing"
)

func TestPassingTheTurnSkipsPlayersWithoutLife(t *testing.T) {
	e, cookies, path := prepareUnconfirmedMatch(t, 3)
	players := cookies[:3]
	confirmHands(t, e, path, players...)
	number := 0
	action := func(cookie *http.Cookie, fields string) {
		t.Helper()
		number++
		requireStatus(t, e.request("POST", path+"/match/actions", fmt.Sprintf(`{"intentId":"%08x-7777-4000-8000-000000000000",%s}`, number, fields), cookie, nil), 200)
	}
	var state struct {
		Match struct {
			ViewerID    int64 `json:"viewerId"`
			CurrentTurn struct {
				UserID int64 `json:"userId"`
			} `json:"currentTurn"`
			TurnOrder []struct {
				UserID int64 `json:"userId"`
			} `json:"turnOrder"`
		} `json:"match"`
	}
	read := func() {
		t.Helper()
		result := e.request("GET", path+"/match", "", players[0], nil)
		requireStatus(t, result, 200)
		if err := json.Unmarshal(result.body, &state); err != nil {
			t.Fatal(err)
		}
	}
	cookieOf := map[int64]*http.Cookie{}
	for _, cookie := range players {
		result := e.request("GET", path+"/match", "", cookie, nil)
		requireStatus(t, result, 200)
		if err := json.Unmarshal(result.body, &state); err != nil {
			t.Fatal(err)
		}
		cookieOf[state.Match.ViewerID] = cookie
	}
	read()
	order := state.Match.TurnOrder
	if len(order) != 3 || state.Match.CurrentTurn.UserID != order[0].UserID {
		t.Fatalf("ordem inesperada: %+v", state.Match)
	}
	setLife := func(id int64, life int) {
		action(cookieOf[id], fmt.Sprintf(`"kind":"counter","target":"player","playerId":%d,"subject":"life","operation":"set","value":%d`, id, life))
	}
	expectTurn := func(id int64, when string) {
		t.Helper()
		read()
		if state.Match.CurrentTurn.UserID != id {
			t.Fatalf("%s: turno de %d, esperado %d", when, state.Match.CurrentTurn.UserID, id)
		}
	}

	// O segundo morreu: passar a vez vai direto ao terceiro, e corrigir volta ao primeiro.
	setLife(order[1].UserID, 0)
	action(players[0], `"kind":"turn","direction":"next"`)
	expectTurn(order[2].UserID, "passar com o segundo morto")
	action(players[0], `"kind":"turn","direction":"previous"`)
	expectTurn(order[0].UserID, "corrigir com o segundo morto")

	// Vida negativa também conta como morto; sozinho, o turno volta para quem está vivo.
	setLife(order[2].UserID, -4)
	action(players[0], `"kind":"turn","direction":"next"`)
	expectTurn(order[0].UserID, "único vivo")

	// Voltar a ter vida devolve o lugar na ordem.
	setLife(order[1].UserID, 1)
	action(players[0], `"kind":"turn","direction":"next"`)
	expectTurn(order[1].UserID, "depois de reviver")
}
