package minigames

import (
	"context"
	"encoding/json"
	"sync"
	"testing"
	"time"

	"mtg4fun/internal/live"
)

type sentMessage struct {
	kind string
	data map[string]any
}

type recordingRoom struct {
	mu     sync.Mutex
	sent   []sentMessage
	online map[int64]bool
}

func (r *recordingRoom) Publish(_ int64, _ string, kind string, data any) {
	r.mu.Lock()
	defer r.mu.Unlock()
	view, _ := data.(map[string]any)
	r.sent = append(r.sent, sentMessage{kind, view})
}

func (r *recordingRoom) Online(_, member int64) bool {
	r.mu.Lock()
	defer r.mu.Unlock()
	return r.online[member]
}

func (r *recordingRoom) count(kind string) int {
	r.mu.Lock()
	defer r.mu.Unlock()
	total := 0
	for _, message := range r.sent {
		if message.kind == kind {
			total++
		}
	}
	return total
}

func newDuels(room *recordingRoom) *CoinDuels {
	return &CoinDuels{
		Hub: room,
		Participant: func(_ context.Context, _, id int64) (string, error) {
			return map[int64]string{1: "Ana", 2: "Bia"}[id], nil
		},
		Flip: func() (string, error) { return sideHeads, nil },
	}
}

func act(t *testing.T, duels *CoinDuels, from int64, kind, data string) error {
	t.Helper()
	return duels.Handle(context.Background(), live.Request{RoomID: 7, From: live.Member{ID: from, Name: map[int64]string{1: "Ana", 2: "Bia"}[from]}, Type: kind, Data: json.RawMessage(data)})
}

func waitFor(t *testing.T, condition func() bool) {
	t.Helper()
	for deadline := time.Now().Add(2 * time.Second); time.Now().Before(deadline); time.Sleep(5 * time.Millisecond) {
		if condition() {
			return
		}
	}
	t.Fatal("condição não ocorreu a tempo")
}

func TestDuelExpiresWithoutActivityAndActivityExtendsIt(t *testing.T) {
	room := &recordingRoom{online: map[int64]bool{1: true, 2: true}}
	duels := newDuels(room)
	duels.Timeout = 120 * time.Millisecond
	if err := act(t, duels, 1, "challenge", `{"opponentId":2}`); err != nil {
		t.Fatal(err)
	}
	time.Sleep(70 * time.Millisecond)
	if err := act(t, duels, 2, "confirm", `{"side":"Cara"}`); err != nil {
		t.Fatal(err)
	}
	time.Sleep(70 * time.Millisecond)
	if room.count("cancelled") != 0 {
		t.Fatal("a ação deveria ter renovado o prazo")
	}
	waitFor(t, func() bool { return room.count("cancelled") == 1 })
	if err := act(t, duels, 1, "confirm", `{"side":"Coroa"}`); err == nil {
		t.Fatal("confirmou um X1 expirado")
	}
}

func TestDuelFlipsOnlyWithDifferentSidesAndWinnerMatchesTheCoin(t *testing.T) {
	room := &recordingRoom{online: map[int64]bool{1: true, 2: true}}
	duels := newDuels(room)
	for _, step := range []struct {
		from       int64
		kind, data string
	}{{1, "challenge", `{"opponentId":2}`}, {1, "confirm", `{"side":"Coroa"}`}, {2, "confirm", `{"side":"Coroa"}`}} {
		if err := act(t, duels, step.from, step.kind, step.data); err != nil {
			t.Fatal(err)
		}
	}
	if room.count("result") != 0 {
		t.Fatal("sorteou com os dois no mesmo lado")
	}
	if err := act(t, duels, 2, "confirm", `{"side":"Cara"}`); err != nil {
		t.Fatal(err)
	}
	if room.count("result") != 1 {
		t.Fatal("não sorteou com lados diferentes")
	}
	result := room.sent[len(room.sent)-1].data
	if result["winnerId"] != int64(2) || result["loserName"] != "Ana" {
		t.Fatalf("a moeda deu Cara e Bia escolheu Cara: %v", result)
	}
	if err := act(t, duels, 1, "challenge", `{"opponentId":2}`); err != nil {
		t.Fatalf("o X1 terminado deveria liberar os dois: %v", err)
	}
}

func TestDuelSurvivesQuickReturnAndEndsAfterOfflineWait(t *testing.T) {
	room := &recordingRoom{online: map[int64]bool{1: true, 2: true}}
	duels := newDuels(room)
	duels.OfflineWait = 40 * time.Millisecond
	if err := act(t, duels, 1, "challenge", `{"opponentId":2}`); err != nil {
		t.Fatal(err)
	}
	duels.MemberOffline(7, 2)
	duels.MemberOnline(7, 2)
	time.Sleep(80 * time.Millisecond)
	if room.count("cancelled") != 0 {
		t.Fatal("voltar a tempo deveria manter o X1")
	}
	room.mu.Lock()
	room.online[2] = false
	room.mu.Unlock()
	duels.MemberOffline(7, 2)
	waitFor(t, func() bool { return room.count("cancelled") == 1 })
}
