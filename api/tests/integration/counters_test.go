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

type counterCard struct {
	ID       string         `json:"id"`
	Counters map[string]int `json:"counters"`
}

func TestNamedCountersConcurrencyPrivacyAndAtomicFailure(t *testing.T) {
	e, id, cookies, players := counterMatch(t)
	path := fmt.Sprintf("/api/rooms/%d/match/actions", id)
	sequence := 0
	action := func(target, operation, name string, value int64, cardID string) string {
		sequence++
		data := map[string]any{"intentId": fmt.Sprintf("20000000-0000-4000-8000-%012d", sequence), "kind": "counter", "target": target, "operation": operation, "name": name, "value": value}
		if target == "player" {
			data["playerId"] = players[0]
		} else {
			data["cardId"] = cardID
		}
		body, err := json.Marshal(data)
		if err != nil {
			t.Fatal(err)
		}
		return string(body)
	}
	view := decodeCounters(t, e.request("POST", path, action("player", "set", "Veneno", 2, ""), cookies[0], nil))
	if view.Players[0].Counters["Veneno"] != 2 {
		t.Fatal("contador jogador não definido")
	}
	results := make(chan response, 8)
	gate := make(chan struct{})
	for i := 0; i < 8; i++ {
		body := action("player", "increment", "Veneno", 1, "")
		go func() { <-gate; results <- e.request("POST", path, body, cookies[0], nil) }()
	}
	close(gate)
	for i := 0; i < 8; i++ {
		requireStatus(t, <-results, 200)
	}
	view = decodeCounters(t, e.request("GET", fmt.Sprintf("/api/rooms/%d/match", id), "", cookies[1], nil))
	if view.Players[0].Counters["Veneno"] != 10 {
		t.Fatalf("incrementos perdidos: %+v", view.Players[0])
	}
	view = decodeCounters(t, e.request("POST", path, `{"intentId":"30000000-0000-4000-8000-000000000001","kind":"draw","count":1}`, cookies[0], nil))
	cardID := view.Players[0].Hand[0].ID
	private := action("card", "set", "Segredo contador", 4, cardID)
	view = decodeCounters(t, e.request("POST", path, private, cookies[0], nil))
	if view.Players[0].Hand[0].Counters["Segredo contador"] != 4 {
		t.Fatal("contador carta não definido")
	}
	if !hasCounterName(view, view.ViewerID, "Veneno") || !hasCounterName(view, view.ViewerID, "Segredo contador") {
		t.Fatalf("nomes usados na partida: %+v", view.Players)
	}
	requireStatus(t, e.request("POST", path, private, cookies[1], nil), 409)
	opponent := e.request("GET", fmt.Sprintf("/api/rooms/%d/match", id), "", cookies[1], nil)
	requireStatus(t, opponent, 200)
	if bytes.Contains(opponent.body, []byte("Segredo contador")) || bytes.Contains(opponent.body, []byte(cardID)) || bytes.Contains(opponent.body, []byte("counterNames")) {
		t.Fatalf("contador privado vazou: %s", opponent.body)
	}
	move := fmt.Sprintf(`{"intentId":"30000000-0000-4000-8000-000000000002","kind":"move","cardIds":[%q],"to":"battlefield"}`, cardID)
	view = decodeCounters(t, e.request("POST", path, move, cookies[0], nil))
	view = decodeCounters(t, e.request("POST", path, action("card", "increment", "Segredo contador", -1, cardID), cookies[0], nil))
	if view.Players[0].Battlefield[0].Counters["Segredo contador"] != 3 {
		t.Fatal("contador não preservou movimento/incremento")
	}
	public := decodeCounters(t, e.request("GET", fmt.Sprintf("/api/rooms/%d/match", id), "", cookies[1], nil))
	if public.Players[0].Battlefield[0].Counters["Segredo contador"] != 3 {
		t.Fatal("contador público não compartilhado")
	}
	before := e.request("GET", fmt.Sprintf("/api/rooms/%d/match", id), "", cookies[0], nil)
	// Denying log insertion must roll back the snapshot update too.
	e.sql("REVOKE INSERT ON " + e.db + ".* FROM '" + e.db + "'@'%'")
	e.disconnectDatabaseConnections()
	failedBody := action("player", "increment", "Vida", -8, "")
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
	if view.Players[0].Counters["Veneno"] != 10 || view.Players[0].Battlefield[0].Counters["Segredo contador"] != 3 || view.Players[0].Life != 32 {
		t.Fatalf("não restaurou: %+v", view.Players[0])
	}
	if !hasCounterName(view, view.ViewerID, "Veneno") || !hasCounterName(view, view.ViewerID, "Segredo contador") {
		t.Fatal("nomes do jogador não sobreviveram ao reinício")
	}
	for _, entry := range view.Log {
		if strings.Contains(entry.Result, "Segredo contador") {
			t.Fatal("nome privado vazou no log histórico")
		}
	}
}

