package integration_test

import (
	"bufio"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"strings"
	"testing"
	"time"
)

type roomView struct {
	ID           int64  `json:"id"`
	Title        string `json:"title"`
	CreatorID    int64  `json:"creatorId"`
	Status       string `json:"status"`
	Participants []struct {
		ID   int64  `json:"id"`
		Name string `json:"name"`
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
	result := e.request("POST", "/api/rooms", "{}", cookie, nil)
	requireStatus(t, result, 201)
	room := decodeRoom(t, result)
	if room.ID <= 0 || room.Title != "Sala #1" || room.Status != "preparing" || len(room.Participants) != 1 || room.Participants[0].Name != "Criador" || room.Vacancies != 5 || room.CreatorID != room.Participants[0].ID {
		t.Fatalf("sala criada: %+v", room)
	}
	e.stop()
	e.start(false)
	rooms := listRooms(t, e, cookie)
	if len(rooms) != 1 || rooms[0].ID != room.ID || len(rooms[0].Participants) != 1 || rooms[0].Vacancies != 5 {
		t.Fatalf("sala após reinício: %+v", rooms)
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
	first := e.request("POST", "/api/rooms", "{}", cookies[0], nil)
	requireStatus(t, first, 201)
	second := e.request("POST", "/api/rooms", "{}", cookies[7], nil)
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
	created := e.request("POST", "/api/rooms", "{}", ana, nil)
	requireStatus(t, created, 201)
	id := decodeRoom(t, created).ID
	for _, stream := range []*roomStream{first, second} {
		rooms := stream.next(t)
		if len(rooms) != 1 || rooms[0].Vacancies != 5 {
			t.Fatalf("criação não sincronizada: %+v", rooms)
		}
	}
	requireStatus(t, e.request("POST", fmt.Sprintf("/api/rooms/%d/participants", id), "{}", bia, nil), 200)
	for _, stream := range []*roomStream{first, second} {
		rooms := stream.next(t)
		if rooms[0].Vacancies != 4 || len(rooms[0].Participants) != 2 {
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
	created := e.request("POST", "/api/rooms", "{}", ana, nil)
	requireStatus(t, created, 201)
	id := decodeRoom(t, created).ID
	// Deny the durable log write while allowing snapshot writes, through actual
	// database permissions. The public API must never confirm a partial action.
	e.sql("REVOKE INSERT ON " + e.db + ".* FROM '" + e.db + "'@'%'; GRANT INSERT ON " + e.db + ".rooms TO '" + e.db + "'@'%'")
	e.disconnectDatabaseConnections()
	requireStatus(t, e.request("POST", "/api/rooms", "{}", ana, nil), 500)
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
	for _, body := range []string{`null`, `{"title":"nome inesperado"}`, `{} {}`, `[]`, `{`} {
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
	requireStatus(t, e.request("POST", "/api/rooms", "{}", cookie, nil), 201)
	if rooms := stream.next(t); len(rooms) != 1 || rooms[0].Vacancies != 5 {
		t.Fatalf("stream ocioso: %+v", rooms)
	}
}
