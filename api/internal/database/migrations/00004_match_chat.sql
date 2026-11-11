-- +goose NO TRANSACTION
-- +goose Up
CREATE TABLE match_chat_messages (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    room_id BIGINT NOT NULL,
    author_id BIGINT NOT NULL,
    body TEXT NOT NULL,
    created_at TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    INDEX match_chat_room (room_id, id),
    FOREIGN KEY (room_id) REFERENCES matches(room_id),
    FOREIGN KEY (author_id) REFERENCES users(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- +goose Down
DROP TABLE match_chat_messages;
