package integration_test

import (
	"encoding/json"
	"fmt"
	"testing"
	"time"
)

func TestArmClockSamplesRequireOwnArmDuelAndDoNotConsumeAttempts(t *testing.T) {
	e := newEnvironment(t)
	room := newLiveRoom(t, e)
	ana := connectLive(t, e, room.path, room.ana)
	bia := connectLive(t, e, room.path, room.bia)
	cida := connectLive(t, e, room.path, room.cida)
	ana.send("coin-duel", "arm-sync", "no-duel", `{"nonce":"before"}`)
	ana.next("coin-duel", "error")
	ana.send("coin-duel", "challenge", "invite", fmt.Sprintf(`{"opponentId":%d,"game":"arm-wrestling"}`, room.biaID))
	ana.next("coin-duel", "ack")
	bia.send("coin-duel", "accept", "accept", `{}`)
	bia.next("coin-duel", "ack")
	cida.send("coin-duel", "arm-sync", "outside", `{"nonce":"outsider"}`)
	cida.next("coin-duel", "error")
	bia.send("coin-duel", "arm-sync", "invalid", `{"nonce":""}`)
	bia.next("coin-duel", "error")
	for _, client := range []*liveClient{ana, bia} {
		before := time.Now().UnixMilli()
		client.send("coin-duel", "arm-sync", "sample", `{"nonce":"sample-for-animation"}`)
		var sample struct {
			UserID     int64
			Nonce      string
			ServerTime int64
		}
		owner := map[*liveClient]int64{ana: room.anaID, bia: room.biaID}[client]
		for {
			if err := json.Unmarshal(client.next("coin-duel", "arm-clock").Data, &sample); err != nil {
				t.Fatal(err)
			}
			if sample.UserID == owner {
				break
			}
		}
		if sample.Nonce != "sample-for-animation" || sample.ServerTime < before || sample.ServerTime > time.Now().UnixMilli() {
			t.Fatalf("invalid sample: %+v", sample)
		}
		client.next("coin-duel", "ack")
	}
	conn, _, err := dialLive(e, room.path, room.ana, e.url)
	if err != nil {
		t.Fatal(err)
	}
	defer conn.CloseNow()
	back := newLiveClient(t, conn)
	var state struct {
		Duels []struct {
			Arm struct {
				Started int64
				Ready   map[string]bool
				Players map[string]json.RawMessage
			}
		}
	}
	if err := json.Unmarshal(back.next("coin-duel", "snapshot").Data, &state); err != nil {
		t.Fatal(err)
	}
	if len(state.Duels) != 1 || state.Duels[0].Arm.Started != 0 || len(state.Duels[0].Arm.Ready) != 0 || len(state.Duels[0].Arm.Players) != 0 {
		t.Fatal("clock sampling changed the game")
	}
}
