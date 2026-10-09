package app

import (
	"crypto/rand"
	"crypto/sha256"
	"database/sql"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"log"
	"net/http"
	"net/url"
	"os"
	"path/filepath"
	"regexp"
	"strings"
	"time"
	"unicode/utf8"

	"github.com/mattn/go-sqlite3"
	"golang.org/x/crypto/bcrypt"
)

const cookieName = "mtg4fun_session"
const passwordCost = 12

var loginPattern = regexp.MustCompile(`^[a-zA-Z0-9_.-]{3,64}$`)

type Store struct {
	db        *sql.DB
	dummyHash []byte
}
type User struct {
	ID    int64  `json:"id"`
	Login string `json:"login"`
	Name  string `json:"name"`
}

func Open(path string) (*Store, error) {
	if err := os.MkdirAll(filepath.Dir(path), 0700); err != nil {
		return nil, err
	}
	absolute, err := filepath.Abs(path)
	if err != nil {
		return nil, err
	}
	uri := url.URL{Scheme: "file", Path: absolute}
	db, err := sql.Open("sqlite3", uri.String()+"?_foreign_keys=on&_journal_mode=WAL&_busy_timeout=5000&_synchronous=FULL")
	if err != nil {
		return nil, err
	}
	db.SetMaxOpenConns(1)
	_, err = db.Exec(`CREATE TABLE IF NOT EXISTS users (
 id INTEGER PRIMARY KEY, login TEXT NOT NULL UNIQUE, name TEXT NOT NULL, password_hash TEXT NOT NULL
 ); CREATE TABLE IF NOT EXISTS sessions (
 token_hash TEXT PRIMARY KEY, user_id INTEGER NOT NULL REFERENCES users(id), expires_at INTEGER NOT NULL
 ); CREATE INDEX IF NOT EXISTS sessions_expiry ON sessions(expires_at);`)
	if err != nil {
		db.Close()
		return nil, err
	}
	// Unknown users still pay the password comparison cost.
	dummy, err := bcrypt.GenerateFromPassword([]byte("dummy-password-for-comparison"), passwordCost)
	if err != nil {
		db.Close()
		return nil, err
	}
	return &Store{db: db, dummyHash: dummy}, nil
}
func (s *Store) Close() error { return s.db.Close() }

func (s *Store) CreateUser(login, name, password string) error {
	name = strings.TrimSpace(name)
	if !loginPattern.MatchString(login) {
		return errors.New("login deve ter 3 a 64 letras ASCII, números, ponto, hífen ou sublinhado")
	}
	if !utf8.ValidString(name) || name == "" || utf8.RuneCountInString(name) > 100 {
		return errors.New("nome deve ter de 1 a 100 caracteres")
	}
	if !utf8.ValidString(password) || len(password) < 8 || len(password) > 72 {
		return errors.New("senha deve ter de 8 a 72 bytes UTF-8")
	}
	hash, err := bcrypt.GenerateFromPassword([]byte(password), passwordCost)
	if err != nil {
		return err
	}
	_, err = s.db.Exec("INSERT INTO users(login, name, password_hash) VALUES (?, ?, ?)", login, name, string(hash))
	var sqliteErr sqlite3.Error
	if errors.As(err, &sqliteErr) && sqliteErr.ExtendedCode == sqlite3.ErrConstraintUnique {
		return errors.New("login já existe")
	}
	return err
}

func sendJSON(w http.ResponseWriter, status int, value any) {
	w.Header().Set("Content-Type", "application/json; charset=utf-8")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(value)
}
func reject(w http.ResponseWriter, status int, message string) {
	sendJSON(w, status, map[string]string{"error": message})
}
func failure(w http.ResponseWriter, err error) {
	log.Printf("falha de armazenamento: %v", err)
	reject(w, 500, "Não foi possível concluir. Tente novamente.")
}
func tokenHash(token string) string {
	sum := sha256.Sum256([]byte(token))
	return hex.EncodeToString(sum[:])
}
func cookie(secure bool, token string, expires time.Time, maxAge int) *http.Cookie {
	return &http.Cookie{Name: cookieName, Value: token, Path: "/", HttpOnly: true, Secure: secure, SameSite: http.SameSiteStrictMode, Expires: expires, MaxAge: maxAge}
}

func (s *Store) currentUser(r *http.Request) (User, string, error) {
	c, err := r.Cookie(cookieName)
	if err != nil || len(c.Value) != 64 {
		return User{}, "", sql.ErrNoRows
	}
	hash := tokenHash(c.Value)
	var user User
	err = s.db.QueryRowContext(r.Context(), `SELECT users.id, users.login, users.name FROM sessions JOIN users ON users.id = sessions.user_id WHERE token_hash = ? AND expires_at > ?`, hash, time.Now().Unix()).Scan(&user.ID, &user.Login, &user.Name)
	return user, hash, err
}

