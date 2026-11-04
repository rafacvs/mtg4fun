package integration_test

import (
	"encoding/json"
	"fmt"
	"net/http"
	"reflect"
	"strings"
	"testing"

	"mtg4fun/internal/leaderboards"
)

func TestLeaderboardsUseDurablePublicActions(t *testing.T) {
	e, cookies, path := prepareCreationMatch(t, `<cockatrice_deck><zone name="main"><card number="12" name="Island"/></zone></cockatrice_deck>`)
	read := func(query string) (map[int64]leaderboards.Player, []byte) {
		t.Helper()
		r := e.request("GET", "/api/leaderboards"+query, "", cookies[2], nil)
		requireStatus(t, r, 200)
		var body struct{ Players []leaderboards.Player }
		if err := json.Unmarshal(r.body, &body); err != nil {
			t.Fatal(err)
		}
		players := map[int64]leaderboards.Player{}
		for _, p := range body.Players {
			players[p.ID] = p
		}
		return players, r.body
	}
	requireStatus(t, e.request("GET", "/api/leaderboards", "", nil, nil), 401)
	requireStatus(t, e.request("GET", "/api/leaderboards?period=nope", "", cookies[0], nil), 400)
	requireStatus(t, e.request("POST", "/api/leaderboards", "{}", cookies[0], nil), 405)
	var initial struct {
		Match struct {
			ViewerID    int64
			CurrentTurn struct{ UserID int64 }
			Players     []struct{ UserID int64 }
		}
	}
	if err := json.Unmarshal(e.request("GET", path, "", cookies[0], nil).body, &initial); err != nil {
		t.Fatal(err)
	}
	first, second := initial.Match.Players[0].UserID, initial.Match.Players[1].UserID
	number := 0
	act := func(cookie *http.Cookie, fields string) response {
		t.Helper()
		number++
		r := e.request("POST", path+"/actions", fmt.Sprintf(`{"intentId":"%08x-abcd-4000-8000-000000000000",%s}`, number, fields), cookie, nil)
		requireStatus(t, r, 200)
		return r
	}
	draw := act(cookies[0], `"kind":"draw","count":2`)
	if strings.Contains(string(draw.body), "error") {
		t.Fatal(string(draw.body))
	}
	// Replay the same public intent: the aggregate must not count it twice.
	requireStatus(t, e.request("POST", path+"/actions", fmt.Sprintf(`{"intentId":"%08x-abcd-4000-8000-000000000000","kind":"draw","count":2}`, number), cookies[0], nil), 200)
	act(cookies[0], `"kind":"roll","sides":20`)
	act(cookies[0], `"kind":"create-token","tokenName":"Soldier Token","count":3`)
	act(cookies[1], `"kind":"turn","direction":"next"`)
	act(cookies[0], `"kind":"turn","direction":"previous"`)
	act(cookies[0], fmt.Sprintf(`"kind":"counter","target":"player","playerId":%d,"subject":"life","operation":"set","value":30`, first))
	act(cookies[0], fmt.Sprintf(`"kind":"counter","target":"player","playerId":%d,"subject":"life","operation":"increment","value":5`, first))
	act(cookies[0], fmt.Sprintf(`"kind":"counter","target":"player","playerId":%d,"subject":"life","operation":"set","value":0`, first))
	act(cookies[1], fmt.Sprintf(`"kind":"counter","target":"player","playerId":%d,"subject":"life","operation":"set","value":1`, second))
	before, _ := read("")
	if before[second].Wins != 0 || before[first].Damage != 45 || before[first].Healing != 5 {
		t.Fatalf("live stats: %+v", before)
	}
	act(cookies[0], `"kind":"finish"`)
	// Adjust only timestamps of real actions in this disposable database, so
	// clock arithmetic can be asserted without sleeping or mocking the route.
	var roomID int64
	if _, err := fmt.Sscanf(path, "/api/rooms/%d/match", &roomID); err != nil {
		t.Fatal(err)
	}
	e.sql(fmt.Sprintf("UPDATE %s.match_events SET created_at='2026-11-03 12:10:00' WHERE room_id=%d", e.db, roomID))
	e.sql(fmt.Sprintf("UPDATE %s.match_events SET created_at='2026-11-03 12:00:00' WHERE room_id=%d AND action IN ('started','keep_hand')", e.db, roomID))
	e.sql(fmt.Sprintf("UPDATE %s.match_events SET created_at='2026-11-03 12:01:00' WHERE room_id=%d AND action='turn' ORDER BY id LIMIT 1", e.db, roomID))
	e.sql(fmt.Sprintf("UPDATE %s.match_events SET created_at='2026-11-03 12:03:00' WHERE room_id=%d AND action='turn' ORDER BY id DESC LIMIT 1", e.db, roomID))
	players, raw := read("")
	if players[first].Damage != 45 || players[second].Damage != 39 || players[first].Draws != 2 || players[first].Tokens != 3 || players[first].Rolls != 1 || players[second].Wins != 1 || players[second].WinLife != 1 || players[first].Streak != -1 {
		t.Fatalf("wrong aggregates: %s", raw)
	}
	owner := initial.Match.CurrentTurn.UserID
	other := first
	if owner == first {
		other = second
	}
	if players[owner].TurnSeconds != 60 || players[other].TurnSeconds != 120 || players[owner].Turns != 1 || players[other].Turns != 1 {
		t.Fatalf("turn duration attributed to actor instead of owner: %s", raw)
	}
	for _, private := range []string{"password", "login", "Island", "Soldier", "snapshot", "cardId", "turnOrder"} {
		if strings.Contains(string(raw), private) {
			t.Fatalf("private field leaked: %s", private)
		}
	}
	e.stop()
	e.start(false)
	after, _ := read("")
	if !reflect.DeepEqual(players, after) {
		t.Fatal("stats changed after restart")
	}
	e.sql(fmt.Sprintf("UPDATE %s.match_events SET created_at='2020-01-01 12:00:00' WHERE room_id=%d AND action='started'", e.db, roomID))
	for _, period := range []string{"month", "week"} {
		filtered, _ := read("?period=" + period)
		if filtered[first].Played != 0 || filtered[second].Wins != 0 || filtered[first].Damage != 0 {
			t.Fatalf("period failed: %+v", filtered)
		}
	}
	all, _ := read("?period=all")
	if all[first].Damage != 45 || all[second].Wins != 1 {
		t.Fatal("all-time lost old match")
	}
}

