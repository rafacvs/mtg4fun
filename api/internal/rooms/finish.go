package rooms

import (
	"context"
	"database/sql"
	"errors"
	"fmt"
	"slices"
)

var errMatchFinished = errors.New("A partida foi finalizada e a sala está encerrada.")

func voteToFinish(m *matchState, actorID int64) actionLogPayload {
	m.FinishVotes = append(m.FinishVotes, actorID)
	required := (len(m.Players) + 1) / 2
	m.Finished = len(m.FinishVotes) >= required
	kind := "finish_vote"
	if m.Finished {
		kind = "finished"
	}
	return actionLogPayload{Kind: kind, Count: len(m.FinishVotes), Result: fmt.Sprintf("%d de %d concordâncias", len(m.FinishVotes), required)}
}

func hasFinishVote(m matchState, actorID int64) bool {
	return slices.Contains(m.FinishVotes, actorID)
}

// The room closure and final match snapshot/log commit in the same transaction.
func finishRoom(ctx context.Context, tx *sql.Tx, roomID, actorID int64) error {
	r, err := lockedRoom(ctx, tx, roomID)
	if err != nil {
		return err
	}
	r.Status = "finished"
	r.Vacancies = 0
	return save(ctx, tx, r, actorID, "finished")
}
