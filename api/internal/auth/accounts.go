package auth

import (
	"errors"
	"regexp"
	"strings"
	"unicode/utf8"

	"github.com/go-sql-driver/mysql"
	"golang.org/x/crypto/bcrypt"
)

var loginPattern = regexp.MustCompile(`^[a-zA-Z0-9_.-]{3,64}$`)

type User struct {
	ID    int64  `json:"id"`
	Login string `json:"login"`
	Name  string `json:"name"`
}

func (s *Service) CreateUser(login, name, password string) error {
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
	var mysqlErr *mysql.MySQLError
	if errors.As(err, &mysqlErr) && mysqlErr.Number == 1062 {
		return errors.New("login já existe")
	}
	return err
}
