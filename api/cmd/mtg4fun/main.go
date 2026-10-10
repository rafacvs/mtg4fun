package main

import (
	"errors"
	"flag"
	"log"
	"os"

	"mtg4fun/internal/auth"
	"mtg4fun/internal/database"
)

func main() {
	if err := run(); err != nil {
		log.Print(err)
		os.Exit(1)
	}
}

func env(key, fallback string) string {
	if value := os.Getenv(key); value != "" {
		return value
	}
	return fallback
}

func run() error {
	if len(os.Args) < 2 {
		return errors.New("uso: mtg4fun serve | create-user --login LOGIN --name NOME --password-stdin")
	}
	command := os.Args[1]
	if command != "serve" && command != "create-user" {
		return errors.New("comando desconhecido")
	}
	flags := flag.NewFlagSet(command, flag.ContinueOnError)
	dbPath := flags.String("db", env("DB_PATH", "data/mtg4fun.db"), "arquivo SQLite")
	login := flags.String("login", "", "login da conta")
	name := flags.String("name", "", "nome da pessoa")
	passwordStdin := flags.Bool("password-stdin", false, "ler senha de stdin")
	addr := flags.String("addr", env("ADDR", ":8080"), "endereço HTTP")
	webDir := flags.String("web", env("WEB_DIR", "../app/dist"), "arquivos do cliente")
	if err := flags.Parse(os.Args[2:]); err != nil {
		return err
	}
	if flags.NArg() != 0 {
		return errors.New("argumentos inesperados")
	}
	if command == "create-user" && !*passwordStdin {
		return errors.New("use --password-stdin para fornecer a senha")
	}
	db, err := database.Open(*dbPath)
	if err != nil {
		return err
	}
	defer db.Close()
	users, err := auth.New(db)
	if err != nil {
		return err
	}
	if command == "create-user" {
		return createUser(users, *login, *name)
	}
	return serve(users, *addr, *webDir)
}
