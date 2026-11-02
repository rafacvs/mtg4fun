package minigames

import (
	"math"
	"math/rand/v2"
	"time"

	"mtg4fun/internal/live"
)

// All scores, zones and input times are controlled by the server.
type ArmPlayer struct {
	Stopped   int64   `json:"stopped"`
	Points    int     `json:"points"`
	Hits      []int   `json:"hits"`
	Zone      float64 `json:"zone"`
	Since     int64   `json:"since"`
	LockUntil int64   `json:"lockUntil"`
}
type ArmState struct {
	Mode    string               `json:"mode"`
	Started int64                `json:"started"`
	Ready   map[int64]bool       `json:"ready"`
	Players map[int64]*ArmPlayer `json:"players"`
}

func newArm() *ArmState {
	return &ArmState{Mode: "normal", Ready: map[int64]bool{}, Players: map[int64]*ArmPlayer{}}
}
func cloneArm(a *ArmState) *ArmState {
	if a == nil {
		return nil
	}
	b := newArm()
	b.Mode = a.Mode
	b.Started = a.Started
	for id, v := range a.Ready {
		b.Ready[id] = v
	}
	for id, p := range a.Players {
		q := *p
		q.Hits = append([]int{}, p.Hits...)
		b.Players[id] = &q
	}
	return b
}
func armDistance(t float64) float64 {
	t = math.Max(0, t)
	if t <= 215.0/3 {
		return 125*t + 1.5*t*t
	}
	capTime := 215.0 / 3
	return 125*capTime + 1.5*capTime*capTime + 340*(t-capTime)
}
func armAngle(a *ArmState, p *ArmPlayer, now int64) float64 {
	if p.Stopped > 0 {
		now = p.Stopped
	}
	elapsed := float64(now-a.Started) / 1000
	since := float64(p.Since-a.Started) / 1000
	factor := 1.0
	if a.Mode == "crazy" {
		factor = 1.15
	}
	return math.Mod((armDistance(elapsed)-armDistance(since))*factor, 360)
}
func armWidths(a *ArmState, now int64) []float64 {
	shrink := math.Max(.72, 1-float64(now-a.Started)/210000)
	if a.Mode == "crazy" {
		return []float64{math.Max(5, 7*shrink)}
	}
	return []float64{5 * shrink, 15 * shrink, 13 * shrink, 11 * shrink}
}
func (c *CoinDuels) armAction(request live.Request) error {
	c.mu.Lock()
	defer c.mu.Unlock()
	d, err := c.playing(request)
	if err != nil {
		return err
	}
	if d.Game != "arm-wrestling" || d.Arm == nil {
		return live.UserError{Message: "Não há queda de braço em andamento."}
	}
	a := d.Arm
	now := time.Now().UnixMilli()
	if request.Type == "arm-start" {
		if a.Started != 0 {
			return live.UserError{Message: "O jogo já começou."}
		}
		a.Ready[request.From.ID] = true
		if a.Ready[d.ChallengerID] && a.Ready[d.OpponentID] {
			a.Started = now + 1000
			c.scheduleArm(d)
			for _, id := range []int64{d.ChallengerID, d.OpponentID} {
				a.Players[id] = &ArmPlayer{Hits: []int{}, Zone: 35 + rand.Float64()*260, Since: a.Started}
			}
		}
	} else {
		goal := 5
		if a.Mode == "crazy" {
			goal = 3
		}
		p := a.Players[request.From.ID]
		if a.Started == 0 || now < a.Started || p == nil || len(p.Hits) >= goal || now < p.LockUntil {
			return live.UserError{Message: "Aguarde para acertar novamente."}
		}
		delta := math.Mod(armAngle(a, p, now)-p.Zone+360, 360)
		zone := -1
		for i, w := range armWidths(a, now) {
			if delta < w {
				zone = i
				break
			}
			delta -= w
		}
		p.LockUntil = now + 250
		if a.Mode == "normal" || zone >= 0 {
			p.Hits = append(p.Hits, zone)
		}
		if zone >= 0 {
			if a.Mode == "normal" {
				p.Points += []int{12, 2, 3, 6}[zone]
			}
			p.LockUntil = now + 180
		}
		if a.Mode == "normal" || zone >= 0 {
			if c.armAttempt(d, request.From.ID, now) {
				return nil
			}
		}

	}
	c.restartTimer(d)
	c.publishState(request.RoomID)
	return nil
}

// armAttempt advances one consumed attempt and returns whether the duel ended.
// A -1 hit records an entire revolution missed, with no score.
func (c *CoinDuels) armAttempt(d *Duel, member, now int64) bool {
	a := d.Arm
	p := a.Players[member]
	goal := 5
	if a.Mode == "crazy" {
		goal = 3
	}
	if len(p.Hits) >= goal {
		p.Stopped = now
		otherID, _ := d.other(member)
		other := a.Players[otherID]
		if a.Mode == "crazy" || len(other.Hits) >= goal {
			if a.Mode == "normal" && p.Points == other.Points {
				a.Mode = "crazy"
				a.Started = now + 1000
				for _, player := range a.Players {
					player.Hits = []int{}
					player.Stopped = 0
					player.Since = a.Started
					player.Zone = 35 + rand.Float64()*260
					player.LockUntil = 0
				}
			} else {
				winner := member
				if a.Mode == "normal" && p.Points < other.Points {
					winner = otherID
				}
				loser, name := d.other(winner)
				c.finish(d, Outcome{Kind: "arm", WinnerID: winner, WinnerName: d.name(winner), LoserID: loser, LoserName: name}, markLost)
				return true
			}
		}
	} else {
		p.Since = now
		p.Zone = 35 + rand.Float64()*260
	}
	return false
}

func (c *CoinDuels) scheduleArm(d *Duel) {
	d.armTimer = time.AfterFunc(25*time.Millisecond, func() {
		c.mu.Lock()
		defer c.mu.Unlock()
		if c.duels[d.ID] != d {
			return
		}
		a := d.Arm
		now := time.Now().UnixMilli()
		changed := false
		for _, id := range []int64{d.ChallengerID, d.OpponentID} {
			p := a.Players[id]
			if p == nil || p.Stopped > 0 || now < a.Started {
				continue
			}
			factor := 1.0
			if a.Mode == "crazy" {
				factor = 1.15
			}
			rotation := (armDistance(float64(now-a.Started)/1000) - armDistance(float64(p.Since-a.Started)/1000)) * factor
			if rotation < 360 {
				continue
			}
			if a.Mode == "normal" {
				p.Hits = append(p.Hits, -1)
			}
			if c.armAttempt(d, id, now) {
				return
			}
			changed = true
		}
		if changed {
			c.publishState(d.room)
		}
		c.scheduleArm(d)
	})
}
