// Package minigames holds room games that exist only while people are connected.
package minigames

import (
	"context"
	"encoding/json"
	"slices"
	"time"

	"mtg4fun/internal/live"
)

// EmojiCooldown is enforced per member, whatever the number of open tabs.
const EmojiCooldown = 2 * time.Second

var emojiOptions = []string{"👍", "❤️", "😂", "😮", "🎉", "😢", "🔥", "💀"}

// Publisher is the part of the hub that the games use to reach a room.
type Publisher interface {
	Publish(roomID int64, game, kind string, data any)
	Online(roomID, memberID int64) bool
}

// Participant returns the display name of someone who can play in the room right
// now, or a live.UserError saying why not.
type Participant func(ctx context.Context, roomID, userID int64) (string, error)

// Emoji makes a reaction fall down the screen of everyone in the room.
type Emoji struct {
	Hub         Publisher
	Participant Participant
}

func (*Emoji) Name() string { return "emoji" }

func (*Emoji) Limit() live.Limit { return live.Limit{Every: EmojiCooldown, Burst: 1} }

func (*Emoji) Snapshot(context.Context, int64, live.Member) (any, error) { return nil, nil }

func (e *Emoji) Handle(ctx context.Context, request live.Request) error {
	var input struct {
		Emoji string `json:"emoji"`
	}
	if request.Type != "send" || json.Unmarshal(request.Data, &input) != nil || !slices.Contains(emojiOptions, input.Emoji) {
		return live.UserError{Message: "Emoji inválido."}
	}
	if _, err := e.Participant(ctx, request.RoomID, request.From.ID); err != nil {
		return err
	}
	e.Hub.Publish(request.RoomID, e.Name(), "fall", map[string]any{"emoji": input.Emoji, "fromId": request.From.ID, "fromName": request.From.Name})
	return nil
}
