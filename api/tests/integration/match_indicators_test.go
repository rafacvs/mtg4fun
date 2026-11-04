package integration_test

import (
	"encoding/json"
	"fmt"
	"net/http"
	"reflect"
	"testing"
	"time"
)

type indicatorCard struct{ ID, Name string }
type indicatorPlayer struct {
	UserID            int64
	LandCount         int
	Hand, Battlefield []indicatorCard
}
type indicatorLog struct {
	ActorID              int64
	Kind, From, To       string
	DrawCount, LandPlays *int
}
type indicatorMatch struct {
	RoomCreatedAt, StartedAt time.Time
	FinishedAt               *time.Time
	ViewerID                 int64
	Players                  []indicatorPlayer
	Log                      []indicatorLog
}

func TestMatchIndicatorsPersistAndRespectVisibility(t *testing.T) {
	e, cookies, path := prepareCreationMatch(t, `<cockatrice_deck><zone name="main"><card number="4" name="Island"/><card number="4" name="Urza's Saga"/><card number="4" name="Gargos, Vicious Watcher"/></zone></cockatrice_deck>`)
	read := func(r response) indicatorMatch {
		t.Helper()
		requireStatus(t, r, 200)
		var body struct{ Match indicatorMatch }
		if err := json.Unmarshal(r.body, &body); err != nil {
			t.Fatal(err)
		}
		return body.Match
	}
	get := func(cookie *http.Cookie) indicatorMatch { return read(e.request("GET", path, "", cookie, nil)) }
	number := 0
	act := func(cookie *http.Cookie, fields string) indicatorMatch {
		t.Helper()
		number++
		return read(e.request("POST", path+"/actions", fmt.Sprintf(`{"intentId":"%08x-aaaa-4000-8000-000000000000",%s}`, number, fields), cookie, nil))
	}
	initial := get(cookies[0])
	if initial.RoomCreatedAt.IsZero() || initial.StartedAt.Before(initial.RoomCreatedAt) || initial.StartedAt.After(time.Now()) {
		t.Fatalf("invalid persisted times: %+v", initial)
	}
	own := func(m indicatorMatch) indicatorPlayer {
		for _, p := range m.Players {
			if p.UserID == m.ViewerID {
				return p
			}
		}
		t.Fatal("missing player")
		return indicatorPlayer{}
	}
	m := act(cookies[0], `"kind":"draw","count":12`)
	drawIntent := fmt.Sprintf(`{"intentId":"%08x-aaaa-4000-8000-000000000000","kind":"draw","count":12}`, number)
	replay := read(e.request("POST", path+"/actions", drawIntent, cookies[0], nil))
	if len(replay.Log) != len(m.Log) || m.Log[len(m.Log)-1].DrawCount == nil || *m.Log[len(m.Log)-1].DrawCount != 12 {
		t.Fatal("draw count or idempotence failed")
	}
	var island, saga, creature string
	for _, c := range own(m).Hand {
		switch c.Name {
		case "Island":
			island = c.ID
		case "Urza's Saga":
			saga = c.ID
		default:
			creature = c.ID
		}
	}
	m = act(cookies[0], fmt.Sprintf(`"kind":"move","cardIds":[%q,%q,%q],"to":"battlefield"`, island, saga, creature))
	if own(m).LandCount != 2 || m.Log[len(m.Log)-1].LandPlays == nil || *m.Log[len(m.Log)-1].LandPlays != 2 {
		t.Fatal("mixed move must count only the two lands")
	}
	act(cookies[0], fmt.Sprintf(`"kind":"set_tapped","cardIds":[%q],"tapped":true`, island))
	if own(get(cookies[0])).LandCount != 2 {
		t.Fatal("tapped land disappeared")
	}
	act(cookies[0], `"kind":"turn","direction":"next"`)
	act(cookies[1], `"kind":"draw","count":1`)
	m = act(cookies[0], fmt.Sprintf(`"kind":"move","cardIds":[%q],"to":"hand"`, saga))
	if own(m).LandCount != 1 {
		t.Fatal("return to hand must reduce field count")
	}
	m = act(cookies[0], fmt.Sprintf(`"kind":"move","cardIds":[%q],"to":"battlefield"`, saga))
	if *m.Log[len(m.Log)-1].LandPlays != 1 {
		t.Fatal("replayed land must count in the new turn")
	}
	other := own(get(cookies[1])).UserID
	act(cookies[0], fmt.Sprintf(`"kind":"transfer_control","cardId":%q,"controllerId":%d`, island, other))
	if own(get(cookies[0])).LandCount != 1 || own(get(cookies[1])).LandCount != 1 {
		t.Fatal("control transfer must change both field counts")
	}
	// Face-down identity is visible to its controller, not to the other player.
	act(cookies[0], fmt.Sprintf(`"kind":"set_face_down","cardIds":[%q],"faceDown":true`, saga))
	public := get(cookies[1])
	for _, p := range public.Players {
		if p.UserID == initial.ViewerID && p.LandCount != 0 {
			t.Fatal("land count leaked a hidden identity")
		}
	}
	before := get(cookies[0])
	e.stop()
	e.start(false)
	after := get(cookies[0])
	if !before.RoomCreatedAt.Equal(after.RoomCreatedAt) || !before.StartedAt.Equal(after.StartedAt) || !reflect.DeepEqual(before.Log, after.Log) || !reflect.DeepEqual(before.Players, after.Players) {
		t.Fatal("indicators changed after restart")
	}
	act(cookies[0], `"kind":"finish"`)
	done := get(cookies[0])
	if done.FinishedAt == nil || done.FinishedAt.Before(done.StartedAt) {
		t.Fatal("missing finish timestamp")
	}
}
