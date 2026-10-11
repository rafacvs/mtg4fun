package integration_test

import (
	"bytes"
	"strings"
	"testing"
)

func TestMigrationCommandPreservesExistingData(t *testing.T) {
	e := newEnvironment(t)
	e.mustCreate("rafa", "Rafa", "senha-segura-de-teste")
	before := strings.TrimSpace(string(e.sql("SELECT COUNT(*) FROM " + e.db + ".users")))
	if before != "1" {
		t.Fatalf("contagem inesperada antes da migration: %s", before)
	}
	output, err := e.command("migrate", "up").CombinedOutput()
	if err != nil {
		t.Fatalf("reaplicar migration: %v; %s", err, output)
	}
	after := strings.TrimSpace(string(e.sql("SELECT COUNT(*) FROM " + e.db + ".users")))
	if after != before {
		t.Fatalf("migration alterou usuários: antes %s, depois %s", before, after)
	}
	output, err = e.command("migrate", "status").CombinedOutput()
	if err != nil || !bytes.Contains(output, []byte("00001 applied 00001_initial.sql")) {
		t.Fatalf("status da migration: %v; %s", err, output)
	}
	e.start(false)
	requireUser(t, e.login("rafa", "senha-segura-de-teste"), "rafa", "Rafa")
}

func TestAPIDoesNotApplyMigrationsOnStart(t *testing.T) {
	e := newEnvironment(t)
	e.sql("DROP TABLE " + e.db + ".goose_db_version")
	status, err := e.command("migrate", "status").CombinedOutput()
	if err != nil || !bytes.Contains(status, []byte("00001 pending 00001_initial.sql")) {
		t.Fatalf("status do banco ainda sem migrations: %v; %s", err, status)
	}
	output, err := e.command("serve", "--cards", e.cards, "--tokens", e.tokens).CombinedOutput()
	if err == nil || !bytes.Contains(output, []byte("execute mtg4fun migrate up")) {
		t.Fatalf("API iniciou sem migration: %v; %s", err, output)
	}
	if got := strings.TrimSpace(string(e.sql("SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = '" + e.db + "' AND table_name = 'goose_db_version'"))); got != "0" {
		t.Fatalf("API criou tabela de migrations ao iniciar: %s", got)
	}
}

func TestAPIStartsWithoutSchemaWritePermissions(t *testing.T) {
	e := newEnvironment(t)
	e.sql("REVOKE CREATE, ALTER, DROP ON " + e.db + ".* FROM '" + e.db + "'@'%'")
	e.start(false)
	requireStatus(t, e.request("GET", "/api/session", "", nil, nil), 401)
}
