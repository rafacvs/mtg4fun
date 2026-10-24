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

func TestRevealKeepsCardsInLibrary(t *testing.T) {
	owner := playerState{UserID: 1, Library: []Card{{ID: "a", Name: "Alpha", Zone: "library"}, {ID: "b", Name: "Beta", Zone: "library"}, {ID: "c", Name: "Gamma", Zone: "library"}}}
	payload, err := revealCards(&owner, 2)
	if err != nil {
		t.Fatal(err)
	}
	if payload.Result != "Alpha, Beta" || len(owner.Library) != 3 || owner.Library[2].ID != "c" {
		t.Fatalf("revelação: %+v %+v", payload, owner)
	}
	seen := matchState{Players: []playerState{owner, {UserID: 2}}}.view(2, nil)
	if len(seen.Players[0].Revealed) != 2 || seen.Players[0].Revealed[0].Name != "Alpha" || seen.Players[0].Revealed[1].Name != "Beta" || seen.Players[0].LibraryCount != 3 {
		t.Fatalf("o outro jogador não viu a ordem: %+v", seen.Players[0])
	}
	if len(seen.Players[0].Consulted) != 0 {
		t.Fatal("consulta vazou na revelação")
	}
}

func TestConsultationMovesSelectedCardWithoutDuplication(t *testing.T) {
	p := &playerState{UserID: 1, Library: []Card{{ID: "commander", Name: "Comandante", ControllerID: 1, Zone: "library"}}}
	if _, err := consultCards(p, matchAction{ConsultFrom: "all", Count: 1}); err != nil {
		t.Fatal(err)
	}
	if _, err := moveCards(&matchState{}, p, matchAction{CardIDs: []string{"commander"}, To: "command"}); err != nil {
		t.Fatal(err)
	}
	if len(p.Library) != 0 || len(p.Consulted) != 0 || len(p.Command) != 1 || p.Command[0].Zone != "command" {
		t.Fatalf("movimento inesperado: %+v", p)
	}
}
