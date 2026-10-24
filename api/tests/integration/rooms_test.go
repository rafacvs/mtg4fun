package integration_test

import (
	"bufio"
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"os"
	"slices"
	"strings"
	"testing"
	"time"
)

type roomView struct {
	ID           int64  `json:"id"`
	Title        string `json:"title"`
	Format       string `json:"format"`
	Seats        int    `json:"seats"`
	Life         int    `json:"life"`
	CreatorID    int64  `json:"creatorId"`
	Status       string `json:"status"`
	Participants []struct {
		ID     int64  `json:"id"`
		Name   string `json:"name"`
		Ready  bool   `json:"ready"`
		DeckID int64  `json:"deckId"`
	} `json:"participants"`
	Vacancies int `json:"vacancies"`
}

func decodeRoom(t *testing.T, result response) roomView {
	t.Helper()
	var payload struct {
		Room roomView `json:"room"`
	}
	if err := json.Unmarshal(result.body, &payload); err != nil {
		t.Fatal(err)
	}
	return payload.Room
}

func listRooms(t *testing.T, e *environment, cookie *http.Cookie) []roomView {
	t.Helper()
	result := e.request("GET", "/api/rooms", "", cookie, nil)
	requireStatus(t, result, 200)
	var payload struct {
		Rooms []roomView `json:"rooms"`
	}
	if err := json.Unmarshal(result.body, &payload); err != nil {
		t.Fatal(err)
	}
	return payload.Rooms
}

func TestRoomCreationAndParticipationSurviveRestart(t *testing.T) {
	e := newEnvironment(t)
	e.mustCreate("criador", "Criador", "senha-da-sala")
	e.start(false)
	for _, route := range []struct{ method, path, body string }{{"GET", "/api/rooms", ""}, {"POST", "/api/rooms", "{}"}, {"POST", "/api/rooms/1/participants", "{}"}, {"GET", "/api/rooms/events", ""}} {
		requireStatus(t, e.request(route.method, route.path, route.body, nil, nil), 401)
	}
	cookie := sessionCookie(t, e.login("criador", "senha-da-sala"))
	if rooms := listRooms(t, e, cookie); len(rooms) != 0 {
		t.Fatalf("lista inicial: %+v", rooms)
	}
	result := e.request("POST", "/api/rooms", `{"name":"Sábado entre amigos","format":"Duelo","seats":2,"life":20}`, cookie, nil)
	requireStatus(t, result, 201)
	room := decodeRoom(t, result)
	if room.ID <= 0 || room.Title != "Sábado entre amigos" || room.Format != "Duelo" || room.Seats != 2 || room.Life != 20 || room.Status != "preparing" || len(room.Participants) != 1 || room.Participants[0].Name != "Criador" || room.Participants[0].Ready || room.Vacancies != 1 || room.CreatorID != room.Participants[0].ID {
		t.Fatalf("sala criada: %+v", room)
	}
	e.stop()
	e.start(false)
	rooms := listRooms(t, e, cookie)
	if len(rooms) != 1 || rooms[0].ID != room.ID || rooms[0].Title != "Sábado entre amigos" || rooms[0].Format != "Duelo" || rooms[0].Seats != 2 || rooms[0].Life != 20 || len(rooms[0].Participants) != 1 || rooms[0].Vacancies != 1 {
		t.Fatalf("sala após reinício: %+v", rooms)
	}
}

func TestRoomCreationAllowsDuplicateNames(t *testing.T) {
	e := newEnvironment(t)
	e.mustCreate("ana", "Ana", "senha-da-sala")
	e.mustCreate("bia", "Bia", "senha-da-sala")
	e.start(false)
	ana := sessionCookie(t, e.login("ana", "senha-da-sala"))
	bia := sessionCookie(t, e.login("bia", "senha-da-sala"))
	body := `{"name":"Sábado entre amigos","format":"Commander","seats":4,"life":40}`
	first := e.request("POST", "/api/rooms", body, ana, nil)
	second := e.request("POST", "/api/rooms", body, bia, nil)
	requireStatus(t, first, 201)
	requireStatus(t, second, 201)
	rooms := listRooms(t, e, ana)
	if len(rooms) != 2 || rooms[0].Title != "Sábado entre amigos" || rooms[1].Title != "Sábado entre amigos" || rooms[0].ID == rooms[1].ID {
		t.Fatalf("nomes repetidos: %+v", rooms)
	}
}

func TestRoomVacanciesFollowConfiguredSeats(t *testing.T) {
	e := newEnvironment(t)
	e.mustCreate("ana", "Ana", "senha-da-sala")
	e.mustCreate("bia", "Bia", "senha-da-sala")
	e.mustCreate("caio", "Caio", "senha-da-sala")
	e.start(false)
	ana := sessionCookie(t, e.login("ana", "senha-da-sala"))
	bia := sessionCookie(t, e.login("bia", "senha-da-sala"))
	caio := sessionCookie(t, e.login("caio", "senha-da-sala"))
	created := e.request("POST", "/api/rooms", `{"name":"Duelo da noite","format":"Duelo","seats":2,"life":20}`, ana, nil)
	requireStatus(t, created, 201)
	id := decodeRoom(t, created).ID
	joined := e.request("POST", fmt.Sprintf("/api/rooms/%d/participants", id), "{}", bia, nil)
	requireStatus(t, joined, 200)
	room := decodeRoom(t, joined)
	if room.Vacancies != 0 || len(room.Participants) != 2 || room.Seats != 2 {
		t.Fatalf("vagas após preencher: %+v", room)
	}
	requireStatus(t, e.request("POST", fmt.Sprintf("/api/rooms/%d/participants", id), "{}", caio, nil), 409)
	listed := listRooms(t, e, ana)
	if listed[0].Vacancies != 0 || len(listed[0].Participants) != 2 {
		t.Fatalf("terceiro sentou: %+v", listed)
	}
}

func TestConcurrentRoomEntryIsLimitedIsolatedAndIdempotent(t *testing.T) {
	e := newEnvironment(t)
	cookies := make([]*http.Cookie, 8)
	for i := range cookies {
		e.mustCreate(fmt.Sprintf("amigo%d", i), fmt.Sprintf("Amigo %d", i), "senha-da-sala")
	}
	e.start(false)
	for i := range cookies {
		cookies[i] = sessionCookie(t, e.login(fmt.Sprintf("amigo%d", i), "senha-da-sala"))
	}
	first := e.request("POST", "/api/rooms", roomJSON(), cookies[0], nil)
	requireStatus(t, first, 201)
	second := e.request("POST", "/api/rooms", roomJSON(), cookies[7], nil)
	requireStatus(t, second, 201)
	id := decodeRoom(t, first).ID
	path := fmt.Sprintf("/api/rooms/%d/participants", id)
	for _, cookie := range cookies[1:5] {
		requireStatus(t, e.request("POST", path, "{}", cookie, nil), 200)
	}
	gate := make(chan struct{})
	results := make(chan response, 2)
	for _, cookie := range cookies[5:7] {
		go func(cookie *http.Cookie) { <-gate; results <- e.request("POST", path, "{}", cookie, nil) }(cookie)
	}
	close(gate)
	success, conflict := 0, 0
	for range 2 {
		result := <-results
		switch result.status {
		case 200:
			success++
		case 409:
			conflict++
		default:
			t.Fatalf("entrada: %d %s", result.status, result.body)
		}
	}
	if success != 1 || conflict != 1 {
		t.Fatalf("última vaga: sucesso=%d conflito=%d", success, conflict)
	}
	requireStatus(t, e.request("POST", path, "{}", cookies[0], nil), 200)
	rooms := listRooms(t, e, cookies[0])
	if len(rooms) != 2 || len(rooms[0].Participants) != 6 || rooms[0].Vacancies != 0 || len(rooms[1].Participants) != 1 || rooms[1].Participants[0].Name != "Amigo 7" || rooms[1].Vacancies != 5 {
		t.Fatalf("isolamento/limite: %+v", rooms)
	}
	requireStatus(t, e.request("POST", "/api/rooms/99999/participants", "{}", cookies[0], nil), 404)
	requireStatus(t, e.request("POST", "/api/rooms/nope/participants", "{}", cookies[0], nil), 400)
	requireStatus(t, e.request("POST", path, "{}", cookies[7], map[string]string{"Origin": "https://outra-origem.test"}), 403)
	e.stop()
	e.start(false)
	rooms = listRooms(t, e, cookies[0])
	if len(rooms[0].Participants) != 6 || len(rooms[1].Participants) != 1 {
		t.Fatalf("persistência: %+v", rooms)
	}
}

type roomStream struct {
	body   io.ReadCloser
	events chan []byte
	done   chan error
}

func openRoomStream(t *testing.T, e *environment, cookie *http.Cookie) *roomStream {
	t.Helper()
	request, err := http.NewRequest("GET", e.url+"/api/rooms/events", nil)
	if err != nil {
		t.Fatal(err)
	}
	request.AddCookie(cookie)
	result, err := (&http.Client{Timeout: 35 * time.Second}).Do(request)
	if err != nil {
		t.Fatal(err)
	}
	if result.StatusCode != 200 {
		result.Body.Close()
		t.Fatalf("stream status=%d", result.StatusCode)
	}
	if !strings.HasPrefix(result.Header.Get("Content-Type"), "text/event-stream") {
		t.Fatalf("stream headers: %v", result.Header)
	}
	stream := &roomStream{body: result.Body, events: make(chan []byte, 20), done: make(chan error, 1)}
	t.Cleanup(func() { stream.body.Close() })
	go func() {
		scanner := bufio.NewScanner(result.Body)
		scanner.Buffer(make([]byte, 4096), 1024*1024)
		for scanner.Scan() {
			line := scanner.Text()
			if strings.HasPrefix(line, "data: ") {
				stream.events <- []byte(strings.TrimPrefix(line, "data: "))
			}
		}
		stream.done <- scanner.Err()
	}()
	return stream
}

