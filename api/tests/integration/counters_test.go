package integration_test

import (
	"bytes"
	"encoding/json"
	"fmt"
	"net/http"
	"os"
	"strings"
	"testing"
)

type markerCounts struct {
	Red    int `json:"red"`
	Yellow int `json:"yellow"`
	Green  int `json:"green"`
	Blue   int `json:"blue"`
	Purple int `json:"purple"`
}

type counterCard struct {
	ID        string       `json:"id"`
	Power     int          `json:"power"`
	Toughness int          `json:"toughness"`
	Markers   markerCounts `json:"markers"`
}

func TestCountersConcurrencyPrivacyAndAtomicFailure(t *testing.T) {
	e, id, cookies, players := counterMatch(t)
	path := fmt.Sprintf("/api/rooms/%d/match/actions", id)
	sequence := 0
	action := func(target, subject, operation, color, cardID string, value int64) string {
		sequence++
		data := map[string]any{"intentId": fmt.Sprintf("20000000-0000-4000-8000-%012d", sequence), "kind": "counter", "target": target, "subject": subject, "operation": operation, "value": value}
		if target == "player" {
			data["playerId"] = players[0]
		} else {
			data["cardId"] = cardID
		}
		if subject == "marker" {
			data["color"] = color
		}
		body, err := json.Marshal(data)
		if err != nil {
			t.Fatal(err)
		}
		return string(body)
	}
	view := decodeCounters(t, e.request("POST", path, action("player", "marker", "set", "red", "", 2), cookies[0], nil))
	if view.Players[0].Markers.Red != 2 {
		t.Fatal("marcador do jogador não definido")
	}
	bodies := make([]string, 8)
	for i := range bodies {
		bodies[i] = action("player", "marker", "increment", "red", "", 1)
	}
	results := make(chan response, len(bodies))
	gate := make(chan struct{})
	for _, body := range bodies {
		go func(payload string) { <-gate; results <- e.request("POST", path, payload, cookies[0], nil) }(body)
	}
	close(gate)
	for range bodies {
		requireStatus(t, <-results, 200)
	}
	view = decodeCounters(t, e.request("GET", fmt.Sprintf("/api/rooms/%d/match", id), "", cookies[1], nil))
	if view.Players[0].Markers.Red != 10 {
		t.Fatalf("incrementos perdidos: %+v", view.Players[0])
	}
	view = decodeCounters(t, e.request("POST", path, `{"intentId":"30000000-0000-4000-8000-000000000001","kind":"draw","count":1}`, cookies[0], nil))
	cardID := view.Players[0].Hand[0].ID
	privatePower := action("card", "power", "set", "", cardID, 4)
	privateMarker := action("card", "marker", "set", "purple", cardID, 9)
	view = decodeCounters(t, e.request("POST", path, privatePower, cookies[0], nil))
	view = decodeCounters(t, e.request("POST", path, privateMarker, cookies[0], nil))
	if view.Players[0].Hand[0].Power != 4 || view.Players[0].Hand[0].Markers.Purple != 9 {
		t.Fatal("modificador ou marcador da carta não definido")
	}
	requireStatus(t, e.request("POST", path, privatePower, cookies[1], nil), 409)
	opponent := e.request("GET", fmt.Sprintf("/api/rooms/%d/match", id), "", cookies[1], nil)
	requireStatus(t, opponent, 200)
	if bytes.Contains(opponent.body, []byte(cardID)) || bytes.Contains(opponent.body, []byte(`"purple":9`)) || bytes.Contains(opponent.body, []byte(`"power":4`)) {
		t.Fatalf("modificador privado vazou: %s", opponent.body)
	}
	move := fmt.Sprintf(`{"intentId":"30000000-0000-4000-8000-000000000002","kind":"move","cardIds":[%q],"to":"battlefield"}`, cardID)
	view = decodeCounters(t, e.request("POST", path, move, cookies[0], nil))
	view = decodeCounters(t, e.request("POST", path, action("card", "power", "increment", "", cardID, -1), cookies[0], nil))
	if view.Players[0].Battlefield[0].Power != 3 || view.Players[0].Battlefield[0].Markers.Purple != 9 {
		t.Fatal("modificador não preservou movimento/incremento")
	}
	public := decodeCounters(t, e.request("GET", fmt.Sprintf("/api/rooms/%d/match", id), "", cookies[1], nil))
	if public.Players[0].Battlefield[0].Power != 3 || public.Players[0].Battlefield[0].Markers.Purple != 9 || public.Players[0].Markers.Red != 10 {
		t.Fatal("valor público não compartilhado")
	}
	before := e.request("GET", fmt.Sprintf("/api/rooms/%d/match", id), "", cookies[0], nil)
	e.sql("REVOKE INSERT ON " + e.db + ".* FROM '" + e.db + "'@'%'")
	e.disconnectDatabaseConnections()
	failedBody := action("player", "life", "increment", "", "", -8)
	requireStatus(t, e.request("POST", path, failedBody, cookies[0], nil), 500)
	after := e.request("GET", fmt.Sprintf("/api/rooms/%d/match", id), "", cookies[0], nil)
	requireStatus(t, after, 200)
	if !bytes.Equal(before.body, after.body) {
		t.Fatal("falha persistência alterou estado/log")
	}
	e.sql("GRANT INSERT ON " + e.db + ".* TO '" + e.db + "'@'%'")
	e.disconnectDatabaseConnections()
	decodeCounters(t, e.request("POST", path, failedBody, cookies[0], nil))
	e.stop()
	e.start(false)
	view = decodeCounters(t, e.request("GET", fmt.Sprintf("/api/rooms/%d/match", id), "", cookies[0], nil))
	if view.Players[0].Markers.Red != 10 || view.Players[0].Battlefield[0].Power != 3 || view.Players[0].Battlefield[0].Markers.Purple != 9 || view.Players[0].Life != 32 {
		t.Fatalf("não restaurou: %+v", view.Players[0])
	}
	for _, entry := range view.Log {
		if strings.Contains(entry.Result, cardID) || strings.Contains(entry.Result, "purple") || strings.Contains(entry.Result, "power") {
			t.Fatal("detalhe privado vazou no log histórico")
		}
	}
}