func TestLeaderboardsDoNotInventWinners(t *testing.T) {
	for _, life := range []int{40, 0} {
		t.Run(fmt.Sprint(life), func(t *testing.T) {
			e, cookies, path := prepareFinishMatch(t, 2)
			if life == 0 {
				var m struct {
					Match struct{ Players []struct{ UserID int64 } }
				}
				json.Unmarshal(e.request("GET", path+"/match", "", cookies[0], nil).body, &m)
				for i, p := range m.Match.Players {
					r := e.request("POST", path+"/match/actions", fmt.Sprintf(`{"intentId":"%08x-abcd-4000-8000-000000000000","kind":"counter","target":"player","playerId":%d,"subject":"life","operation":"set","value":0}`, i+1, p.UserID), cookies[i], nil)
					requireStatus(t, r, 200)
				}
			}
			requireStatus(t, e.request("POST", path+"/match/actions", finishBody(90), cookies[0], nil), 200)
			r := e.request("GET", "/api/leaderboards", "", cookies[0], nil)
			requireStatus(t, r, 200)
			var b struct {
				Players    []leaderboards.Player
				RecentWins []json.RawMessage
			}
			if err := json.Unmarshal(r.body, &b); err != nil {
				t.Fatal(err)
			}
			if len(b.RecentWins) != 0 {
				t.Fatal("invented winner")
			}
			for _, p := range b.Players {
				if p.Wins != 0 || p.Decided != 0 {
					t.Fatal("invented result")
				}
			}
		})
	}
}

func TestLeaderboardsExcludePreparationDrawsIncludingLegacyLogs(t *testing.T) {
	e, cookies, path := prepareUnconfirmedMatch(t, 2)
	// The initial four-card hand does not leave cards to draw. Return one
	// through the real HTTP action, then draw it during preparation.
	var body struct {
		Match struct {
			ViewerID int64
			Players  []struct {
				UserID int64
				Hand   []struct{ ID string }
			}
		}
	}
	r := e.request("GET", path+"/match", "", cookies[0], nil)
	requireStatus(t, r, 200)
	if err := json.Unmarshal(r.body, &body); err != nil {
		t.Fatal(err)
	}
	card := body.Match.Players[0].Hand[0].ID
	for i, fields := range []string{
		fmt.Sprintf(`"kind":"move","cardIds":[%q],"to":"library","libraryPlacement":"bottom"`, card),
		`"kind":"draw","count":1`,
	} {
		r = e.request("POST", path+"/match/actions", fmt.Sprintf(`{"intentId":"%08x-abcd-4000-8000-000000000000",%s}`, i+1, fields), cookies[0], nil)
		requireStatus(t, r, 200)
	}
	// Old events predate the additive drawCount field. Preserve their payload
	// otherwise, and assert the public aggregate still knows this was setup.
	e.sql(fmt.Sprintf("UPDATE %s.match_events SET payload=JSON_REMOVE(payload,'$.drawCount') WHERE action='draw'", e.db))
	confirmHands(t, e, path, cookies[:2]...)
	r = e.request("GET", "/api/leaderboards", "", cookies[0], nil)
	requireStatus(t, r, 200)
	var b struct{ Players []leaderboards.Player }
	if err := json.Unmarshal(r.body, &b); err != nil {
		t.Fatal(err)
	}
	for _, p := range b.Players {
		if p.Draws != 0 {
			t.Fatalf("preparation was counted: %s", r.body)
		}
	}
}
