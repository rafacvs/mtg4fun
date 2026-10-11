package rooms

import "testing"

func TestConsultationPreservesOrderWhenReorderedAndClosed(t *testing.T) {
	p := &playerState{UserID: 1, Library: []Card{{ID: "a", Name: "A", ControllerID: 1, Zone: "library"}, {ID: "b", Name: "B", ControllerID: 1, Zone: "library"}, {ID: "c", Name: "C", ControllerID: 1, Zone: "library"}}}
	if _, err := consultCards(p, matchAction{ConsultFrom: "top", Count: 2}); err != nil {
		t.Fatal(err)
	}
	if _, err := reorderConsulted(p, []string{"b", "a"}); err != nil {
		t.Fatal(err)
	}
	if _, err := closeConsultation(p, "top", false); err != nil {
		t.Fatal(err)
	}
	if len(p.Consulted) != 0 || p.Library[0].ID != "b" || p.Library[1].ID != "a" || p.Library[2].ID != "c" {
		t.Fatalf("ordem inesperada: %+v", p)
	}
}

func TestConsultationMovesSelectedCardWithoutDuplication(t *testing.T) {
	p := &playerState{UserID: 1, Library: []Card{{ID: "commander", Name: "Comandante", ControllerID: 1, Zone: "library"}}}
	if _, err := consultCards(p, matchAction{ConsultFrom: "all", Count: 1}); err != nil {
		t.Fatal(err)
	}
	if _, err := moveCards(p, matchAction{CardIDs: []string{"commander"}, To: "command"}); err != nil {
		t.Fatal(err)
	}
	if len(p.Library) != 0 || len(p.Consulted) != 0 || len(p.Command) != 1 || p.Command[0].Zone != "command" {
		t.Fatalf("movimento inesperado: %+v", p)
	}
}
