package backend

import (
	"database/sql"
	"time"
)

// Database functions
func InitDB() (*sql.DB, error) {
	// PostgreSQL connection string
	connStr := "postgres://postgres:askarbtw@localhost:5432/chatdb?sslmode=disable"

	db, err := sql.Open("postgres", connStr)
	if err != nil {
		return nil, err
	}

	// Check connection
	err = db.Ping()
	if err != nil {
		return nil, err
	}

	// Create messages table if it doesn't exist
	_, err = db.Exec(`
        CREATE TABLE IF NOT EXISTS messages (
            id SERIAL PRIMARY KEY,
            username TEXT NOT NULL,
            recipient TEXT,
            content TEXT NOT NULL,
            timestamp TIMESTAMP NOT NULL,
            is_private BOOLEAN NOT NULL DEFAULT FALSE
        )
    `)
	if err != nil {
		return nil, err
	}

	// Create users table if it doesn't exist
	_, err = db.Exec(`
        CREATE TABLE IF NOT EXISTS users (
            id SERIAL PRIMARY KEY,
            username TEXT NOT NULL UNIQUE,
            password TEXT NOT NULL,
            email TEXT,
            created_at TIMESTAMP NOT NULL
        )
    `)
	if err != nil {
		return nil, err
	}

	return db, nil
}

func saveMessage(db *sql.DB, msg Message) (int64, error) {
	var id int64
	err := db.QueryRow(
		"INSERT INTO messages(username, recipient, content, timestamp, is_private) VALUES($1, $2, $3, $4, $5) RETURNING id",
		msg.Username, msg.Recipient, msg.Content, msg.Timestamp, msg.IsPrivate,
	).Scan(&id)

	if err != nil {
		return 0, err
	}

	return id, nil
}

func getLastMessages(db *sql.DB, username string, limit int) ([]Message, error) {
	// Get both public messages and private messages involving this user
	rows, err := db.Query(`
        SELECT id, username, recipient, content, timestamp, is_private 
        FROM messages 
        WHERE is_private = false 
            OR (is_private = true AND (username = $1 OR recipient = $2))
        ORDER BY timestamp DESC LIMIT $3
    `, username, username, limit)

	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var messages []Message
	for rows.Next() {
		var msg Message
		var timeStr string
		var isPrivate bool
		err := rows.Scan(&msg.ID, &msg.Username, &msg.Recipient, &msg.Content, &timeStr, &isPrivate)
		if err != nil {
			return nil, err
		}
		msg.Timestamp, _ = time.Parse("2006-01-02 15:04:05.999999999-07:00", timeStr)
		msg.IsPrivate = isPrivate
		messages = append(messages, msg)
	}

	// Reverse the order to have oldest messages first
	for i, j := 0, len(messages)-1; i < j; i, j = i+1, j-1 {
		messages[i], messages[j] = messages[j], messages[i]
	}

	return messages, nil
}
