// Package live distributes ephemeral room messages over WebSocket. It knows
// nothing about any game: each feature registers itself as a Game.
package live

import (
	"context"
	"encoding/json"
	"errors"
	"log"
	"sync"
	"time"
)

// Member is the authenticated person behind a connection.
type Member struct {
	ID   int64
	Name string
}

// Request is one message sent by a member to a game.
type Request struct {
	RoomID int64
	From   Member
	Type   string
	Data   json.RawMessage
}

// Game is one ephemeral feature of a room. Handle runs on the sender's
// connection, so a slow game only delays that member.
type Game interface {
	Name() string
	Limit() Limit
	// Snapshot is the current state a member receives on connecting. There is no
	// replay: what happened while disconnected only appears through it.
	Snapshot(ctx context.Context, roomID int64, viewer Member) (any, error)
	Handle(ctx context.Context, request Request) error
}

// PresenceWatcher is implemented by games that react to members coming and going.
type PresenceWatcher interface {
	MemberOnline(roomID, memberID int64)
	MemberOffline(roomID, memberID int64)
}

// UserError carries a message that can be shown to the sender as is.
type UserError struct{ Message string }

func (e UserError) Error() string { return e.Message }

type message struct {
	Game string `json:"game"`
	Type string `json:"type"`
	ID   string `json:"id,omitempty"`
	Data any    `json:"data,omitempty"`
}

type room struct {
	connections map[*connection]struct{}
	buckets     map[bucketKey]*bucket
}

type bucketKey struct {
	member int64
	game   string
}

// Hub keeps connections in memory, which assumes one API process.
type Hub struct {
	mu      sync.RWMutex
	games   map[string]Game
	rooms   map[int64]*room
	closing bool
}

func NewHub() *Hub {
	return &Hub{games: map[string]Game{}, rooms: map[int64]*room{}}
}

// Register must happen before the server accepts connections.
func (h *Hub) Register(games ...Game) {
	for _, game := range games {
		h.games[game.Name()] = game
	}
}

// Publish sends a message to every connection of the room.
func (h *Hub) Publish(roomID int64, game, kind string, data any) {
	h.deliver(roomID, message{Game: game, Type: kind, Data: data}, func(*connection) bool { return true })
}

func (h *Hub) deliver(roomID int64, m message, wanted func(*connection) bool) {
	encoded, err := json.Marshal(m)
	if err != nil {
		log.Printf("mensagem %s/%s inválida: %v", m.Game, m.Type, err)
		return
	}
	h.mu.RLock()
	defer h.mu.RUnlock()
	current := h.rooms[roomID]
	if current == nil {
		return
	}
	for c := range current.connections {
		if wanted(c) {
			c.enqueue(encoded)
		}
	}
}

// Online reports whether the member has at least one connection in the room.
func (h *Hub) Online(roomID, memberID int64) bool {
	h.mu.RLock()
	defer h.mu.RUnlock()
	current := h.rooms[roomID]
	if current == nil {
		return false
	}
	for c := range current.connections {
		if c.member.ID == memberID {
			return true
		}
	}
	return false
}

// Close asks every client to come back after a restart.
func (h *Hub) Close() {
	h.mu.Lock()
	defer h.mu.Unlock()
	h.closing = true
	for _, current := range h.rooms {
		for c := range current.connections {
			c.closeWith(closeRestart, "Servidor reiniciando.")
		}
	}
}

var errClosing = errors.New("hub encerrando")

// add reports whether this is the member's first connection in the room.
func (h *Hub) add(c *connection) (bool, error) {
	h.mu.Lock()
	defer h.mu.Unlock()
	if h.closing {
		return false, errClosing
	}
	current := h.rooms[c.roomID]
	if current == nil {
		current = &room{connections: map[*connection]struct{}{}, buckets: map[bucketKey]*bucket{}}
		h.rooms[c.roomID] = current
	}
	first := true
	for other := range current.connections {
		if other.member.ID == c.member.ID {
			first = false
		}
	}
	current.connections[c] = struct{}{}
	return first, nil
}

// remove reports whether the member has no connection left in the room.
func (h *Hub) remove(c *connection) bool {
	h.mu.Lock()
	defer h.mu.Unlock()
	current := h.rooms[c.roomID]
	delete(current.connections, c)
	last := true
	for other := range current.connections {
		if other.member.ID == c.member.ID {
			last = false
		}
	}
	if len(current.connections) == 0 {
		delete(h.rooms, c.roomID)
	}
	return last
}

func (h *Hub) notifyPresence(roomID, memberID int64, online bool) {
	for _, game := range h.games {
		if watcher, ok := game.(PresenceWatcher); ok {
			if online {
				watcher.MemberOnline(roomID, memberID)
			} else {
				watcher.MemberOffline(roomID, memberID)
			}
		}
	}
}

// allow is shared by every connection of the member, so two tabs split one limit.
func (h *Hub) allow(roomID, memberID int64, game Game) (bool, time.Duration) {
	limit := game.Limit()
	if limit.Every <= 0 {
		return true, 0
	}
	h.mu.Lock()
	defer h.mu.Unlock()
	current := h.rooms[roomID]
	if current == nil {
		return false, limit.Every
	}
	key := bucketKey{memberID, game.Name()}
	b := current.buckets[key]
	if b == nil {
		b = newBucket(limit, time.Now())
		current.buckets[key] = b
	}
	return b.take(time.Now())
}

func (h *Hub) dispatch(ctx context.Context, c *connection, incoming message, data json.RawMessage) {
	game := h.games[incoming.Game]
	if game == nil {
		c.reply(incoming, "error", errorData{Message: "Jogo desconhecido."})
		return
	}
	if ok, wait := h.allow(c.roomID, c.member.ID, game); !ok {
		c.reply(incoming, "error", errorData{Message: "Aguarde um instante.", RetryAfterMs: wait.Milliseconds()})
		return
	}
	err := game.Handle(ctx, Request{RoomID: c.roomID, From: c.member, Type: incoming.Type, Data: data})
	var user UserError
	switch {
	case err == nil:
		c.reply(incoming, "ack", nil)
	case errors.As(err, &user):
		c.reply(incoming, "error", errorData{Message: user.Message})
	default:
		log.Printf("jogo %s na sala %d: %v", incoming.Game, c.roomID, err)
		c.reply(incoming, "error", errorData{Message: "Não foi possível concluir. Tente novamente."})
	}
}

type errorData struct {
	Message      string `json:"message"`
	RetryAfterMs int64  `json:"retryAfterMs,omitempty"`
}
