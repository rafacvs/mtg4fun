package rooms

import (
	"encoding/json"
	"slices"
	"testing"
)

func TestMoveClearsBattlefieldStateAndRemovesTokens(t *testing.T) {
	for _, destination := range []string{"graveyard", "exile", "hand", "library", "command"} {
		for _, kind := range []string{"", "token", "custom-token", "copy"} {
			t.Run(destination+"/"+kind, func(t *testing.T) {
				p := playerState{UserID: 1, Battlefield: []Card{{ID: "card", Zone: "battlefield", ControllerID: 1, OwnerID: 1, InstanceKind: kind, Tapped: true, FaceDown: true, Power: 4, Toughness: -2, Markers: colorCounts{Red: 7, Blue: -1}}}}
				if _, err := moveCards(&matchState{}, &p, matchAction{CardIDs: []string{"card"}, To: destination, LibraryPlacement: "top"}); err != nil {
					t.Fatal(err)
				}
				if len(p.Battlefield) != 0 {
					t.Fatal("card stayed on battlefield")
				}
				got := *zone(&p, destination)
				if kind != "" {
					if len(got) != 0 {
						t.Fatal("token survived outside battlefield")
					}
					return
				}
				if len(got) != 1 || got[0].Zone != destination {
					t.Fatalf("destination: %+v", got)
				}
				if got[0].Tapped || got[0].FaceDown || got[0].Power != 0 || got[0].Toughness != 0 || got[0].Markers != (colorCounts{}) {
					t.Fatalf("state survived: %+v", got[0])
				}
			})
		}
	}
}

func TestMoveOntoBattlefieldUsesTheCellOrTheFirstOpenStack(t *testing.T) {
	p := &playerState{UserID: 1, Hand: []Card{{ID: "a", ControllerID: 1, Zone: "hand"}, {ID: "b", ControllerID: 1, Zone: "hand"}}, Battlefield: []Card{
		{ID: "1", PositionX: 0, Row: 0}, {ID: "2", PositionX: 0, Row: 0}, {ID: "3", PositionX: 0, Row: 0},
		{ID: "4", PositionX: 1, Row: 2}, {ID: "5", PositionX: 1, Row: 2}, {ID: "6", PositionX: 1, Row: 2},
	}}
	m := &matchState{}
	if _, err := moveCards(m, p, matchAction{CardIDs: []string{"a", "b"}, To: "battlefield"}); err != nil {
		t.Fatal(err)
	}
	got := map[string]Card{}
	for _, card := range p.Battlefield {
		got[card.ID] = card
	}
	if got["a"].PositionX != 1 || got["a"].Row != 0 || got["b"].PositionX != 1 || got["b"].Row != 0 || got["a"].StackOrder == 0 || got["a"].StackOrder >= got["b"].StackOrder {
		t.Fatalf("entrada sem ponto: %+v %+v", got["a"], got["b"])
	}
	p.Hand = []Card{{ID: "c", ControllerID: 1, Zone: "hand"}}
	if _, err := moveCards(m, p, matchAction{CardIDs: []string{"c"}, To: "battlefield", HasPosition: true, PositionX: 4, Row: 3}); err != nil {
		t.Fatal(err)
	}
	if p.Battlefield[len(p.Battlefield)-1].PositionX != 4 || p.Battlefield[len(p.Battlefield)-1].Row != 3 {
		t.Fatalf("célula pedida: %+v", p.Battlefield[len(p.Battlefield)-1])
	}
}

func TestMoveFromAnotherZoneClearsCountersAndTapButKeepsFaceDownEntry(t *testing.T) {
	for _, from := range []string{"hand", "graveyard", "exile", "command"} {
		t.Run(from, func(t *testing.T) {
			p := &playerState{UserID: 1}
			*zone(p, from) = []Card{{ID: "card", Zone: from, ControllerID: 1, OwnerID: 1, Tapped: true, FaceDown: true, Power: 2, Toughness: 1, Markers: colorCounts{Red: 3}}}
			if _, err := moveCards(&matchState{}, p, matchAction{CardIDs: []string{"card"}, To: "battlefield"}); err != nil {
				t.Fatal(err)
			}
			got := p.Battlefield[0]
			if got.Tapped || got.Power != 0 || got.Toughness != 0 || got.Markers != (colorCounts{}) {
				t.Fatalf("state survived: %+v", got)
			}
			if !got.FaceDown {
				t.Fatal("played face down lost its face")
			}
		})
	}
}

