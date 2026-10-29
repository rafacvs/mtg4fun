package rooms

import (
	"context"
	"database/sql"
	"encoding/json"
	"errors"
	"io"
	"net/http"
	"strings"

	"mtg4fun/internal/auth"
	"mtg4fun/internal/httpserver"
)

type preparationSettings struct {
	Life               *int  `json:"life"`
	CommanderToCommand *bool `json:"commanderToCommand"`
	DrawOpeningHand    *bool `json:"drawOpeningHand"`
}

func (s *Service) updatePreparationSettings(ctx context.Context, id int64, user auth.User, input preparationSettings) (Room, error) {
	tx, err := s.db.BeginTx(ctx, nil)
	if err != nil {
		return Room{}, err
	}
	defer tx.Rollback()
	room, err := lockedRoom(ctx, tx, id)
	if err != nil {
		return Room{}, err
	}
	if room.CreatorID != user.ID {
		return Room{}, errNotCreator
	}
	if room.Status != "preparing" {
		return Room{}, errRoomStarted
	}
	if input.Life != nil {
		room.Life = *input.Life
	}
	if input.CommanderToCommand != nil {
		room.CommanderToCommand = input.CommanderToCommand
	}
	if input.DrawOpeningHand != nil {
		room.DrawOpeningHand = input.DrawOpeningHand
	}
	if err = save(ctx, tx, room, user.ID, "settings"); err != nil {
		return Room{}, err
	}
	if err = tx.Commit(); err != nil {
		return Room{}, err
	}
	return room.view(), nil
}

func (s *Service) changePreparationSettings(w http.ResponseWriter, r *http.Request) {
	id, ok := roomID(w, r)
	if !ok {
		return
	}
	user, ok := s.requireUser(w, r)
	if !ok {
		return
	}
	if strings.Split(r.Header.Get("Content-Type"), ";")[0] != "application/json" {
		httpserver.WriteError(w, 415, "Envie JSON.")
		return
	}
	decoder := json.NewDecoder(http.MaxBytesReader(w, r.Body, 4096))
	decoder.DisallowUnknownFields()
	var input preparationSettings
	if err := decoder.Decode(&input); err != nil || (input.Life == nil && input.CommanderToCommand == nil && input.DrawOpeningHand == nil) || (input.Life != nil && (*input.Life < 1 || *input.Life > 999)) {
		httpserver.WriteError(w, 400, "Configuração inválida.")
		return
	}
	if err := decoder.Decode(&struct{}{}); err != io.EOF {
		httpserver.WriteError(w, 400, "Configuração inválida.")
		return
	}
	room, err := s.updatePreparationSettings(r.Context(), id, user, input)
	switch {
	case errors.Is(err, sql.ErrNoRows):
		httpserver.WriteError(w, 404, "Sala não encontrada.")
	case errors.Is(err, errNotCreator):
		httpserver.WriteError(w, 403, "Somente o criador pode configurar a sala.")
	case errors.Is(err, errRoomStarted):
		httpserver.WriteError(w, 409, err.Error())
	case err != nil:
		httpserver.InternalError(w, err)
	default:
		httpserver.WriteJSON(w, 200, map[string]Room{"room": room})
	}
}
