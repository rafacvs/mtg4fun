package live

import (
	"math"
	"time"
)

// Limit allows Burst messages at once and gains one more each Every. A zero
// Every means no limit. With Grow, each message instead waits Every multiplied
// by Grow per message in the streak, up to Max; idling for Rest ends the streak.
type Limit struct {
	Every time.Duration
	Burst int
	Grow  float64
	Max   time.Duration
	Rest  time.Duration
}

type bucket struct {
	limit  Limit
	tokens float64
	last   time.Time
	streak int
	free   time.Time
}

func newBucket(limit Limit, now time.Time) *bucket {
	return &bucket{limit: limit, tokens: float64(limit.Burst), last: now}
}

// take spends one token or reports how long until the next one.
func (b *bucket) take(now time.Time) (bool, time.Duration) {
	if b.limit.Grow > 0 {
		return b.takeGrowing(now)
	}
	b.tokens = min(float64(b.limit.Burst), b.tokens+float64(now.Sub(b.last))/float64(b.limit.Every))
	b.last = now
	if b.tokens >= 1 {
		b.tokens--
		return true, 0
	}
	return false, time.Duration((1 - b.tokens) * float64(b.limit.Every))
}

func (b *bucket) takeGrowing(now time.Time) (bool, time.Duration) {
	if now.Before(b.free) {
		return false, b.free.Sub(now)
	}
	if now.Sub(b.free) >= b.limit.Rest {
		b.streak = 0
	}
	wait := time.Duration(float64(b.limit.Every) * math.Pow(b.limit.Grow, float64(b.streak)))
	b.free = now.Add(min(wait, b.limit.Max))
	b.streak++
	return true, 0
}
