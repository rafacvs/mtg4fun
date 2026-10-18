package rooms

import "testing"

func TestTransferControlAvoidsAddingAFourthCardToAManualStack(t *testing.T) {
	m := matchState{Players: []playerState{
		{UserID: 1, Battlefield: []Card{{ID: "borrowed", OwnerID: 1, ControllerID: 1, Zone: "battlefield"}}},
		{UserID: 2, Battlefield: []Card{
			{ID: "a", PositionX: 360, Row: 0},
			{ID: "b", PositionX: 360, Row: 0},
			{ID: "c", PositionX: 360, Row: 0},
		}},
	}}
	if _, err := transferControl(&m, &m.Players[0], matchAction{CardID: "borrowed", ControllerID: 2}); err != nil {
		t.Fatal(err)
	}
	got := m.Players[1].Battlefield[3]
	if len(m.Players[0].Battlefield) != 0 || got.PositionX == 360 && got.Row == 0 || got.OwnerID != 1 || got.ControllerID != 2 {
		t.Fatalf("transfer added a fourth card to the stack or changed owner: %+v", m.Players)
	}
}
