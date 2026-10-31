package integration_test

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"strings"
	"testing"
	"time"

	"github.com/coder/websocket"
)

type liveMessage struct {
	Game string          `json:"game"`
	Type string          `json:"type"`
	ID   string          `json:"id"`
	Data json.RawMessage `json:"data"`
}

type liveClient struct {
	t        *testing.T
	conn     *websocket.Conn
	incoming chan liveMessage
	ended    chan error
}

// newLiveClient reads in the background: a Read whose context expires closes the
// connection, and these tests need to wait for silence on a connection that lives on.
func newLiveClient(t *testing.T, conn *websocket.Conn) *liveClient {
	client := &liveClient{t, conn, make(chan liveMessage, 256), make(chan error, 1)}
	go func() {
		for {
			_, data, err := conn.Read(context.Background())
			if err != nil {
				client.ended <- err
				return
			}
			var message liveMessage
			if err := json.Unmarshal(data, &message); err != nil {
				client.ended <- err
				return
			}
			client.incoming <- message
		}
	}()
	return client
}

var errNoLiveMessage = errors.New("nenhuma mensagem a tempo")

func dialLive(e *environment, path string, cookie *http.Cookie, origin string) (*websocket.Conn, *http.Response, error) {
	header := http.Header{}
	if cookie != nil {
		header.Set("Cookie", cookie.Name+"="+cookie.Value)
	}
	if origin != "" {
		header.Set("Origin", origin)
	}
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()
	return websocket.Dial(ctx, strings.Replace(e.url, "http://", "ws://", 1)+path+"/live", &websocket.DialOptions{HTTPHeader: header})
}

func connectLive(t *testing.T, e *environment, path string, cookie *http.Cookie) *liveClient {
	t.Helper()
	conn, _, err := dialLive(e, path, cookie, e.url)
	if err != nil {
		t.Fatalf("conectar WS: %v", err)
	}
	t.Cleanup(func() { conn.CloseNow() })
	client := newLiveClient(t, conn)
	// A conexão só está na sala de verdade depois de receber o estado inicial.
	client.next("dice", "snapshot")
	return client
}

func (c *liveClient) read(timeout time.Duration) (liveMessage, error) {
	select {
	case message := <-c.incoming:
		return message, nil
	case err := <-c.ended:
		return liveMessage{}, err
	case <-time.After(timeout):
		return liveMessage{}, errNoLiveMessage
	}
}

// next ignores what comes before the expected message and fails if it never comes.
func (c *liveClient) next(game, kind string) liveMessage {
	c.t.Helper()
	deadline := time.Now().Add(20 * time.Second)
	for {
		message, err := c.read(time.Until(deadline))
		if err != nil {
			c.t.Fatalf("esperava %s/%s: %v", game, kind, err)
		}
		if message.Game == game && message.Type == kind {
			return message
		}
	}
}

func (c *liveClient) send(game, kind, id, data string) {
	c.t.Helper()
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()
	body := fmt.Sprintf(`{"game":%q,"type":%q,"id":%q,"data":%s}`, game, kind, id, data)
	if err := c.conn.Write(ctx, websocket.MessageText, []byte(body)); err != nil {
		c.t.Fatal(err)
	}
}

// reply waits for the answer to one message and returns its type and error text.
func (c *liveClient) reply(id string) (string, string, int64) {
	c.t.Helper()
	deadline := time.Now().Add(10 * time.Second)
	for {
		message, err := c.read(time.Until(deadline))
		if err != nil {
			c.t.Fatalf("sem resposta para %s: %v", id, err)
		}
		if message.ID != id {
			continue
		}
		var detail struct {
			Message      string `json:"message"`
			RetryAfterMs int64  `json:"retryAfterMs"`
		}
		_ = json.Unmarshal(message.Data, &detail)
		return message.Type, detail.Message, detail.RetryAfterMs
	}
}

func (c *liveClient) requireAck(id string) {
	c.t.Helper()
	if kind, text, _ := c.reply(id); kind != "ack" {
		c.t.Fatalf("%s: %s %s", id, kind, text)
	}
}

