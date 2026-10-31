package live

import "time"

// Limit allows Burst messages at once and gains one more each Every. A zero
// Every means no limit.
type Limit struct {
	Every time.Duration
	Burst int
}

type bucket struct {
	limit  Limit
	tokens float64
	last   time.Time
}

func newBucket(limit Limit, now time.Time) *bucket {
	return &bucket{limit: limit, tokens: float64(limit.Burst), last: now}
}

// take spends one token or reports how long until the next one.
func (b *bucket) take(now time.Time) (bool, time.Duration) {
	b.tokens = min(float64(b.limit.Burst), b.tokens+float64(now.Sub(b.last))/float64(b.limit.Every))
	b.last = now
	if b.tokens >= 1 {
		b.tokens--
		return true, 0
	}
	return false, time.Duration((1 - b.tokens) * float64(b.limit.Every))
}
