package rooms

import (
	"bytes"
	"encoding/json"
	"testing"
)

func TestLegacyNamedCounterSnapshotIsIgnored(t *testing.T) {
	var state matchState
	raw := []byte(`{"roomId":1,"initialLife":40,"turnOrder":[{"userId":1,"name":"Ana","roll":10}],"players":[{"userId":1,"name":"Ana","life":40,"counters":{"Velho":4},"counterNames":["Velho"],"hand":[{"id":"c1","name":"Island","ownerId":1,"controllerId":1,"zone":"hand","counters":{"Velho":2}}],"library":[],"battlefield":[],"graveyard":[],"exile":[],"command":[]},{"userId":2,"name":"Bia","life":40,"library":[],"hand":[],"battlefield":[],"graveyard":[],"exile":[],"command":[]}]}`)
	if err := json.Unmarshal(raw, &state); err != nil {
		t.Fatal(err)
	}
	own := state.view(1, nil)
	hand := own.Players[0].Hand[0]
	if own.Players[0].Life != 40 || own.Players[0].Markers != (colorCounts{}) || hand.Power != 0 || hand.Toughness != 0 || hand.Markers != (colorCounts{}) {
		t.Fatalf("ausência não leu como zero: %+v %+v", own.Players[0], hand)
	}
	encoded, err := json.Marshal(own)
	if err != nil {
		t.Fatal(err)
	}
	if bytes.Contains(encoded, []byte("Velho")) || bytes.Contains(encoded, []byte("counterNames")) || bytes.Contains(encoded, []byte(`"counters"`)) {
		t.Fatalf("modelo antigo reapareceu: %s", encoded)
	}
}
