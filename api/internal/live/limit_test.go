package live

import (
	"testing"
	"time"
)

func TestBucketCooldownWaitsAndRefills(t *testing.T) {
	start := time.Unix(1000, 0)
	b := newBucket(Limit{Every: 2 * time.Second, Burst: 1}, start)
	if ok, _ := b.take(start); !ok {
		t.Fatal("a primeira mensagem deveria passar")
	}
	ok, wait := b.take(start.Add(500 * time.Millisecond))
	if ok || wait != 1500*time.Millisecond {
		t.Fatalf("durante a espera: ok=%v, faltam %v", ok, wait)
	}
	if ok, _ := b.take(start.Add(2500 * time.Millisecond)); !ok {
		t.Fatal("depois da espera deveria passar")
	}
}

func TestBucketDoesNotAccumulateBeyondBurst(t *testing.T) {
	start := time.Unix(1000, 0)
	b := newBucket(Limit{Every: time.Second, Burst: 2}, start)
	later := start.Add(time.Hour)
	for i := range 2 {
		if ok, _ := b.take(later); !ok {
			t.Fatalf("mensagem %d deveria passar", i)
		}
	}
	if ok, _ := b.take(later); ok {
		t.Fatal("a rajada não pode passar do limite")
	}
}

func TestGrowingLimitSlowsAStreakAndForgetsItAfterRest(t *testing.T) {
	limit := Limit{Every: 200 * time.Millisecond, Grow: 2, Max: time.Second, Rest: 5 * time.Second}
	now := time.Unix(1000, 0)
	b := newBucket(limit, now)
	for _, wait := range []time.Duration{200, 400, 800, 1000, 1000} {
		if ok, _ := b.take(now); !ok {
			t.Fatalf("deveria passar antes da espera de %d ms", wait)
		}
		ok, left := b.take(now.Add(time.Millisecond))
		if ok || left != wait*time.Millisecond-time.Millisecond {
			t.Fatalf("espera de %d ms: ok=%v, faltam %v", wait, ok, left)
		}
		now = now.Add(wait * time.Millisecond)
	}
	if ok, _ := b.take(now.Add(5 * time.Second)); !ok {
		t.Fatal("depois da pausa deveria passar")
	}
	if ok, left := b.take(now.Add(5*time.Second + time.Millisecond)); ok || left != 199*time.Millisecond {
		t.Fatalf("a pausa deveria zerar a sequência: ok=%v, faltam %v", ok, left)
	}
}
