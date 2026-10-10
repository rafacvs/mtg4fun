// Package auth owns account provisioning and authenticated access.
package auth

import (
	"database/sql"

	"golang.org/x/crypto/bcrypt"
)

const passwordCost = 12

type Service struct {
	db        *sql.DB
	dummyHash []byte
}

// New uses a connection whose lifecycle belongs to the caller.
func New(db *sql.DB) (*Service, error) {
	// Unknown users still pay the password comparison cost.
	dummy, err := bcrypt.GenerateFromPassword([]byte("dummy-password-for-comparison"), passwordCost)
	if err != nil {
		return nil, err
	}
	return &Service{db: db, dummyHash: dummy}, nil
}
