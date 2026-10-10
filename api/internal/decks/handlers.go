package decks

import (
	"database/sql"
	"errors"
	"io"
	"net/http"
	"path/filepath"
	"strconv"
	"strings"

	"mtg4fun/internal/auth"
	"mtg4fun/internal/httpserver"
)

func (s *Service) Handler(users *auth.Service) http.Handler {
	mux := http.NewServeMux()
	mux.HandleFunc("GET /api/decks", func(w http.ResponseWriter, r *http.Request) {
		user, ok := currentUser(w, r, users)
		if !ok {
			return
		}
		decks, err := s.list(r.Context(), user.ID)
		if err != nil {
			httpserver.InternalError(w, err)
			return
		}
		httpserver.WriteJSON(w, 200, map[string]any{"decks": decks})
	})
	mux.HandleFunc("POST /api/decks", func(w http.ResponseWriter, r *http.Request) {
		user, ok := currentUser(w, r, users)
		if !ok {
			return
		}
		// Allow framing overhead while enforcing the approved 2 MiB file limit.
		r.Body = http.MaxBytesReader(w, r.Body, 2*1024*1024+64*1024)
		if err := r.ParseMultipartForm(2*1024*1024 + 64*1024); err != nil {
			httpserver.WriteError(w, 400, "Envie um arquivo .cod de até 2 MiB.")
			return
		}
		defer r.MultipartForm.RemoveAll()
		if len(r.MultipartForm.File["file"]) != 1 || len(r.MultipartForm.File) != 1 || len(r.MultipartForm.Value) != 0 {
			httpserver.WriteError(w, 400, "Envie somente um arquivo .cod no campo file.")
			return
		}
		file, header, err := r.FormFile("file")
		if err != nil {
			httpserver.WriteError(w, 400, "Selecione um arquivo .cod.")
			return
		}
		defer file.Close()
		if strings.ToLower(filepath.Ext(header.Filename)) != ".cod" || header.Size > 2*1024*1024 {
			httpserver.WriteError(w, 400, "Envie um arquivo .cod de até 2 MiB.")
			return
		}
		deck, err := parse(io.LimitReader(file, 2*1024*1024+1), strings.TrimSuffix(filepath.Base(header.Filename), filepath.Ext(header.Filename)))
		if err != nil {
			httpserver.WriteError(w, 400, err.Error())
			return
		}
		deck, err = s.save(r.Context(), user.ID, deck)
		if errors.Is(err, errInvalidDeck) {
			httpserver.WriteError(w, 400, strings.TrimPrefix(err.Error(), errInvalidDeck.Error()+": "))
			return
		}
		if err != nil {
			httpserver.InternalError(w, err)
			return
		}
		httpserver.WriteJSON(w, 201, map[string]any{"deck": deck})
	})
	mux.HandleFunc("DELETE /api/decks/{id}", func(w http.ResponseWriter, r *http.Request) {
		user, ok := currentUser(w, r, users)
		if !ok {
			return
		}
		id, err := strconv.ParseInt(r.PathValue("id"), 10, 64)
		if err != nil || id <= 0 {
			httpserver.WriteError(w, 404, "Deck não encontrado.")
			return
		}
		result, err := s.db.ExecContext(r.Context(), "DELETE FROM decks WHERE id=? AND user_id=?", id, user.ID)
		if err != nil {
			httpserver.InternalError(w, err)
			return
		}
		count, err := result.RowsAffected()
		if err != nil {
			httpserver.InternalError(w, err)
			return
		}
		if count == 0 {
			httpserver.WriteError(w, 404, "Deck não encontrado.")
			return
		}
		w.WriteHeader(204)
	})
	return mux
}
func currentUser(w http.ResponseWriter, r *http.Request, users *auth.Service) (auth.User, bool) {
	user, _, err := users.CurrentUser(r)
	if errors.Is(err, sql.ErrNoRows) {
		httpserver.WriteError(w, 401, "Entre para continuar.")
		return auth.User{}, false
	}
	if err != nil {
		httpserver.InternalError(w, err)
		return auth.User{}, false
	}
	return user, true
}
