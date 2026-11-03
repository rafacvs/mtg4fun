// Package leaderboards reads public match statistics without exposing snapshots.
package leaderboards

import (
	"database/sql"
	"errors"
	"net/http"

	"mtg4fun/internal/auth"
	"mtg4fun/internal/httpserver"
)

func Handler(db *sql.DB, users *auth.Service) http.Handler {
	mux := http.NewServeMux()
	mux.HandleFunc("GET /api/leaderboards", func(w http.ResponseWriter, r *http.Request) {
		if _, _, err := users.CurrentUser(r); err != nil {
			if errors.Is(err, sql.ErrNoRows) {
				httpserver.WriteError(w, 401, "Entre para continuar.")
			} else {
				httpserver.InternalError(w, err)
			}
			return
		}
		period := r.URL.Query().Get("period")
		if period == "" {
			period = "all"
		}
		if period != "all" && period != "month" && period != "week" {
			httpserver.WriteError(w, 400, "Período inválido.")
			return
		}
		result, err := read(r.Context(), db, period)
		if err != nil {
			httpserver.InternalError(w, err)
			return
		}
		w.Header().Set("Cache-Control", "no-store")
		httpserver.WriteJSON(w, 200, result)
	})
	return mux
}