type counterPlayer struct {
	UserID      int64         `json:"userId"`
	Life        int64         `json:"life"`
	Markers     markerCounts  `json:"markers"`
	Hand        []counterCard `json:"hand"`
	Battlefield []counterCard `json:"battlefield"`
}

type counterView struct {
	ViewerID int64           `json:"viewerId"`
	Players  []counterPlayer `json:"players"`
	Log      []struct {
		Kind   string `json:"kind"`
		Result string `json:"result"`
	} `json:"log"`
}

func decodeCounters(t *testing.T, r response) counterView {
	t.Helper()
	requireStatus(t, r, 200)
	var payload struct {
		Match counterView `json:"match"`
	}
	if err := json.Unmarshal(r.body, &payload); err != nil {
		t.Fatal(err)
	}
	return payload.Match
}
func counterMatch(t *testing.T) (*environment, int64, []*http.Cookie, []int64) {
	t.Helper()
	e := newEnvironment(t)
	for _, login := range []string{"ana", "bia", "fora"} {
		e.mustCreate(login, login, "senha-contadores")
	}
	e.start(false)
	cookies := []*http.Cookie{}
	for _, login := range []string{"ana", "bia", "fora"} {
		cookies = append(cookies, sessionCookie(t, e.login(login, "senha-contadores")))
	}
	deck, err := os.ReadFile("testdata/cockatrice-deck.cod")
	if err != nil {
		t.Fatal(err)
	}
	var roomID int64
	for i := 0; i < 2; i++ {
		upload := e.uploadDeck(cookies[i], deck)
		requireStatus(t, upload, 201)
		var data struct {
			Deck struct {
				ID int64 `json:"id"`
			} `json:"deck"`
		}
		if err := json.Unmarshal(upload.body, &data); err != nil {
			t.Fatal(err)
		}
		if i == 0 {
			created := e.request("POST", "/api/rooms", roomJSON(), cookies[i], nil)
			requireStatus(t, created, 201)
			roomID = decodeRoom(t, created).ID
		} else {
			requireStatus(t, e.request("POST", fmt.Sprintf("/api/rooms/%d/participants", roomID), "{}", cookies[i], nil), 200)
		}
		requireStatus(t, e.request("PUT", fmt.Sprintf("/api/rooms/%d/participants/me/ready", roomID), fmt.Sprintf(`{"deckId":%d}`, data.Deck.ID), cookies[i], nil), 200)
	}
	requireStatus(t, e.request("POST", fmt.Sprintf("/api/rooms/%d/start", roomID), "{}", cookies[0], nil), 201)
	returnOpeningHandsToLibrary(t, e, roomID, cookies[0], cookies[1])
	view := decodeCounters(t, e.request("GET", fmt.Sprintf("/api/rooms/%d/match", roomID), "", cookies[0], nil))
	return e, roomID, cookies, []int64{view.Players[0].UserID, view.Players[1].UserID}
}

