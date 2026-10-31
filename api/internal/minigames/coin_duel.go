package minigames

import (
	"context"
	cryptorand "crypto/rand"
	"encoding/json"
	"fmt"
	"maps"
	"math/big"
	"sync"
	"time"

	"mtg4fun/internal/live"
)

const (
	sideHeads = "Cara"
	sideTails = "Coroa"

	duelTimeout     = 60 * time.Second
	duelOfflineWait = 15 * time.Second
)

// Duel is the public state of a coin duel. Only confirmed sides are shared: a
// side chosen but not confirmed stays in the player's browser.
type Duel struct {
	ID             int64            `json:"id"`
	ChallengerID   int64            `json:"challengerId"`
	ChallengerName string           `json:"challengerName"`
	OpponentID     int64            `json:"opponentId"`
	OpponentName   string           `json:"opponentName"`
	Confirmed      map[int64]string `json:"confirmed"`
	// Conflict means both confirmed the same side at once, so nothing is flipped
	// until one of them unconfirms and changes.
	Conflict bool `json:"conflict"`
	room     int64
	timer    *time.Timer
}

func (d *Duel) has(member int64) bool { return d.ChallengerID == member || d.OpponentID == member }

func (d *Duel) other(member int64) (int64, string) {
	if member == d.ChallengerID {
		return d.OpponentID, d.OpponentName
	}
	return d.ChallengerID, d.ChallengerName
}

func (d *Duel) name(member int64) string {
	if member == d.ChallengerID {
		return d.ChallengerName
	}
	return d.OpponentName
}

type presence struct{ room, member int64 }

// CoinDuels runs one-on-one coin flips. A person plays one duel at a time, and
// other pairs in the room can play at the same moment.
type CoinDuels struct {
	Hub         Publisher
	Participant Participant
	// Flip, Timeout and OfflineWait have defaults; tests can shorten them.
	Flip        func() (string, error)
	Timeout     time.Duration
	OfflineWait time.Duration

	mu      sync.Mutex
	nextID  int64
	duels   map[int64]*Duel
	offline map[presence]*time.Timer
}

func (*CoinDuels) Name() string { return "coin-duel" }

func (*CoinDuels) Limit() live.Limit { return live.Limit{Every: 100 * time.Millisecond, Burst: 10} }

func (c *CoinDuels) Snapshot(_ context.Context, roomID int64, _ live.Member) (any, error) {
	c.mu.Lock()
	defer c.mu.Unlock()
	return c.view(roomID), nil
}

// view copies the duels: a snapshot is encoded after the lock is released.
func (c *CoinDuels) view(roomID int64) map[string]any {
	duels := []Duel{}
	for _, duel := range c.duels {
		if duel.room == roomID {
			public := Duel{ID: duel.ID, ChallengerID: duel.ChallengerID, ChallengerName: duel.ChallengerName, OpponentID: duel.OpponentID, OpponentName: duel.OpponentName, Confirmed: maps.Clone(duel.Confirmed), Conflict: duel.Conflict}
			duels = append(duels, public)
		}
	}
	return map[string]any{"duels": duels}
}

func (c *CoinDuels) publishState(roomID int64) {
	c.Hub.Publish(roomID, c.Name(), "state", c.view(roomID))
}

func (c *CoinDuels) Handle(ctx context.Context, request live.Request) error {
	switch request.Type {
	case "challenge":
		var input struct {
			OpponentID int64 `json:"opponentId"`
		}
		if json.Unmarshal(request.Data, &input) != nil {
			return live.UserError{Message: "Desafio inválido."}
		}
		return c.challenge(ctx, request, input.OpponentID)
	case "confirm":
		var input struct {
			Side string `json:"side"`
		}
		if json.Unmarshal(request.Data, &input) != nil || (input.Side != sideHeads && input.Side != sideTails) {
			return live.UserError{Message: "Escolha cara ou coroa."}
		}
		return c.confirm(request, input.Side)
	case "unconfirm":
		return c.unconfirm(request)
	case "cancel":
		return c.cancel(request)
	}
	return live.UserError{Message: "Ação inválida."}
}

func (c *CoinDuels) challenge(ctx context.Context, request live.Request, opponentID int64) error {
	if opponentID == request.From.ID {
		return live.UserError{Message: "Escolha outro jogador."}
	}
	// Checked before locking: this reads the database.
	opponentName, err := c.Participant(ctx, request.RoomID, opponentID)
	if err != nil {
		return err
	}
	if _, err := c.Participant(ctx, request.RoomID, request.From.ID); err != nil {
		return err
	}
	c.mu.Lock()
	defer c.mu.Unlock()
	if !c.Hub.Online(request.RoomID, opponentID) {
		return live.UserError{Message: fmt.Sprintf("%s não está na sala agora.", opponentName)}
	}
	for _, duel := range c.duels {
		if duel.room != request.RoomID {
			continue
		}
		if duel.has(request.From.ID) {
			return live.UserError{Message: "Você já está em um X1."}
		}
		if duel.has(opponentID) {
			return live.UserError{Message: fmt.Sprintf("%s já está em um X1.", opponentName)}
		}
	}
	if c.duels == nil {
		c.duels = map[int64]*Duel{}
	}
	c.nextID++
	duel := &Duel{ID: c.nextID, ChallengerID: request.From.ID, ChallengerName: request.From.Name, OpponentID: opponentID, OpponentName: opponentName, Confirmed: map[int64]string{}, room: request.RoomID}
	c.duels[duel.ID] = duel
	c.restartTimer(duel)
	c.publishState(request.RoomID)
	return nil
}