func (s *Store) Handler(webDir string, secure bool) http.Handler {
	mux := http.NewServeMux()
	mux.HandleFunc("POST /api/session", func(w http.ResponseWriter, r *http.Request) { s.login(w, r, secure) })
	mux.HandleFunc("GET /api/session", func(w http.ResponseWriter, r *http.Request) {
		user, _, err := s.currentUser(r)
		if errors.Is(err, sql.ErrNoRows) {
			reject(w, 401, "Entre para continuar.")
			return
		}
		if err != nil {
			failure(w, err)
			return
		}
		sendJSON(w, 200, map[string]User{"user": user})
	})
	mux.HandleFunc("DELETE /api/session", func(w http.ResponseWriter, r *http.Request) {
		_, hash, err := s.currentUser(r)
		if errors.Is(err, sql.ErrNoRows) {
			reject(w, 401, "Entre para continuar.")
			return
		}
		if err != nil {
			failure(w, err)
			return
		}
		if _, err := s.db.ExecContext(r.Context(), "DELETE FROM sessions WHERE token_hash = ?", hash); err != nil {
			failure(w, err)
			return
		}
		http.SetCookie(w, cookie(secure, "", time.Unix(1, 0), -1))
		w.WriteHeader(204)
	})
	mux.HandleFunc("/api/", func(w http.ResponseWriter, r *http.Request) { reject(w, 404, "Recurso não encontrado.") })
	files := http.FileServer(http.Dir(webDir))
	mux.HandleFunc("/", func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodGet && r.Method != http.MethodHead {
			w.Header().Set("Allow", "GET, HEAD")
			reject(w, http.StatusMethodNotAllowed, "Método não permitido.")
			return
		}
		files.ServeHTTP(w, r)
	})
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("X-Content-Type-Options", "nosniff")
		w.Header().Set("Referrer-Policy", "same-origin")
		w.Header().Set("Content-Security-Policy", "default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; frame-ancestors 'none'; base-uri 'self'; form-action 'self'")
		if strings.HasPrefix(r.URL.Path, "/api/") {
			w.Header().Set("Cache-Control", "no-store")
			if r.Method != "GET" && r.Method != "HEAD" {
				scheme := "http"
				if secure || r.TLS != nil {
					scheme = "https"
				}
				origin := r.Header.Get("Origin")
				if r.Header.Get("Sec-Fetch-Site") == "cross-site" || (origin != "" && origin != scheme+"://"+r.Host) {
					reject(w, 403, "Origem não permitida.")
					return
				}
			}
		}
		mux.ServeHTTP(w, r)
	})
}

func (s *Store) login(w http.ResponseWriter, r *http.Request, secure bool) {
	if strings.Split(r.Header.Get("Content-Type"), ";")[0] != "application/json" {
		reject(w, 415, "Envie JSON.")
		return
	}
	var input struct {
		Login    string `json:"login"`
		Password string `json:"password"`
	}
	decoder := json.NewDecoder(http.MaxBytesReader(w, r.Body, 4096))
	decoder.DisallowUnknownFields()
	if err := decoder.Decode(&input); err != nil {
		reject(w, 400, "Dados de acesso inválidos.")
		return
	}
	if err := decoder.Decode(&struct{}{}); err != io.EOF {
		reject(w, 400, "Dados de acesso inválidos.")
		return
	}
	var user User
	var hash []byte
	err := s.db.QueryRowContext(r.Context(), "SELECT id, login, name, password_hash FROM users WHERE login = ?", input.Login).Scan(&user.ID, &user.Login, &user.Name, &hash)
	if err != nil && !errors.Is(err, sql.ErrNoRows) {
		failure(w, err)
		return
	}
	found := err == nil
	if !found {
		hash = s.dummyHash
	}
	passwordErr := bcrypt.CompareHashAndPassword(hash, []byte(input.Password))
	if !found || passwordErr != nil || len(input.Password) > 72 {
		reject(w, 401, "Login ou senha inválidos.")
		return
	}
	bytes := make([]byte, 32)
	if _, err := rand.Read(bytes); err != nil {
		failure(w, fmt.Errorf("gerar sessão: %w", err))
		return
	}
	token := hex.EncodeToString(bytes)
	expiry := time.Now().Add(24 * time.Hour)
	tx, err := s.db.BeginTx(r.Context(), nil)
	if err != nil {
		failure(w, err)
		return
	}
	defer tx.Rollback()
	if _, err = tx.ExecContext(r.Context(), "DELETE FROM sessions WHERE expires_at <= ?", time.Now().Unix()); err == nil {
		_, err = tx.ExecContext(r.Context(), "INSERT INTO sessions(token_hash,user_id,expires_at) VALUES (?,?,?)", tokenHash(token), user.ID, expiry.Unix())
	}
	if err == nil {
		err = tx.Commit()
	}
	if err != nil {
		failure(w, err)
		return
	}
	http.SetCookie(w, cookie(secure, token, expiry, 86400))
	sendJSON(w, 200, map[string]User{"user": user})
}
