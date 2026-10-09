package main

import (
	"context"
	"errors"
	"flag"
	"fmt"
	"io"
	"log"
	"net"
	"net/http"
	"os"
	"os/signal"
	"strings"
	"syscall"
	"time"

	"mtg4fun/internal/app"
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
	webDir := flags.String("web", env("WEB_DIR", "web/dist"), "arquivos do cliente")
	if err := flags.Parse(os.Args[2:]); err != nil {
		return err
	}
	if flags.NArg() != 0 {
		return errors.New("argumentos inesperados")
	}
	if command == "create-user" && !*passwordStdin {
		return errors.New("use --password-stdin para fornecer a senha")
	}
	store, err := app.Open(*dbPath)
	if err != nil {
		return err
	}
	defer store.Close()
	if command == "create-user" {
		input, err := io.ReadAll(io.LimitReader(os.Stdin, 75))
		if err != nil {
			return errors.New("não foi possível ler a senha")
		}
		password := strings.TrimSuffix(strings.TrimSuffix(string(input), "\n"), "\r")
		if err := store.CreateUser(*login, *name, password); err != nil {
			return err
		}
		fmt.Println("Conta criada.")
		return nil
	}
	secure := env("COOKIE_SECURE", "false")
	if secure != "true" && secure != "false" {
		return errors.New("COOKIE_SECURE deve ser true ou false")
	}
	if _, err := os.Stat(*webDir + "/index.html"); err != nil {
		return fmt.Errorf("cliente indisponível: compile web ou configure WEB_DIR: %w", err)
	}
	listener, err := net.Listen("tcp", *addr)
	if err != nil {
		return err
	}
	server := &http.Server{Handler: store.Handler(*webDir, secure == "true"), ReadHeaderTimeout: 5 * time.Second, ReadTimeout: 10 * time.Second, WriteTimeout: 15 * time.Second, IdleTimeout: 60 * time.Second}
	ctx, stop := signal.NotifyContext(context.Background(), os.Interrupt, syscall.SIGTERM)
	defer stop()
	go func() {
		<-ctx.Done()
		shutdown, cancel := context.WithTimeout(context.Background(), 10*time.Second)
		defer cancel()
		_ = server.Shutdown(shutdown)
	}()
	log.Printf("HTTP ouvindo em %s", listener.Addr())
	if err := server.Serve(listener); err != nil && err != http.ErrServerClosed {
		return err
	}
	return nil
}
