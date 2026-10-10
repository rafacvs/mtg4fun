// Package rooms owns durable room preparation and participation.
package rooms

import (
	"context"
	"database/sql"
	"encoding/json"
	"errors"
	"fmt"

	"mtg4fun/internal/auth"
)

const capacity = 6

type Participant struct {
	ID   int64  `json:"id"`
	Name string `json:"name"`
}

type Room struct {
	ID           int64         `json:"id"`
	Title        string        `json:"title"`
	CreatorID    int64         `json:"creatorId"`
	Status       string        `json:"status"`
	Participants []Participant `json:"participants"`
	Vacancies    int           `json:"vacancies"`
}

type Service struct {
	db    *sql.DB
	users *auth.Service
}

func New(db *sql.DB, users *auth.Service) *Service { return &Service{db: db, users: users} }

func (s *Service) list(ctx context.Context) ([]Room, error) {
	rows, err := s.db.QueryContext(ctx, "SELECT snapshot FROM rooms ORDER BY id")
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	rooms := make([]Room, 0)
	for rows.Next() {
		var snapshot []byte
		var room Room
		if err := rows.Scan(&snapshot); err != nil {
			return nil, err
		}
		if err := json.Unmarshal(snapshot, &room); err != nil {
			return nil, err
		}
		rooms = append(rooms, room)
	}
	return rooms, rows.Err()
}

func save(ctx context.Context, tx *sql.Tx, room Room, actor int64, action string) error {
	snapshot, err := json.Marshal(room)
	if err != nil {
		return err
	}
	if _, err := tx.ExecContext(ctx, "UPDATE rooms SET snapshot=? WHERE id=?", snapshot, room.ID); err != nil {
		return err
	}
	_, err = tx.ExecContext(ctx, "INSERT INTO room_events (room_id,actor_id,action) VALUES (?,?,?)", room.ID, actor, action)
	return err
}

func (s *Service) create(ctx context.Context, user auth.User) (Room, error) {
	tx, err := s.db.BeginTx(ctx, nil)
	if err != nil {
		return Room{}, err
	}
	defer tx.Rollback()
	result, err := tx.ExecContext(ctx, "INSERT INTO rooms (creator_id,snapshot) VALUES (?,JSON_OBJECT())", user.ID)
	if err != nil {
		return Room{}, err
	}
	id, err := result.LastInsertId()
	if err != nil {
		return Room{}, err
	}
	room := Room{ID: id, Title: fmt.Sprintf("Sala #%d", id), CreatorID: user.ID, Status: "preparing", Participants: []Participant{{ID: user.ID, Name: user.Name}}, Vacancies: capacity - 1}
	if err := save(ctx, tx, room, user.ID, "created"); err != nil {
		return Room{}, err
	}
	if err := tx.Commit(); err != nil {
		return Room{}, err
	}
	return room, nil
}

var errRoomFull = errors.New("A sala está cheia.")
var errRoomStarted = errors.New("A partida já foi iniciada.")

func (s *Service) join(ctx context.Context, id int64, user auth.User) (Room, error) {
	tx, err := s.db.BeginTx(ctx, nil)
	if err != nil {
		return Room{}, err
	}
	defer tx.Rollback()
	var snapshot []byte
	if err := tx.QueryRowContext(ctx, "SELECT snapshot FROM rooms WHERE id=? FOR UPDATE", id).Scan(&snapshot); err != nil {
		return Room{}, err
	}
	var room Room
	if err := json.Unmarshal(snapshot, &room); err != nil {
		return Room{}, err
	}
	for _, participant := range room.Participants {
		if participant.ID == user.ID {
			return room, nil
		}
	}
	if room.Status != "preparing" {
		return Room{}, errRoomStarted
	}
	if len(room.Participants) >= capacity {
		return Room{}, errRoomFull
	}
	room.Participants = append(room.Participants, Participant{ID: user.ID, Name: user.Name})
	room.Vacancies = capacity - len(room.Participants)
	if err := save(ctx, tx, room, user.ID, "joined"); err != nil {
		return Room{}, err
	}
	if err := tx.Commit(); err != nil {
		return Room{}, err
	}
	return room, nil
}
