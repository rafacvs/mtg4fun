package minigames

import (
	"math"
	"testing"
	"time"
)

func TestArmClockAndScoringBoundaries(t *testing.T) {
	a := newArm()
	a.Started = 1000
	p := &ArmPlayer{Since: 1000}
	if got := armAngle(a, p, 2000); math.Abs(got-126.5) > 0.001 {
		t.Fatalf("angle %v", got)
	}
	a.Mode = "crazy"
	if got := armAngle(a, p, 2000); math.Abs(got-145.475) > .001 {
		t.Fatalf("crazy angle %v", got)
	}
	if got := armWidths(a, 211000); got[0] != 5.04 {
		t.Fatalf("width %v", got)
	}
}

func TestArmRejectsCoinActionsAndRequiresBothReady(t *testing.T) {
	room := &recordingRoom{online: map[int64]bool{1: true, 2: true}}
	duels := newDuels(room)
	steps(t, duels, step{1, "challenge", `{"opponentId":2,"game":"arm-wrestling"}`}, step{2, "accept", `{}`})
	for _, kind := range []string{"pick", "confirm", "unconfirm", "arm-press"} {
		if err := act(t, duels, 1, kind, `{"side":"Cara"}`); err == nil {
			t.Fatalf("accepted %s", kind)
		}
	}
	steps(t, duels, step{1, "arm-start", `{}`})
	if duels.duelOf(7, 1).Arm.Started != 0 {
		t.Fatal("started before both ready")
	}
	steps(t, duels, step{2, "arm-start", `{}`})
	if duels.duelOf(7, 1).Arm.Started <= time.Now().UnixMilli() {
		t.Fatal("no countdown")
	}
	steps(t, duels, step{1, "forfeit", `{}`})
	if got := lastResult(t, room); got.Game != "arm-wrestling" || got.WinnerID != 2 {
		t.Fatalf("wrong result %+v", got)
	}
}

func TestArmFiveAttemptsStopAndTieStartsCrazy(t *testing.T) {
	room := &recordingRoom{online: map[int64]bool{1: true, 2: true}}
	duels := newDuels(room)
	steps(t, duels, step{1, "challenge", `{"opponentId":2,"game":"arm-wrestling"}`}, step{2, "accept", `{}`})
	d := duels.duelOf(7, 1)
	a := d.Arm
	a.Players[1] = &ArmPlayer{Hits: []int{1, -1, -1, -1, -1}, Points: 2}
	a.Players[2] = &ArmPlayer{Hits: []int{1, -1, -1, -1}, Points: 2}
	if duels.armAttempt(d, 1, 2000) || a.Players[1].Stopped != 2000 {
		t.Fatal("five attempts did not stop player")
	}
	frozen := armAngle(a, a.Players[1], 3000)
	if armAngle(a, a.Players[1], 4000) != frozen {
		t.Fatal("stopped needle moved")
	}
	a.Players[2].Hits = append(a.Players[2].Hits, -1)
	if duels.armAttempt(d, 2, 3000) || a.Mode != "crazy" {
		t.Fatal("tie did not enter crazy")
	}
	if a.Players[1].Stopped != 0 || len(a.Players[1].Hits) != 0 {
		t.Fatal("crazy did not reset player")
	}
	a.Players[1].Hits = []int{0, 0, 0}
	if !duels.armAttempt(d, 1, 5000) || lastResult(t, room).WinnerID != 1 {
		t.Fatal("three whites did not win")
	}
}
