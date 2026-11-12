package integration_test

import (
	"encoding/json"
	"fmt"
	"testing"
	"time"
)

func TestPresenceTracksVisibilityAcrossConnections(t *testing.T) {
	e, cookies, path := prepareUnconfirmedMatch(t, 2)
	observer := connectLive(t, e, path, cookies[2])
	first := connectLive(t, e, path, cookies[0])
	second := connectLive(t, e, path, cookies[0])
	playerID := fmt.Sprint(sessionUserID(t, e, cookies[0]))
	expect := func(want string) {
		t.Helper()
		deadline := time.Now().Add(5 * time.Second)
		for time.Now().Before(deadline) {
			msg, err := observer.read(time.Until(deadline))
			if err != nil {
				t.Fatal(err)
			}
			if msg.Game != "presence" || msg.Type != "state" {
				continue
			}
			var states map[string]string
			if err := json.Unmarshal(msg.Data, &states); err != nil {
				t.Fatal(err)
			}
			if states[playerID] == want {
				return
			}
		}
		t.Fatalf("não recebeu presença %q", want)
	}
	first.send("presence", "visibility", "v1", `{"visible":true}`)
	first.requireAck("v1")
	expect("online")
	second.send("presence", "visibility", "v2", `{"visible":false}`)
	second.requireAck("v2")
	expect("online")
	first.send("presence", "visibility", "v3", `{"visible":false}`)
	first.requireAck("v3")
	expect("away")
	second.send("presence", "visibility", "v4", `{"visible":true}`)
	second.requireAck("v4")
	expect("online")
	second.conn.CloseNow()
	expect("away")
	first.conn.CloseNow()
	expect("")
}