func (s *roomStream) next(t *testing.T) []roomView {
	t.Helper()
	select {
	case data := <-s.events:
		var payload struct {
			Rooms []roomView `json:"rooms"`
		}
		if err := json.Unmarshal(data, &payload); err != nil {
			t.Fatal(err)
		}
		return payload.Rooms
	case err := <-s.done:
		t.Fatalf("stream encerrou: %v", err)
	case <-time.After(5 * time.Second):
		t.Fatal("stream sem atualização")
	}
	return nil
}

func TestRoomEventsSynchronizeClientsAndReconnect(t *testing.T) {
	e := newEnvironment(t)
	e.mustCreate("ana", "Ana", "senha-da-sala")
	e.mustCreate("bia", "Bia", "senha-da-sala")
	e.start(false)
	ana := sessionCookie(t, e.login("ana", "senha-da-sala"))
	bia := sessionCookie(t, e.login("bia", "senha-da-sala"))
	first := openRoomStream(t, e, ana)
	second := openRoomStream(t, e, bia)
	if len(first.next(t)) != 0 || len(second.next(t)) != 0 {
		t.Fatal("stream inicial deve ser vazio")
	}
	created := e.request("POST", "/api/rooms", `{"name":"Mesa SSE","format":"Livre","seats":3,"life":30}`, ana, nil)
	requireStatus(t, created, 201)
	id := decodeRoom(t, created).ID
	for _, stream := range []*roomStream{first, second} {
		rooms := stream.next(t)
		if len(rooms) != 1 || rooms[0].Title != "Mesa SSE" || rooms[0].Format != "Livre" || rooms[0].Seats != 3 || rooms[0].Life != 30 || rooms[0].Vacancies != 2 {
			t.Fatalf("criação não sincronizada: %+v", rooms)
		}
	}
	requireStatus(t, e.request("POST", fmt.Sprintf("/api/rooms/%d/participants", id), "{}", bia, nil), 200)
	for _, stream := range []*roomStream{first, second} {
		rooms := stream.next(t)
		if rooms[0].Vacancies != 1 || len(rooms[0].Participants) != 2 || rooms[0].Title != "Mesa SSE" {
			t.Fatalf("entrada não sincronizada: %+v", rooms)
		}
	}
	first.body.Close()
	second.body.Close()
	e.stop()
	e.start(false)
	reconnected := openRoomStream(t, e, ana)
	rooms := reconnected.next(t)
	if len(rooms) != 1 || len(rooms[0].Participants) != 2 {
		t.Fatalf("reconexão: %+v", rooms)
	}
	requireStatus(t, e.request("DELETE", "/api/session", "", ana, nil), 204)
	select {
	case data := <-reconnected.events:
		if string(data) != "{}" {
			t.Fatalf("evento revogação: %s", data)
		}
	case <-time.After(5 * time.Second):
		t.Fatal("stream da sessão revogada não encerrou")
	}
	select {
	case <-reconnected.done:
	case <-time.After(5 * time.Second):
		t.Fatal("stream ainda aberto após revogar")
	}
}

func TestRoomWritesRollbackWhenLogCannotBeSaved(t *testing.T) {
	e := newEnvironment(t)
	e.mustCreate("ana", "Ana", "senha-da-sala")
	e.mustCreate("bia", "Bia", "senha-da-sala")
	e.start(false)
	ana := sessionCookie(t, e.login("ana", "senha-da-sala"))
	bia := sessionCookie(t, e.login("bia", "senha-da-sala"))
	created := e.request("POST", "/api/rooms", roomJSON(), ana, nil)
	requireStatus(t, created, 201)
	id := decodeRoom(t, created).ID
	// Deny the durable log write while allowing snapshot writes, through actual
	// database permissions. The public API must never confirm a partial action.
	e.sql("REVOKE INSERT ON " + e.db + ".* FROM '" + e.db + "'@'%'; GRANT INSERT ON " + e.db + ".rooms TO '" + e.db + "'@'%'")
	e.disconnectDatabaseConnections()
	requireStatus(t, e.request("POST", "/api/rooms", roomJSON(), ana, nil), 500)
	requireStatus(t, e.request("POST", fmt.Sprintf("/api/rooms/%d/participants", id), "{}", bia, nil), 500)
	rooms := listRooms(t, e, ana)
	if len(rooms) != 1 || len(rooms[0].Participants) != 1 || rooms[0].Vacancies != 5 {
		t.Fatalf("gravação parcial confirmada: %+v", rooms)
	}
}

func TestRoomInputRejectsInvalidBodies(t *testing.T) {
	e := newEnvironment(t)
	e.mustCreate("ana", "Ana", "senha-da-sala")
	e.start(false)
	cookie := sessionCookie(t, e.login("ana", "senha-da-sala"))
	for _, body := range []string{`null`, `{}`, `{"title":"nome inesperado"}`, `{"name":"   ","format":"Commander","seats":4,"life":40}`, `{"name":"Mesa","format":"Standard","seats":4,"life":40}`, `{"name":"Mesa","format":"Commander","seats":0,"life":40}`, `{"name":"Mesa","format":"Commander","seats":7,"life":40}`, `{"name":"Mesa","format":"Commander","seats":4,"life":0}`, `{"name":"Mesa","format":"Commander","seats":4,"life":1000}`, `{} {}`, `[]`, `{`} {
		requireStatus(t, e.request("POST", "/api/rooms", body, cookie, nil), 400)
	}
	requireStatus(t, e.request("POST", "/api/rooms", "{}", cookie, map[string]string{"Content-Type": "text/plain"}), 415)
	if rooms := listRooms(t, e, cookie); len(rooms) != 0 {
		t.Fatalf("corpo inválido criou sala: %+v", rooms)
	}
}

func TestRoomEventsStayOpenAcrossIdlePeriod(t *testing.T) {
	e := newEnvironment(t)
	e.mustCreate("ana", "Ana", "senha-da-sala")
	e.start(false)
	cookie := sessionCookie(t, e.login("ana", "senha-da-sala"))
	stream := openRoomStream(t, e, cookie)
	if len(stream.next(t)) != 0 {
		t.Fatal("lista inicial deve ser vazia")
	}
	// The normal HTTP write timeout is 15s. An idle room stream must stay usable.
	time.Sleep(16 * time.Second)
	requireStatus(t, e.request("POST", "/api/rooms", roomJSON(), cookie, nil), 201)
	if rooms := stream.next(t); len(rooms) != 1 || rooms[0].Vacancies != 5 {
		t.Fatalf("stream ocioso: %+v", rooms)
	}
}

func TestPreparationStartsPersistentIndependentMatch(t *testing.T) {
	e := newEnvironment(t)
	e.mustCreate("ana", "Ana", "senha-da-sala")
	e.mustCreate("bia", "Bia", "senha-da-sala")
	e.mustCreate("fora", "Fora", "senha-da-sala")
	e.start(false)
	ana := sessionCookie(t, e.login("ana", "senha-da-sala"))
	bia := sessionCookie(t, e.login("bia", "senha-da-sala"))
	outsider := sessionCookie(t, e.login("fora", "senha-da-sala"))
	deck, err := os.ReadFile("testdata/cockatrice-deck.cod")
	if err != nil {
		t.Fatal(err)
	}
	anaUpload := e.uploadDeck(ana, deck)
	biaUpload := e.uploadDeck(bia, deck)
	requireStatus(t, anaUpload, 201)
	requireStatus(t, biaUpload, 201)
	var uploaded struct {
		Deck struct {
			ID int64 `json:"id"`
		} `json:"deck"`
	}
	if err := json.Unmarshal(anaUpload.body, &uploaded); err != nil {
		t.Fatal(err)
	}
	anaDeck := uploaded.Deck.ID
	if err := json.Unmarshal(biaUpload.body, &uploaded); err != nil {
		t.Fatal(err)
	}
	biaDeck := uploaded.Deck.ID
	created := e.request("POST", "/api/rooms", `{"name":"Duelo da tarde","format":"Duelo","seats":2,"life":20}`, ana, nil)
	requireStatus(t, created, 201)
	id := decodeRoom(t, created).ID
	requireStatus(t, e.request("POST", fmt.Sprintf("/api/rooms/%d/participants", id), "{}", bia, nil), 200)
	requireStatus(t, e.request("PUT", fmt.Sprintf("/api/rooms/%d/participants/me/ready", id), fmt.Sprintf(`{"deckId":%d}`, anaDeck), ana, nil), 200)
	requireStatus(t, e.request("POST", fmt.Sprintf("/api/rooms/%d/start", id), "{}", ana, nil), 409)
	requireStatus(t, e.request("PUT", fmt.Sprintf("/api/rooms/%d/participants/me/ready", id), fmt.Sprintf(`{"deckId":%d}`, biaDeck), bia, nil), 200)
	requireStatus(t, e.request("POST", fmt.Sprintf("/api/rooms/%d/start", id), "{}", bia, nil), 403)
	started := e.request("POST", fmt.Sprintf("/api/rooms/%d/start", id), "{}", ana, nil)
	requireStatus(t, started, 201)
	if bytes.Contains(started.body, []byte("Island")) {
		t.Fatalf("início expôs biblioteca: %s", started.body)
	}
	var match struct {
		Match struct {
			InitialLife int `json:"initialLife"`
			TurnOrder   []struct {
				UserID int64 `json:"userId"`
				Roll   int   `json:"roll"`
			} `json:"turnOrder"`
			Players []struct {
				LibraryCount int `json:"libraryCount"`
				Life         int `json:"life"`
			} `json:"players"`
		} `json:"match"`
	}
	if err := json.Unmarshal(started.body, &match); err != nil {
		t.Fatal(err)
	}
	if match.Match.InitialLife != 20 || match.Match.Players[0].Life != 20 || match.Match.Players[1].Life != 20 || len(match.Match.Players) != 2 || match.Match.Players[0].LibraryCount != 7 || match.Match.Players[1].LibraryCount != 7 || len(match.Match.TurnOrder) != 2 || match.Match.TurnOrder[0].Roll < 1 || match.Match.TurnOrder[0].Roll > 20 {
		t.Fatalf("partida inicial: %s", started.body)
	}
	requireStatus(t, e.request("GET", fmt.Sprintf("/api/rooms/%d/match", id), "", outsider, nil), 404)
	requireStatus(t, e.request("DELETE", fmt.Sprintf("/api/decks/%d", anaDeck), "", ana, nil), 204)
	e.stop()
	e.start(false)
	recovered := e.request("GET", fmt.Sprintf("/api/rooms/%d/match", id), "", ana, nil)
	requireStatus(t, recovered, 200)
	if !bytes.Contains(recovered.body, []byte(`"libraryCount":7`)) || bytes.Contains(recovered.body, []byte("Island")) {
		t.Fatalf("recuperação: %s", recovered.body)
	}
	requireStatus(t, e.request("POST", fmt.Sprintf("/api/rooms/%d/participants", id), "{}", outsider, nil), 409)
}

