package live

import (
	"context"
	"encoding/json"
	"log"
	"net/http"
	"sync"
	"time"

	"github.com/coder/websocket"
)

const (
	maxMessageBytes = 4096
	sendQueueSize   = 64
	writeTimeout    = 10 * time.Second
	pingEvery       = 25 * time.Second
	pingTimeout     = 10 * time.Second
	sessionEvery    = 10 * time.Second

	closeRestart        = websocket.StatusServiceRestart
	closeTooSlow        = websocket.StatusTryAgainLater
	closeSessionExpired = websocket.StatusCode(4401)
)

type connection struct {
	conn      *websocket.Conn
	roomID    int64
	member    Member
	send      chan []byte
	closeOnce sync.Once
}

// Serve upgrades an authorized request and blocks until the connection ends.
// sessionValid is checked periodically; it reports false only for an ended session.
func (h *Hub) Serve(w http.ResponseWriter, r *http.Request, roomID int64, member Member, sessionValid func() bool) {
	// Accept refuses a foreign Origin: the handshake is a GET carrying the
	// session cookie, so the HTTP origin check for writes does not cover it.
	conn, err := websocket.Accept(w, r, nil)
	if err != nil {
		return
	}
	defer conn.CloseNow()
	conn.SetReadLimit(maxMessageBytes)
	c := &connection{conn: conn, roomID: roomID, member: member, send: make(chan []byte, sendQueueSize)}
	first, err := h.add(c)
	if err != nil {
		conn.Close(closeRestart, "Servidor reiniciando.")
		return
	}
	defer func() {
		if h.remove(c) {
			h.notifyPresence(roomID, member.ID, false)
		}
	}()
	if first {
		h.notifyPresence(roomID, member.ID, true)
	}
	ctx, cancel := context.WithCancel(r.Context())
	defer cancel()
	// Snapshots are read after joining the room and written before anything queued,
	// so a change during this step arrives right after them instead of being lost.
	if err := h.writeSnapshots(ctx, c); err != nil {
		log.Printf("estado inicial da sala %d: %v", roomID, err)
		conn.Close(websocket.StatusInternalError, "Não foi possível carregar a sala.")
		return
	}
	var background sync.WaitGroup
	background.Go(func() { c.writeLoop(ctx) })
	background.Go(func() { c.keepAlive(ctx, sessionValid) })
	c.readLoop(ctx, h)
	cancel()
	background.Wait()
}

func (h *Hub) writeSnapshots(ctx context.Context, c *connection) error {
	for name, game := range h.games {
		snapshot, err := game.Snapshot(ctx, c.roomID, c.member)
		if err != nil {
			return err
		}
		if snapshot == nil {
			continue
		}
		encoded, err := json.Marshal(message{Game: name, Type: "snapshot", Data: snapshot})
		if err != nil {
			return err
		}
		if err := c.write(ctx, encoded); err != nil {
			return err
		}
	}
	return nil
}

func (c *connection) write(ctx context.Context, data []byte) error {
	ctx, cancel := context.WithTimeout(ctx, writeTimeout)
	defer cancel()
	return c.conn.Write(ctx, websocket.MessageText, data)
}

func (c *connection) writeLoop(ctx context.Context) {
	for {
		select {
		case <-ctx.Done():
			return
		case data := <-c.send:
			if c.write(ctx, data) != nil {
				c.conn.CloseNow()
				return
			}
		}
	}
}

// keepAlive runs apart from writes because a ping waits for the pong.
func (c *connection) keepAlive(ctx context.Context, sessionValid func() bool) {
	ping := time.NewTicker(pingEvery)
	defer ping.Stop()
	session := time.NewTicker(sessionEvery)
	defer session.Stop()
	for {
		select {
		case <-ctx.Done():
			return
		case <-ping.C:
			waiting, cancel := context.WithTimeout(ctx, pingTimeout)
			err := c.conn.Ping(waiting)
			cancel()
			if err != nil {
				c.conn.CloseNow()
				return
			}
		case <-session.C:
			if !sessionValid() {
				c.closeWith(closeSessionExpired, "Sessão encerrada.")
				return
			}
		}
	}
}

func (c *connection) readLoop(ctx context.Context, h *Hub) {
	for {
		_, data, err := c.conn.Read(ctx)
		if err != nil {
			return
		}
		var incoming struct {
			Game string          `json:"game"`
			Type string          `json:"type"`
			ID   string          `json:"id"`
			Data json.RawMessage `json:"data"`
		}
		if json.Unmarshal(data, &incoming) != nil || len(incoming.ID) > 64 {
			c.reply(message{Game: "live"}, "error", errorData{Message: "Mensagem inválida."})
			continue
		}
		h.dispatch(ctx, c, message{Game: incoming.Game, Type: incoming.Type, ID: incoming.ID}, incoming.Data)
	}
}

// enqueue never waits: a client that cannot keep up is dropped and comes back
// with a fresh snapshot, instead of building a backlog of old events.
func (c *connection) enqueue(data []byte) {
	select {
	case c.send <- data:
	default:
		c.closeWith(closeTooSlow, "Conexão lenta.")
	}
}

func (c *connection) reply(to message, kind string, data any) {
	encoded, err := json.Marshal(message{Game: to.Game, Type: kind, ID: to.ID, Data: data})
	if err == nil {
		c.enqueue(encoded)
	}
}

func (c *connection) closeWith(code websocket.StatusCode, reason string) {
	c.closeOnce.Do(func() {
		go func() {
			if c.conn.Close(code, reason) != nil {
				c.conn.CloseNow()
			}
		}()
	})
}
