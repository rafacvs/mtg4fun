-- +goose NO TRANSACTION
-- +goose Up
ALTER TABLE decks ADD COLUMN commander VARBINARY(1024) NULL;

-- +goose Down
ALTER TABLE decks DROP COLUMN commander;
