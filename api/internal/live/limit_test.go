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
