package rooms

import (
	"context"
	"database/sql"
	"encoding/json"
	"errors"
	"io"
	"net/http"
	"strings"
	"time"
	"unicode/utf8"

	"mtg4fun/internal/httpserver"
	"mtg4fun/internal/live"
)

type chatMessage struct {
	ID        int64  `json:"id"`
	AuthorID  int64  `json:"authorId"`
	Author    string `json:"author"`
	Body      string `json:"body"`
	CreatedAt string `json:"createdAt"`
}

// Chat is available only in a running match, to authenticated players and spectators.
func (s *Service) chatAccess(ctx context.Context, id int64) error {
	room, err := s.liveRoomState(ctx, id)
	if err != nil {
		return err
	}
	if room.Status != "started" {
		return sql.ErrNoRows
	}
	var snapshot []byte
	if err = s.db.QueryRowContext(ctx, "SELECT snapshot FROM matches WHERE room_id=?", id).Scan(&snapshot); err != nil {
		return err
	}
	var match matchState
	if err = json.Unmarshal(snapshot, &match); err != nil {
		return err
	}
	if match.PendingOrder || match.Finished {
		return sql.ErrNoRows
	}
	return nil
}

func (s *Service) chatAllowed(w http.ResponseWriter, r *http.Request) (int64, bool) {
	id, ok := roomID(w, r)
	if !ok {
		return 0, false
	}
	err := s.chatAccess(r.Context(), id)
	var userErr live.UserError
	if errors.Is(err, sql.ErrNoRows) || errors.As(err, &userErr) {
		httpserver.WriteError(w, 404, "Partida não encontrada.")
		return 0, false
	}
	if err != nil {
		httpserver.InternalError(w, err)
		return 0, false
	}
	return id, true
}

func (s *Service) getChat(w http.ResponseWriter, r *http.Request) {
	id, ok := s.chatAllowed(w, r)
	if !ok {
		return
	}
	rows, err := s.db.QueryContext(r.Context(), `SELECT c.id, c.author_id, u.name, c.body, DATE_FORMAT(c.created_at, '%Y-%m-%dT%H:%i:%s.%fZ') FROM match_chat_messages c JOIN users u ON u.id=c.author_id WHERE c.room_id=? ORDER BY c.id`, id)
	if err != nil {
		httpserver.InternalError(w, err)
		return
	}
	defer rows.Close()
	messages := []chatMessage{}
	for rows.Next() {
		var m chatMessage
		if err = rows.Scan(&m.ID, &m.AuthorID, &m.Author, &m.Body, &m.CreatedAt); err != nil {
			httpserver.InternalError(w, err)
			return
		}
		messages = append(messages, m)
	}
	if err = rows.Err(); err != nil {
		httpserver.InternalError(w, err)
		return
	}
	httpserver.WriteJSON(w, 200, map[string]any{"messages": messages})
}

func (s *Service) postChat(w http.ResponseWriter, r *http.Request) {
	id, ok := s.chatAllowed(w, r)
	if !ok {
		return
	}
	if strings.Split(r.Header.Get("Content-Type"), ";")[0] != "application/json" {
		httpserver.WriteError(w, 415, "Envie JSON.")
		return
	}
	decoder := json.NewDecoder(http.MaxBytesReader(w, r.Body, 8192))
	decoder.DisallowUnknownFields()
	var input struct {
		Body string `json:"body"`
	}
	if decoder.Decode(&input) != nil || decoder.Decode(&struct{}{}) != io.EOF {
		httpserver.WriteError(w, 400, "Mensagem inválida.")
		return
	}
	input.Body = strings.TrimSpace(input.Body)
	if !utf8.ValidString(input.Body) || utf8.RuneCountInString(input.Body) == 0 || utf8.RuneCountInString(input.Body) > 1000 {
		httpserver.WriteError(w, 400, "A mensagem deve ter entre 1 e 1000 caracteres.")
		return
	}
	user, ok := s.requireUser(w, r)
	if !ok {
		return
	}
	_, err := s.db.ExecContext(r.Context(), "INSERT INTO match_chat_messages (room_id, author_id, body) VALUES (?, ?, ?)", id, user.ID, input.Body)
	if err != nil {
		httpserver.InternalError(w, err)
		return
	}
	httpserver.WriteJSON(w, 201, map[string]bool{"ok": true})
}

type shakeGame struct{ s *Service }

func (shakeGame) Name() string { return "shake" }
func (shakeGame) Limit() live.Limit {
	return live.Limit{Every: 3 * time.Second, Burst: 7, CooldownAfterBurst: true}
}
func (shakeGame) Snapshot(context.Context, int64, live.Member) (any, error) { return nil, nil }
func (g shakeGame) Handle(ctx context.Context, r live.Request) error {
	if r.Type != "send" {
		return live.UserError{Message: "Ação inválida."}
	}
	if err := g.s.chatAccess(ctx, r.RoomID); err != nil {
		return live.UserError{Message: "Disponível somente durante a partida."}
	}
	g.s.live.Publish(r.RoomID, "shake", "shake", map[string]any{"fromName": r.From.Name})
	return nil
}
