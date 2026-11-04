package leaderboards

import (
	"context"
	"database/sql"
	"encoding/json"
	"fmt"
	"sort"
	"strings"
	"time"
)

type Player struct {
	ID          int64   `json:"id"`
	Name        string  `json:"name"`
	Played      int     `json:"played"`
	Decided     int     `json:"decided"`
	Wins        int     `json:"wins"`
	Damage      int64   `json:"damage"`
	Healing     int64   `json:"healing"`
	TurnSeconds float64 `json:"turnSeconds"`
	Turns       int     `json:"turns"`
	Draws       int     `json:"draws"`
	Mulligans   int     `json:"mulligans"`
	Tokens      int     `json:"tokens"`
	Rolls       int     `json:"rolls"`
	Streak      int     `json:"streak"`
	WinLife     float64 `json:"winLife"`
}

type win struct {
	PlayerID int64     `json:"playerId"`
	Name     string    `json:"name"`
	Life     int64     `json:"life"`
	At       time.Time `json:"at"`
}

type board struct {
	Period     string    `json:"period"`
	Players    []*Player `json:"players"`
	RecentWins []win     `json:"recentWins"`
	Matches    int       `json:"matches"`
	outcomes   []outcome
}

type outcome struct {
	at           time.Time
	winner       int64
	participants []participant
}

// Only these public fields are decoded. Cards, deck identities and credentials
// never enter the response model.
type participant struct {
	UserID int64 `json:"userId"`
	Life   int64 `json:"life"`
}
type snapshot struct {
	InitialLife int64         `json:"initialLife"`
	Finished    bool          `json:"finished"`
	Players     []participant `json:"players"`
}
type preparation struct {
	DrawOpeningHand *bool `json:"drawOpeningHand"`
}
type event struct {
	Kind      string        `json:"kind"`
	Result    string        `json:"result"`
	Count     int           `json:"count"`
	DrawCount *int          `json:"drawCount"`
	TurnOrder []participant `json:"turnOrder"`
}

func periodStart(period string, now time.Time) time.Time {
	zone, err := time.LoadLocation("America/Sao_Paulo")
	if err != nil {
		zone = time.FixedZone("BRT", -3*60*60)
	}
	local := now.In(zone)
	day := time.Date(local.Year(), local.Month(), local.Day(), 0, 0, 0, 0, zone)
	switch period {
	case "month":
		return time.Date(local.Year(), local.Month(), 1, 0, 0, 0, 0, zone)
	case "week":
		return day.AddDate(0, 0, -(int(day.Weekday())+6)%7)
	default:
		return time.Date(1000, 1, 1, 0, 0, 0, 0, time.UTC)
	}
}

func read(ctx context.Context, db *sql.DB, period string) (board, error) {
	result := board{Period: period, Players: []*Player{}, RecentWins: []win{}}
	tx, err := db.BeginTx(ctx, &sql.TxOptions{ReadOnly: true, Isolation: sql.LevelRepeatableRead})
	if err != nil {
		return result, err
	}
	defer tx.Rollback()
	players := map[int64]*Player{}
	rows, err := tx.QueryContext(ctx, "SELECT id,name FROM users ORDER BY id")
	if err != nil {
		return result, err
	}
	for rows.Next() {
		p := &Player{}
		if err = rows.Scan(&p.ID, &p.Name); err != nil {
			rows.Close()
			return result, err
		}
		players[p.ID] = p
		result.Players = append(result.Players, p)
	}
	err = rows.Err()
	rows.Close()
	if err != nil {
		return result, err
	}
	// Select entire matches by their start date so a long game is never split
	// between periods and win-rate denominators describe the same cohort.
	rows, err = tx.QueryContext(ctx, `SELECT m.room_id,m.snapshot,r.snapshot FROM matches m
		JOIN rooms r ON r.id=m.room_id
		JOIN match_events e ON e.room_id=m.room_id AND e.action='started'
		WHERE e.created_at>=? ORDER BY e.created_at,e.id`, periodStart(period, time.Now()))
	if err != nil {
		return result, err
	}
	type game struct {
		id        int64
		state     snapshot
		preparing bool
	}
	games := []game{}
	for rows.Next() {
		var g game
		var raw, roomRaw []byte
		var room preparation
		if err = rows.Scan(&g.id, &raw, &roomRaw); err == nil {
			err = json.Unmarshal(raw, &g.state)
		}
		if err == nil {
			err = json.Unmarshal(roomRaw, &room)
		}
		g.preparing = room.DrawOpeningHand == nil || *room.DrawOpeningHand
		if err != nil {
			rows.Close()
			return result, err
		}
		games = append(games, g)
	}
	err = rows.Err()
	rows.Close()
	if err != nil {
		return result, err
	}
	for _, g := range games {
		if err = collect(ctx, tx, g.id, g.state, g.preparing, players, &result); err != nil {
			return result, err
		}
	}
	result.Matches = len(games)
	sort.SliceStable(result.outcomes, func(i, j int) bool { return result.outcomes[i].at.Before(result.outcomes[j].at) })
	for _, game := range result.outcomes {
		for _, member := range game.participants {
			p := players[member.UserID]
			if p == nil {
				continue
			}
			if member.UserID == game.winner {
				if p.Streak < 0 {
					p.Streak = 0
				}
				p.Streak++
			} else {
				if p.Streak > 0 {
					p.Streak = 0
				}
				p.Streak--
			}
		}
	}
	for _, p := range result.Players {
		if p.Wins > 0 {
			p.WinLife /= float64(p.Wins)
		}
	}
	sort.SliceStable(result.Players, func(i, j int) bool {
		a, b := result.Players[i], result.Players[j]
		if a.Wins != b.Wins {
			return a.Wins > b.Wins
		}
		if a.Played != b.Played {
			return a.Played > b.Played
		}
		return a.ID < b.ID
	})
	sort.SliceStable(result.RecentWins, func(i, j int) bool { return result.RecentWins[i].At.After(result.RecentWins[j].At) })
	if len(result.RecentWins) > 5 {
		result.RecentWins = result.RecentWins[:5]
	}
	return result, tx.Commit()
}

