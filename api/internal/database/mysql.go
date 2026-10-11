// Package database owns the MySQL connection and schema migrations.
package database

import (
	"context"
	"database/sql"
	"errors"
	"fmt"
	"time"

	"github.com/go-sql-driver/mysql"
)

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
	return db, nil
}
