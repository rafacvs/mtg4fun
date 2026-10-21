package database

import (
	"strings"
	"testing"

	"github.com/go-sql-driver/mysql"
)

func TestRequiredTLSNeverFallsBackToPlaintext(t *testing.T) {
	t.Setenv("DB_PASSWORD", "test-password")
	t.Setenv("DB_TLS", "required")
	t.Setenv("DB_TLS_CA", "")
	config, _, err := ConfigFromEnvironment()
	if err != nil {
		t.Fatal(err)
	}
	// Exercise the DSN consumed by database/sql, including the driver's
	// normalization of its TLS mode and fallback behavior.
	parsed, err := mysql.ParseDSN(config.FormatDSN())
	if err != nil {
		t.Fatal(err)
	}
	if parsed.TLS == nil || !parsed.TLS.InsecureSkipVerify || parsed.AllowFallbackToPlaintext {
		t.Fatal("required must encrypt without certificate validation or plaintext fallback")
	}
}

func TestTLSRejectsUnsupportedModesAndAmbiguousCA(t *testing.T) {
	for _, example := range []struct{ mode, ca, message string }{
		{"preferred", "", "DB_TLS deve ser"},
		{"skip-verify", "", "DB_TLS deve ser"},
		{"required", "/unused-ca.pem", "DB_TLS_CA requer DB_TLS=true"},
		{"false", "/unused-ca.pem", "DB_TLS_CA requer DB_TLS=true"},
	} {
		t.Run(example.mode+example.ca, func(t *testing.T) {
			t.Setenv("DB_PASSWORD", "test-password")
			t.Setenv("DB_TLS", example.mode)
			t.Setenv("DB_TLS_CA", example.ca)
			if _, _, err := ConfigFromEnvironment(); err == nil || !strings.Contains(err.Error(), example.message) {
				t.Fatalf("configuration should fail with %q, got %v", example.message, err)
			}
		})
	}
}