func TestMoveWithinBattlefieldKeepsCardState(t *testing.T) {
	p := &playerState{UserID: 1, Battlefield: []Card{{ID: "card", Zone: "battlefield", ControllerID: 1, OwnerID: 1, Tapped: true, FaceDown: true, Power: 2, Markers: colorCounts{Red: 3}}}}
	if _, err := moveCards(&matchState{}, p, matchAction{CardIDs: []string{"card"}, To: "battlefield"}); err != nil {
		t.Fatal(err)
	}
	if got := p.Battlefield[0]; !got.Tapped || !got.FaceDown || got.Power != 2 || got.Markers.Red != 3 {
		t.Fatalf("state lost: %+v", got)
	}
}

func TestDroppingManyCardsOpensAsManyStacksAsNeeded(t *testing.T) {
	cases := []struct {
		name     string
		existing []Card
		count    int
		want     [][2]int
	}{
		{"campo vazio", nil, 7, [][2]int{{5, 1}, {5, 1}, {5, 1}, {6, 1}, {6, 1}, {6, 1}, {7, 1}}},
		{"completa a pilha alvo", []Card{{PositionX: 5, Row: 1}}, 3, [][2]int{{5, 1}, {5, 1}, {6, 1}}},
		{"pilha alvo cheia", []Card{{PositionX: 5, Row: 1}, {PositionX: 5, Row: 1}, {PositionX: 5, Row: 1}}, 1, [][2]int{{6, 1}}},
		{"não mistura com outra carta da fileira", []Card{{PositionX: 6, Row: 1}}, 4, [][2]int{{5, 1}, {5, 1}, {5, 1}, {7, 1}}},
		{"outra fileira não ocupa", []Card{{PositionX: 6, Row: 2}}, 4, [][2]int{{5, 1}, {5, 1}, {5, 1}, {6, 1}}},
	}
	for _, c := range cases {
		t.Run(c.name, func(t *testing.T) {
			got, err := planBattlefieldEntry(c.existing, c.count, true, 5, 1)
			if err != nil {
				t.Fatal(err)
			}
			if !slices.Equal(got, c.want) {
				t.Fatalf("got %v, want %v", got, c.want)
			}
		})
	}
	if _, err := planBattlefieldEntry(nil, 4, true, 20000, 0); err != errInvalidPosition {
		t.Fatalf("beyond the table: %v", err)
	}
}

func TestNextTurnClearsEveryDisclosureWithoutMovingCards(t *testing.T) {
	m := matchState{TurnOrder: []Turn{{UserID: 1}, {UserID: 2}}, Players: []playerState{{UserID: 1}, {UserID: 2}}}
	zones := []string{"battlefield", "hand", "graveyard", "exile", "command", "consulted", "revealed", "library"}
	for i := range m.Players {
		for _, name := range zones {
			*zone(&m.Players[i], name) = []Card{{ID: name, Zone: name, Revealed: true}}
		}
	}
	if _, err := changeTurn(&m, "next"); err != nil {
		t.Fatal(err)
	}
	if m.TurnIndex != 1 {
		t.Fatal("turn did not advance")
	}
	for i := range m.Players {
		for _, name := range zones {
			cards := *zone(&m.Players[i], name)
			if len(cards) != 1 || cards[0].ID != name || cards[0].Zone != name || cards[0].Revealed {
				t.Fatalf("changed zone or disclosure: %+v", cards)
			}
		}
	}
	observer := m.view(2, nil).Players[0]
	if len(observer.ExposedCards) != 0 || len(observer.Revealed) != 0 {
		t.Fatal("hidden identities remain public")
	}
}