func TestLifeCountersPublicPermissionsAndDurability(t *testing.T) {
	e, id, cookies, players := counterMatch(t)
	path := fmt.Sprintf("/api/rooms/%d/match/actions", id)
	body := fmt.Sprintf(`{"intentId":"10000000-0000-4000-8000-000000000001","kind":"counter","target":"player","playerId":%d,"subject":"life","operation":"increment","value":-3}`, players[0])
	view := decodeCounters(t, e.request("POST", path, body, cookies[0], nil))
	if view.Players[0].Life != 37 {
		t.Fatalf("vida: %+v", view.Players[0])
	}
	view = decodeCounters(t, e.request("POST", path, body, cookies[0], nil))
	if view.Players[0].Life != 37 {
		t.Fatal("retry duplicou incremento")
	}
	shared := decodeCounters(t, e.request("GET", fmt.Sprintf("/api/rooms/%d/match", id), "", cookies[1], nil))
	if shared.Players[0].Life != 37 {
		t.Fatal("vida não é pública")
	}
	requireStatus(t, e.request("POST", path, body, cookies[1], nil), 409)
	requireStatus(t, e.request("POST", path, body, cookies[2], nil), 404)
	e.stop()
	e.start(false)
	view = decodeCounters(t, e.request("GET", fmt.Sprintf("/api/rooms/%d/match", id), "", cookies[1], nil))
	if view.Players[0].Life != 37 || view.Log[len(view.Log)-1].Kind != "counter" {
		t.Fatalf("vida/log após reinício: %+v", view)
	}
}

func TestCountersValidateValuesAndTargets(t *testing.T) {
	e, id, cookies, players := counterMatch(t)
	path := fmt.Sprintf("/api/rooms/%d/match/actions", id)
	base := fmt.Sprintf(`{"intentId":"40000000-0000-4000-8000-000000000001","kind":"counter","target":"player","playerId":%d,"subject":"life","operation":"set","value":0}`, players[0])
	for _, body := range []string{
		strings.Replace(base, `"value":0`, `"value":0.5`, 1),
		strings.Replace(base, `"value":0`, `"value":9007199254740992`, 1),
		strings.Replace(base, `"value":0`, `"value":null`, 1),
		strings.Replace(base, `"subject":"life"`, `"name":"livre"`, 1),
		strings.Replace(base, `"subject":"life"`, `"subject":"outro"`, 1),
		strings.Replace(base, `"operation":"set"`, `"operation":"remove"`, 1),
		strings.Replace(base, `"value":0`, `"value":0,"cardId":"foreign"`, 1),
		strings.Replace(base, `"value":0`, `"value":0,"count":1`, 1),
		strings.Replace(base, `"kind":"counter"`, `"kind":"coin"`, 1),
		strings.Replace(base, `"subject":"life"`, `"subject":"marker"`, 1),
		strings.Replace(base, `"subject":"life"`, `"subject":"marker","color":"orange"`, 1),
		strings.Replace(base, `"subject":"life"`, `"subject":"power"`, 1),
		fmt.Sprintf(`{"intentId":"40000000-0000-4000-8000-000000000009","kind":"counter","target":"card","cardId":"ausente","subject":"life","operation":"set","value":1}`),
	} {
		requireStatus(t, e.request("POST", path, body, cookies[0], nil), 400)
	}
	view := decodeCounters(t, e.request("POST", path, base, cookies[0], nil))
	if view.Players[0].Life != 0 {
		t.Fatal("zero deveria ser aceito")
	}
	ignored := strings.Replace(strings.Replace(base, "000000000001", "000000000010", 1), `"value":0`, `"value":7,"color":"red"`, 1)
	view = decodeCounters(t, e.request("POST", path, ignored, cookies[0], nil))
	if view.Players[0].Life != 7 || view.Players[0].Markers.Red != 0 {
		t.Fatal("vida não deve usar cor")
	}
	negative := strings.Replace(strings.Replace(base, "000000000001", "000000000002", 1), `"value":0`, `"value":-20`, 1)
	view = decodeCounters(t, e.request("POST", path, negative, cookies[0], nil))
	if view.Players[0].Life != -20 {
		t.Fatal("não deve avaliar derrota")
	}
	maximum := strings.Replace(strings.Replace(base, "000000000001", "000000000003", 1), `"value":0`, `"value":9007199254740991`, 1)
	decodeCounters(t, e.request("POST", path, maximum, cookies[0], nil))
	overflow := strings.Replace(strings.Replace(strings.Replace(base, "000000000001", "000000000004", 1), `"operation":"set"`, `"operation":"increment"`, 1), `"value":0`, `"value":1`, 1)
	requireStatus(t, e.request("POST", path, overflow, cookies[0], nil), 409)
	view = decodeCounters(t, e.request("GET", fmt.Sprintf("/api/rooms/%d/match", id), "", cookies[0], nil))
	if view.Players[0].Life != 9007199254740991 {
		t.Fatal("overflow alterou estado")
	}
}

