package database

import (
	"context"
	"database/sql"
	"embed"
	"errors"
	"fmt"
	"io/fs"
	"path/filepath"

	"github.com/pressly/goose/v3"
	"github.com/pressly/goose/v3/lock"
)

//go:embed migrations/*.sql
var migrationFiles embed.FS

func provider(db *sql.DB, withLock bool) (*goose.Provider, error) {
	files, err := fs.Sub(migrationFiles, "migrations")
	if err != nil {
		return nil, err
	}
	var options []goose.ProviderOption
	if withLock {
		locker, err := lock.NewMySQLTableLocker()
		if err != nil {
			return nil, err
		}
		options = append(options, goose.WithLocker(locker))
	}
	return goose.NewProvider(goose.DialectMySQL, db, files, options...)
}

func MigrateUp(ctx context.Context, db *sql.DB) error {
	p, err := provider(db, true)
	if err != nil {
		return err
	}
	if _, err := p.Up(ctx); err != nil {
		return fmt.Errorf("aplicar migrations: %w", err)
	}
	return nil
}

func MigrationStatus(ctx context.Context, db *sql.DB) ([]*goose.MigrationStatus, error) {
	p, err := provider(db, false)
	if err != nil {
		return nil, err
	}
	present, err := versionTableExists(ctx, db)
	if err != nil {
		return nil, err
	}
	if !present {
		var statuses []*goose.MigrationStatus
		for _, source := range p.ListSources() {
			statuses = append(statuses, &goose.MigrationStatus{Source: source, State: goose.StatePending})
		}
		return statuses, nil
	}
	return p.Status(ctx)
}

// RequireCurrent only reads the schema. The production API must never change
// tables as a side effect of starting.
func RequireCurrent(ctx context.Context, db *sql.DB) error {
	present, err := versionTableExists(ctx, db)
	if err != nil {
		return err
	}
	if !present {
		return errors.New("banco sem migrations; execute mtg4fun migrate up")
	}
	p, err := provider(db, false)
	if err != nil {
		return err
	}
	current, target, err := p.GetVersions(ctx)
	if err != nil {
		return fmt.Errorf("verificar versão do banco: %w", err)
	}
	pending, err := p.HasPending(ctx)
	if err != nil {
		return fmt.Errorf("verificar migrations pendentes: %w", err)
	}
	if current != target || pending {
		return fmt.Errorf("versão do banco %d, esperada %d; execute mtg4fun migrate up", current, target)
	}
	return nil
}

func versionTableExists(ctx context.Context, db *sql.DB) (bool, error) {
	var present int
	if err := db.QueryRowContext(ctx, "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = DATABASE() AND table_name = 'goose_db_version'").Scan(&present); err != nil {
		return false, fmt.Errorf("verificar migrations: %w", err)
	}
	return present != 0, nil
}

func MigrationLabel(status *goose.MigrationStatus) string {
	return fmt.Sprintf("%05d %s %s", status.Source.Version, status.State, filepath.Base(status.Source.Path))
}
