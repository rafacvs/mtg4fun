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

func TestPositioningSeveralCardsPreservesTheirLayoutAndChangesNoneOnFailure(t *testing.T) {
	card := func(id string, x, row int, controller int64) Card {
		return Card{ID: id, ControllerID: controller, Zone: "battlefield", PositionX: x, Row: row}
	}
	m := &matchState{}
	p := &playerState{UserID: 1, Battlefield: []Card{card("a", 40, 2, 1), card("b", 120, 3, 1), card("opponent", 200, 4, 2)}}
	if _, err := positionCard(m, p, matchAction{CardIDs: []string{"a", "b"}, PositionX: 400, Row: 7}); err != nil {
		t.Fatal(err)
	}
	if p.Battlefield[0].PositionX != 400 || p.Battlefield[0].Row != 7 || p.Battlefield[1].PositionX != 480 || p.Battlefield[1].Row != 8 {
		t.Fatalf("deslocamento coletivo não preservou a disposição: %+v", p.Battlefield)
	}
	if _, err := positionCard(m, p, matchAction{CardIDs: []string{"a", "opponent"}, PositionX: 600, Row: 9}); err != errNotController {
		t.Fatalf("permissão coletiva: %v", err)
	}
	if p.Battlefield[0].PositionX != 400 || p.Battlefield[0].Row != 7 || p.Battlefield[2].PositionX != 200 || p.Battlefield[2].Row != 4 {
		t.Fatalf("falha mudou parte da seleção: %+v", p.Battlefield)
	}
}

func TestMovingSeveralCardsLeavesAllInPlaceWhenOneIsForbidden(t *testing.T) {
	p := &playerState{UserID: 1, Hand: []Card{
		{ID: "mine", ControllerID: 1, Zone: "hand"},
		{ID: "theirs", ControllerID: 2, Zone: "hand"},
	}}
	if _, err := moveCards(&matchState{}, p, matchAction{CardIDs: []string{"mine", "theirs"}, To: "battlefield"}); err != errNotController {
		t.Fatalf("permissão coletiva: %v", err)
	}
	if len(p.Hand) != 2 || len(p.Battlefield) != 0 || p.Hand[0].ID != "mine" || p.Hand[1].ID != "theirs" {
		t.Fatalf("movimento parcial: %+v", p)
	}
}

func TestCollectivePositionRejectsADestinationPastTheEdge(t *testing.T) {
	m := &matchState{}
	p := &playerState{UserID: 1, Battlefield: []Card{
		{ID: "a", ControllerID: 1, Zone: "battlefield", PositionX: 0, Row: 0},
		{ID: "b", ControllerID: 1, Zone: "battlefield", PositionX: 2, Row: 0},
	}}
	if _, err := positionCard(m, p, matchAction{CardIDs: []string{"a", "b"}, PositionX: 19999, Row: 0}); err != errInvalidPosition {
		t.Fatalf("limite: %v", err)
	}
	if p.Battlefield[0].PositionX != 0 || p.Battlefield[1].PositionX != 2 {
		t.Fatalf("falha moveu: %+v", p.Battlefield)
	}
}

func TestCollectivePositionPreservesStackOrderWhenTopCardIsAnchor(t *testing.T) {
	m := &matchState{NextStackOrder: 2}
	p := &playerState{UserID: 1, Battlefield: []Card{
		{ID: "base", ControllerID: 1, Zone: "battlefield", PositionX: 40, Row: 1, StackOrder: 1},
		{ID: "top", ControllerID: 1, Zone: "battlefield", PositionX: 40, Row: 1, StackOrder: 2},
	}}
	if _, err := positionCard(m, p, matchAction{CardIDs: []string{"top", "base"}, PositionX: 500, Row: 3}); err != nil {
		t.Fatal(err)
	}
	if p.Battlefield[0].PositionX != 500 || p.Battlefield[1].PositionX != 500 || p.Battlefield[0].Row != 3 || p.Battlefield[1].Row != 3 || p.Battlefield[0].StackOrder >= p.Battlefield[1].StackOrder {
		t.Fatalf("collective movement reversed the stack: %+v", p.Battlefield)
	}
}