// silent proves that nothing arrives for a while.
func (c *liveClient) silent(game string, wait time.Duration) {
	c.t.Helper()
	deadline := time.Now().Add(wait)
	for time.Now().Before(deadline) {
		message, err := c.read(time.Until(deadline))
		if errors.Is(err, errNoLiveMessage) {
			return
		}
		if err != nil {
			c.t.Fatalf("conexão encerrada durante a espera: %v", err)
		}
		if message.Game == game {
			c.t.Fatalf("mensagem inesperada: %s/%s %s", message.Game, message.Type, message.Data)
		}
	}
}

type liveRoom struct {
	path                string
	ana, bia, cida      *http.Cookie
	outsider            *http.Cookie
	anaID, biaID, cida3 int64
}

func newLiveRoom(t *testing.T, e *environment) liveRoom {
	t.Helper()
	for _, name := range []string{"ana", "bia", "cida", "fora"} {
		e.mustCreate(name, name, "senha-da-sala")
	}
	e.start(false)
	room := liveRoom{
		ana: sessionCookie(t, e.login("ana", "senha-da-sala")), bia: sessionCookie(t, e.login("bia", "senha-da-sala")),
		cida: sessionCookie(t, e.login("cida", "senha-da-sala")), outsider: sessionCookie(t, e.login("fora", "senha-da-sala")),
	}
	created := e.request("POST", "/api/rooms", roomJSON(), room.ana, nil)
	requireStatus(t, created, 201)
	detail := decodeRoom(t, created)
	room.path = fmt.Sprintf("/api/rooms/%d", detail.ID)
	for _, cookie := range []*http.Cookie{room.bia, room.cida} {
		requireStatus(t, e.request("POST", room.path+"/participants", "{}", cookie, nil), 200)
	}
	room.anaID = sessionUserID(t, e, room.ana)
	room.biaID = sessionUserID(t, e, room.bia)
	room.cida3 = sessionUserID(t, e, room.cida)
	return room
}

func sessionUserID(t *testing.T, e *environment, cookie *http.Cookie) int64 {
	t.Helper()
	var payload struct {
		User struct {
			ID int64 `json:"id"`
		} `json:"user"`
	}
	session := e.request("GET", "/api/session", "", cookie, nil)
	requireStatus(t, session, 200)
	if err := json.Unmarshal(session.body, &payload); err != nil {
		t.Fatal(err)
	}
	return payload.User.ID
}

func TestLiveHandshakeRequiresSessionMembershipAndOrigin(t *testing.T) {
	e := newEnvironment(t)
	room := newLiveRoom(t, e)
	for name, test := range map[string]struct {
		path   string
		cookie *http.Cookie
		origin string
		status int
	}{
		"sem sessão":       {room.path, nil, e.url, 401},
		"fora da sala":     {room.path, room.outsider, e.url, 404},
		"sala inexistente": {"/api/rooms/999999", room.ana, e.url, 404},
		"origem cruzada":   {room.path, room.ana, "https://outro.example", 403},
	} {
		conn, response, err := dialLive(e, test.path, test.cookie, test.origin)
		if err == nil {
			conn.CloseNow()
			t.Fatalf("%s: conectou", name)
		}
		if response == nil || response.StatusCode != test.status {
			t.Fatalf("%s: resposta %+v, esperado %d", name, response, test.status)
		}
	}
}