func TestCreatingRoomWithOwnDeckSelectsItWithoutReady(t *testing.T) {
	e := newEnvironment(t)
	e.mustCreate("ana", "Ana", "senha-da-sala")
	e.start(false)
	ana := sessionCookie(t, e.login("ana", "senha-da-sala"))
	deck, err := os.ReadFile("testdata/cockatrice-deck.cod")
	if err != nil {
		t.Fatal(err)
	}
	uploaded := e.uploadDeck(ana, deck)
	requireStatus(t, uploaded, 201)
	var payload struct {
		Deck struct {
			ID int64 `json:"id"`
		} `json:"deck"`
	}
	if err := json.Unmarshal(uploaded.body, &payload); err != nil {
		t.Fatal(err)
	}
	created := e.request("POST", "/api/rooms", fmt.Sprintf(`{"name":"Mesa com deck","format":"Commander","seats":4,"life":40,"deckId":%d}`, payload.Deck.ID), ana, nil)
	requireStatus(t, created, 201)
	room := decodeRoom(t, created)
	if len(room.Participants) != 1 || room.Participants[0].Ready || room.Participants[0].DeckID != payload.Deck.ID {
		t.Fatalf("criação com deck: %+v", room)
	}
	listed := listRooms(t, e, ana)
	if listed[0].Participants[0].Ready || listed[0].Participants[0].DeckID != payload.Deck.ID {
		t.Fatalf("listagem com deck: %+v", listed)
	}
	requireStatus(t, e.request("POST", fmt.Sprintf("/api/rooms/%d/start", room.ID), "{}", ana, nil), 409)
}

func TestLegacyRoomsKeepTitleSixSeatsAndLifeForty(t *testing.T) {
	e := newEnvironment(t)
	e.mustCreate("ana", "Ana", "senha-da-sala")
	e.start(false)
	ana := sessionCookie(t, e.login("ana", "senha-da-sala"))
	userID := strings.TrimSpace(string(e.sql("SELECT id FROM " + e.db + ".users WHERE login='ana'")))
	e.sql("INSERT INTO " + e.db + ".rooms (creator_id, snapshot) VALUES (" + userID + ", JSON_OBJECT())")
	id := strings.TrimSpace(string(e.sql("SELECT id FROM " + e.db + ".rooms")))
	e.sql("UPDATE " + e.db + ".rooms SET snapshot='" + `{"id":` + id + `,"title":"Sala #` + id + `","creatorId":` + userID + `,"status":"preparing","participants":[{"id":` + userID + `,"name":"Ana","deckId":0,"ready":false}],"vacancies":5}` + "' WHERE id=" + id)
	rooms := listRooms(t, e, ana)
	if len(rooms) != 1 || rooms[0].Title != "Sala #"+id || rooms[0].Format != "" || rooms[0].Seats != 6 || rooms[0].Life != 40 || rooms[0].Vacancies != 5 {
		t.Fatalf("sala antiga: %+v", rooms)
	}
	deck, err := os.ReadFile("testdata/cockatrice-deck.cod")
	if err != nil {
		t.Fatal(err)
	}
	uploaded := e.uploadDeck(ana, deck)
	requireStatus(t, uploaded, 201)
	var payload struct {
		Deck struct {
			ID int64 `json:"id"`
		} `json:"deck"`
	}
	if err := json.Unmarshal(uploaded.body, &payload); err != nil {
		t.Fatal(err)
	}
	requireStatus(t, e.request("PUT", fmt.Sprintf("/api/rooms/%s/participants/me/ready", id), fmt.Sprintf(`{"deckId":%d}`, payload.Deck.ID), ana, nil), 200)
	started := e.request("POST", fmt.Sprintf("/api/rooms/%s/start", id), "{}", ana, nil)
	requireStatus(t, started, 201)
	var match struct {
		Match struct {
			InitialLife int `json:"initialLife"`
		} `json:"match"`
	}
	if err := json.Unmarshal(started.body, &match); err != nil {
		t.Fatal(err)
	}
	if match.Match.InitialLife != 40 {
		t.Fatalf("vida da sala antiga: %s", started.body)
	}
}

func TestCreatingRoomRejectsForeignOrMissingDeck(t *testing.T) {
	e := newEnvironment(t)
	e.mustCreate("ana", "Ana", "senha-da-sala")
	e.mustCreate("bia", "Bia", "senha-da-sala")
	e.start(false)
	ana := sessionCookie(t, e.login("ana", "senha-da-sala"))
	bia := sessionCookie(t, e.login("bia", "senha-da-sala"))
	deck, err := os.ReadFile("testdata/cockatrice-deck.cod")
	if err != nil {
		t.Fatal(err)
	}
	uploaded := e.uploadDeck(bia, deck)
	requireStatus(t, uploaded, 201)
	var payload struct {
		Deck struct {
			ID int64 `json:"id"`
		} `json:"deck"`
	}
	if err := json.Unmarshal(uploaded.body, &payload); err != nil {
		t.Fatal(err)
	}
	requireStatus(t, e.request("POST", "/api/rooms", fmt.Sprintf(`{"name":"Mesa alheia","format":"Commander","seats":4,"life":40,"deckId":%d}`, payload.Deck.ID), ana, nil), 404)
	requireStatus(t, e.request("POST", "/api/rooms", `{"name":"Mesa fantasma","format":"Commander","seats":4,"life":40,"deckId":99999}`, ana, nil), 404)
	if rooms := listRooms(t, e, ana); len(rooms) != 0 {
		t.Fatalf("deck inválido criou sala: %+v", rooms)
	}
}

func TestSelectingDeckDoesNotMarkReady(t *testing.T) {
	e := newEnvironment(t)
	e.mustCreate("ana", "Ana", "senha-da-sala")
	e.start(false)
	ana := sessionCookie(t, e.login("ana", "senha-da-sala"))
	deck, err := os.ReadFile("testdata/cockatrice-deck.cod")
	if err != nil {
		t.Fatal(err)
	}
	uploaded := e.uploadDeck(ana, deck)
	requireStatus(t, uploaded, 201)
	var payload struct {
		Deck struct {
			ID int64 `json:"id"`
		} `json:"deck"`
	}
	if err := json.Unmarshal(uploaded.body, &payload); err != nil {
		t.Fatal(err)
	}
	created := e.request("POST", "/api/rooms", roomJSON(), ana, nil)
	requireStatus(t, created, 201)
	id := decodeRoom(t, created).ID
	selected := e.request("PUT", fmt.Sprintf("/api/rooms/%d/participants/me/deck", id), fmt.Sprintf(`{"deckId":%d}`, payload.Deck.ID), ana, nil)
	requireStatus(t, selected, 200)
	room := decodeRoom(t, selected)
	if len(room.Participants) != 1 || room.Participants[0].Ready || room.Participants[0].DeckID != payload.Deck.ID {
		t.Fatalf("seleção marcou pronto: %s", selected.body)
	}
	listed := listRooms(t, e, ana)
	if len(listed) != 1 || listed[0].Participants[0].Ready || listed[0].Participants[0].DeckID != payload.Deck.ID {
		t.Fatalf("listagem após seleção: %+v", listed)
	}
	requireStatus(t, e.request("POST", fmt.Sprintf("/api/rooms/%d/start", id), "{}", ana, nil), 409)
}

