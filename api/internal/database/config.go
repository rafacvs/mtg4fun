package database

import (
	"crypto/tls"
	"crypto/x509"
	"errors"
	"fmt"
	"net"
	"os"
	"strconv"
	"time"

	"github.com/go-sql-driver/mysql"
)

// ConfigFromEnvironment reads connection settings without loading files or
// exposing the password in a command argument or log message.
func ConfigFromEnvironment() (*mysql.Config, time.Duration, error) {
	value := func(key, fallback string) string {
		if v := os.Getenv(key); v != "" {
			return v
		}
		return fallback
	}
	port := value("DB_PORT", "3306")
	number, err := strconv.Atoi(port)
	if err != nil || number < 1 || number > 65535 {
		return nil, 0, errors.New("DB_PORT deve ser uma porta válida")
	}
	timeout, err := time.ParseDuration(value("DB_CONNECT_TIMEOUT", "120s"))
	if err != nil || timeout <= 0 {
		return nil, 0, errors.New("DB_CONNECT_TIMEOUT deve ser uma duração positiva")
	}
	config := mysql.NewConfig()
	config.Net = "tcp"
	config.Addr = net.JoinHostPort(value("DB_HOST", "mysql"), port)
	config.User = value("DB_USER", "mtg4fun")
	config.Passwd = os.Getenv("DB_PASSWORD")
	config.DBName = value("DB_NAME", "mtg4fun")
	if config.Passwd == "" {
		return nil, 0, errors.New("DB_PASSWORD é obrigatório")
	}
	config.Timeout = 5 * time.Second
	config.ReadTimeout = 10 * time.Second
	config.WriteTimeout = 10 * time.Second
	if err := config.Apply(mysql.Charset("utf8mb4", "")); err != nil {
		return nil, 0, err
	}
	secure := value("DB_TLS", "false")
	if secure != "true" && secure != "false" {
		return nil, 0, errors.New("DB_TLS deve ser true ou false")
	}
	caPath := os.Getenv("DB_TLS_CA")
	if caPath != "" && secure != "true" {
		return nil, 0, errors.New("DB_TLS_CA requer DB_TLS=true")
	}
	if secure == "true" {
		config.TLSConfig = "true"
		if caPath != "" {
			pem, err := os.ReadFile(caPath)
			if err != nil {
				return nil, 0, fmt.Errorf("ler DB_TLS_CA: %w", err)
			}
			roots, err := x509.SystemCertPool()
			if err != nil {
				return nil, 0, fmt.Errorf("carregar certificados: %w", err)
			}
			if !roots.AppendCertsFromPEM(pem) {
				return nil, 0, errors.New("DB_TLS_CA não contém certificado PEM válido")
			}
			if err := mysql.RegisterTLSConfig("mtg4fun", &tls.Config{RootCAs: roots, MinVersion: tls.VersionTLS12}); err != nil {
				return nil, 0, err
			}
			config.TLSConfig = "mtg4fun"
		}
	}
	return config, timeout, nil
}