func TestLiveDiceReachesTheRoomWithoutReplayAfterReconnecting(t *testing.T) {
	e := newEnvironment(t)
	e.rolls = "7,11"
	room := newLiveRoom(t, e)
	ana := connectLive(t, e, room.path, room.ana)
	bia := connectLive(t, e, room.path, room.bia)
	roll := func(cookie *http.Cookie, n int) {
		t.Helper()
		requireStatus(t, e.request("POST", room.path+"/preparation/actions", fmt.Sprintf(`{"intentId":"00000000-0000-4000-8000-%012d","kind":"roll","power":3}`, n), cookie, nil), 200)
	}
	roll(room.ana, 1)
	var state struct {
		Phase string `json:"phase"`
		Rolls []struct {
			ID    string `json:"id"`
			Value int    `json:"value"`
			Power int    `json:"power"`
		} `json:"rolls"`
	}
	if err := json.Unmarshal(bia.next("dice", "state").Data, &state); err != nil {
		t.Fatal(err)
	}
	if state.Phase != "preparing" || len(state.Rolls) != 1 || state.Rolls[0].Value != 7 || state.Rolls[0].Power != 3 {
		t.Fatalf("rolagem não chegou à sala: %+v", state)
	}
	ana.next("dice", "state")

	// Quem estava fora recebe só o estado atual, nenhum evento antigo.
	bia.conn.CloseNow()
	roll(room.ana, 2)
	back, _, err := dialLive(e, room.path, room.bia, e.url)
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { back.CloseNow() })
	returned := newLiveClient(t, back)
	snapshot := returned.next("dice", "snapshot")
	if err := json.Unmarshal(snapshot.Data, &state); err != nil {
		t.Fatal(err)
	}
	if len(state.Rolls) != 2 {
		t.Fatalf("o estado inicial deveria trazer as duas rolagens: %s", snapshot.Data)
	}
	returned.silent("dice", 1500*time.Millisecond)

	// A brincadeira fica só na memória: não sobrevive ao reinício da API.
	e.stop()
	e.start(false)
	recovered := e.request("GET", room.path+"/preparation", "", room.ana, nil)
	requireStatus(t, recovered, 200)
	if strings.Contains(string(recovered.body), `"value":7`) {
		t.Fatalf("a brincadeira foi persistida: %s", recovered.body)
	}
}

func TestLiveEmojiFallsForEveryoneWithServerCooldown(t *testing.T) {
	e := newEnvironment(t)
	room := newLiveRoom(t, e)
	ana := connectLive(t, e, room.path, room.ana)
	secondTab := connectLive(t, e, room.path, room.ana)
	bia := connectLive(t, e, room.path, room.bia)

	ana.send("emoji", "send", "e1", `{"emoji":"💀"}`)
	var fall struct {
		Emoji    string `json:"emoji"`
		FromID   int64  `json:"fromId"`
		FromName string `json:"fromName"`
	}
	if err := json.Unmarshal(bia.next("emoji", "fall").Data, &fall); err != nil {
		t.Fatal(err)
	}
	if fall.Emoji != "💀" || fall.FromID != room.anaID || fall.FromName != "ana" {
		t.Fatalf("emoji incorreto: %+v", fall)
	}
	// O cooldown é da pessoa: abrir outra aba não libera outro emoji.
	secondTab.send("emoji", "send", "e2", `{"emoji":"🔥"}`)
	kind, _, retry := secondTab.reply("e2")
	if kind != "error" || retry <= 0 || retry > 2000 {
		t.Fatalf("cooldown não aplicado: %s, %d ms", kind, retry)
	}
	bia.silent("emoji", 300*time.Millisecond)
	bia.send("emoji", "send", "e3", `{"emoji":"não é emoji"}`)
	if kind, text, _ := bia.reply("e3"); kind != "error" || text != "Emoji inválido." {
		t.Fatalf("aceitou emoji fora da lista: %s %s", kind, text)
	}
	time.Sleep(2100 * time.Millisecond)
	ana.send("emoji", "send", "e4", `{"emoji":"🔥"}`)
	ana.requireAck("e4")
}

type duelState struct {
	Duels []struct {
		ID           int64             `json:"id"`
		ChallengerID int64             `json:"challengerId"`
		OpponentID   int64             `json:"opponentId"`
		Confirmed    map[string]string `json:"confirmed"`
		Conflict     bool              `json:"conflict"`
	} `json:"duels"`
}

func decodeDuels(t *testing.T, message liveMessage) duelState {
	t.Helper()
	var state duelState
	if err := json.Unmarshal(message.Data, &state); err != nil {
		t.Fatal(err)
	}
	return state
}

