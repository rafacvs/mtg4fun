package integration_test

import (
	"bytes"
	"encoding/json"
	"fmt"
	"testing"
	"time"
)

func TestChatHistoryAndShakeForPlayersAndSpectators(t *testing.T) {
	e, cookies, path := prepareUnconfirmedMatch(t, 2)
	chat := path + "/match/chat"
	requireStatus(t, e.request("GET", chat, "", nil, nil), 401)
	requireStatus(t, e.request("POST", chat, `{"body":"  "}`, cookies[0], nil), 400)
	requireStatus(t, e.request("POST", chat, `{"body":"Olá da mesa"}`, cookies[0], nil), 201)
	requireStatus(t, e.request("POST", chat, `{"body":"Olá de quem assiste"}`, cookies[2], nil), 201)
	history := e.request("GET", chat, "", cookies[1], nil)
	requireStatus(t, history, 200)
	var result struct {
		Messages []struct {
			Author string `json:"author"`
			Body   string `json:"body"`
		} `json:"messages"`
	}
	if err := json.Unmarshal(history.body, &result); err != nil {
		t.Fatal(err)
	}
	if len(result.Messages) != 2 || result.Messages[0].Body != "Olá da mesa" || result.Messages[1].Body != "Olá de quem assiste" {
		t.Fatalf("histórico: %s", history.body)
	}
	player := connectLive(t, e, path, cookies[0])
	spectator := connectLive(t, e, path, cookies[2])
	for i := 0; i < 7; i++ {
		id := fmt.Sprint(i)
		spectator.send("shake", "send", id, `{}`)
		player.next("shake", "shake")
		spectator.next("shake", "shake")
		spectator.requireAck(id)
	}
	spectator.send("shake", "send", "blocked", `{}`)
	if kind, _, _ := spectator.reply("blocked"); kind != "error" {
		t.Fatalf("limite da tremida: %s", kind)
	}
	time.Sleep(3 * time.Second)
	spectator.send("shake", "send", "after", `{}`)
	player.next("shake", "shake")
	spectator.next("shake", "shake")
	spectator.requireAck("after")
	e.stop()
	e.start(false)
	persisted := e.request("GET", chat, "", cookies[2], nil)
	requireStatus(t, persisted, 200)
	if !bytes.Equal(history.body, persisted.body) {
		t.Fatalf("histórico após reinício: %s", persisted.body)
	}
	confirmHands(t, e, path, cookies[:2]...)
	requireStatus(t, e.request("POST", path+"/match/actions", `{"intentId":"000000ff-4444-4000-8000-000000000000","kind":"finish"}`, cookies[0], nil), 200)
	requireStatus(t, e.request("GET", chat, "", cookies[2], nil), 404)
	requireStatus(t, e.request("POST", chat, `{"body":"tarde"}`, cookies[0], nil), 404)
}
