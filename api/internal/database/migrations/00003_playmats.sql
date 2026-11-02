-- +goose NO TRANSACTION
-- +goose Up
CREATE TABLE playmat_images (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    user_id BIGINT NOT NULL,
    name VARCHAR(255) NOT NULL,
    media_type VARCHAR(32) NOT NULL,
    content MEDIUMBLOB NOT NULL,
    deleted BOOLEAN NOT NULL DEFAULT FALSE,
    FOREIGN KEY (user_id) REFERENCES users(id),
    INDEX playmat_owner (user_id, deleted)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
CREATE TABLE playmat_preferences (
    user_id BIGINT PRIMARY KEY,
    settings JSON NOT NULL,
    FOREIGN KEY (user_id) REFERENCES users(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- +goose Down
DROP TABLE playmat_preferences;
DROP TABLE playmat_images;