type counterPlayer struct {
	UserID       int64          `json:"userId"`
	Life         int            `json:"life"`
	Counters     map[string]int `json:"counters"`
	CounterNames []string       `json:"counterNames"`
	Hand         []counterCard  `json:"hand"`
	Battlefield  []counterCard  `json:"battlefield"`
}

func hasCounterName(view counterView, userID int64, name string) bool {
	for _, player := range view.Players {
		if player.UserID != userID {
			continue
		}
		for _, existing := range player.CounterNames {
			if existing == name {
				return true
			}
		}
	}
	return false
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
			created := e.request("POST", "/api/rooms", "{}", cookies[i], nil)
			requireStatus(t, created, 201)
			roomID = decodeRoom(t, created).ID
		} else {
			requireStatus(t, e.request("POST", fmt.Sprintf("/api/rooms/%d/participants", roomID), "{}", cookies[i], nil), 200)
		}
		requireStatus(t, e.request("PUT", fmt.Sprintf("/api/rooms/%d/participants/me/ready", roomID), fmt.Sprintf(`{"deckId":%d}`, data.Deck.ID), cookies[i], nil), 200)
	}
	requireStatus(t, e.request("POST", fmt.Sprintf("/api/rooms/%d/start", roomID), "{}", cookies[0], nil), 201)
	view := decodeCounters(t, e.request("GET", fmt.Sprintf("/api/rooms/%d/match", roomID), "", cookies[0], nil))
	return e, roomID, cookies, []int64{view.Players[0].UserID, view.Players[1].UserID}
}

func TestLifeCountersPublicPermissionsAndDurability(t *testing.T) {
	e, id, cookies, players := counterMatch(t)
	path := fmt.Sprintf("/api/rooms/%d/match/actions", id)
	body := fmt.Sprintf(`{"intentId":"10000000-0000-4000-8000-000000000001","kind":"counter","target":"player","playerId":%d,"name":"Vida","operation":"increment","value":-3}`, players[0])
	view := decodeCounters(t, e.request("POST", path, body, cookies[0], nil))
	if view.Players[0].Life != 37 {
		t.Fatalf("vida: %+v", view.Players[0])
	}
	view = decodeCounters(t, e.request("POST", path, body, cookies[0], nil))
	if view.Players[0].Life != 37 {
		t.Fatal("retry duplicou incremento")
	}
	requireStatus(t, e.request("POST", path, body, cookies[1], nil), 409)
	requireStatus(t, e.request("POST", path, body, cookies[2], nil), 404)
	e.stop()
	e.start(false)
	view = decodeCounters(t, e.request("GET", fmt.Sprintf("/api/rooms/%d/match", id), "", cookies[1], nil))
	if view.Players[0].Life != 37 || len(view.Log) != 2 || view.Log[1].Kind != "counter" {
		t.Fatalf("vida/log após reinício: %+v", view)
	}
}

