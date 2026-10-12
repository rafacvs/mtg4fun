package rooms

import "testing"

func TestPositionAllowsRowsBeyondTheFirstScreenAndRejectsAFourthStack(t *testing.T) {
	card := func(id string, x, row, order int) Card {
		return Card{ID: id, ControllerID: 1, Zone: "battlefield", PositionX: x, Row: row, StackOrder: order}
	}
	m := &matchState{}
	p := &playerState{UserID: 1, Battlefield: []Card{card("a", 40, 12, 1)}}
	if _, err := positionCard(m, p, matchAction{CardID: "a", PositionX: 900, Row: 40}); err != nil {
		t.Fatal(err)
	}
	if p.Battlefield[0].PositionX != 900 || p.Battlefield[0].Row != 40 {
		t.Fatalf("fileira distante não foi gravada: %+v", p.Battlefield[0])
	}
	p.Battlefield = []Card{card("a", 10, 2, 1), card("b", 10, 2, 2), card("c", 10, 2, 3)}
	if _, err := positionCard(m, p, matchAction{CardID: "d", PositionX: 10, Row: 2}); err != errStackFull {
		t.Fatalf("quarta carta na pilha: %v", err)
	}
	if _, err := positionCard(m, p, matchAction{CardID: "c", PositionX: 10, Row: 2}); err != nil {
		t.Fatal(err)
	}
}
