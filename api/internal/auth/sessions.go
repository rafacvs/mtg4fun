package auth

import (
	"context"
	"crypto/rand"
	"crypto/sha256"
	"database/sql"
	"encoding/hex"
	"errors"
	"fmt"
	"time"

	"golang.org/x/crypto/bcrypt"
)

var errInvalidCredentials = errors.New("Login ou senha inválidos.")

func tokenHash(token string) string {
	sum := sha256.Sum256([]byte(token))
	return hex.EncodeToString(sum[:])
}

func (s *Service) authenticate(ctx context.Context, login, password string) (User, error) {
	var user User
	var hash []byte
	err := s.db.QueryRowContext(ctx, "SELECT id, login, name, password_hash FROM users WHERE login = ?", login).Scan(&user.ID, &user.Login, &user.Name, &hash)
	if err != nil && !errors.Is(err, sql.ErrNoRows) {
		return User{}, err
	}
	found := err == nil
	if !found {
		hash = s.dummyHash
	}
	passwordErr := bcrypt.CompareHashAndPassword(hash, []byte(password))
	if !found || passwordErr != nil || len(password) > 72 {
		return User{}, errInvalidCredentials
	}
	return user, nil
}

func (s *Service) createSession(ctx context.Context, userID int64) (string, time.Time, error) {
	bytes := make([]byte, 32)
	if _, err := rand.Read(bytes); err != nil {
		return "", time.Time{}, fmt.Errorf("gerar sessão: %w", err)
	}
	token := hex.EncodeToString(bytes)
	expiry := time.Now().Add(24 * time.Hour)
	// Expired-session cleanup must not gap-lock an empty sessions table while
	// other logins insert their tokens. Both writes still commit atomically.
	tx, err := s.db.BeginTx(ctx, &sql.TxOptions{Isolation: sql.LevelReadCommitted})
	if err != nil {
		return "", time.Time{}, err
	}
	defer tx.Rollback()
	if _, err = tx.ExecContext(ctx, "DELETE FROM sessions WHERE expires_at <= ?", time.Now().Unix()); err == nil {
		_, err = tx.ExecContext(ctx, "INSERT INTO sessions(token_hash,user_id,expires_at) VALUES (?,?,?)", tokenHash(token), userID, expiry.Unix())
	}
	if err == nil {
		err = tx.Commit()
	}
	if err != nil {
		return "", time.Time{}, err
	}
	return token, expiry, nil
}

func (s *Service) userBySession(ctx context.Context, token string) (User, error) {
	if len(token) != 64 {
		return User{}, sql.ErrNoRows
	}
	var user User
	err := s.db.QueryRowContext(ctx, `SELECT users.id, users.login, users.name FROM sessions JOIN users ON users.id = sessions.user_id WHERE token_hash = ? AND expires_at > ?`, tokenHash(token), time.Now().Unix()).Scan(&user.ID, &user.Login, &user.Name)
	return user, err
}

func (s *Service) revokeSession(ctx context.Context, token string) error {
	_, err := s.db.ExecContext(ctx, "DELETE FROM sessions WHERE token_hash = ?", tokenHash(token))
	return err
}
