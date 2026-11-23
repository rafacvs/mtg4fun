package decks

import (
	"net/http"
	"strconv"
	"strings"

	"mtg4fun/internal/auth"
	"mtg4fun/internal/httpserver"
)

func (s *Service) searchCatalog(w http.ResponseWriter, r *http.Request, users *auth.Service) {
	if _, ok := currentUser(w, r, users); !ok {
		return
	}
	values := r.URL.Query()
	integer := func(key string, fallback, minimum, maximum int) (int, bool) {
		if !values.Has(key) {
			return fallback, true
		}
		value, err := strconv.Atoi(values.Get(key))
		return value, err == nil && value >= minimum && value <= maximum
	}
	offset, validOffset := integer("offset", 0, 0, 1000000)
	limit, validLimit := integer("limit", 50, 1, 50)
	if !validOffset || !validLimit {
		httpserver.WriteError(w, 400, "Paginação inválida: use offset não negativo e limit de 1 a 50.")
		return
	}
	var cmc *int
	if raw := values.Get("cmc"); raw != "" {
		parsed := -1
		if raw != "12+" {
			value, err := strconv.Atoi(raw)
			if err != nil || value < 0 || value > 20 {
				httpserver.WriteError(w, 400, "Valor de mana inválido.")
				return
			}
			parsed = value
		}
		cmc = &parsed
	}
	color := strings.ToUpper(values.Get("color"))
	if color != "" && !strings.Contains("WUBRGCM", color) && color != "M" {
		httpserver.WriteError(w, 400, "Filtro de cor inválido.")
		return
	}
	if len(color) > 1 {
		httpserver.WriteError(w, 400, "Filtro de cor inválido.")
		return
	}
	page := s.catalog.Search(values.Get("q"), values.Get("type"), color, cmc, offset, limit)
	httpserver.WriteJSON(w, 200, page)
}
