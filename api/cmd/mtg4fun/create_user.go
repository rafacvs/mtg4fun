package main

import (
	"errors"
	"fmt"
	"io"
	"os"
	"strings"

	"mtg4fun/internal/auth"
)

func createUser(users *auth.Service, login, name string) error {
	input, err := io.ReadAll(io.LimitReader(os.Stdin, 75))
	if err != nil {
		return errors.New("não foi possível ler a senha")
	}
	password := strings.TrimSuffix(strings.TrimSuffix(string(input), "\n"), "\r")
	if err := users.CreateUser(login, name, password); err != nil {
		return err
	}
	fmt.Println("Conta criada.")
	return nil
}