func TestConfirmingReadyRequiresSelectedDeck(t *testing.T) {
	e := newEnvironment(t)
	e.mustCreate("ana", "Ana", "senha-da-sala")
	e.start(false)
	ana := sessionCookie(t, e.login("ana", "senha-da-sala"))
	deck, err := os.ReadFile("testdata/cockatrice-deck.cod")
	if err != nil {
		t.Fatal(err)
	}
	uploaded := e.uploadDeck(ana, deck)
	requireStatus(t, uploaded, 201)
	var payload struct {
		Deck struct {
			ID int64 `json:"id"`
		} `json:"deck"`
	}
	if err := json.Unmarshal(uploaded.body, &payload); err != nil {
		t.Fatal(err)
	}
	created := e.request("POST", "/api/rooms", roomJSON(), ana, nil)
	requireStatus(t, created, 201)
	id := decodeRoom(t, created).ID
	missing := e.request("PUT", fmt.Sprintf("/api/rooms/%d/participants/me/ready", id), "{}", ana, nil)
	requireStatus(t, missing, 409)
	if !bytes.Contains(missing.body, []byte("Selecione um deck")) {
		t.Fatalf("prontidão sem deck: %s", missing.body)
	}
	requireStatus(t, e.request("PUT", fmt.Sprintf("/api/rooms/%d/participants/me/deck", id), fmt.Sprintf(`{"deckId":%d}`, payload.Deck.ID), ana, nil), 200)
	confirmed := e.request("PUT", fmt.Sprintf("/api/rooms/%d/participants/me/ready", id), "{}", ana, nil)
	requireStatus(t, confirmed, 200)
	room := decodeRoom(t, confirmed)
	if !room.Participants[0].Ready || room.Participants[0].DeckID != payload.Deck.ID {
		t.Fatalf("confirmação: %s", confirmed.body)
	}
	requireStatus(t, e.request("POST", fmt.Sprintf("/api/rooms/%d/start", id), "{}", ana, nil), 201)
}

func TestUndoReadyKeepsDeckAndAllowsChangingIt(t *testing.T) {
	e := newEnvironment(t)
	e.mustCreate("ana", "Ana", "senha-da-sala")
	e.mustCreate("bia", "Bia", "senha-da-sala")
	e.start(false)
	ana := sessionCookie(t, e.login("ana", "senha-da-sala"))
	bia := sessionCookie(t, e.login("bia", "senha-da-sala"))
	deck, err := os.ReadFile("testdata/cockatrice-deck.cod")
	if err != nil {
		t.Fatal(err)
	}
	anaDeck := e.uploadDeck(ana, deck)
	firstBia := e.uploadDeck(bia, deck)
	secondBia := e.uploadDeck(bia, []byte(`<cockatrice_deck version="1"><deckname>Outro</deckname><zone name="main"><card number="3" name="Island"/></zone></cockatrice_deck>`))
	requireStatus(t, anaDeck, 201)
	requireStatus(t, firstBia, 201)
	requireStatus(t, secondBia, 201)
	var uploaded struct {
		Deck struct {
			ID int64 `json:"id"`
		} `json:"deck"`
	}
	if err := json.Unmarshal(anaDeck.body, &uploaded); err != nil {
		t.Fatal(err)
	}
	anaID := uploaded.Deck.ID
	if err := json.Unmarshal(firstBia.body, &uploaded); err != nil {
		t.Fatal(err)
	}
	biaFirst := uploaded.Deck.ID
	if err := json.Unmarshal(secondBia.body, &uploaded); err != nil {
		t.Fatal(err)
	}
	biaSecond := uploaded.Deck.ID
	created := e.request("POST", "/api/rooms", roomJSON(), ana, nil)
	requireStatus(t, created, 201)
	id := decodeRoom(t, created).ID
	path := fmt.Sprintf("/api/rooms/%d/participants/me", id)
	requireStatus(t, e.request("POST", fmt.Sprintf("/api/rooms/%d/participants", id), "{}", bia, nil), 200)
	requireStatus(t, e.request("PUT", path+"/deck", fmt.Sprintf(`{"deckId":%d}`, anaID), ana, nil), 200)
	requireStatus(t, e.request("PUT", path+"/deck", fmt.Sprintf(`{"deckId":%d}`, biaFirst), bia, nil), 200)
	requireStatus(t, e.request("PUT", path+"/ready", "{}", ana, nil), 200)
	requireStatus(t, e.request("PUT", path+"/ready", "{}", bia, nil), 200)
	locked := e.request("PUT", path+"/deck", fmt.Sprintf(`{"deckId":%d}`, biaSecond), bia, nil)
	requireStatus(t, locked, 409)
	undone := e.request("DELETE", path+"/ready", "{}", bia, nil)
	requireStatus(t, undone, 200)
	room := decodeRoom(t, undone)
	var biaState, anaState struct {
		Ready  bool
		DeckID int64
	}
	for _, participant := range room.Participants {
		switch participant.Name {
		case "Bia":
			biaState.Ready, biaState.DeckID = participant.Ready, participant.DeckID
		case "Ana":
			anaState.Ready, anaState.DeckID = participant.Ready, participant.DeckID
		}
	}
	if biaState.Ready || biaState.DeckID != biaFirst || !anaState.Ready || anaState.DeckID != anaID {
		t.Fatalf("desfazer prontidão: %s", undone.body)
	}
	requireStatus(t, e.request("POST", fmt.Sprintf("/api/rooms/%d/start", id), "{}", ana, nil), 409)
	changed := e.request("PUT", path+"/deck", fmt.Sprintf(`{"deckId":%d}`, biaSecond), bia, nil)
	requireStatus(t, changed, 200)
	after := decodeRoom(t, changed)
	for _, participant := range after.Participants {
		if participant.Name == "Bia" && (participant.Ready || participant.DeckID != biaSecond) {
			t.Fatalf("troca após desfazer: %s", changed.body)
		}
	}
}

func TestReadyDoesNotChangeDeckWhileLocked(t *testing.T) {
	e := newEnvironment(t)
	e.mustCreate("ana", "Ana", "senha-da-sala")
	e.start(false)
	ana := sessionCookie(t, e.login("ana", "senha-da-sala"))
	deck, err := os.ReadFile("testdata/cockatrice-deck.cod")
	if err != nil {
		t.Fatal(err)
	}
	first := e.uploadDeck(ana, deck)
	second := e.uploadDeck(ana, []byte(`<cockatrice_deck version="1"><deckname>Outro</deckname><zone name="main"><card number="3" name="Island"/></zone></cockatrice_deck>`))
	requireStatus(t, first, 201)
	requireStatus(t, second, 201)
	var uploaded struct {
		Deck struct {
			ID int64 `json:"id"`
		} `json:"deck"`
	}
	if err := json.Unmarshal(first.body, &uploaded); err != nil {
		t.Fatal(err)
	}
	firstID := uploaded.Deck.ID
	if err := json.Unmarshal(second.body, &uploaded); err != nil {
		t.Fatal(err)
	}
	secondID := uploaded.Deck.ID
	created := e.request("POST", "/api/rooms", roomJSON(), ana, nil)
	requireStatus(t, created, 201)
	id := decodeRoom(t, created).ID
	requireStatus(t, e.request("PUT", fmt.Sprintf("/api/rooms/%d/participants/me/ready", id), fmt.Sprintf(`{"deckId":%d}`, firstID), ana, nil), 200)
	locked := e.request("PUT", fmt.Sprintf("/api/rooms/%d/participants/me/ready", id), fmt.Sprintf(`{"deckId":%d}`, secondID), ana, nil)
	requireStatus(t, locked, 409)
	listed := listRooms(t, e, ana)
	if listed[0].Participants[0].DeckID != firstID || !listed[0].Participants[0].Ready {
		t.Fatalf("prontidão trocou o deck: %+v", listed)
	}
}

func TestStartRollsBackWhenMatchLogCannotBeSaved(t *testing.T) {
	e := newEnvironment(t)
	e.mustCreate("ana", "Ana", "senha-da-sala")
	e.start(false)
	ana := sessionCookie(t, e.login("ana", "senha-da-sala"))
	deck, err := os.ReadFile("testdata/cockatrice-deck.cod")
	if err != nil {
		t.Fatal(err)
	}
	uploaded := e.uploadDeck(ana, deck)
	requireStatus(t, uploaded, 201)
	var payload struct {
		Deck struct {
			ID int64 `json:"id"`
		} `json:"deck"`
	}
	if err := json.Unmarshal(uploaded.body, &payload); err != nil {
		t.Fatal(err)
	}
	created := e.request("POST", "/api/rooms", roomJSON(), ana, nil)
	requireStatus(t, created, 201)
	id := decodeRoom(t, created).ID
	requireStatus(t, e.request("PUT", fmt.Sprintf("/api/rooms/%d/participants/me/ready", id), fmt.Sprintf(`{"deckId":%d}`, payload.Deck.ID), ana, nil), 200)
	e.sql("REVOKE INSERT ON " + e.db + ".* FROM '" + e.db + "'@'%'; GRANT INSERT ON " + e.db + ".rooms TO '" + e.db + "'@'%'")
	e.disconnectDatabaseConnections()
	requireStatus(t, e.request("POST", fmt.Sprintf("/api/rooms/%d/start", id), "{}", ana, nil), 500)
	rooms := listRooms(t, e, ana)
	if len(rooms) != 1 || rooms[0].Status != "preparing" {
		t.Fatalf("falha publicou início: %+v", rooms)
	}
}

