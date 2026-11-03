package leaderboards

import (
	"testing"
	"time"
)

func TestPeriodStartUsesBrazilianCalendar(t *testing.T) {
	// Sunday in Brasília, already Monday in UTC, across a month boundary.
	now := time.Date(2026, 6, 1, 1, 30, 0, 0, time.UTC)
	for _, tc := range []struct{ period, want string }{
		{"month", "2026-05-01T03:00:00Z"},
		{"week", "2026-05-25T03:00:00Z"},
	} {
		if got := periodStart(tc.period, now).UTC().Format(time.RFC3339); got != tc.want {
			t.Errorf("%s: got %s want %s", tc.period, got, tc.want)
		}
	}
}