func TestCountersRespectControllerAndHiddenMetadata(t *testing.T) {
	e, id, cookies, players := counterMatch(t)
	path := fmt.Sprintf("/api/rooms/%d/match/actions", id)
	view := decodeCounters(t, e.request("POST", path, `{"intentId":"50000000-0000-4000-8000-000000000001","kind":"draw","count":1}`, cookies[0], nil))
	cardID := view.Players[0].Hand[0].ID
	move := fmt.Sprintf(`{"intentId":"50000000-0000-4000-8000-000000000002","kind":"move","cardIds":[%q],"to":"battlefield"}`, cardID)
	decodeCounters(t, e.request("POST", path, move, cookies[0], nil))
	e.sql(fmt.Sprintf("UPDATE "+e.db+".matches SET snapshot=JSON_SET(snapshot,'$.players[0].battlefield[0].controllerId',%d,'$.players[0].battlefield[0].faceDown',true) WHERE room_id=%d", players[1], id))
	body := fmt.Sprintf(`{"intentId":"50000000-0000-4000-8000-000000000003","kind":"counter","target":"card","cardId":%q,"subject":"marker","color":"red","operation":"set","value":5}`, cardID)
	requireStatus(t, e.request("POST", path, body, cookies[0], nil), 409)
	view = decodeCounters(t, e.request("POST", path, body, cookies[1], nil))
	if view.Players[0].Battlefield[0].Markers.Red != 5 {
		t.Fatal("controlador não recebeu marcador")
	}
	e.sql(fmt.Sprintf("UPDATE "+e.db+".matches SET snapshot=JSON_SET(snapshot,'$.players[0].battlefield[0].controllerId',%d) WHERE room_id=%d", players[0], id))
	observer := e.request("GET", fmt.Sprintf("/api/rooms/%d/match", id), "", cookies[1], nil)
	requireStatus(t, observer, 200)
	hidden := decodeCounters(t, observer)
	if hidden.Players[0].Battlefield[0].Markers.Red != 0 || bytes.Contains(observer.body, []byte(`"red":5`)) {
		t.Fatalf("marcador de carta oculta vazou: %s", observer.body)
	}
	decodeCounters(t, e.request("POST", path, fmt.Sprintf(`{"intentId":"50000000-0000-4000-8000-000000000004","kind":"move","cardIds":[%q],"to":"hand"}`, cardID), cookies[0], nil))
	e.sql(fmt.Sprintf("UPDATE "+e.db+".matches SET snapshot=JSON_SET(snapshot,'$.players[0].hand[0].controllerId',%d) WHERE room_id=%d", players[1], id))
	requireStatus(t, e.request("POST", path, strings.Replace(body, "000000000003", "000000000005", 1), cookies[1], nil), 409)
	owned := decodeCounters(t, e.request("POST", path, strings.Replace(body, "000000000003", "000000000006", 1), cookies[0], nil))
	if owned.Players[0].Hand[0].Markers.Red != 5 {
		t.Fatal("dono não alterou a carta na mão")
	}
}