func TestStartRefusesDeckDeletedAfterReadiness(t *testing.T) {
	e := newEnvironment(t)
	e.mustCreate("ana", "Ana", "senha-da-sala")
	e.start(false)
	ana := sessionCookie(t, e.login("ana", "senha-da-sala"))
	deck, err := os.ReadFile("testdata/cockatrice-deck.cod")
	if err != nil {
		t.Fatal(err)
	}
	uploaded := e.uploadDeck(ana, deck)
	requireStatus(t, uploaded, 201)
	var payload struct {
		Deck struct {
			ID int64 `json:"id"`
		} `json:"deck"`
	}
	if err := json.Unmarshal(uploaded.body, &payload); err != nil {
		t.Fatal(err)
	}
	created := e.request("POST", "/api/rooms", roomJSON(), ana, nil)
	requireStatus(t, created, 201)
	id := decodeRoom(t, created).ID
	requireStatus(t, e.request("PUT", fmt.Sprintf("/api/rooms/%d/participants/me/ready", id), fmt.Sprintf(`{"deckId":%d}`, payload.Deck.ID), ana, nil), 200)
	requireStatus(t, e.request("DELETE", fmt.Sprintf("/api/decks/%d", payload.Deck.ID), "", ana, nil), 204)
	result := e.request("POST", fmt.Sprintf("/api/rooms/%d/start", id), "{}", ana, nil)
	requireStatus(t, result, 409)
	if !bytes.Contains(result.body, []byte("Deck não encontrado")) {
		t.Fatalf("erro: %s", result.body)
	}
	if room := listRooms(t, e, ana)[0]; room.Status != "preparing" {
		t.Fatalf("início com deck excluído: %+v", room)
	}
}

func TestStartReturnsControlledD20TiebreakOverHTTP(t *testing.T) {
	e := newEnvironment(t)
	e.rolls = "12,12,9,17"
	e.mustCreate("ana", "Ana", "senha-da-sala")
	e.mustCreate("bia", "Bia", "senha-da-sala")
	e.start(false)
	ana := sessionCookie(t, e.login("ana", "senha-da-sala"))
	bia := sessionCookie(t, e.login("bia", "senha-da-sala"))
	deck, err := os.ReadFile("testdata/cockatrice-deck.cod")
	if err != nil {
		t.Fatal(err)
	}
	anaDeck := e.uploadDeck(ana, deck)
	biaDeck := e.uploadDeck(bia, deck)
	requireStatus(t, anaDeck, 201)
	requireStatus(t, biaDeck, 201)
	var payload struct {
		Deck struct {
			ID int64 `json:"id"`
		} `json:"deck"`
	}
	if err := json.Unmarshal(anaDeck.body, &payload); err != nil {
		t.Fatal(err)
	}
	firstDeck := payload.Deck.ID
	if err := json.Unmarshal(biaDeck.body, &payload); err != nil {
		t.Fatal(err)
	}
	secondDeck := payload.Deck.ID
	created := e.request("POST", "/api/rooms", roomJSON(), ana, nil)
	requireStatus(t, created, 201)
	id := decodeRoom(t, created).ID
	requireStatus(t, e.request("POST", fmt.Sprintf("/api/rooms/%d/participants", id), "{}", bia, nil), 200)
	requireStatus(t, e.request("PUT", fmt.Sprintf("/api/rooms/%d/participants/me/ready", id), fmt.Sprintf(`{"deckId":%d}`, firstDeck), ana, nil), 200)
	requireStatus(t, e.request("PUT", fmt.Sprintf("/api/rooms/%d/participants/me/ready", id), fmt.Sprintf(`{"deckId":%d}`, secondDeck), bia, nil), 200)
	result := e.request("POST", fmt.Sprintf("/api/rooms/%d/start", id), "{}", ana, nil)
	requireStatus(t, result, 201)
	var match struct {
		Match struct {
			TurnOrder []struct {
				Name string `json:"name"`
				Roll int    `json:"roll"`
			} `json:"turnOrder"`
		} `json:"match"`
	}
	if err := json.Unmarshal(result.body, &match); err != nil {
		t.Fatal(err)
	}
	if len(match.Match.TurnOrder) != 2 || match.Match.TurnOrder[0].Name != "Bia" || match.Match.TurnOrder[0].Roll != 17 || match.Match.TurnOrder[1].Name != "Ana" || match.Match.TurnOrder[1].Roll != 9 {
		t.Fatalf("desempate: %s", result.body)
	}
}

func consultedCardIDs(t *testing.T, body []byte) []string {
	t.Helper()
	var payload struct {
		Match struct {
			Players []struct {
				Consulted []struct {
					ID string `json:"id"`
				} `json:"consulted"`
			} `json:"players"`
		} `json:"match"`
	}
	if err := json.Unmarshal(body, &payload); err != nil {
		t.Fatal(err)
	}
	var ids []string
	for _, player := range payload.Match.Players {
		if len(player.Consulted) == 0 {
			continue
		}
		if ids != nil {
			t.Fatalf("mais de um jogador com consulta: %s", body)
		}
		for _, card := range player.Consulted {
			ids = append(ids, card.ID)
		}
	}
	if len(ids) == 0 {
		t.Fatalf("consulta privada ausente: %s", body)
	}
	return ids
}