func collect(ctx context.Context, tx *sql.Tx, roomID int64, state snapshot, preparing bool, players map[int64]*Player, result *board) error {
	life := map[int64]int64{}
	for _, p := range state.Players {
		life[p.UserID] = state.InitialLife
		if players[p.UserID] != nil {
			players[p.UserID].Played++
		}
	}
	rows, err := tx.QueryContext(ctx, "SELECT actor_id,action,payload,created_at FROM match_events WHERE room_id=? ORDER BY id", roomID)
	if err != nil {
		return err
	}
	defer rows.Close()
	var order []participant
	index := 0
	var turnStart, finishedAt time.Time
	firstTurn := true
	kept := map[int64]bool{}
	for rows.Next() {
		var actor int64
		var action string
		var raw []byte
		var at time.Time
		var e event
		if err = rows.Scan(&actor, &action, &raw, &at); err != nil {
			return err
		}
		if err = json.Unmarshal(raw, &e); err != nil {
			return err
		}
		if e.Kind == "" {
			e.Kind = action
		}
		p := players[actor]
		switch e.Kind {
		case "started":
			order = e.TurnOrder
			turnStart = at
		case "keep_hand":
			kept[actor] = true
			if len(kept) == len(state.Players) {
				preparing = false
			}
			if firstTurn {
				turnStart = at
			}
		case "unkeep_hand":
			delete(kept, actor)
		case "counter":
			var value int64
			if p != nil && strings.HasPrefix(e.Result, "vida = ") {
				if _, err := fmt.Sscanf(e.Result, "vida = %d", &value); err != nil {
					return err
				}
				delta := value - life[actor]
				if delta < 0 {
					p.Damage -= delta
				} else {
					p.Healing += delta
				}
				life[actor] = value
			}
		case "turn":
			if len(order) == 0 {
				continue
			}
			owner := players[order[index].UserID]
			if owner != nil && !turnStart.IsZero() && !at.Before(turnStart) {
				owner.TurnSeconds += at.Sub(turnStart).Seconds()
				owner.Turns++
			}
			step := 1
			if strings.HasPrefix(e.Result, "corrigiu") {
				step = len(order) - 1
			}
			next := (index + step) % len(order)
			for distance := 1; distance <= len(order); distance++ {
				candidate := (index + step*distance) % len(order)
				if life[order[candidate].UserID] > 0 {
					next = candidate
					break
				}
			}
			index = next
			turnStart = at
			firstTurn = false
		case "draw":
			if p != nil {
				if e.DrawCount != nil {
					p.Draws += *e.DrawCount
				} else if !preparing {
					p.Draws += e.Count
				}
			}
		case "mulligan":
			if p != nil {
				p.Mulligans++
			}
		case "create-token":
			if p != nil {
				p.Tokens += e.Count
			}
		case "roll":
			if p != nil {
				p.Rolls++
			}
		case "finished":
			finishedAt = at
		}
	}
	if err = rows.Err(); err != nil {
		return err
	}
	if !state.Finished || finishedAt.IsZero() {
		return nil
	}
	var survivor *participant
	for i := range state.Players {
		if state.Players[i].Life > 0 {
			if survivor != nil {
				return nil
			}
			survivor = &state.Players[i]
		}
	}
	if survivor == nil {
		return nil
	}
	result.outcomes = append(result.outcomes, outcome{finishedAt, survivor.UserID, state.Players})
	for _, member := range state.Players {
		p := players[member.UserID]
		if p == nil {
			continue
		}
		p.Decided++
		if member.UserID == survivor.UserID {
			p.Wins++
			p.WinLife += float64(member.Life)
			result.RecentWins = append(result.RecentWins, win{p.ID, p.Name, member.Life, finishedAt})
		}
	}
	return nil
}
