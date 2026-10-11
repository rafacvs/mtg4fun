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
		return errors.New("uso: mtg4fun serve | create-user --name USUARIO --password SENHA | migrate up|status")
	}
	command := os.Args[1]
	if command != "serve" && command != "create-user" && command != "migrate" {
		return errors.New("comando desconhecido")
	}
	if command == "migrate" {
		if len(os.Args) != 3 || (os.Args[2] != "up" && os.Args[2] != "status") {
			return errors.New("uso: mtg4fun migrate up|status")
		}
		return migrate(os.Args[2])
	}
	flags := flag.NewFlagSet(command, flag.ContinueOnError)
	cards := flags.String("cards", env("CATALOG_CARDS", "catalog/cards.xml"), "cards.xml Cockatrice")
	tokens := flags.String("tokens", env("CATALOG_TOKENS", "catalog/tokens.xml"), "tokens.xml Cockatrice")
	login := flags.String("login", "", "login da conta")
	name := flags.String("name", "", "nome da pessoa")
	password := flags.String("password", "", "senha da conta")
	passwordStdin := flags.Bool("password-stdin", false, "ler senha de stdin")
	addr := flags.String("addr", env("ADDR", ":8080"), "endereço HTTP")
	webDir := flags.String("web", env("WEB_DIR", ""), "arquivos do cliente (opcional; vazio executa somente a API)")
	imageCache := flags.String("image-cache", env("IMAGE_CACHE", "data/images"), "cache compartilhado de imagens")
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
	var cardCatalog *catalog.Catalog
	if command == "serve" {
		var err error
		if cardCatalog, err = catalog.Load(*cards, *tokens); err != nil {
			return err
		}
	}
	config, timeout, err := database.ConfigFromEnvironment()
	if err != nil {
		return err
	}
	db, err := database.Open(config, timeout)
	if err != nil {
		return err
	}
	defer db.Close()
	if err := database.RequireCurrent(context.Background(), db); err != nil {
		return err
	}
	users, err := auth.New(db)
	if err != nil {
		return err
	}
	if command == "create-user" {
		return createUser(users, *login, *name, *password)
	}
	return serve(users, db, cardCatalog, *imageCache, *addr, *webDir)
}

func migrate(action string) error {
	config, timeout, err := database.ConfigFromEnvironment()
	if err != nil {
		return err
	}
	// The first DDL can sit longer than a normal request before MySQL replies.
	config.ReadTimeout = 2 * time.Minute
	config.WriteTimeout = 2 * time.Minute
	db, err := database.Open(config, timeout)
	if err != nil {
		return err
	}
	defer db.Close()
	ctx := context.Background()
	if action == "up" {
		if err := database.MigrateUp(ctx, db); err != nil {
			return err
		}
	}
	statuses, err := database.MigrationStatus(ctx, db)
	if err != nil {
		return err
	}
	for _, status := range statuses {
		fmt.Println(database.MigrationLabel(status))
	}
	return nil
}