func TestMatchActionsPersistPrivatelyAndIdempotently(t *testing.T) {
	e := newEnvironment(t)
	for _, account := range []string{"ana", "bia", "fora"} {
		e.mustCreate(account, strings.Title(account), "senha-da-sala")
	}
	e.start(false)
	ana, bia, outsider := sessionCookie(t, e.login("ana", "senha-da-sala")), sessionCookie(t, e.login("bia", "senha-da-sala")), sessionCookie(t, e.login("fora", "senha-da-sala"))
	deck, err := os.ReadFile("testdata/cockatrice-deck.cod")
	if err != nil {
		t.Fatal(err)
	}
	first, second := e.uploadDeck(ana, deck), e.uploadDeck(bia, deck)
	requireStatus(t, first, 201)
	requireStatus(t, second, 201)
	var uploaded struct {
		Deck struct {
			ID int64 `json:"id"`
		} `json:"deck"`
	}
	if err := json.Unmarshal(first.body, &uploaded); err != nil {
		t.Fatal(err)
	}
	anaDeck := uploaded.Deck.ID
	if err := json.Unmarshal(second.body, &uploaded); err != nil {
		t.Fatal(err)
	}
	biaDeck := uploaded.Deck.ID
	created := e.request("POST", "/api/rooms", roomJSON(), ana, nil)
	requireStatus(t, created, 201)
	roomID := decodeRoom(t, created).ID
	requireStatus(t, e.request("POST", fmt.Sprintf("/api/rooms/%d/participants", roomID), "{}", bia, nil), 200)
	for _, ready := range []struct {
		cookie *http.Cookie
		deck   int64
	}{{ana, anaDeck}, {bia, biaDeck}} {
		requireStatus(t, e.request("PUT", fmt.Sprintf("/api/rooms/%d/participants/me/ready", roomID), fmt.Sprintf(`{"deckId":%d}`, ready.deck), ready.cookie, nil), 200)
	}
	requireStatus(t, e.request("POST", fmt.Sprintf("/api/rooms/%d/start", roomID), "{}", ana, nil), 201)
	actionPath := fmt.Sprintf("/api/rooms/%d/match/actions", roomID)
	consult := e.request("POST", actionPath, `{"intentId":"10101010-1010-4010-8010-101010101010","kind":"consult","consultFrom":"top","count":2}`, ana, nil)
	requireStatus(t, consult, 200)
	var privateConsult struct {
		Match struct {
			Players []struct {
				UserID    int64 `json:"userId"`
				Consulted []struct {
					ID   string `json:"id"`
					Name string `json:"name"`
				} `json:"consulted"`
			} `json:"players"`
		} `json:"match"`
	}
	if err := json.Unmarshal(consult.body, &privateConsult); err != nil {
		t.Fatal(err)
	}
	var consulted []struct {
		ID   string `json:"id"`
		Name string `json:"name"`
	}
	for _, player := range privateConsult.Match.Players {
		if player.UserID != 0 && len(player.Consulted) == 2 {
			consulted = player.Consulted
		}
	}
	if len(consulted) != 2 {
		t.Fatalf("consulta privada ausente: %s", consult.body)
	}
	otherConsult := e.request("GET", fmt.Sprintf("/api/rooms/%d/match", roomID), "", bia, nil)
	requireStatus(t, otherConsult, 200)
	if bytes.Contains(otherConsult.body, []byte(consulted[0].ID)) || bytes.Contains(otherConsult.body, []byte(consulted[0].Name)) {
		t.Fatalf("consulta privada vazou: %s", otherConsult.body)
	}
	reordered := []string{consulted[1].ID, consulted[0].ID}
	reorder := fmt.Sprintf(`{"intentId":"20202020-2020-4020-8020-202020202020","kind":"reorder","cardIds":[%q,%q]}`, reordered[0], reordered[1])
	requireStatus(t, e.request("POST", actionPath, reorder, ana, nil), 200)
	requireStatus(t, e.request("POST", actionPath, `{"intentId":"30303030-3030-4030-8030-303030303030","kind":"close","libraryPlacement":"top"}`, ana, nil), 200)
	topAfterReorder := e.request("POST", actionPath, `{"intentId":"50505050-5050-4050-8050-505050505050","kind":"consult","consultFrom":"top","count":2}`, ana, nil)
	requireStatus(t, topAfterReorder, 200)
	if got := consultedCardIDs(t, topAfterReorder.body); !slices.Equal(got, reordered) {
		t.Fatalf("reordenar e fechar no topo não preservou a ordem: obtido %v, esperado %v", got, reordered)
	}
	requireStatus(t, e.request("POST", actionPath, `{"intentId":"51515151-5151-4151-8151-515151515151","kind":"close","libraryPlacement":"bottom"}`, ana, nil), 200)
	bottomAfterClose := e.request("POST", actionPath, `{"intentId":"52525252-5252-4252-8252-525252525252","kind":"consult","consultFrom":"bottom","count":2}`, ana, nil)
	requireStatus(t, bottomAfterClose, 200)
	if got := consultedCardIDs(t, bottomAfterClose.body); !slices.Equal(got, reordered) {
		t.Fatalf("fechar no fundo não devolveu os mesmos ids ao consultar o fundo: obtido %v, esperado %v", got, reordered)
	}
	requireStatus(t, e.request("POST", actionPath, `{"intentId":"53535353-5353-4353-8353-535353535353","kind":"close","libraryPlacement":"bottom"}`, ana, nil), 200)
	topAfterBottom := e.request("POST", actionPath, `{"intentId":"54545454-5454-4454-8454-545454545454","kind":"consult","consultFrom":"top","count":2}`, ana, nil)
	requireStatus(t, topAfterBottom, 200)
	if got := consultedCardIDs(t, topAfterBottom.body); slices.Equal(got, reordered) || slices.Contains(got, reordered[0]) || slices.Contains(got, reordered[1]) {
		t.Fatalf("consultar o topo devolveu a sequência fechada no fundo: %v", got)
	}
	requireStatus(t, e.request("POST", actionPath, `{"intentId":"56565656-5656-4566-8566-565656565656","kind":"close","libraryPlacement":"top"}`, ana, nil), 200)
	beforeShuffle := e.request("POST", actionPath, `{"intentId":"57575757-5757-4575-8575-575757575757","kind":"consult","consultFrom":"top","count":7}`, ana, nil)
	requireStatus(t, beforeShuffle, 200)
	orderBeforeShuffle := consultedCardIDs(t, beforeShuffle.body)
	if len(orderBeforeShuffle) != 7 {
		t.Fatalf("topo antes de embaralhar: %v", orderBeforeShuffle)
	}
	requireStatus(t, e.request("POST", actionPath, `{"intentId":"58585858-5858-4585-8585-585858585858","kind":"close","libraryPlacement":"top"}`, ana, nil), 200)
	shuffle := e.request("POST", actionPath, `{"intentId":"40404040-4040-4040-8040-404040404040","kind":"shuffle","libraryPlacement":"top"}`, ana, nil)
	requireStatus(t, shuffle, 200)
	if !bytes.Contains(shuffle.body, []byte(`"kind":"shuffle"`)) {
		t.Fatalf("embaralhamento não foi confirmado publicamente: %s", shuffle.body)
	}
	afterShuffle := e.request("POST", actionPath, `{"intentId":"59595959-5959-4595-8595-595959595959","kind":"consult","consultFrom":"top","count":7}`, ana, nil)
	requireStatus(t, afterShuffle, 200)
	if got := consultedCardIDs(t, afterShuffle.body); slices.Equal(got, orderBeforeShuffle) {
		t.Fatalf("embaralhar não mudou a ordem do topo: %v", orderBeforeShuffle)
	}
	requireStatus(t, e.request("POST", actionPath, `{"intentId":"5a5a5a5a-5a5a-45a5-85a5-5a5a5a5a5a5a","kind":"close","libraryPlacement":"top"}`, ana, nil), 200)
	draw := `{"intentId":"11111111-1111-4111-8111-111111111111","kind":"draw","count":2}`
	requireStatus(t, e.request("POST", actionPath, draw, ana, nil), 200)
	// The same intent may be retried after a lost response without drawing again.
	duplicate := e.request("POST", actionPath, draw, ana, nil)
	requireStatus(t, duplicate, 200)
	var mine struct {
		Match struct {
			Players []struct {
				UserID       int64 `json:"userId"`
				LibraryCount int   `json:"libraryCount"`
				Hand         []struct {
					ID   string `json:"id"`
					Name string `json:"name"`
				} `json:"hand"`
			} `json:"players"`
			Log []struct {
				Kind  string `json:"kind"`
				Count int    `json:"count"`
			} `json:"log"`
		} `json:"match"`
	}
	if err := json.Unmarshal(duplicate.body, &mine); err != nil {
		t.Fatal(err)
	}
	var own struct {
		LibraryCount int `json:"libraryCount"`
		Hand         []struct {
			ID   string `json:"id"`
			Name string `json:"name"`
		} `json:"hand"`
	}
	for _, player := range mine.Match.Players {
		if player.UserID != 0 && len(player.Hand) == 2 {
			own.LibraryCount, own.Hand = player.LibraryCount, player.Hand
		}
	}
	if own.LibraryCount != 5 || len(own.Hand) != 2 || own.Hand[0].Name == "" || len(mine.Match.Log) < 2 || mine.Match.Log[len(mine.Match.Log)-1].Kind != "draw" || mine.Match.Log[len(mine.Match.Log)-1].Count != 2 {
		t.Fatalf("compra/idempotência: %s", duplicate.body)
	}
	otherView := e.request("GET", fmt.Sprintf("/api/rooms/%d/match", roomID), "", bia, nil)
	requireStatus(t, otherView, 200)
	if bytes.Contains(otherView.body, []byte(own.Hand[0].Name)) || bytes.Contains(otherView.body, []byte(own.Hand[0].ID)) {
		t.Fatalf("mão privada vazou: %s", otherView.body)
	}
	move := fmt.Sprintf(`{"intentId":"22222222-2222-4222-8222-222222222222","kind":"move","cardIds":[%q],"to":"battlefield"}`, own.Hand[0].ID)
	requireStatus(t, e.request("POST", actionPath, move, ana, nil), 200)
	position := fmt.Sprintf(`{"intentId":"22222222-2222-4222-8222-222222222223","kind":"position","cardId":%q,"x":735,"row":2}`, own.Hand[0].ID)
	positioned := e.request("POST", actionPath, position, ana, nil)
	requireStatus(t, positioned, 200)
	// Only the controller may organize a public card, and the public view
	// exposes the durable, viewport-independent layout values.
	requireStatus(t, e.request("POST", actionPath, position, bia, nil), 409)
	if !bytes.Contains(positioned.body, []byte(`"positionX":735`)) || !bytes.Contains(positioned.body, []byte(`"row":2`)) || !bytes.Contains(positioned.body, []byte(`"kind":"position"`)) {
		t.Fatalf("posição não confirmada: %s", positioned.body)
	}
	var placed struct {
		Match struct {
			Players []struct {
				Battlefield []struct {
					ID         string `json:"id"`
					StackOrder int    `json:"stackOrder"`
				} `json:"battlefield"`
			} `json:"players"`
		} `json:"match"`
	}
	if err := json.Unmarshal(positioned.body, &placed); err != nil {
		t.Fatal(err)
	}
	stackOrder := 0
	for _, player := range placed.Match.Players {
		for _, card := range player.Battlefield {
			if card.ID == own.Hand[0].ID {
				stackOrder = card.StackOrder
			}
		}
	}
	if stackOrder == 0 {
		t.Fatalf("posição sem ordem de pilha: %s", positioned.body)
	}
	otherView = e.request("GET", fmt.Sprintf("/api/rooms/%d/match", roomID), "", bia, nil)
	requireStatus(t, otherView, 200)
	if !bytes.Contains(otherView.body, []byte(own.Hand[0].Name)) || bytes.Contains(otherView.body, []byte(own.Hand[1].ID)) {
		t.Fatalf("visão pública após movimento: %s", otherView.body)
	}
	// Concurrent moves are serialized by the locked match row. Both may apply
	// in sequence, but the card must end in exactly one public zone.
	concurrent := make(chan response, 2)
	for i, destination := range []string{"graveyard", "exile"} {
		go func(i int, destination string) {
			body := fmt.Sprintf(`{"intentId":"55555555-5555-4555-8555-55555555555%d","kind":"move","cardIds":[%q],"to":%q}`, i, own.Hand[1].ID, destination)
			concurrent <- e.request("POST", actionPath, body, ana, nil)
		}(i, destination)
	}
	success, conflict := 0, 0
	for range 2 {
		switch result := <-concurrent; result.status {
		case 200:
			success++
		case 409:
			conflict++
		default:
			t.Fatalf("movimentos concorrentes: %d %s", result.status, result.body)
		}
	}
	if success == 0 || success+conflict != 2 {
		t.Fatalf("movimentos concorrentes: sucesso=%d conflito=%d", success, conflict)
	}
	concurrentView := e.request("GET", fmt.Sprintf("/api/rooms/%d/match", roomID), "", ana, nil)
	requireStatus(t, concurrentView, 200)
	var zones struct {
		Match struct {
			Players []struct {
				UserID         int64 `json:"userId"`
				GraveyardCount int   `json:"graveyardCount"`
				ExileCount     int   `json:"exileCount"`
			} `json:"players"`
		} `json:"match"`
	}
	if err := json.Unmarshal(concurrentView.body, &zones); err != nil {
		t.Fatal(err)
	}
	for _, player := range zones.Match.Players {
		if player.UserID == mine.Match.Players[0].UserID && player.GraveyardCount+player.ExileCount != 1 {
			t.Fatalf("carta concorrente duplicada/perdida: %s", concurrentView.body)
		}
	}
	requireStatus(t, e.request("POST", actionPath, `{"intentId":"33333333-3333-4333-8333-333333333333","kind":"draw","count":1}`, outsider, nil), 404)
	persistedConsult := e.request("POST", actionPath, `{"intentId":"5b5b5b5b-5b5b-45b5-85b5-5b5b5b5b5b5b","kind":"consult","consultFrom":"top","count":5}`, ana, nil)
	requireStatus(t, persistedConsult, 200)
	libraryOrder := consultedCardIDs(t, persistedConsult.body)
	if len(libraryOrder) != 5 {
		t.Fatalf("ordem do grimório antes de reiniciar: %v", libraryOrder)
	}
	requireStatus(t, e.request("POST", actionPath, `{"intentId":"5c5c5c5c-5c5c-45c5-85c5-5c5c5c5c5c5c","kind":"close","libraryPlacement":"top"}`, ana, nil), 200)
	e.stop()
	e.start(false)
	recovered := e.request("GET", fmt.Sprintf("/api/rooms/%d/match", roomID), "", ana, nil)
	requireStatus(t, recovered, 200)
	var restored struct {
		Match struct {
			Players []struct {
				UserID       int64 `json:"userId"`
				LibraryCount int   `json:"libraryCount"`
				Hand         []struct {
					ID string `json:"id"`
				} `json:"hand"`
				Battlefield []struct {
					ID         string `json:"id"`
					PositionX  int    `json:"positionX"`
					Row        int    `json:"row"`
					StackOrder int    `json:"stackOrder"`
				} `json:"battlefield"`
				Graveyard []struct {
					ID string `json:"id"`
				} `json:"graveyard"`
				Exile []struct {
					ID string `json:"id"`
				} `json:"exile"`
			} `json:"players"`
			Log []struct {
				Kind string `json:"kind"`
			} `json:"log"`
		} `json:"match"`
	}
	if err := json.Unmarshal(recovered.body, &restored); err != nil {
		t.Fatal(err)
	}
	var restoredAna struct {
		LibraryCount int
		Hand         []struct {
			ID string `json:"id"`
		}
		Battlefield []struct {
			ID         string `json:"id"`
			PositionX  int    `json:"positionX"`
			Row        int    `json:"row"`
			StackOrder int    `json:"stackOrder"`
		}
		Graveyard []struct {
			ID string `json:"id"`
		}
		Exile []struct {
			ID string `json:"id"`
		}
	}
	for _, player := range restored.Match.Players {
		if player.UserID == mine.Match.Players[0].UserID {
			restoredAna.LibraryCount, restoredAna.Hand, restoredAna.Battlefield, restoredAna.Graveyard, restoredAna.Exile = player.LibraryCount, player.Hand, player.Battlefield, player.Graveyard, player.Exile
		}
	}
	contains := func(cards []struct {
		ID string `json:"id"`
	}, id string) bool {
		for _, card := range cards {
			if card.ID == id {
				return true
			}
		}
		return false
	}
	containsBattlefield := func(id string) bool {
		for _, card := range restoredAna.Battlefield {
			if card.ID == id {
				return true
			}
		}
		return false
	}
	hasShuffle := false
	for _, entry := range restored.Match.Log {
		if entry.Kind == "shuffle" {
			hasShuffle = true
		}
	}
	if restoredAna.LibraryCount != 5 || len(restoredAna.Hand) != 0 || !containsBattlefield(own.Hand[0].ID) || restoredAna.Battlefield[0].PositionX != 735 || restoredAna.Battlefield[0].Row != 2 || restoredAna.Battlefield[0].StackOrder != stackOrder || contains(restoredAna.Graveyard, own.Hand[0].ID) || contains(restoredAna.Exile, own.Hand[0].ID) || (contains(restoredAna.Graveyard, own.Hand[1].ID) == contains(restoredAna.Exile, own.Hand[1].ID)) || len(restored.Match.Log) != 20+success || !hasShuffle {
		t.Fatalf("ações não recuperadas: %s", recovered.body)
	}
	restoredConsult := e.request("POST", actionPath, `{"intentId":"5d5d5d5d-5d5d-45d5-85d5-5d5d5d5d5d5d","kind":"consult","consultFrom":"top","count":5}`, ana, nil)
	requireStatus(t, restoredConsult, 200)
	if got := consultedCardIDs(t, restoredConsult.body); !slices.Equal(got, libraryOrder) {
		t.Fatalf("ordem persistida do grimório: obtido %v, esperado %v", got, libraryOrder)
	}
	requireStatus(t, e.request("POST", actionPath, `{"intentId":"5e5e5e5e-5e5e-45e5-85e5-5e5e5e5e5e5e","kind":"close","libraryPlacement":"top"}`, ana, nil), 200)
	// A database permission failure after parsing cannot publish an acknowledged partial draw.
	baseline := e.request("GET", fmt.Sprintf("/api/rooms/%d/match", roomID), "", ana, nil)
	requireStatus(t, baseline, 200)
	e.sql("REVOKE INSERT ON " + e.db + ".* FROM '" + e.db + "'@'%'; GRANT INSERT ON " + e.db + ".rooms TO '" + e.db + "'@'%'")
	e.disconnectDatabaseConnections()
	requireStatus(t, e.request("POST", actionPath, `{"intentId":"44444444-4444-4444-8444-444444444444","kind":"draw","count":1}`, ana, nil), 500)
	still := e.request("GET", fmt.Sprintf("/api/rooms/%d/match", roomID), "", ana, nil)
	requireStatus(t, still, 200)
	if !bytes.Equal(still.body, baseline.body) {
		t.Fatalf("falha parcial alterou estado: %s", still.body)
	}
}

