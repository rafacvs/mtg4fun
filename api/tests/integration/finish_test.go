package integration_test

import (
	"bytes"
	"encoding/json"
	"fmt"
	"net/http"
	"slices"
	"testing"
)

type finishView struct {
	Finished       bool            `json:"finished"`
	FinishVotes    []int64         `json:"finishVotes"`
	FinishRequired int             `json:"finishRequired"`
	Players        json.RawMessage `json:"players"`
	Log            []struct {
		Kind string `json:"kind"`
	} `json:"log"`
}

func decodeFinish(t *testing.T, result response) finishView {
	t.Helper()
	requireStatus(t, result, 200)
	var body struct {
		Match finishView `json:"match"`
	}
	if err := json.Unmarshal(result.body, &body); err != nil {
		t.Fatal(err)
	}
	return body.Match
}

func prepareFinishMatch(t *testing.T, count int) (*environment, []*http.Cookie, string) {
	t.Helper()
	e := newEnvironment(t)
	for i := 0; i <= count; i++ {
		e.mustCreate(fmt.Sprintf("finish%d", i), fmt.Sprintf("Amigo %d", i), "senha-da-mesa")
	}
	e.start(false)
	cookies := make([]*http.Cookie, count+1)
	for i := range cookies {
		cookies[i] = sessionCookie(t, e.login(fmt.Sprintf("finish%d", i), "senha-da-mesa"))
	}
	room := e.request("POST", "/api/rooms", roomJSON(), cookies[0], nil)
	requireStatus(t, room, 201)
	path := fmt.Sprintf("/api/rooms/%d", decodeRoom(t, room).ID)
	for i, cookie := range cookies[:count] {
		if i > 0 {
			requireStatus(t, e.request("POST", path+"/participants", "{}", cookie, nil), 200)
		}
		upload := e.uploadDeck(cookie, []byte(`<cockatrice_deck><zone name="main"><card number="4" name="Island"/></zone></cockatrice_deck>`))
		requireStatus(t, upload, 201)
		var body struct {
			Deck struct{ ID int64 } `json:"deck"`
		}
		if err := json.Unmarshal(upload.body, &body); err != nil {
			t.Fatal(err)
		}
		requireStatus(t, e.request("PUT", path+"/participants/me/ready", fmt.Sprintf(`{"deckId":%d}`, body.Deck.ID), cookie, nil), 200)
	}
	requireStatus(t, e.request("POST", path+"/start", "{}", cookies[0], nil), 201)
	return e, cookies, path
}

func finishBody(number int) string {
	return fmt.Sprintf(`{"intentId":"%08x-1234-4000-8000-000000000000","kind":"finish"}`, number)
}

