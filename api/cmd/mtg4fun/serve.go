package main

import (
	"context"
	"database/sql"
	"errors"
	"fmt"
	"log"
	"net"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"mtg4fun/internal/auth"
	"mtg4fun/internal/httpserver"
	"mtg4fun/internal/rooms"
)

func serve(users *auth.Service, db *sql.DB, addr, webDir string) error {
	secure := env("COOKIE_SECURE", "false")
	if secure != "true" && secure != "false" {
		return errors.New("COOKIE_SECURE deve ser true ou false")
	}
	if webDir != "" {
		if _, err := os.Stat(webDir + "/index.html"); err != nil {
			return fmt.Errorf("cliente indisponível: compile o frontend em app/ ou configure WEB_DIR: %w", err)
		}
	}
	listener, err := net.Listen("tcp", addr)
	if err != nil {
		return err
	}
	api := http.NewServeMux()
	roomHandler := rooms.New(db, users).Handler()
	api.Handle("/api/rooms", roomHandler)
	api.Handle("/api/rooms/", roomHandler)
	api.Handle("/api/", users.Handler(secure == "true"))
	server := &http.Server{
		Handler:           httpserver.NewHandler(api, webDir, secure == "true"),
		ReadHeaderTimeout: 5 * time.Second,
		ReadTimeout:       10 * time.Second,
		WriteTimeout:      15 * time.Second,
		IdleTimeout:       60 * time.Second,
	}
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