func TestMatchRandomActionsTurnsAndIdempotencySurviveRestart(t *testing.T) {
	e := newEnvironment(t)
	e.mustCreate("ana", "Ana", "senha-da-sala")
	e.mustCreate("bia", "Bia", "senha-da-sala")
	e.mustCreate("fora", "Fora", "senha-da-sala")
	e.start(false)
	ana := sessionCookie(t, e.login("ana", "senha-da-sala"))
	bia := sessionCookie(t, e.login("bia", "senha-da-sala"))
	outsider := sessionCookie(t, e.login("fora", "senha-da-sala"))
	deck, err := os.ReadFile("testdata/cockatrice-deck.cod")
	if err != nil {
		t.Fatal(err)
	}
	first, second := e.uploadDeck(ana, deck), e.uploadDeck(bia, deck)
	requireStatus(t, first, 201)
	requireStatus(t, second, 201)
	var upload struct {
		Deck struct {
			ID int64 `json:"id"`
		} `json:"deck"`
	}
	if err := json.Unmarshal(first.body, &upload); err != nil {
		t.Fatal(err)
	}
	anaDeck := upload.Deck.ID
	if err := json.Unmarshal(second.body, &upload); err != nil {
		t.Fatal(err)
	}
	biaDeck := upload.Deck.ID
	created := e.request("POST", "/api/rooms", roomJSON(), ana, nil)
	requireStatus(t, created, 201)
	id := decodeRoom(t, created).ID
	requireStatus(t, e.request("POST", fmt.Sprintf("/api/rooms/%d/participants", id), "{}", bia, nil), 200)
	requireStatus(t, e.request("PUT", fmt.Sprintf("/api/rooms/%d/participants/me/ready", id), fmt.Sprintf(`{"deckId":%d}`, anaDeck), ana, nil), 200)
	requireStatus(t, e.request("PUT", fmt.Sprintf("/api/rooms/%d/participants/me/ready", id), fmt.Sprintf(`{"deckId":%d}`, biaDeck), bia, nil), 200)
	requireStatus(t, e.request("POST", fmt.Sprintf("/api/rooms/%d/start", id), "{}", ana, nil), 201)
	actions := fmt.Sprintf("/api/rooms/%d/match/actions", id)
	intent := `{"intentId":"018f2f9e-1a55-4b39-9c75-7c8d5d4a3b2c","kind":"roll","sides":20}`
	rolled := e.request("POST", actions, intent, ana, nil)
	requireStatus(t, rolled, 200)
	repeated := e.request("POST", actions, intent, ana, nil)
	requireStatus(t, repeated, 200)
	if !bytes.Equal(rolled.body, repeated.body) {
		t.Fatalf("reenvio mudou o resultado: %s vs %s", rolled.body, repeated.body)
	}
	coin := e.request("POST", actions, `{"intentId":"018f2f9e-1a55-4b39-9c75-7c8d5d4a3b2d","kind":"coin"}`, bia, nil)
	requireStatus(t, coin, 200)
	turn := e.request("POST", actions, `{"intentId":"018f2f9e-1a55-4b39-9c75-7c8d5d4a3b2e","kind":"turn","direction":"next"}`, bia, nil)
	requireStatus(t, turn, 200)
	requireStatus(t, e.request("POST", actions, `{"intentId":"018f2f9e-1a55-4b39-9c75-7c8d5d4a3b2f","kind":"coin"}`, outsider, nil), 404)
	var view struct {
		Match struct {
			TurnOrder []struct {
				Name string `json:"name"`
			} `json:"turnOrder"`
			CurrentTurn struct {
				Name string `json:"name"`
			} `json:"currentTurn"`
			Log []struct {
				ActorID int64  `json:"actorId"`
				Kind    string `json:"kind"`
				Result  string `json:"result"`
			} `json:"log"`
		} `json:"match"`
	}
	if err := json.Unmarshal(turn.body, &view); err != nil {
		t.Fatal(err)
	}
	var rollResult, coinResult, turnResult string
	var rollActorID, coinActorID int64
	rolls, coins, turns := 0, 0, 0
	for _, entry := range view.Match.Log {
		switch entry.Kind {
		case "roll":
			rolls++
			rollResult = entry.Result
			rollActorID = entry.ActorID
		case "coin":
			coins++
			coinResult = entry.Result
			coinActorID = entry.ActorID
		case "turn":
			turns++
			turnResult = entry.Result
		}
	}
	if rolls != 1 || coins != 1 || turns != 1 || rollActorID == 0 || coinActorID == 0 || rollActorID == coinActorID || len(view.Match.TurnOrder) != 2 || !strings.HasPrefix(rollResult, "D20: ") || coinResult != "Cara" && coinResult != "Coroa" || turnResult != "avançou para o turno de "+view.Match.TurnOrder[1].Name+" e ocultou todas as revelações" || view.Match.CurrentTurn.Name != view.Match.TurnOrder[1].Name {
		t.Fatalf("ações públicas: %s", turn.body)
	}
	e.stop()
	e.start(false)
	recovered := e.request("GET", fmt.Sprintf("/api/rooms/%d/match", id), "", ana, nil)
	requireStatus(t, recovered, 200)
	if !bytes.Contains(recovered.body, []byte(`"currentTurn":`)) || bytes.Count(recovered.body, []byte(`"kind":"roll"`)) != 1 || bytes.Count(recovered.body, []byte(`"kind":"coin"`)) != 1 || bytes.Count(recovered.body, []byte(`"kind":"turn"`)) != 1 {
		t.Fatalf("ações não persistiram: %s", recovered.body)
	}
}