func TestCountersValidateValuesNamesAndTargets(t *testing.T) {
	e, id, cookies, players := counterMatch(t)
	path := fmt.Sprintf("/api/rooms/%d/match/actions", id)
	base := fmt.Sprintf(`{"intentId":"40000000-0000-4000-8000-000000000001","kind":"counter","target":"player","playerId":%d,"name":"Vida","operation":"set","value":0}`, players[0])
	for _, body := range []string{
		strings.Replace(base, `"value":0`, `"value":0.5`, 1),
		strings.Replace(base, `"value":0`, `"value":9007199254740992`, 1),
		strings.Replace(base, `"value":0`, `"value":null`, 1),
		strings.Replace(base, `"name":"Vida"`, `"name":"  "`, 1),
		strings.Replace(base, `"name":"Vida"`, `"name":"x\ny"`, 1),
		strings.Replace(base, `"operation":"set"`, `"operation":"remove"`, 1),
		strings.Replace(base, `"value":0`, `"value":0,"cardId":"foreign"`, 1),
		strings.Replace(base, `"value":0`, `"value":0,"count":1`, 1),
		strings.Replace(base, `"kind":"counter"`, `"kind":"coin"`, 1),
	} {
		requireStatus(t, e.request("POST", path, body, cookies[0], nil), 400)
	}
	view := decodeCounters(t, e.request("POST", path, base, cookies[0], nil))
	if view.Players[0].Life != 0 {
		t.Fatal("zero deveria ser aceito")
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
	if int64(view.Players[0].Life) != 9007199254740991 {
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
	// Prepare an existing transferred, face-down card. The transfer action is
	// issue 14; assertions below exercise counters exclusively over HTTP.
	e.sql(fmt.Sprintf("UPDATE "+e.db+".matches SET snapshot=JSON_SET(snapshot,'$.players[0].battlefield[0].controllerId',%d,'$.players[0].battlefield[0].faceDown',true) WHERE room_id=%d", players[1], id))
	body := fmt.Sprintf(`{"intentId":"50000000-0000-4000-8000-000000000003","kind":"counter","target":"card","cardId":%q,"name":"Nome oculto","operation":"set","value":5}`, cardID)
	requireStatus(t, e.request("POST", path, body, cookies[0], nil), 409)
	view = decodeCounters(t, e.request("POST", path, body, cookies[1], nil))
	if view.Players[0].Battlefield[0].Counters["Nome oculto"] != 5 {
		t.Fatal("controlador não recebeu contador")
	}
	// An observer distinct from owner/controller must not see the counter on the face-down card.
	// The name stays in the suggestion list of the player who created it, only in this match.
	e.sql(fmt.Sprintf("UPDATE "+e.db+".matches SET snapshot=JSON_SET(snapshot,'$.players[0].battlefield[0].controllerId',%d) WHERE room_id=%d", players[0], id))
	observer := e.request("GET", fmt.Sprintf("/api/rooms/%d/match", id), "", cookies[1], nil)
	requireStatus(t, observer, 200)
	hidden := decodeCounters(t, observer)
	if hidden.Players[0].Battlefield[0].Counters["Nome oculto"] != 0 {
		t.Fatalf("contador de carta oculta vazou: %+v", hidden.Players[0].Battlefield[0])
	}
	if !hasCounterName(hidden, hidden.ViewerID, "Nome oculto") {
		t.Fatal("quem criou o nome não o reencontrou na partida")
	}
	owner := e.request("GET", fmt.Sprintf("/api/rooms/%d/match", id), "", cookies[0], nil)
	requireStatus(t, owner, 200)
	if bytes.Contains(owner.body, []byte("counterNames")) {
		t.Fatalf("lista de nomes vazou para outro jogador: %s", owner.body)
	}
	decodeCounters(t, e.request("POST", path, fmt.Sprintf(`{"intentId":"50000000-0000-4000-8000-000000000004","kind":"move","cardIds":[%q],"to":"hand"}`, cardID), cookies[0], nil))
	// Outside the battlefield only ownership authorizes the counter change.
	e.sql(fmt.Sprintf("UPDATE "+e.db+".matches SET snapshot=JSON_SET(snapshot,'$.players[0].hand[0].controllerId',%d) WHERE room_id=%d", players[1], id))
	requireStatus(t, e.request("POST", path, strings.Replace(body, "000000000003", "000000000005", 1), cookies[1], nil), 409)
	decodeCounters(t, e.request("POST", path, strings.Replace(body, "000000000003", "000000000006", 1), cookies[0], nil))
}
