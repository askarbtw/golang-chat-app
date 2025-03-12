package backend

import (
	"database/sql"
	"github.com/dgrijalva/jwt-go"
	"github.com/gorilla/websocket"
	"time"
)

// User for registered users
type User struct {
	ID        int64     `json:"id,omitempty"`
	Username  string    `json:"username"`
	Password  string    `json:"password"` // Never send password to client
	Email     string    `json:"email,omitempty"`
	CreatedAt time.Time `json:"created_at,omitempty"`
}

// Credentials for login requests
type Credentials struct {
	Username string `json:"username"`
	Password string `json:"password"`
}

// AuthResponse contains token and user info
type AuthResponse struct {
	Token string `json:"token"`
	User  User   `json:"user"`
}

// JWTClaim for token validation
type JWTClaim struct {
	Username string `json:"username"`
	jwt.StandardClaims
}

// Message represents a chat message
type Message struct {
	ID        int64     `json:"id,omitempty"`
	Username  string    `json:"username"`
	Recipient string    `json:"recipient,omitempty"` // For private messages
	Content   string    `json:"content"`
	Timestamp time.Time `json:"timestamp"`
	IsPrivate bool      `json:"isPrivate"`
}

// Client represents a connected websocket client
type Client struct {
	conn     *websocket.Conn
	username string
	hub      *Hub
}

// Hub manages all connected clients
type Hub struct {
	clients    map[*Client]bool
	broadcast  chan Message
	register   chan *Client
	unregister chan *Client
	db         *sql.DB
}