func TestCollectivePositionIsAtomicAndSurvivesRestart(t *testing.T) {
	e := newEnvironment(t)
	e.mustCreate("ana", "Ana", "senha-da-sala")
	e.start(false)
	ana := sessionCookie(t, e.login("ana", "senha-da-sala"))
	deck, err := os.ReadFile("testdata/cockatrice-deck.cod")
	if err != nil {
		t.Fatal(err)
	}
	uploaded := e.uploadDeck(ana, deck)
	requireStatus(t, uploaded, 201)
	var upload struct {
		Deck struct {
			ID int64 `json:"id"`
		} `json:"deck"`
	}
	if err := json.Unmarshal(uploaded.body, &upload); err != nil {
		t.Fatal(err)
	}
	created := e.request("POST", "/api/rooms", roomJSON(), ana, nil)
	requireStatus(t, created, 201)
	roomID := decodeRoom(t, created).ID
	requireStatus(t, e.request("PUT", fmt.Sprintf("/api/rooms/%d/participants/me/ready", roomID), fmt.Sprintf(`{"deckId":%d}`, upload.Deck.ID), ana, nil), 200)
	requireStatus(t, e.request("POST", fmt.Sprintf("/api/rooms/%d/start", roomID), "{}", ana, nil), 201)
	actionPath := fmt.Sprintf("/api/rooms/%d/match/actions", roomID)
	requireStatus(t, e.request("POST", actionPath, `{"intentId":"40111111-1111-4111-8111-111111111111","kind":"draw","count":2}`, ana, nil), 200)
	var drawn struct {
		Match struct {
			Players []struct {
				Hand []struct {
					ID string `json:"id"`
				} `json:"hand"`
			} `json:"players"`
		} `json:"match"`
	}
	view := e.request("GET", fmt.Sprintf("/api/rooms/%d/match", roomID), "", ana, nil)
	requireStatus(t, view, 200)
	if err := json.Unmarshal(view.body, &drawn); err != nil || len(drawn.Match.Players) != 1 || len(drawn.Match.Players[0].Hand) != 2 {
		t.Fatalf("mão para seleção: %v %s", err, view.body)
	}
	ids := []string{drawn.Match.Players[0].Hand[0].ID, drawn.Match.Players[0].Hand[1].ID}
	requireStatus(t, e.request("POST", actionPath, fmt.Sprintf(`{"intentId":"40222222-2222-4222-8222-222222222222","kind":"move","cardIds":[%q,%q],"to":"battlefield"}`, ids[0], ids[1]), ana, nil), 200)
	failed := e.request("POST", actionPath, fmt.Sprintf(`{"intentId":"40333333-3333-4333-8333-333333333333","kind":"position","cardIds":[%q,"missing"],"x":300,"row":3}`, ids[0]), ana, nil)
	requireStatus(t, failed, 409)
	view = e.request("GET", fmt.Sprintf("/api/rooms/%d/match", roomID), "", ana, nil)
	requireStatus(t, view, 200)
	var unchanged struct {
		Match struct {
			Players []struct {
				Battlefield []struct {
					ID  string `json:"id"`
					X   int    `json:"positionX"`
					Row int    `json:"row"`
				} `json:"battlefield"`
			} `json:"players"`
		} `json:"match"`
	}
	if err := json.Unmarshal(view.body, &unchanged); err != nil {
		t.Fatal(err)
	}
	before := map[string][2]int{}
	for _, card := range unchanged.Match.Players[0].Battlefield {
		before[card.ID] = [2]int{card.X, card.Row}
	}
	if before[ids[0]] != [2]int{0, 0} || before[ids[1]] != [2]int{0, 0} {
		t.Fatalf("entrada no campo: %s", view.body)
	}
	requireStatus(t, e.request("POST", actionPath, `{"intentId":"40666666-6666-4666-8666-666666666666","kind":"draw","count":1}`, ana, nil), 200)
	view = e.request("GET", fmt.Sprintf("/api/rooms/%d/match", roomID), "", ana, nil)
	requireStatus(t, view, 200)
	var extra struct {
		Match struct {
			Players []struct {
				Hand []struct {
					ID string `json:"id"`
				} `json:"hand"`
			} `json:"players"`
		} `json:"match"`
	}
	if err := json.Unmarshal(view.body, &extra); err != nil || len(extra.Match.Players[0].Hand) != 1 {
		t.Fatalf("carta para a célula pedida: %v %s", err, view.body)
	}
	placedID := extra.Match.Players[0].Hand[0].ID
	placed := e.request("POST", actionPath, fmt.Sprintf(`{"intentId":"40777777-7777-4777-8777-777777777777","kind":"move","cardIds":[%q],"to":"battlefield","x":2,"row":1}`, placedID), ana, nil)
	requireStatus(t, placed, 200)
	if !bytes.Contains(placed.body, []byte(`"positionX":2`)) || !bytes.Contains(placed.body, []byte(`"row":1`)) {
		t.Fatalf("movimento não gravou a célula: %s", placed.body)
	}
	// Invalid collective selections cannot change any card or append a log.
	requireStatus(t, e.request("POST", actionPath, fmt.Sprintf(`{"intentId":"40000000-0000-4000-8000-000000000000","kind":"position","cardIds":[%q,%q],"x":300,"row":3}`, ids[0], ids[0]), ana, nil), 409)
	requireStatus(t, e.request("POST", actionPath, fmt.Sprintf(`{"intentId":"40000000-0000-4000-8000-000000000001","kind":"position","cardIds":[%q,%q],"x":20001,"row":3}`, ids[0], ids[1]), ana, nil), 400)
	requireStatus(t, e.request("POST", actionPath, fmt.Sprintf(`{"intentId":"40555555-5555-4555-8555-555555555555","kind":"position","cardId":%q,"cardIds":[%q],"x":300,"row":3}`, ids[0], ids[1]), ana, nil), 400)
	requireStatus(t, e.request("POST", actionPath, fmt.Sprintf(`{"intentId":"40444444-4444-4444-8444-444444444444","kind":"position","cardIds":[%q,%q],"x":300,"row":3}`, ids[0], ids[1]), ana, nil), 200)
	// A lost confirmation can be retried with the same intent.
	requireStatus(t, e.request("POST", actionPath, fmt.Sprintf(`{"intentId":"40444444-4444-4444-8444-444444444444","kind":"position","cardIds":[%q,%q],"x":300,"row":3}`, ids[0], ids[1]), ana, nil), 200)
	e.stop()
	e.start(false)
	view = e.request("GET", fmt.Sprintf("/api/rooms/%d/match", roomID), "", ana, nil)
	requireStatus(t, view, 200)
	var restored struct {
		Match struct {
			Players []struct {
				Battlefield []struct {
					ID  string `json:"id"`
					X   int    `json:"positionX"`
					Row int    `json:"row"`
				} `json:"battlefield"`
			} `json:"players"`
			Log []struct {
				Kind  string `json:"kind"`
				Count int    `json:"count"`
			} `json:"log"`
		} `json:"match"`
	}
	if err := json.Unmarshal(view.body, &restored); err != nil {
		t.Fatal(err)
	}
	positions := map[string][2]int{}
	for _, card := range restored.Match.Players[0].Battlefield {
		positions[card.ID] = [2]int{card.X, card.Row}
	}
	if positions[ids[0]] != [2]int{300, 3} || positions[ids[1]] != [2]int{300, 3} || len(restored.Match.Log) == 0 || restored.Match.Log[len(restored.Match.Log)-1].Kind != "position" || restored.Match.Log[len(restored.Match.Log)-1].Count != 2 {
		t.Fatalf("posição coletiva persistida: %s", view.body)
	}
}
