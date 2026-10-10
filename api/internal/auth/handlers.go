package auth

import (
	"database/sql"
	"encoding/json"
	"errors"
	"io"
	"net/http"
	"strings"
	"time"

	"mtg4fun/internal/httpserver"
)

const cookieName = "mtg4fun_session"

func cookie(secure bool, token string, expires time.Time, maxAge int) *http.Cookie {
	return &http.Cookie{Name: cookieName, Value: token, Path: "/", HttpOnly: true, Secure: secure, SameSite: http.SameSiteStrictMode, Expires: expires, MaxAge: maxAge}
}

// CurrentUser validates the session token against durable authenticated access.
func (s *Service) CurrentUser(r *http.Request) (User, string, error) {
	c, err := r.Cookie(cookieName)
	if err != nil {
		return User{}, "", sql.ErrNoRows
	}
	user, err := s.userBySession(r.Context(), c.Value)
	return user, c.Value, err
}

func (s *Service) Handler(secure bool) http.Handler {
	mux := http.NewServeMux()
	mux.HandleFunc("POST /api/session", func(w http.ResponseWriter, r *http.Request) { s.login(w, r, secure) })
	mux.HandleFunc("GET /api/session", s.session)
	mux.HandleFunc("DELETE /api/session", func(w http.ResponseWriter, r *http.Request) { s.logout(w, r, secure) })
	mux.HandleFunc("/api/", func(w http.ResponseWriter, r *http.Request) {
		httpserver.WriteError(w, http.StatusNotFound, "Recurso não encontrado.")
	})
	return mux
}

func (s *Service) session(w http.ResponseWriter, r *http.Request) {
	user, _, err := s.CurrentUser(r)
	if errors.Is(err, sql.ErrNoRows) {
		httpserver.WriteError(w, 401, "Entre para continuar.")
		return
	}
	if err != nil {
		httpserver.InternalError(w, err)
		return
	}
	httpserver.WriteJSON(w, 200, map[string]User{"user": user})
}

func (s *Service) logout(w http.ResponseWriter, r *http.Request, secure bool) {
	_, token, err := s.CurrentUser(r)
	if errors.Is(err, sql.ErrNoRows) {
		httpserver.WriteError(w, 401, "Entre para continuar.")
		return
	}
	if err != nil {
		httpserver.InternalError(w, err)
		return
	}
	if err := s.revokeSession(r.Context(), token); err != nil {
		httpserver.InternalError(w, err)
		return
	}
	http.SetCookie(w, cookie(secure, "", time.Unix(1, 0), -1))
	w.WriteHeader(204)
}

func (s *Service) login(w http.ResponseWriter, r *http.Request, secure bool) {
	if strings.Split(r.Header.Get("Content-Type"), ";")[0] != "application/json" {
		httpserver.WriteError(w, 415, "Envie JSON.")
		return
	}
	var input struct {
		Login    string `json:"login"`
		Password string `json:"password"`
	}
	decoder := json.NewDecoder(http.MaxBytesReader(w, r.Body, 4096))
	decoder.DisallowUnknownFields()
	if err := decoder.Decode(&input); err != nil {
		httpserver.WriteError(w, 400, "Dados de acesso inválidos.")
		return
	}
	if err := decoder.Decode(&struct{}{}); err != io.EOF {
		httpserver.WriteError(w, 400, "Dados de acesso inválidos.")
		return
	}
	user, err := s.authenticate(r.Context(), input.Login, input.Password)
	if errors.Is(err, errInvalidCredentials) {
		httpserver.WriteError(w, 401, err.Error())
		return
	}
	if err != nil {
		httpserver.InternalError(w, err)
		return
	}
	token, expiry, err := s.createSession(r.Context(), user.ID)
	if err != nil {
		httpserver.InternalError(w, err)
		return
	}
	http.SetCookie(w, cookie(secure, token, expiry, 86400))
	httpserver.WriteJSON(w, 200, map[string]User{"user": user})
}
