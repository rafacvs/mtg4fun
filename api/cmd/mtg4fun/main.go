package main

import (
	"context"
	"errors"
	"flag"
	"fmt"
	"log"
	"os"
	"time"

	"mtg4fun/internal/auth"
	"mtg4fun/internal/catalog"
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
		return errors.New("uso: mtg4fun serve | create-user --name USUARIO --password SENHA | import-catalog [--cards cards.xml] [--tokens tokens.xml]")
	}
	command := os.Args[1]
	if command != "serve" && command != "create-user" && command != "import-catalog" {
		return errors.New("comando desconhecido")
	}
	flags := flag.NewFlagSet(command, flag.ContinueOnError)
	cards := flags.String("cards", "catalog/cards.xml", "cards.xml Cockatrice")
	tokens := flags.String("tokens", "catalog/tokens.xml", "tokens.xml Cockatrice")
	login := flags.String("login", "", "login da conta")
	name := flags.String("name", "", "nome da pessoa")
	password := flags.String("password", "", "senha da conta")
	passwordStdin := flags.Bool("password-stdin", false, "ler senha de stdin")
	addr := flags.String("addr", env("ADDR", ":8080"), "endereço HTTP")
	webDir := flags.String("web", env("WEB_DIR", ""), "arquivos do cliente (opcional; vazio executa somente a API)")
	if err := flags.Parse(os.Args[2:]); err != nil {
		return err
	}
	if flags.NArg() != 0 {
		return errors.New("argumentos inesperados")
	}
	if command == "create-user" {
		loginProvided, nameProvided, passwordProvided := false, false, false
		flags.Visit(func(f *flag.Flag) {
			switch f.Name {
			case "login":
				loginProvided = true
			case "name":
				nameProvided = true
			case "password":
				passwordProvided = true
			}
		})
		if !loginProvided {
			*login = *name
		}
		if !nameProvided {
			*name = *login
		}
		if *passwordStdin {
			if passwordProvided {
				return errors.New("use apenas --password ou --password-stdin")
			}
			var err error
			*password, err = passwordFromStdin()
			if err != nil {
				return err
			}
		} else if *password == "" {
			return errors.New("use --password para fornecer a senha")
		}
	}
	if os.Getenv("DB_PATH") != "" {
		return errors.New("DB_PATH não é mais suportado; configure MySQL com DB_HOST, DB_PORT, DB_NAME, DB_USER e DB_PASSWORD")
	}
	config, timeout, err := database.ConfigFromEnvironment()
	if err != nil {
		return err
	}
	if command == "import-catalog" {
		// Bulk writes may stall while InnoDB flushes; HTTP request limits do not apply.
		config.ReadTimeout = 5 * time.Minute
		config.WriteTimeout = 5 * time.Minute
	}
	db, err := database.Open(config, timeout)
	if err != nil {
		return err
	}
	defer db.Close()
	if command == "import-catalog" {
		if *cards == "" || *tokens == "" {
			return errors.New("use --cards e --tokens com XML Cockatrice")
		}
		if err := catalog.Import(context.Background(), db, *cards, *tokens); err != nil {
			return err
		}
		fmt.Println("Catálogo importado.")
		return nil
	}
	users, err := auth.New(db)
	if err != nil {
		return err
	}
	if command == "create-user" {
		return createUser(users, *login, *name, *password)
	}
	return serve(users, db, *addr, *webDir)
}
