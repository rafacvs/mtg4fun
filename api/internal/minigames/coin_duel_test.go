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
	mu       sync.Mutex
	sent     []sentMessage
	outcomes []Outcome
	online   map[int64]bool
}

func (r *recordingRoom) Publish(_ int64, _ string, kind string, data any) {
	r.mu.Lock()
	defer r.mu.Unlock()
	view, _ := data.(map[string]any)
	if outcome, ok := data.(Outcome); ok {
		r.outcomes = append(r.outcomes, outcome)
	}
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
	steps(t, duels, step{1, "challenge", `{"opponentId":2}`})
	time.Sleep(70 * time.Millisecond)
	steps(t, duels, step{2, "accept", `{}`})
	time.Sleep(70 * time.Millisecond)
	if room.count("cancelled") != 0 {
		t.Fatal("a ação deveria ter renovado o prazo")
	}
	waitFor(t, func() bool { return room.count("cancelled") == 1 })
	if err := act(t, duels, 1, "pick", `{"side":"Coroa"}`); err == nil {
		t.Fatal("escolheu em um X1 expirado")
	}
}

type step struct {
	from       int64
	kind, data string
}

func steps(t *testing.T, duels *CoinDuels, list ...step) {
	t.Helper()
	for _, s := range list {
		if err := act(t, duels, s.from, s.kind, s.data); err != nil {
			t.Fatalf("%s de %d: %v", s.kind, s.from, err)
		}
	}
}

func lastResult(t *testing.T, room *recordingRoom) Outcome {
	t.Helper()
	room.mu.Lock()
	defer room.mu.Unlock()
	if len(room.outcomes) == 0 {
		t.Fatal("nenhum resultado publicado")
	}
	return room.outcomes[len(room.outcomes)-1]
}

func TestDuelBlocksSameSideAndWinnerMatchesTheCoin(t *testing.T) {
	room := &recordingRoom{online: map[int64]bool{1: true, 2: true}}
	duels := newDuels(room)
	if err := act(t, duels, 2, "pick", `{"side":"Cara"}`); err == nil {
		t.Fatal("escolheu sem X1")
	}
	steps(t, duels, step{1, "challenge", `{"opponentId":2}`})
	if err := act(t, duels, 2, "pick", `{"side":"Cara"}`); err == nil {
		t.Fatal("escolheu antes de aceitar")
	}
	steps(t, duels, step{2, "accept", `{}`}, step{1, "pick", `{"side":"Coroa"}`}, step{2, "pick", `{"side":"Coroa"}`})
	for _, from := range []int64{1, 2} {
		if err := act(t, duels, from, "confirm", `{}`); err == nil {
			t.Fatal("confirmou com os dois no mesmo lado")
		}
	}
	steps(t, duels, step{2, "pick", `{"side":"Cara"}`}, step{1, "confirm", `{}`})
	// Quem confirmou fica com o lado, e o outro já não pode escolhê-lo.
	if err := act(t, duels, 2, "pick", `{"side":"Coroa"}`); err == nil {
		t.Fatal("escolheu o lado confirmado pelo outro")
	}
	if err := act(t, duels, 1, "pick", `{"side":"Cara"}`); err == nil {
		t.Fatal("trocou de lado sem desconfirmar")
	}
	if room.count("result") != 0 {
		t.Fatal("sorteou antes das duas confirmações")
	}
	steps(t, duels, step{2, "confirm", `{}`})
	result := lastResult(t, room)
	if result.WinnerID != 2 || result.LoserName != "Ana" || result.LoserSide != "Coroa" || result.WinnerSide != "Cara" || result.Side != "Cara" {
		t.Fatalf("a moeda deu Cara e Bia escolheu Cara: %+v", result)
	}
	steps(t, duels, step{1, "challenge", `{"opponentId":2}`})
}

func TestDuelMarksWhoLosesForfeitsOrRefusesUntilTheMatchStarts(t *testing.T) {
	room := &recordingRoom{online: map[int64]bool{1: true, 2: true}}
	duels := newDuels(room)
	marks := func() map[int64]string {
		duels.mu.Lock()
		defer duels.mu.Unlock()
		return duels.view(7)["marks"].(map[int64]string)
	}
	// Cancelar antes de responder não marca ninguém.
	steps(t, duels, step{1, "challenge", `{"opponentId":2}`}, step{1, "cancel", `{}`})
	if len(marks()) != 0 || room.count("cancelled") != 1 {
		t.Fatalf("cancelar marcou alguém: %v", marks())
	}
	steps(t, duels, step{1, "challenge", `{"opponentId":2}`}, step{2, "refuse", `{}`})
	if marks()[2] != markRefused || lastResult(t, room).Kind != outcomeRefused {
		t.Fatalf("recusar deveria marcar: %v", marks())
	}
	steps(t, duels, step{2, "challenge", `{"opponentId":1}`}, step{1, "accept", `{}`})
	if err := act(t, duels, 2, "cancel", `{}`); err == nil {
		t.Fatal("desistir sem custo depois de aceitar")
	}
	steps(t, duels, step{1, "forfeit", `{}`})
	if marks()[1] != markLost || lastResult(t, room).Kind != outcomeForfeit || lastResult(t, room).WinnerName != "Bia" {
		t.Fatalf("arregar conta como derrota: %v %+v", marks(), lastResult(t, room))
	}
	duels.CancelRoom(7)
	if len(marks()) != 0 {
		t.Fatalf("a marca deveria sumir ao começar a partida: %v", marks())
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
