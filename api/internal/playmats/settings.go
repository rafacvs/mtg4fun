// Package playmats owns personal backgrounds and the configuration frozen into a match.
package playmats

import (
	"context"
	"crypto/rand"
	"database/sql"
	"encoding/json"
	"errors"
	"math/big"
	"slices"
)

type Settings struct {
	Random  bool   `json:"random"`
	Preset  string `json:"preset"`
	ImageID int64  `json:"imageId"`
	Fit     string `json:"fit"`
	Zoom    int    `json:"zoom"`
	Dim     int    `json:"dim"`
}

func Default() Settings {
	return Settings{Random: true, Preset: "forest", Fit: "cover", Zoom: 100, Dim: 25}
}
func (s Settings) valid() bool {
	return slices.Contains([]string{"forest", "swamp", "mountain", "sea"}, s.Preset) && slices.Contains([]string{"cover", "contain", "stretch", "repeat"}, s.Fit) && s.ImageID >= 0 && s.Zoom >= 100 && s.Zoom <= 200 && s.Dim >= 0 && s.Dim <= 100
}

type reader interface {
	QueryRowContext(context.Context, string, ...any) *sql.Row
}

func Load(ctx context.Context, db reader, userID int64) (Settings, error) {
	settings := Default()
	var raw []byte
	err := db.QueryRowContext(ctx, "SELECT settings FROM playmat_preferences WHERE user_id=?", userID).Scan(&raw)
	if errors.Is(err, sql.ErrNoRows) {
		return settings, nil
	}
	if err != nil {
		return settings, err
	}
	err = json.Unmarshal(raw, &settings)
	return settings, err
}

// ForMatch resolves random once; the caller saves the result in the durable snapshot.
func ForMatch(ctx context.Context, tx *sql.Tx, userID int64) (Settings, error) {
	settings, err := Load(ctx, tx, userID)
	if err != nil {
		return settings, err
	}
	if settings.Random {
		n, err := rand.Int(rand.Reader, big.NewInt(4))
		if err != nil {
			return settings, err
		}
		settings.Preset = []string{"forest", "swamp", "mountain", "sea"}[n.Int64()]
		settings.ImageID = 0
	}
	settings.Random = false
	return settings, nil
}