func TestFinishRequiresHalfOfAllParticipantsAndPreservesFinalState(t *testing.T) {
	for count := 1; count <= 6; count++ {
		t.Run(fmt.Sprint(count), func(t *testing.T) {
			e, cookies, path := prepareFinishMatch(t, count)
			actions := path + "/match/actions"
			required := (count + 1) / 2
			requireStatus(t, e.request("POST", actions, finishBody(1), nil, nil), 401)
			requireStatus(t, e.request("POST", actions, finishBody(1), cookies[count], nil), 404)
			requireStatus(t, e.request("POST", actions, `{"intentId":"00000001-1234-4000-8000-000000000000","kind":"finish","playerId":2}`, cookies[0], nil), 400)
			before := decodeFinish(t, e.request("GET", path+"/match", "", cookies[0], nil))
			var lastVoter int
			var final finishView
			for vote := 0; vote < required; vote++ {
				// A non-creator can initiate; disconnected players still count.
				lastVoter = (vote + count - 1) % count
				final = decodeFinish(t, e.request("POST", actions, finishBody(vote+1), cookies[lastVoter], nil))
				if len(final.FinishVotes) != vote+1 || final.FinishRequired != required || final.Finished != (vote+1 == required) {
					t.Fatalf("limiar incorreto: %+v", final)
				}
				if !final.Finished {
					repeated := decodeFinish(t, e.request("POST", actions, finishBody(100+vote), cookies[lastVoter], nil))
					if !slices.Equal(final.FinishVotes, repeated.FinishVotes) || len(final.Log) != len(repeated.Log) {
						t.Fatal("novo intentId duplicou voto/log do mesmo participante")
					}
					if len(listRooms(t, e, cookies[0])) != 1 {
						t.Fatal("sala desapareceu antes do limiar")
					}
					e.stop()
					e.start(false)
					restored := decodeFinish(t, e.request("GET", path+"/match", "", cookies[0], nil))
					if !slices.Equal(final.FinishVotes, restored.FinishVotes) {
						t.Fatal("votos perdidos após reinício")
					}
					// Gameplay continues while a vote waits for more approvals.
					requireStatus(t, e.request("POST", actions, fmt.Sprintf(`{"intentId":"%08x-2222-4000-8000-000000000000","kind":"coin"}`, vote+1), cookies[0], nil), 200)
				}
			}
			final = decodeFinish(t, e.request("GET", path+"/match", "", cookies[0], nil))
			if !bytes.Equal(before.Players, final.Players) || final.Log[len(final.Log)-1].Kind != "finished" {
				t.Fatal("encerramento alterou cartas ou não preservou log final")
			}
			if len(listRooms(t, e, cookies[0])) != 0 {
				t.Fatal("sala encerrada continua no lobby")
			}
			for _, cookie := range []*http.Cookie{cookies[0], cookies[count]} {
				requireStatus(t, e.request("POST", path+"/participants", "{}", cookie, nil), 409)
			}
			// A lost response is recoverable with the same intent after completion.
			requireStatus(t, e.request("POST", actions, finishBody(required), cookies[lastVoter], nil), 200)
			requireStatus(t, e.request("POST", actions, finishBody(999), cookies[0], nil), 409)
			requireStatus(t, e.request("POST", actions, `{"intentId":"00000999-2222-4000-8000-000000000000","kind":"draw","count":1}`, cookies[0], nil), 409)
			requireStatus(t, e.request("POST", path+"/start", "{}", cookies[0], nil), 409)
			requireStatus(t, e.request("GET", path+"/match", "", cookies[count], nil), 404)
			persisted := e.request("GET", path+"/match", "", cookies[0], nil)
			e.stop()
			e.start(false)
			restored := e.request("GET", path+"/match", "", cookies[0], nil)
			if !bytes.Equal(persisted.body, restored.body) || len(listRooms(t, e, cookies[0])) != 0 {
				t.Fatal("estado final/log/fechamento não persistiram após reinício")
			}
		})
	}
}

func TestFinishClosureRollsBackWhenFinalLogCannotBeSaved(t *testing.T) {
	e, cookies, path := prepareFinishMatch(t, 3)
	actions := path + "/match/actions"
	decodeFinish(t, e.request("POST", actions, finishBody(1), cookies[1], nil))
	before := e.request("GET", path+"/match", "", cookies[0], nil)
	e.sql("REVOKE INSERT ON " + e.db + ".* FROM '" + e.db + "'@'%'; GRANT INSERT ON " + e.db + ".room_events TO '" + e.db + "'@'%'")
	e.disconnectDatabaseConnections()
	requireStatus(t, e.request("POST", actions, finishBody(2), cookies[0], nil), 500)
	after := e.request("GET", path+"/match", "", cookies[0], nil)
	if !bytes.Equal(before.body, after.body) || len(listRooms(t, e, cookies[0])) != 1 {
		t.Fatal("falha parcial alterou votos/partida/sala")
	}
	e.sql("GRANT INSERT ON " + e.db + ".* TO '" + e.db + "'@'%'")
	e.disconnectDatabaseConnections()
	if !decodeFinish(t, e.request("POST", actions, finishBody(2), cookies[0], nil)).Finished {
		t.Fatal("tentativa após falha não encerrou")
	}
}

func TestConcurrentFinishVotesDoNotCountOnePlayerTwice(t *testing.T) {
	e, cookies, path := prepareFinishMatch(t, 6)
	gate := make(chan struct{})
	results := make(chan response, 2)
	for i := 1; i <= 2; i++ {
		go func(number int) {
			<-gate
			results <- e.request("POST", path+"/match/actions", finishBody(number), cookies[1], nil)
		}(i)
	}
	close(gate)
	for i := 0; i < 2; i++ {
		m := decodeFinish(t, <-results)
		if m.Finished || len(m.FinishVotes) != 1 || len(m.Log) != 2 {
			t.Fatal("concorrência duplicou voto ou encerrou prematuramente")
		}
	}
}
