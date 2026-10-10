package rooms

import "testing"

func TestTurnOrderRerollsOnlyTiedPlayers(t *testing.T) {
	participants := []participantState{{ID: 1, Name: "Ana"}, {ID: 2, Name: "Bia"}, {ID: 3, Name: "Caio"}}
	rolls := []int{16, 20, 16, 7, 18}
	next := 0
	order, err := drawTurnOrder(participants, func() (int, error) {
		value := rolls[next]
		next++
		return value, nil
	})
	if err != nil {
		t.Fatal(err)
	}
	if next != len(rolls) {
		t.Fatalf("rolagens: %d", next)
	}
	if got, want := []int64{order[0].UserID, order[1].UserID, order[2].UserID}, []int64{2, 3, 1}; got[0] != want[0] || got[1] != want[1] || got[2] != want[2] {
		t.Fatalf("ordem: %+v", order)
	}
	if order[0].Roll != 20 || order[1].Roll != 18 || order[2].Roll != 7 {
		t.Fatalf("resultado: %+v", order)
	}
}
