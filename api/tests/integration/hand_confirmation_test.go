package integration_test

import (
	"encoding/json"
	"fmt"
	"net/http"
	"testing"
)

func TestMatchStartsOnlyAfterEveryHandIsConfirmed(t *testing.T) {
	e, cookies, path := prepareUnconfirmedMatch(t, 2)
	ana, bia := cookies[0], cookies[1]
	number := 0
	action := func(cookie *http.Cookie, fields string) response {
		number++
		return e.request("POST", path+"/match/actions", fmt.Sprintf(`{"intentId":"%08x-3333-4000-8000-000000000000",%s}`, number, fields), cookie, nil)
	}
	type view struct {
		Match struct {
			MulliganOpen bool `json:"mulliganOpen"`
			ViewerID     int64
			Players      []struct {
				UserID       int64 `json:"userId"`
				MulliganKept bool  `json:"mulliganKept"`
				LibraryCount int   `json:"libraryCount"`
				Hand         []struct {
					ID string `json:"id"`
				} `json:"hand"`
			} `json:"players"`
		} `json:"match"`
	}
	read := func(cookie *http.Cookie) view {
		var current view
		result := e.request("GET", path+"/match", "", cookie, nil)
		requireStatus(t, result, 200)
		if err := json.Unmarshal(result.body, &current); err != nil {
			t.Fatal(err)
		}
		return current
	}
	hand := read(ana).Match.Players[0].Hand
	if len(hand) != 4 {
		t.Fatalf("mão inicial: %+v", hand)
	}
	card := hand[0].ID
	for _, refused := range []string{
		`"kind":"turn","direction":"next"`,
		`"kind":"finish"`,
		`"kind":"roll","sides":20`,
		`"kind":"untap_all"`,
		fmt.Sprintf(`"kind":"move","cardIds":[%q],"to":"battlefield"`, card),
		fmt.Sprintf(`"kind":"move","cardIds":[%q],"to":"graveyard"`, card),
	} {
		requireStatus(t, action(ana, refused), 409)
	}
	// O mulligan manual continua possível para quem não confirmou.
	requireStatus(t, action(ana, fmt.Sprintf(`"kind":"move","cardIds":[%q],"to":"library","libraryPlacement":"bottom"`, card)), 200)
	requireStatus(t, action(ana, `"kind":"draw","count":1`), 200)

	requireStatus(t, action(ana, `"kind":"keep_hand"`), 200)
	requireStatus(t, action(ana, `"kind":"draw","count":1`), 409)
	current := read(bia).Match
	if !current.MulliganOpen || !current.Players[0].MulliganKept || current.Players[1].MulliganKept {
		t.Fatalf("depois da primeira confirmação: %+v", current)
	}
	requireStatus(t, action(bia, `"kind":"turn","direction":"next"`), 409)

	before := read(ana).Match.Players[0]
	requireStatus(t, action(ana, `"kind":"unkeep_hand"`), 200)
	after := read(ana).Match.Players[0]
	if after.MulliganKept || len(after.Hand) != len(before.Hand) || after.LibraryCount != before.LibraryCount {
		t.Fatalf("desconfirmar mexeu nas cartas: %+v -> %+v", before, after)
	}

	requireStatus(t, action(bia, `"kind":"keep_hand"`), 200)
	if !read(bia).Match.MulliganOpen {
		t.Fatal("começou com a mão de Ana sem confirmar")
	}
	requireStatus(t, action(ana, `"kind":"keep_hand"`), 200)
	if read(bia).Match.MulliganOpen {
		t.Fatal("não começou com todas as mãos confirmadas")
	}
	requireStatus(t, action(ana, `"kind":"unkeep_hand"`), 409)
	requireStatus(t, action(bia, `"kind":"turn","direction":"next"`), 200)
	requireStatus(t, action(ana, fmt.Sprintf(`"kind":"move","cardIds":[%q],"to":"battlefield"`, read(ana).Match.Players[0].Hand[0].ID)), 200)
}
