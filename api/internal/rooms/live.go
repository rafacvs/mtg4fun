package rooms

import (
	"context"
	"database/sql"
	"errors"
	"log"
	"net/http"
	"sort"
	"sync"
	"time"

	"mtg4fun/internal/httpserver"
	"mtg4fun/internal/live"
	"mtg4fun/internal/minigames"
)

const maxPlayRolls = 50

func (s *Service) setupLive() {
	s.live = live.NewHub()
	s.coinDuels = &minigames.CoinDuels{Hub: s.live, Participant: s.preparingParticipant}
	s.live.Register(diceGame{s}, s.coinDuels, &minigames.Emoji{Hub: s.live, Participant: s.preparingParticipant})
}

// CloseLive asks the connected clients to come back after a restart.
func (s *Service) CloseLive() { s.live.Close() }

func (s *Service) liveRoom(w http.ResponseWriter, r *http.Request) {
	id, ok := roomID(w, r)
	if !ok {
		return
	}
	user, ok := s.requireUser(w, r)
	if !ok {
		return
	}
	room, err := readRoom(s.db.QueryRowContext(r.Context(), "SELECT snapshot FROM rooms WHERE id=?", id))
	if errors.Is(err, sql.ErrNoRows) || (err == nil && !memberOf(room, user.ID)) {
		httpserver.WriteError(w, 404, "Sala não encontrada.")
		return
	}
	if err != nil {
		httpserver.InternalError(w, err)
		return
	}
	s.live.Serve(w, r, id, live.Member{ID: user.ID, Name: user.Name}, func() bool {
		_, _, err := s.users.CurrentUser(r)
		return !errors.Is(err, sql.ErrNoRows)
	})
}

// preparingParticipant allows the games that exist only before the match starts.
func (s *Service) preparingParticipant(ctx context.Context, id, userID int64) (string, error) {
	room, err := readRoom(s.db.QueryRowContext(ctx, "SELECT snapshot FROM rooms WHERE id=?", id))
	if errors.Is(err, sql.ErrNoRows) {
		return "", live.UserError{Message: "Sala não encontrada."}
	}
	if err != nil {
		return "", err
	}
	if room.Status != "preparing" {
		return "", live.UserError{Message: "Disponível só antes de iniciar a partida."}
	}
	for _, p := range room.Participants {
		if p.ID == userID {
			return p.Name, nil
		}
	}
	return "", live.UserError{Message: "Esse jogador não está nesta sala."}
}

// diceGame only distributes: rolls enter through POST /preparation/actions, which
// keeps the idempotency and the transaction of the rolls that define the order.
type diceGame struct{ s *Service }

func (diceGame) Name() string { return "dice" }

func (diceGame) Limit() live.Limit { return live.Limit{} }

func (d diceGame) Snapshot(ctx context.Context, id int64, _ live.Member) (any, error) {
	return d.s.preparationView(ctx, id)
}

func (diceGame) Handle(context.Context, live.Request) error {
	return live.UserError{Message: "Ação inválida."}
}

type preparationView struct {
	Phase     string            `json:"phase"`
	Rolls     []PreparationRoll `json:"rolls"`
	Confirmed map[int64]string  `json:"confirmed"`
}

// preparationView joins the rolls that count, in MySQL, with the ones for fun, in memory.
func (s *Service) preparationView(ctx context.Context, id int64) (preparationView, error) {
	room, err := readRoom(s.db.QueryRowContext(ctx, "SELECT snapshot FROM rooms WHERE id=?", id))
	if err != nil {
		return preparationView{}, err
	}
	rolls := append(room.Dice, s.playRolls.list(id)...)
	sort.SliceStable(rolls, func(i, j int) bool { return rolls[i].At < rolls[j].At })
	return preparationView{Phase: room.Status, Rolls: rolls, Confirmed: room.Confirmed}, nil
}

// publishPreparation holds the lock across reading and sending so that an older
// view cannot be delivered after a newer one.
func (s *Service) publishPreparation(id int64) {
	s.publishing.Lock()
	defer s.publishing.Unlock()
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()
	view, err := s.preparationView(ctx, id)
	if err != nil {
		log.Printf("publicar rolagens da sala %d: %v", id, err)
		return
	}
	s.live.Publish(id, diceGame{}.Name(), "state", view)
}

// playRollStore keeps the rolls for fun: they survive a reload, not an API restart.
type playRollStore struct {
	mu    sync.Mutex
	rooms map[int64][]PreparationRoll
}

func (p *playRollStore) list(id int64) []PreparationRoll {
	p.mu.Lock()
	defer p.mu.Unlock()
	return append([]PreparationRoll(nil), p.rooms[id]...)
}

func (p *playRollStore) has(id int64, rollID string) bool {
	p.mu.Lock()
	defer p.mu.Unlock()
	for _, roll := range p.rooms[id] {
		if roll.ID == rollID {
			return true
		}
	}
	return false
}

func (p *playRollStore) recent(id, playerID int64, since int64) int {
	p.mu.Lock()
	defer p.mu.Unlock()
	count := 0
	for _, roll := range p.rooms[id] {
		if roll.PlayerID == playerID && roll.At > since {
			count++
		}
	}
	return count
}

func (p *playRollStore) add(id int64, roll PreparationRoll) {
	p.mu.Lock()
	defer p.mu.Unlock()
	if p.rooms == nil {
		p.rooms = map[int64][]PreparationRoll{}
	}
	rolls := append(p.rooms[id], roll)
	if len(rolls) > maxPlayRolls {
		rolls = rolls[len(rolls)-maxPlayRolls:]
	}
	p.rooms[id] = rolls
}

func (p *playRollStore) drop(id int64) {
	p.mu.Lock()
	defer p.mu.Unlock()
	delete(p.rooms, id)
}