func TestLegacyRevelationCanBeHiddenAndReturnedWithoutLoss(t *testing.T) {
	p := playerState{UserID: 1, Revealed: []Card{{ID: "old", Name: "Old", Zone: "revealed", Revealed: true}}, Consulted: []Card{{ID: "private", Name: "Private", Zone: "consulted"}}}
	clearRevelations(&p)
	if len(p.Revealed) != 1 || p.Revealed[0].Zone != "revealed" {
		t.Fatal("hiding moved legacy card")
	}
	m := matchState{Players: []playerState{p}}
	raw, _ := json.Marshal(m)
	if err := json.Unmarshal(raw, &m); err != nil {
		t.Fatal(err)
	}
	if len(m.view(2, nil).Players[0].Revealed) != 0 {
		t.Fatal("legacy card leaked")
	}
	if len(m.view(1, nil).Players[0].Consulted) != 2 {
		t.Fatal("owner lost access")
	}
	raw, _ = json.Marshal(p)
	if err := json.Unmarshal(raw, &p); err != nil {
		t.Fatal(err)
	}
	if _, err := closeConsultation(&p, "top", false); err != nil {
		t.Fatal(err)
	}
	if len(p.Library) != 2 || p.Library[1].ID != "old" || p.Library[1].Revealed {
		t.Fatal("legacy return failed")
	}
}

func TestReorderingLegacyConsultationDoesNotRevealHiddenCards(t *testing.T) {
	p := playerState{UserID: 1, Consulted: []Card{{ID: "private", Zone: "consulted"}}, Revealed: []Card{{ID: "old", Zone: "revealed"}}}
	raw, _ := json.Marshal(p)
	if err := json.Unmarshal(raw, &p); err != nil {
		t.Fatal(err)
	}
	if _, err := reorderConsulted(&p, []string{"old", "private"}); err != nil {
		t.Fatal(err)
	}
	cards := consultationCards(&p)
	if len(cards) != 2 || cards[0].Revealed {
		t.Fatal("reorder revealed a hidden identity")
	}
}

func TestMovePlacementInOrderedZones(t *testing.T) {
	for _, test := range []struct {
		to, placement string
		want          []string
	}{
		{"graveyard", "top", []string{"old", "a", "b"}},
		{"graveyard", "bottom", []string{"a", "b", "old"}},
		{"graveyard", "", []string{"old", "a", "b"}},
		{"exile", "top", []string{"old", "a", "b"}},
		{"exile", "bottom", []string{"a", "b", "old"}},
		{"library", "top", []string{"a", "b", "old"}},
		{"library", "bottom", []string{"old", "a", "b"}},
	} {
		t.Run(test.to+"/"+test.placement, func(t *testing.T) {
			p := playerState{UserID: 1, Hand: []Card{{ID: "a", ControllerID: 1, OwnerID: 1}, {ID: "b", ControllerID: 1, OwnerID: 1}}}
			*zone(&p, test.to) = []Card{{ID: "old", ControllerID: 1, OwnerID: 1}}
			if _, err := moveCards(&matchState{}, &p, matchAction{CardIDs: []string{"a", "b"}, To: test.to, LibraryPlacement: test.placement}); err != nil {
				t.Fatal(err)
			}
			got := []string{}
			for _, card := range *zone(&p, test.to) {
				got = append(got, card.ID)
			}
			if !slices.Equal(got, test.want) {
				t.Fatalf("ordem %v, esperada %v", got, test.want)
			}
		})
	}
	for _, test := range []struct{ to, placement string }{{"hand", "top"}, {"battlefield", "bottom"}, {"command", "top"}, {"graveyard", "middle"}, {"library", ""}} {
		if validMovePlacement(test.to, test.placement) {
			t.Fatalf("%s/%s deveria ser recusado", test.to, test.placement)
		}
	}
}

func TestReorderZoneRequiresTheWholeZone(t *testing.T) {
	cards := []Card{{ID: "a"}, {ID: "b"}, {ID: "c"}}
	p := playerState{Graveyard: cards}
	for _, ids := range [][]string{{"a", "b"}, {"a", "a", "b"}, {"a", "b", "x"}} {
		if _, err := reorderZone(&p, "graveyard", ids); err == nil {
			t.Fatalf("%v deveria ser recusado", ids)
		}
	}
	if _, err := reorderZone(&p, "graveyard", []string{"c", "a", "b"}); err != nil {
		t.Fatal(err)
	}
	if got := []string{p.Graveyard[0].ID, p.Graveyard[1].ID, p.Graveyard[2].ID}; !slices.Equal(got, []string{"c", "a", "b"}) {
		t.Fatalf("ordem %v", got)
	}
}
