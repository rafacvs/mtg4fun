// Package minigames holds room games that exist only while people are connected.
package minigames

import (
	"context"
	"encoding/json"
	"regexp"
	"strings"
	"time"
	"unicode"
	"unicode/utf8"

	"mtg4fun/internal/live"
)

// emojiLimit lets a member spam, each click waiting a bit longer than the last.
// It counts per member, whatever the number of open tabs; useEmojiReactions mirrors it.
var emojiLimit = live.Limit{Every: 120 * time.Millisecond, Grow: 1.12, Max: 1200 * time.Millisecond, Rest: 3 * time.Second}

// cardIDPattern matches the ids the match gives its cards; the card itself is
// only looked up by whoever sees it on the table.
var cardIDPattern = regexp.MustCompile(`^[A-Za-z0-9-]{1,64}$`)

// Emoji symbols that Unicode does not class as symbols.
var emojiExceptions = map[rune]bool{'‼': true, '⁉': true, 'ℹ': true, '〰': true, '〽': true}

// validEmoji accepts one emoji sequence, including skin tones, flags, keycaps
// and joined sequences, and refuses text.
func validEmoji(value string) bool {
	if value == "" || len(value) > 64 || utf8.RuneCountInString(value) > 16 || !utf8.ValidString(value) {
		return false
	}
	keycap := strings.ContainsRune(value, '⃣')
	symbol := false
	for _, r := range value {
		switch {
		case unicode.IsSymbol(r) && r > unicode.MaxASCII || emojiExceptions[r]:
			symbol = true
		case r == '‍' || r == '️' || r == '︎' || r >= 0xE0020 && r <= 0xE007F:
		case r == '⃣':
			symbol = true
		case keycap && (r == '#' || r == '*' || r >= '0' && r <= '9'):
		default:
			return false
		}
	}
	return symbol
}

// Publisher is the part of the hub that the games use to reach a room.
type Publisher interface {
	Publish(roomID int64, game, kind string, data any)
	Online(roomID, memberID int64) bool
}

// Participant returns the display name of someone who can play in the room right
// now, or a live.UserError saying why not.
type Participant func(ctx context.Context, roomID, userID int64) (string, error)

// Emoji makes a reaction fall down the screen of everyone in the room, or
// splats a tomato on a card of the table.
type Emoji struct {
	Hub         Publisher
	Participant Participant
}

func (*Emoji) Name() string { return "emoji" }

func (*Emoji) Limit() live.Limit { return emojiLimit }

func (*Emoji) Snapshot(context.Context, int64, live.Member) (any, error) { return nil, nil }

func (e *Emoji) Handle(ctx context.Context, request live.Request) error {
	var input struct {
		Emoji  string `json:"emoji"`
		CardID string `json:"cardId"`
	}
	if json.Unmarshal(request.Data, &input) != nil {
		return live.UserError{Message: "Emoji inválido."}
	}
	switch {
	case request.Type == "send" && validEmoji(input.Emoji):
	case request.Type == "throw" && cardIDPattern.MatchString(input.CardID):
	case request.Type == "throw":
		return live.UserError{Message: "Carta inválida."}
	default:
		return live.UserError{Message: "Emoji inválido."}
	}
	if _, err := e.Participant(ctx, request.RoomID, request.From.ID); err != nil {
		return err
	}
	if request.Type == "throw" {
		e.Hub.Publish(request.RoomID, e.Name(), "splat", map[string]any{"cardId": input.CardID, "fromId": request.From.ID, "fromName": request.From.Name})
		return nil
	}
	e.Hub.Publish(request.RoomID, e.Name(), "fall", map[string]any{"emoji": input.Emoji, "fromId": request.From.ID, "fromName": request.From.Name})
	return nil
}
