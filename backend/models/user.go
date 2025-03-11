package models

import (
	"chat-app/backend/database"
	"database/sql"
	"errors"
	"time"

	"golang.org/x/crypto/bcrypt"
)

// User represents a user in the system
type User struct {
	ID        int       `json:"id"`
	Username  string    `json:"username"`
	Email     string    `json:"email"`
	Password  string    `json:"-"` // Don't expose password in JSON
	CreatedAt time.Time `json:"created_at"`
	LastSeen  time.Time `json:"last_seen"`
}

// CreateUser creates a new user in the database
func CreateUser(username, email, password string) (*User, error) {
	// Hash the password
	hashedPassword, err := bcrypt.GenerateFromPassword([]byte(password), bcrypt.DefaultCost)
	if err != nil {
		return nil, err
	}

	db := database.GetDB()
	var user User

	// Insert the user into the database
	err = db.QueryRow(
		"INSERT INTO users (username, email, password) VALUES ($1, $2, $3) RETURNING id, username, email, created_at, last_seen",
		username, email, string(hashedPassword),
	).Scan(&user.ID, &user.Username, &user.Email, &user.CreatedAt, &user.LastSeen)

	if err != nil {
		return nil, err
	}

	return &user, nil
}

// GetUserByID retrieves a user by their ID
func GetUserByID(id int) (*User, error) {
	db := database.GetDB()
	var user User

	err := db.QueryRow(
		"SELECT id, username, email, password, created_at, last_seen FROM users WHERE id = $1",
		id,
	).Scan(&user.ID, &user.Username, &user.Email, &user.Password, &user.CreatedAt, &user.LastSeen)

	if err == sql.ErrNoRows {
		return nil, errors.New("user not found")
	} else if err != nil {
		return nil, err
	}

	return &user, nil
}

// GetUserByUsername retrieves a user by their username
func GetUserByUsername(username string) (*User, error) {
	db := database.GetDB()
	var user User

	err := db.QueryRow(
		"SELECT id, username, email, password, created_at, last_seen FROM users WHERE username = $1",
		username,
	).Scan(&user.ID, &user.Username, &user.Email, &user.Password, &user.CreatedAt, &user.LastSeen)

	if err == sql.ErrNoRows {
		return nil, errors.New("user not found")
	} else if err != nil {
		return nil, err
	}

	return &user, nil
}

// GetAllUsers retrieves all users
func GetAllUsers() ([]User, error) {
	db := database.GetDB()
	rows, err := db.Query("SELECT id, username, email, created_at, last_seen FROM users")
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var users []User
	for rows.Next() {
		var user User
		if err := rows.Scan(&user.ID, &user.Username, &user.Email, &user.CreatedAt, &user.LastSeen); err != nil {
			return nil, err
		}
		users = append(users, user)
	}

	return users, nil
}

// UpdateLastSeen updates a user's last seen timestamp
func UpdateLastSeen(userID int) error {
	db := database.GetDB()
	_, err := db.Exec("UPDATE users SET last_seen = CURRENT_TIMESTAMP WHERE id = $1", userID)
	return err
}

// CheckPassword checks if the provided password matches the stored hash
func (u *User) CheckPassword(password string) bool {
	err := bcrypt.CompareHashAndPassword([]byte(u.Password), []byte(password))
	return err == nil
}
