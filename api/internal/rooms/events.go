package rooms

import (
	"bytes"
	"database/sql"
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"time"
)

// Room events always carry a complete, committed public view. Reading from
// MySQL also recovers changes after restarts, without connection-owned state.
func (s *Service) events(w http.ResponseWriter, r *http.Request) {
	controller := http.NewResponseController(w)
	w.Header().Set("Content-Type", "text/event-stream; charset=utf-8")
	w.Header().Set("X-Accel-Buffering", "no")
	send := func(event string, data []byte) error {
		if err := controller.SetWriteDeadline(time.Now().Add(30 * time.Second)); err != nil {
			return err
		}
		if _, err := fmt.Fprintf(w, "event: %s\ndata: %s\n\n", event, data); err != nil {
			return err
		}
		return controller.Flush()
	}
	ticker := time.NewTicker(time.Second)
	defer ticker.Stop()
	var previous []byte
	heartbeat := time.Now()
	for {
		_, _, err := s.users.CurrentUser(r)
		if errors.Is(err, sql.ErrNoRows) {
			_ = send("session-expired", []byte("{}"))
			return
		}
		if err != nil {
			_ = send("sync-error", []byte(`{"error":"Não foi possível atualizar as salas. Reconectando…"}`))
			return
		}
		rooms, err := s.list(r.Context())
		if err != nil {
			_ = send("sync-error", []byte(`{"error":"Não foi possível atualizar as salas. Reconectando…"}`))
			return
		}
		snapshot, err := json.Marshal(map[string]any{"rooms": rooms})
		if err != nil {
			return
		}
		if !bytes.Equal(snapshot, previous) {
			if err := send("rooms", snapshot); err != nil {
				return
			}
			previous = snapshot
			heartbeat = time.Now()
		} else if time.Since(heartbeat) >= 10*time.Second {
			if err := controller.SetWriteDeadline(time.Now().Add(30 * time.Second)); err != nil {
				return
			}
			if _, err := fmt.Fprint(w, ": conectado\n\n"); err != nil {
				return
			}
			if err := controller.Flush(); err != nil {
				return
			}
			heartbeat = time.Now()
		}
		select {
		case <-r.Context().Done():
			return
		case <-ticker.C:
		}
	}
}
