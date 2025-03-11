package database

import (
	"database/sql"
	"fmt"
	_ "github.com/lib/pq"
)

var db *sql.DB

// InitPostgres initializes the PostgreSQL database connection
func InitPostgres(connStr string) error {
	var err error
	db, err = sql.Open("postgres", connStr)
	if err != nil {
		return err
	}

	if err = db.Ping(); err != nil {
		return err
	}

	// Create tables if they don't exist
	if err = createTables(); err != nil {
		return err
	}

	fmt.Println("Connected to PostgreSQL database")
	return nil
}

// ClosePostgres closes the PostgreSQL database connection
func ClosePostgres() {
	if db != nil {
		db.Close()
	}
}

// GetDB returns the database connection
func GetDB() *sql.DB {
	return db
}

// createTables creates the necessary tables if they don't exist
func createTables() error {
	// Create users table
	_, err := db.Exec(`
		CREATE TABLE IF NOT EXISTS users (
			id SERIAL PRIMARY KEY,
			username VARCHAR(50) UNIQUE NOT NULL,
			password VARCHAR(100) NOT NULL,
			email VARCHAR(100) UNIQUE NOT NULL,
			created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
			last_seen TIMESTAMP DEFAULT CURRENT_TIMESTAMP
		)
	`)
	if err != nil {
		return err
	}

	// Create messages table
	_, err = db.Exec(`
		CREATE TABLE IF NOT EXISTS messages (
			id SERIAL PRIMARY KEY,
			sender_id INTEGER REFERENCES users(id),
			recipient_id INTEGER REFERENCES users(id),
			content TEXT NOT NULL,
			created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
			is_read BOOLEAN DEFAULT FALSE
		)
	`)
	if err != nil {
		return err
	}

	// Create chat_rooms table
	_, err = db.Exec(`
		CREATE TABLE IF NOT EXISTS chat_rooms (
			id SERIAL PRIMARY KEY,
			name VARCHAR(100) NOT NULL,
			created_by INTEGER REFERENCES users(id),
			created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
		)
	`)
	if err != nil {
		return err
	}

	// Create room_messages table
	_, err = db.Exec(`
		CREATE TABLE IF NOT EXISTS room_messages (
			id SERIAL PRIMARY KEY,
			room_id INTEGER REFERENCES chat_rooms(id),
			sender_id INTEGER REFERENCES users(id),
			content TEXT NOT NULL,
			created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
		)
	`)
	if err != nil {
		return err
	}

	// Create room_members table
	_, err = db.Exec(`
		CREATE TABLE IF NOT EXISTS room_members (
			room_id INTEGER REFERENCES chat_rooms(id),
			user_id INTEGER REFERENCES users(id),
			joined_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
			PRIMARY KEY (room_id, user_id)
		)
	`)
	return err
}
