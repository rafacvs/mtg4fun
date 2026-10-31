package minigames

import (
	"context"
	cryptorand "crypto/rand"
	"encoding/json"
	"fmt"
	"maps"
	"math/big"
	"slices"
	"sync"
	"time"

	"mtg4fun/internal/live"
)

const (
	sideHeads = "Cara"
	sideTails = "Coroa"

	duelInvited = "invited"
	duelPlaying = "playing"

	markLost    = "lost"
	markRefused = "refused"

	outcomeFlip    = "flip"
	outcomeForfeit = "forfeit"
	outcomeRefused = "refused"

	maxDuelHistory = 50

	duelTimeout     = 60 * time.Second
	duelOfflineWait = 15 * time.Second
)

// Duel is the state of a coin duel. Both players see each other's side as it is
// chosen, so two people can only agree to flip with different sides.
type Duel struct {
	ID             int64            `json:"id"`
	Status         string           `json:"status"`
	ChallengerID   int64            `json:"challengerId"`
	ChallengerName string           `json:"challengerName"`
	OpponentID     int64            `json:"opponentId"`
	OpponentName   string           `json:"opponentName"`
	Picks          map[int64]string `json:"picks"`
	Confirmed      map[int64]bool   `json:"confirmed"`
	// Conflict means both chose the same side: nobody can confirm until one changes.
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

// Outcome is how a duel ended, shown to the whole room and kept in its history.
type Outcome struct {
	DuelID     int64  `json:"duelId"`
	Kind       string `json:"kind"`
	Side       string `json:"side,omitempty"`
	LoserID    int64  `json:"loserId"`
	LoserName  string `json:"loserName"`
	LoserSide  string `json:"loserSide,omitempty"`
	WinnerID   int64  `json:"winnerId"`
	WinnerName string `json:"winnerName"`
	WinnerSide string `json:"winnerSide,omitempty"`
	At         int64  `json:"at"`
}

// duelRecord is what a room remembers until the match starts.
type duelRecord struct {
	marks   map[int64]string
	history []Outcome
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
	records map[int64]*duelRecord
	offline map[presence]*time.Timer
}

func (*CoinDuels) Name() string { return "coin-duel" }

func (*CoinDuels) Limit() live.Limit { return live.Limit{Every: 100 * time.Millisecond, Burst: 10} }

func (c *CoinDuels) Snapshot(_ context.Context, roomID int64, _ live.Member) (any, error) {
	c.mu.Lock()
	defer c.mu.Unlock()
	return c.view(roomID), nil
}

// view copies the state: a snapshot is encoded after the lock is released.
func (c *CoinDuels) view(roomID int64) map[string]any {
	duels := []Duel{}
	for _, duel := range c.duels {
		if duel.room == roomID {
			duels = append(duels, Duel{ID: duel.ID, Status: duel.Status, ChallengerID: duel.ChallengerID, ChallengerName: duel.ChallengerName, OpponentID: duel.OpponentID, OpponentName: duel.OpponentName, Picks: maps.Clone(duel.Picks), Confirmed: maps.Clone(duel.Confirmed), Conflict: duel.Conflict})
		}
	}
	marks := map[int64]string{}
	history := []Outcome{}
	if record := c.records[roomID]; record != nil {
		marks = maps.Clone(record.marks)
		history = slices.Clone(record.history)
	}
	return map[string]any{"duels": duels, "marks": marks, "history": history}
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
	case "pick":
		var input struct {
			Side string `json:"side"`
		}
		if json.Unmarshal(request.Data, &input) != nil || (input.Side != sideHeads && input.Side != sideTails) {
			return live.UserError{Message: "Escolha cara ou coroa."}
		}
		return c.pick(request, input.Side)
	case "accept":
		return c.accept(request)
	case "refuse":
		return c.refuse(request)
	case "confirm":
		return c.confirm(request)
	case "unconfirm":
		return c.unconfirm(request)
	case "forfeit":
		return c.forfeit(request)
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
	duel := &Duel{ID: c.nextID, Status: duelInvited, ChallengerID: request.From.ID, ChallengerName: request.From.Name, OpponentID: opponentID, OpponentName: opponentName, Picks: map[int64]string{}, Confirmed: map[int64]bool{}, room: request.RoomID}
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

// playing returns the sender's duel once it was accepted.
func (c *CoinDuels) playing(request live.Request) (*Duel, error) {
	duel := c.duelOf(request.RoomID, request.From.ID)
	if duel == nil || duel.Status != duelPlaying {
		return nil, live.UserError{Message: "Este X1 já terminou."}
	}
	return duel, nil
}

// invitation returns the duel the sender was invited to and has not answered.
func (c *CoinDuels) invitation(request live.Request) (*Duel, error) {
	duel := c.duelOf(request.RoomID, request.From.ID)
	if duel == nil || duel.Status != duelInvited || duel.OpponentID != request.From.ID {
		return nil, live.UserError{Message: "Este convite já não vale."}
	}
	return duel, nil
}

func (c *CoinDuels) accept(request live.Request) error {
	c.mu.Lock()
	defer c.mu.Unlock()
	duel, err := c.invitation(request)
	if err != nil {
		return err
	}
	duel.Status = duelPlaying
	c.restartTimer(duel)
	c.publishState(request.RoomID)
	return nil
}

func (c *CoinDuels) refuse(request live.Request) error {
	c.mu.Lock()
	defer c.mu.Unlock()
	duel, err := c.invitation(request)
	if err != nil {
		return err
	}
	c.finish(duel, Outcome{Kind: outcomeRefused, LoserID: duel.OpponentID, LoserName: duel.OpponentName, WinnerID: duel.ChallengerID, WinnerName: duel.ChallengerName}, markRefused)
	return nil
}

func (c *CoinDuels) pick(request live.Request, side string) error {
	c.mu.Lock()
	defer c.mu.Unlock()
	duel, err := c.playing(request)
	if err != nil {
		return err
	}
	if duel.Confirmed[request.From.ID] {
		return live.UserError{Message: "Desconfirme para trocar de lado."}
	}
	other, otherName := duel.other(request.From.ID)
	if duel.Confirmed[other] && duel.Picks[other] == side {
		return live.UserError{Message: fmt.Sprintf("%s já confirmou %s.", otherName, side)}
	}
	duel.Picks[request.From.ID] = side
	duel.Conflict = duel.Picks[other] == side
	c.restartTimer(duel)
	c.publishState(request.RoomID)
	return nil
}

func (c *CoinDuels) confirm(request live.Request) error {
	c.mu.Lock()
	defer c.mu.Unlock()
	duel, err := c.playing(request)
	if err != nil {
		return err
	}
	side := duel.Picks[request.From.ID]
	if side == "" {
		return live.UserError{Message: "Escolha um lado primeiro."}
	}
	// The picks arrive in order, so two confirmations can never end on the same side.
	if duel.Conflict {
		return live.UserError{Message: "Escolham lados diferentes."}
	}
	duel.Confirmed[request.From.ID] = true
	c.restartTimer(duel)
	other, _ := duel.other(request.From.ID)
	if !duel.Confirmed[other] {
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
	c.finish(duel, Outcome{Kind: outcomeFlip, Side: result, LoserID: loser, LoserName: loserName, LoserSide: duel.Picks[loser], WinnerID: winner, WinnerName: duel.name(winner), WinnerSide: duel.Picks[winner]}, markLost)
	return nil
}

func (c *CoinDuels) unconfirm(request live.Request) error {
	c.mu.Lock()
	defer c.mu.Unlock()
	duel, err := c.playing(request)
	if err != nil {
		return err
	}
	delete(duel.Confirmed, request.From.ID)
	c.restartTimer(duel)
	c.publishState(request.RoomID)
	return nil
}

func (c *CoinDuels) forfeit(request live.Request) error {
	c.mu.Lock()
	defer c.mu.Unlock()
	duel, err := c.playing(request)
	if err != nil {
		return err
	}
	winner, winnerName := duel.other(request.From.ID)
	c.finish(duel, Outcome{Kind: outcomeForfeit, LoserID: request.From.ID, LoserName: request.From.Name, WinnerID: winner, WinnerName: winnerName}, markLost)
	return nil
}

// cancel lets who challenged take it back before an answer, without any mark.
func (c *CoinDuels) cancel(request live.Request) error {
	c.mu.Lock()
	defer c.mu.Unlock()
	duel := c.duelOf(request.RoomID, request.From.ID)
	if duel == nil {
		return nil
	}
	if duel.Status != duelInvited || duel.ChallengerID != request.From.ID {
		return live.UserError{Message: "Este X1 já não pode ser cancelado."}
	}
	c.end(duel, fmt.Sprintf("%s cancelou o X1.", request.From.Name))
	return nil
}

// CancelRoom ends the room's duels and forgets its marks: the match is about to start.
func (c *CoinDuels) CancelRoom(roomID int64) {
	c.mu.Lock()
	defer c.mu.Unlock()
	for _, duel := range c.duels {
		if duel.room == roomID {
			c.end(duel, "O X1 foi cancelado: a partida vai começar.")
		}
	}
	delete(c.records, roomID)
	c.publishState(roomID)
}

// finish records who lost, which stays visible on the table until the match starts.
func (c *CoinDuels) finish(duel *Duel, outcome Outcome, mark string) {
	outcome.DuelID = duel.ID
	outcome.At = time.Now().UnixMilli()
	if c.records == nil {
		c.records = map[int64]*duelRecord{}
	}
	record := c.records[duel.room]
	if record == nil {
		record = &duelRecord{marks: map[int64]string{}}
		c.records[duel.room] = record
	}
	record.marks[outcome.LoserID] = mark
	record.history = append(record.history, outcome)
	if len(record.history) > maxDuelHistory {
		record.history = record.history[len(record.history)-maxDuelHistory:]
	}
	c.remove(duel)
	c.publishState(duel.room)
	c.Hub.Publish(duel.room, c.Name(), "result", outcome)
}

// end drops a duel without a loser.
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