func TestLiveCoinDuelResultReachesWholeRoomAndBlocksSameSide(t *testing.T) {
	e := newEnvironment(t)
	room := newLiveRoom(t, e)
	ana := connectLive(t, e, room.path, room.ana)
	bia := connectLive(t, e, room.path, room.bia)
	cida := connectLive(t, e, room.path, room.cida)

	ana.send("coin-duel", "challenge", "self", fmt.Sprintf(`{"opponentId":%d}`, room.anaID))
	if kind, _, _ := ana.reply("self"); kind != "error" {
		t.Fatal("aceitou desafiar a si mesma")
	}
	ana.send("coin-duel", "challenge", "c1", fmt.Sprintf(`{"opponentId":%d}`, room.biaID))
	ana.requireAck("c1")
	challenged := decodeDuels(t, bia.next("coin-duel", "state"))
	if len(challenged.Duels) != 1 || challenged.Duels[0].OpponentID != room.biaID {
		t.Fatalf("desafio incorreto: %+v", challenged)
	}
	cida.send("coin-duel", "challenge", "busy", fmt.Sprintf(`{"opponentId":%d}`, room.biaID))
	if kind, text, _ := cida.reply("busy"); kind != "error" || !strings.Contains(text, "já está em um X1") {
		t.Fatalf("aceitou duelo paralelo da mesma pessoa: %s %s", kind, text)
	}

	// Os dois confirmam o mesmo lado: nada é sorteado até um deles trocar.
	ana.send("coin-duel", "confirm", "a1", `{"side":"Cara"}`)
	ana.requireAck("a1")
	bia.next("coin-duel", "state")
	bia.send("coin-duel", "confirm", "b1", `{"side":"Cara"}`)
	bia.requireAck("b1")
	conflict := decodeDuels(t, cida.lastDuelState(2))
	if len(conflict.Duels) != 1 || !conflict.Duels[0].Conflict {
		t.Fatalf("mesmo lado deveria ficar em conflito: %+v", conflict)
	}
	cida.silent("coin-duel", 300*time.Millisecond)

	bia.send("coin-duel", "unconfirm", "b2", `{}`)
	bia.requireAck("b2")
	cleared := decodeDuels(t, ana.lastDuelState(2))
	if cleared.Duels[0].Conflict || len(cleared.Duels[0].Confirmed) != 1 {
		t.Fatalf("desconfirmar deveria limpar o conflito: %+v", cleared)
	}
	bia.send("coin-duel", "confirm", "b3", `{"side":"Coroa"}`)
	bia.requireAck("b3")

	var result struct {
		Side       string `json:"side"`
		WinnerID   int64  `json:"winnerId"`
		WinnerName string `json:"winnerName"`
		LoserName  string `json:"loserName"`
	}
	if err := json.Unmarshal(cida.next("coin-duel", "result").Data, &result); err != nil {
		t.Fatal(err)
	}
	wantWinner, wantLoser := room.anaID, "bia"
	if result.Side == "Coroa" {
		wantWinner, wantLoser = room.biaID, "ana"
	}
	if (result.Side != "Cara" && result.Side != "Coroa") || result.WinnerID != wantWinner || result.LoserName != wantLoser {
		t.Fatalf("resultado incoerente com os lados: %+v", result)
	}
	ana.next("coin-duel", "result")
}

// lastDuelState reads the state that follows the given number of changes.
func (c *liveClient) lastDuelState(changes int) liveMessage {
	c.t.Helper()
	var message liveMessage
	for range changes {
		message = c.next("coin-duel", "state")
	}
	return message
}

