// Package database owns the MySQL connection and the application schema.
package database

import (
	"context"
	"database/sql"
	_ "embed"
	"errors"
	"fmt"
	"strings"
	"time"

	"github.com/go-sql-driver/mysql"
)

//go:embed schema.sql
var schema string

func Open(config *mysql.Config, timeout time.Duration) (*sql.DB, error) {
	connector, err := mysql.NewConnector(config)
	if err != nil {
		return nil, err
	}
	db := sql.OpenDB(connector)
	db.SetMaxOpenConns(10)
	db.SetMaxIdleConns(5)
	db.SetConnMaxLifetime(3 * time.Minute)
	ctx, cancel := context.WithTimeout(context.Background(), timeout)
	defer cancel()
	for {
		if err = db.PingContext(ctx); err == nil {
			break
		}
		var serverError *mysql.MySQLError
		if errors.As(err, &serverError) {
			db.Close()
			return nil, fmt.Errorf("conectar ao MySQL: %w", err)
		}
		select {
		case <-ctx.Done():
			db.Close()
			return nil, fmt.Errorf("conectar ao MySQL: %w", err)
		case <-time.After(500 * time.Millisecond):
		}
	}
	// MySQL DDL commits implicitly; each statement is idempotent so concurrent
	// provisioning and server startup can safely initialize the same database.
	for _, statement := range strings.Split(schema, ";") {
		if strings.TrimSpace(statement) == "" {
			continue
		}
		if _, err := db.ExecContext(ctx, statement); err != nil {
			db.Close()
			return nil, fmt.Errorf("inicializar esquema MySQL: %w", err)
		}
	}
	return db, nil
}
