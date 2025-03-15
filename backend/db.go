package backend

import (
	"database/sql"
	"fmt"
	"log"
	"os"
	"sort"
	"strings"
	"time"
)

// Database functions
func InitDB() (*sql.DB, error) {
	// Get PostgreSQL connection string from environment variable or use default
	connStr := os.Getenv("DB_CONNECTION")
	if connStr == "" {
		// Default PostgreSQL connection string
		connStr = "postgres://postgres:askarbtw@localhost:5432/chatdb?sslmode=disable"
		log.Println("Warning: Using default database connection string. Set DB_CONNECTION environment variable to override.")
	}

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
            timestamp TIMESTAMP WITH TIME ZONE NOT NULL,
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
            created_at TIMESTAMP WITH TIME ZONE NOT NULL
        )
    `)
	if err != nil {
		return nil, err
	}

	// Create friends table if it doesn't exist
	_, err = db.Exec(`
        CREATE TABLE IF NOT EXISTS friends (
            id SERIAL PRIMARY KEY,
            user_id INTEGER NOT NULL,
            friend_id INTEGER NOT NULL,
            status TEXT NOT NULL, -- 'pending', 'accepted', 'declined'
            created_at TIMESTAMP WITH TIME ZONE NOT NULL,
            updated_at TIMESTAMP WITH TIME ZONE,
            FOREIGN KEY (user_id) REFERENCES users(id),
            FOREIGN KEY (friend_id) REFERENCES users(id),
            UNIQUE(user_id, friend_id)
        )
    `)
	if err != nil {
		return nil, err
	}

	// Run migration to update existing timestamp columns
	// This is safe to run multiple times
	err = migrateTimestampColumns(db)
	if err != nil {
		log.Printf("Warning: Failed to migrate timestamp columns: %v", err)
	}

	return db, nil
}

// migrateTimestampColumns updates existing timestamp columns to use timezone info
func migrateTimestampColumns(db *sql.DB) error {
	// Check if the messages table has a TIMESTAMP WITHOUT TIME ZONE column
	var dataType string
	err := db.QueryRow(`
		SELECT data_type FROM information_schema.columns 
		WHERE table_name = 'messages' AND column_name = 'timestamp'
	`).Scan(&dataType)

	if err != nil {
		return err
	}

	if dataType == "TIMESTAMP WITHOUT TIME ZONE" {
		log.Println("Migrating messages timestamp column to include timezone info")
		_, err = db.Exec(`ALTER TABLE messages ALTER COLUMN timestamp TYPE TIMESTAMP WITH TIME ZONE`)
		if err != nil {
			return err
		}
	}

	// Check users table
	err = db.QueryRow(`
		SELECT data_type FROM information_schema.columns 
		WHERE table_name = 'users' AND column_name = 'created_at'
	`).Scan(&dataType)

	if err != nil {
		return err
	}

	if dataType == "TIMESTAMP WITHOUT TIME ZONE" {
		log.Println("Migrating users created_at column to include timezone info")
		_, err = db.Exec(`ALTER TABLE users ALTER COLUMN created_at TYPE TIMESTAMP WITH TIME ZONE`)
		if err != nil {
			return err
		}
	}

	// Check friends table
	err = db.QueryRow(`
		SELECT data_type FROM information_schema.columns 
		WHERE table_name = 'friends' AND column_name = 'created_at'
	`).Scan(&dataType)

	if err != nil {
		return err
	}

	if dataType == "TIMESTAMP WITHOUT TIME ZONE" {
		log.Println("Migrating friends created_at column to include timezone info")
		_, err = db.Exec(`ALTER TABLE friends ALTER COLUMN created_at TYPE TIMESTAMP WITH TIME ZONE`)
		if err != nil {
			return err
		}

		// Also check the updated_at column (might be NULL)
		_, err = db.Exec(`
			ALTER TABLE friends 
			ALTER COLUMN updated_at TYPE TIMESTAMP WITH TIME ZONE 
			USING updated_at::TIMESTAMP WITH TIME ZONE
		`)
		if err != nil {
			return err
		}
	}

	return nil
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

	// Set the ID in the message
	msg.ID = id

	// Cache the message in Redis if Redis is available
	if redisClient != nil {
		err = CacheMessage(msg)
		if err != nil {
			// Just log the error, don't fail the whole operation
			// The message is already saved in the database
			// Redis caching is just an optimization
			// error: Redis writes should not block the flow
			// unlike error on database writes
			log.Printf("Warning: Failed to cache message in Redis: %v", err)
		}
	}

	return id, nil
}

func getLastMessages(db *sql.DB, username string, limit int) ([]Message, error) {
	var messages []Message
	var err error

	// Try to get messages from Redis cache first
	if redisClient != nil {
		// Try getting global messages
		globalMessages, err := GetCachedMessages("all", username, limit)
		if err == nil && len(globalMessages) > 0 {
			messages = append(messages, globalMessages...)
		}

		// Get private messages for this user
		// Query Redis for all private conversations this user has
		keyPattern := fmt.Sprintf("messages:private:*%s*", username)
		keys, err := redisClient.Keys(ctx, keyPattern).Result()
		if err == nil {
			for _, key := range keys {
				// Parse the key to extract recipient username
				parts := strings.Split(key, ":")
				if len(parts) >= 4 {
					var recipient string
					if parts[2] == username {
						recipient = parts[3]
					} else {
						recipient = parts[2]
					}

					// Get messages for this conversation
					privateMessages, err := GetCachedMessages(recipient, username, limit)
					if err == nil && len(privateMessages) > 0 {
						messages = append(messages, privateMessages...)
					}
				}
			}
		}

		// If we got enough messages from Redis, return them
		if len(messages) >= limit {
			// Sort messages by timestamp
			sort.Slice(messages, func(i, j int) bool {
				return messages[i].Timestamp.Before(messages[j].Timestamp)
			})

			// If we have more than limit, return only the most recent ones
			if len(messages) > limit {
				messages = messages[len(messages)-limit:]
			}

			return messages, nil
		}
	}

	// If Redis failed or didn't have enough messages, fall back to database
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

	messages = []Message{} // Reset messages array
	for rows.Next() {
		var msg Message
		err := rows.Scan(&msg.ID, &msg.Username, &msg.Recipient, &msg.Content, &msg.Timestamp, &msg.IsPrivate)
		if err != nil {
			return nil, err
		}
		messages = append(messages, msg)
	}

	// Reverse the order to have oldest messages first
	for i, j := 0, len(messages)-1; i < j; i, j = i+1, j-1 {
		messages[i], messages[j] = messages[j], messages[i]
	}

	// Cache these messages in Redis if Redis is available
	if redisClient != nil {
		for _, msg := range messages {
			err = CacheMessage(msg)
			if err != nil {
				log.Printf("Warning: Failed to cache message in Redis after DB retrieval: %v", err)
			}
		}
	}

	return messages, nil
}

// Add a friend request
func addFriendRequest(db *sql.DB, username, friendUsername string) error {
	// Get user IDs
	var userID, friendID int64

	err := db.QueryRow("SELECT id FROM users WHERE username = $1", username).Scan(&userID)
	if err != nil {
		return err
	}

	err = db.QueryRow("SELECT id FROM users WHERE username = $1", friendUsername).Scan(&friendID)
	if err != nil {
		return err
	}

	// Check if request already exists
	var exists bool
	err = db.QueryRow(`
        SELECT EXISTS(
            SELECT 1 FROM friends 
            WHERE (user_id = $1 AND friend_id = $2) OR (user_id = $2 AND friend_id = $1)
        )`, userID, friendID).Scan(&exists)
	if err != nil {
		return err
	}

	if exists {
		return nil // Request already exists, no need to create a new one
	}

	// Create new friend request
	now := time.Now()
	_, err = db.Exec(`
        INSERT INTO friends(user_id, friend_id, status, created_at) 
        VALUES($1, $2, $3, $4)`,
		userID, friendID, "pending", now)

	return err
}

// Accept a friend request
func acceptFriendRequest(db *sql.DB, username, friendUsername string) error {
	// Get user IDs
	var userID, friendID int64

	err := db.QueryRow("SELECT id FROM users WHERE username = $1", username).Scan(&userID)
	if err != nil {
		return err
	}

	err = db.QueryRow("SELECT id FROM users WHERE username = $1", friendUsername).Scan(&friendID)
	if err != nil {
		return err
	}

	// Update the friend request status
	now := time.Now()
	_, err = db.Exec(`
        UPDATE friends
        SET status = 'accepted', updated_at = $1
        WHERE user_id = $2 AND friend_id = $3 AND status = 'pending'`,
		now, friendID, userID)

	return err
}

// Decline a friend request
func declineFriendRequest(db *sql.DB, username, friendUsername string) error {
	// Get user IDs
	var userID, friendID int64

	err := db.QueryRow("SELECT id FROM users WHERE username = $1", username).Scan(&userID)
	if err != nil {
		return err
	}

	err = db.QueryRow("SELECT id FROM users WHERE username = $1", friendUsername).Scan(&friendID)
	if err != nil {
		return err
	}

	// Update the friend request status
	now := time.Now()
	_, err = db.Exec(`
        UPDATE friends
        SET status = 'declined', updated_at = $1
        WHERE user_id = $2 AND friend_id = $3 AND status = 'pending'`,
		now, friendID, userID)

	return err
}

// Remove a friend
func removeFriend(db *sql.DB, username, friendUsername string) error {
	// Get user IDs
	var userID, friendID int64

	err := db.QueryRow("SELECT id FROM users WHERE username = $1", username).Scan(&userID)
	if err != nil {
		return err
	}

	err = db.QueryRow("SELECT id FROM users WHERE username = $1", friendUsername).Scan(&friendID)
	if err != nil {
		return err
	}

	// Delete friend relationship in both directions
	_, err = db.Exec(`
        DELETE FROM friends
        WHERE (user_id = $1 AND friend_id = $2) OR (user_id = $2 AND friend_id = $1)`,
		userID, friendID)

	return err
}

// Get friends list for a user
func getFriends(db *sql.DB, username string) ([]User, error) {
	var userID int64

	err := db.QueryRow("SELECT id FROM users WHERE username = $1", username).Scan(&userID)
	if err != nil {
		return nil, err
	}

	// Get all accepted friends
	rows, err := db.Query(`
        SELECT u.id, u.username, u.email, u.created_at
        FROM users u
        JOIN friends f ON (u.id = f.friend_id AND f.user_id = $1) OR (u.id = f.user_id AND f.friend_id = $1)
        WHERE f.status = 'accepted' AND u.id != $1`,
		userID)

	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var friends []User
	for rows.Next() {
		var friend User
		err := rows.Scan(&friend.ID, &friend.Username, &friend.Email, &friend.CreatedAt)
		if err != nil {
			return nil, err
		}
		friends = append(friends, friend)
	}

	return friends, nil
}

// Get pending friend requests for a user
func getPendingFriendRequests(db *sql.DB, username string) ([]User, error) {
	var userID int64

	err := db.QueryRow("SELECT id FROM users WHERE username = $1", username).Scan(&userID)
	if err != nil {
		return nil, err
	}

	// Get all pending friend requests sent to this user
	rows, err := db.Query(`
        SELECT u.id, u.username, u.email, u.created_at
        FROM users u
        JOIN friends f ON u.id = f.user_id
        WHERE f.friend_id = $1 AND f.status = 'pending'`,
		userID)

	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var requesters []User
	for rows.Next() {
		var requester User
		err := rows.Scan(&requester.ID, &requester.Username, &requester.Email, &requester.CreatedAt)
		if err != nil {
			return nil, err
		}
		requesters = append(requesters, requester)
	}

	return requesters, nil
}