func TestLiveCoinDuelSurvivesReloadAndEndsWhenPlayerLeaves(t *testing.T) {
	e := newEnvironment(t)
	room := newLiveRoom(t, e)
	ana := connectLive(t, e, room.path, room.ana)
	bia := connectLive(t, e, room.path, room.bia)
	ana.send("coin-duel", "challenge", "c1", fmt.Sprintf(`{"opponentId":%d}`, room.biaID))
	ana.requireAck("c1")
	bia.next("coin-duel", "state")

	// Um F5 não perde o duelo.
	bia.conn.CloseNow()
	conn, _, err := dialLive(e, room.path, room.bia, e.url)
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { conn.CloseNow() })
	reloaded := newLiveClient(t, conn)
	if state := decodeDuels(t, reloaded.next("coin-duel", "snapshot")); len(state.Duels) != 1 {
		t.Fatalf("o duelo sumiu no F5: %+v", state)
	}
	// Sair de vez encerra, sem deixar a outra pessoa presa.
	conn.CloseNow()
	var cancelled struct {
		Message string `json:"message"`
	}
	if err := json.Unmarshal(ana.next("coin-duel", "cancelled").Data, &cancelled); err != nil {
		t.Fatal(err)
	}
	if !strings.Contains(cancelled.Message, "bia saiu da sala") {
		t.Fatalf("motivo inesperado: %s", cancelled.Message)
	}
	ana.send("coin-duel", "challenge", "offline", fmt.Sprintf(`{"opponentId":%d}`, room.biaID))
	if kind, text, _ := ana.reply("offline"); kind != "error" || !strings.Contains(text, "não está na sala") {
		t.Fatalf("aceitou desafiar quem saiu: %s %s", kind, text)
	}
}

func TestLiveGamesStopWhenTheMatchStartsAndConnectionOutlivesIdleTimeouts(t *testing.T) {
	e := newEnvironment(t)
	room := newLiveRoom(t, e)
	// Passa dos prazos de leitura e escrita do servidor HTTP.
	ana := connectLive(t, e, room.path, room.ana)
	bia := connectLive(t, e, room.path, room.bia)
	ana.silent("emoji", 16*time.Second)
	ana.send("coin-duel", "challenge", "c1", fmt.Sprintf(`{"opponentId":%d}`, room.biaID))
	ana.requireAck("c1")

	requireStatus(t, e.request("PUT", room.path+"/participants/me/ready", fmt.Sprintf(`{"deckId":%d}`, uploadTestDeck(t, e, room.ana)), room.ana, nil), 200)
	requireStatus(t, e.request("PUT", room.path+"/participants/me/ready", fmt.Sprintf(`{"deckId":%d}`, uploadTestDeck(t, e, room.bia)), room.bia, nil), 200)
	requireStatus(t, e.request("PUT", room.path+"/participants/me/ready", fmt.Sprintf(`{"deckId":%d}`, uploadTestDeck(t, e, room.cida)), room.cida, nil), 200)
	requireStatus(t, e.request("POST", room.path+"/preparation/start", "{}", room.ana, nil), 200)
	bia.next("coin-duel", "cancelled")
	var state struct {
		Phase string `json:"phase"`
	}
	if err := json.Unmarshal(bia.next("dice", "state").Data, &state); err != nil {
		t.Fatal(err)
	}
	if state.Phase != "determining_order" {
		t.Fatalf("fase não chegou à sala: %s", state.Phase)
	}
	bia.send("emoji", "send", "late", `{"emoji":"🔥"}`)
	if kind, text, _ := bia.reply("late"); kind != "error" || !strings.Contains(text, "antes de iniciar") {
		t.Fatalf("emoji depois de iniciar: %s %s", kind, text)
	}
}

func TestLiveConnectionEndsWithTheSession(t *testing.T) {
	e := newEnvironment(t)
	room := newLiveRoom(t, e)
	ana := connectLive(t, e, room.path, room.ana)
	requireStatus(t, e.request("DELETE", "/api/session", "", room.ana, nil), 204)
	deadline := time.Now().Add(15 * time.Second)
	for {
		_, err := ana.read(time.Until(deadline))
		if err == nil {
			continue
		}
		if status := websocket.CloseStatus(err); status != 4401 {
			t.Fatalf("encerramento inesperado: %v", err)
		}
		return
	}
}

func uploadTestDeck(t *testing.T, e *environment, cookie *http.Cookie) int64 {
	t.Helper()
	result := e.uploadDeck(cookie, []byte(`<cockatrice_deck><deckname>Deck ao vivo</deckname><zone name="main"><card number="10" name="Island"/></zone></cockatrice_deck>`))
	requireStatus(t, result, 201)
	var payload struct{ Deck struct{ ID int64 } }
	if err := json.Unmarshal(result.body, &payload); err != nil {
		t.Fatal(err)
	}
	return payload.Deck.ID
}
