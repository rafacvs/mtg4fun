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

func TestStandardMulliganIsFreeOnceAndBottomsAdditionalCardsOnKeep(t *testing.T) {
	p := playerState{UserID: 1}
	for i := 0; i < 14; i++ {
		zone := "library"
		if i < 7 {
			zone = "hand"
			p.Hand = append(p.Hand, Card{ID: string(rune('a' + i)), Zone: zone})
		} else {
			p.Library = append(p.Library, Card{ID: string(rune('a' + i)), Zone: zone})
		}
	}
	m := matchState{MulliganMode: "standard", MulliganOpen: true}
	if _, err := mulligan(&m, &p); err != nil {
		t.Fatal(err)
	}
	if _, err := keepMulliganHand(&m, &p, nil); err != nil {
		t.Fatalf("primeiro deveria ser gratuito: %v", err)
	}
	if len(p.Hand) != 7 || !p.MulliganKept {
		t.Fatalf("mão inesperada: %+v", p)
	}

	p.MulliganKept = false
	if _, err := mulligan(&m, &p); err != nil {
		t.Fatal(err)
	}
	if _, err := keepMulliganHand(&m, &p, nil); err != errMulliganSelection {
		t.Fatalf("esperava seleção, recebeu %v", err)
	}
	id := p.Hand[0].ID
	if _, err := keepMulliganHand(&m, &p, []string{id}); err != nil {
		t.Fatal(err)
	}
	if len(p.Hand) != 6 || p.Library[len(p.Library)-1].ID != id {
		t.Fatalf("carta não foi ao fundo: %+v", p)
	}
}

func TestAconchegazMulliganNeverReducesHand(t *testing.T) {
	p := playerState{UserID: 1}
	for i := 0; i < 14; i++ {
		card := Card{ID: string(rune('a' + i))}
		if i < 7 {
			card.Zone = "hand"
			p.Hand = append(p.Hand, card)
		} else {
			card.Zone = "library"
			p.Library = append(p.Library, card)
		}
	}
	m := matchState{MulliganMode: "aconchegaz", MulliganOpen: true}
	for i := 0; i < 3; i++ {
		if _, err := mulligan(&m, &p); err != nil {
			t.Fatal(err)
		}
	}
	if _, err := keepMulliganHand(&m, &p, nil); err != nil {
		t.Fatal(err)
	}
	if len(p.Hand) != 7 {
		t.Fatalf("esperava sete cartas, recebeu %d", len(p.Hand))
	}
}

func TestStandardMulliganStopsBeforeHandWouldBecomeEmpty(t *testing.T) {
	p := playerState{UserID: 1, Mulligans: 6}
	for i := 0; i < 14; i++ {
		card := Card{ID: string(rune('a' + i))}
		if i < 7 {
			card.Zone = "hand"
			p.Hand = append(p.Hand, card)
		} else {
			card.Zone = "library"
			p.Library = append(p.Library, card)
		}
	}
	m := matchState{MulliganMode: "standard", MulliganOpen: true}
	if _, err := mulligan(&m, &p); err != nil {
		t.Fatal(err)
	}
	ids := make([]string, 6)
	for i := range ids {
		ids[i] = p.Hand[i].ID
	}
	if _, err := keepMulliganHand(&m, &p, ids); err != nil {
		t.Fatal(err)
	}
	if len(p.Hand) != 1 {
		t.Fatalf("esperava uma carta, recebeu %d", len(p.Hand))
	}
	p.MulliganKept = false
	p.Hand = append(p.Hand, p.Library[:6]...)
	p.Library = p.Library[6:]
	if _, err := mulligan(&m, &p); err != errMulliganClosed {
		t.Fatalf("esperava limite, recebeu %v", err)
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