func (c *CoinDuels) duelOf(roomID, member int64) *Duel {
	for _, duel := range c.duels {
		if duel.room == roomID && duel.has(member) {
			return duel
		}
	}
	return nil
}

func (c *CoinDuels) confirm(request live.Request, side string) error {
	c.mu.Lock()
	defer c.mu.Unlock()
	duel := c.duelOf(request.RoomID, request.From.ID)
	if duel == nil {
		return live.UserError{Message: "Este X1 já terminou."}
	}
	duel.Confirmed[request.From.ID] = side
	c.restartTimer(duel)
	other, _ := duel.other(request.From.ID)
	otherSide := duel.Confirmed[other]
	duel.Conflict = otherSide == side
	if otherSide == "" || duel.Conflict {
		c.publishState(request.RoomID)
		return nil
	}
	flip := c.Flip
	if flip == nil {
		flip = flipCoin
	}
	result, err := flip()
	if err != nil {
		delete(duel.Confirmed, request.From.ID)
		c.publishState(request.RoomID)
		return err
	}
	winner := request.From.ID
	if side != result {
		winner = other
	}
	loser, loserName := duel.other(winner)
	c.remove(duel)
	c.publishState(request.RoomID)
	c.Hub.Publish(request.RoomID, c.Name(), "result", map[string]any{"duelId": duel.ID, "side": result, "winnerId": winner, "winnerName": duel.name(winner), "loserId": loser, "loserName": loserName})
	return nil
}

func (c *CoinDuels) unconfirm(request live.Request) error {
	c.mu.Lock()
	defer c.mu.Unlock()
	duel := c.duelOf(request.RoomID, request.From.ID)
	if duel == nil {
		return live.UserError{Message: "Este X1 já terminou."}
	}
	delete(duel.Confirmed, request.From.ID)
	duel.Conflict = false
	c.restartTimer(duel)
	c.publishState(request.RoomID)
	return nil
}

func (c *CoinDuels) cancel(request live.Request) error {
	c.mu.Lock()
	defer c.mu.Unlock()
	duel := c.duelOf(request.RoomID, request.From.ID)
	if duel == nil {
		return nil
	}
	verb := "desistiu do X1"
	if request.From.ID == duel.OpponentID {
		verb = "recusou o X1"
	}
	c.end(duel, fmt.Sprintf("%s %s.", request.From.Name, verb))
	return nil
}

// CancelRoom ends the room's duels, for when the match is about to start.
func (c *CoinDuels) CancelRoom(roomID int64) {
	c.mu.Lock()
	defer c.mu.Unlock()
	for _, duel := range c.duels {
		if duel.room == roomID {
			c.end(duel, "O X1 foi cancelado: a partida vai começar.")
		}
	}
}

func (c *CoinDuels) end(duel *Duel, reason string) {
	c.remove(duel)
	c.publishState(duel.room)
	c.Hub.Publish(duel.room, c.Name(), "cancelled", map[string]any{"duelId": duel.ID, "players": []int64{duel.ChallengerID, duel.OpponentID}, "message": reason})
}

func (c *CoinDuels) remove(duel *Duel) {
	duel.timer.Stop()
	delete(c.duels, duel.ID)
}

func (c *CoinDuels) restartTimer(duel *Duel) {
	if duel.timer != nil {
		duel.timer.Stop()
	}
	timeout := c.Timeout
	if timeout == 0 {
		timeout = duelTimeout
	}
	armed := new(*time.Timer)
	timer := time.AfterFunc(timeout, func() {
		c.mu.Lock()
		defer c.mu.Unlock()
		// A timer that already fired can lose the lock to the action that replaced it.
		if c.duels[duel.ID] == duel && duel.timer == *armed {
			c.end(duel, "O X1 expirou sem resposta.")
		}
	})
	*armed = timer
	duel.timer = timer
}

// MemberOnline keeps the duel of someone who only reloaded the page.
func (c *CoinDuels) MemberOnline(roomID, memberID int64) {
	c.mu.Lock()
	defer c.mu.Unlock()
	key := presence{roomID, memberID}
	if timer := c.offline[key]; timer != nil {
		timer.Stop()
		delete(c.offline, key)
	}
}

// MemberOffline gives the player some time to come back before ending the duel.
func (c *CoinDuels) MemberOffline(roomID, memberID int64) {
	c.mu.Lock()
	defer c.mu.Unlock()
	if c.duelOf(roomID, memberID) == nil {
		return
	}
	if c.offline == nil {
		c.offline = map[presence]*time.Timer{}
	}
	wait := c.OfflineWait
	if wait == 0 {
		wait = duelOfflineWait
	}
	key := presence{roomID, memberID}
	if timer := c.offline[key]; timer != nil {
		timer.Stop()
	}
	c.offline[key] = time.AfterFunc(wait, func() {
		c.mu.Lock()
		defer c.mu.Unlock()
		delete(c.offline, key)
		if duel := c.duelOf(roomID, memberID); duel != nil && !c.Hub.Online(roomID, memberID) {
			c.end(duel, fmt.Sprintf("%s saiu da sala e o X1 foi cancelado.", duel.name(memberID)))
		}
	})
}

func flipCoin() (string, error) {
	n, err := cryptorand.Int(cryptorand.Reader, big.NewInt(2))
	if err != nil {
		return "", err
	}
	if n.Int64() == 0 {
		return sideHeads, nil
	}
	return sideTails, nil
}
