package minigames

import "testing"

func TestValidEmojiAcceptsEverySequenceKindAndRefusesText(t *testing.T) {
	for _, value := range []string{"🍅", "🦖", "👍🏽", "👩‍🚀", "👨‍👩‍👧‍👦", "🇧🇷", "🏴󠁧󠁢󠁳󠁣󠁴󠁿", "1️⃣", "#️⃣", "‼️", "ℹ️", "©️", "↔️", "❤️‍🔥"} {
		if !validEmoji(value) {
			t.Errorf("recusou %q", value)
		}
	}
	for _, value := range []string{"", "a", "oi", "não é emoji", "😂 oi", "1", "<b>", "‍", "️", "🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥"} {
		if validEmoji(value) {
			t.Errorf("aceitou %q", value)
		}
	}
}
