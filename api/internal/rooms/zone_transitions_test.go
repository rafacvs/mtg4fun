package rooms

import "testing"

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
				if destination == "graveyard" || destination == "exile" {
					if got[0].Tapped || got[0].FaceDown || got[0].Power != 0 || got[0].Toughness != 0 || got[0].Markers != (colorCounts{}) {
						t.Fatalf("state survived: %+v", got[0])
					}
				} else if !got[0].Tapped || got[0].Power != 4 {
					t.Fatal("unrequested reset")
				}
			})
		}
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
	if len(m.view(2, nil).Players[0].Revealed) != 0 {
		t.Fatal("legacy card leaked")
	}
	if len(m.view(1, nil).Players[0].Consulted) != 2 {
		t.Fatal("owner lost access")
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
	if _, err := reorderConsulted(&p, []string{"old", "private"}); err != nil {
		t.Fatal(err)
	}
	if len(p.Consulted) != 2 || p.Consulted[0].Revealed {
		t.Fatal("reorder revealed a hidden identity")
	}
}
