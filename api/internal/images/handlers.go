package images

import (
	"database/sql"
	"errors"
	"net/http"

	"mtg4fun/internal/auth"
	"mtg4fun/internal/httpserver"
)

func (s *Service) Handler(users *auth.Service) http.Handler {
	mux := http.NewServeMux()
	mux.HandleFunc("GET /api/cards/image", func(w http.ResponseWriter, r *http.Request) {
		if _, _, err := users.CurrentUser(r); err != nil {
			if errors.Is(err, sql.ErrNoRows) {
				httpserver.WriteError(w, http.StatusUnauthorized, "Entre para continuar.")
				return
			}
			httpserver.InternalError(w, err)
			return
		}
		image, err := s.Get(r.URL.Query().Get("name"))
		if errors.Is(err, ErrUnavailable) {
			httpserver.WriteError(w, http.StatusBadGateway, "Não foi possível carregar a imagem desta carta.")
			return
		}
		if err != nil {
			httpserver.InternalError(w, err)
			return
		}
		w.Header().Set("Content-Type", image.ContentType)
		w.Header().Set("Cache-Control", "private, max-age=86400")
		_, _ = w.Write(image.Data)
	})
	return mux
}
