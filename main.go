package main

import (
	"database/sql"
	"encoding/json"
	"log"
	"net/http"
	"time"

	"github.com/dgrijalva/jwt-go"
	"github.com/gorilla/websocket"
	_ "github.com/mattn/go-sqlite3"
	"golang.org/x/crypto/bcrypt"
)

// User represents a registered user
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
	Content   string    `json:"content"`
	Timestamp time.Time `json:"timestamp"`
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

var upgrader = websocket.Upgrader{
	ReadBufferSize:  1024,
	WriteBufferSize: 1024,
	CheckOrigin: func(r *http.Request) bool {
		return true // Allow all connections (in production, restrict this)
	},
}

// Secret key for JWT signing - in production use environment variables
var jwtKey = []byte("your_secret_key")

func newHub(db *sql.DB) *Hub {
	return &Hub{
		clients:    make(map[*Client]bool),
		broadcast:  make(chan Message),
		register:   make(chan *Client),
		unregister: make(chan *Client),
		db:         db,
	}
}

func (h *Hub) run() {
	for {
		select {
		case client := <-h.register:
			h.clients[client] = true
			// Send last 50 messages to new client
			messages, err := getLastMessages(h.db, 50)
			if err != nil {
				log.Printf("Error fetching messages: %v", err)
				continue
			}
			for _, msg := range messages {
				client.conn.WriteJSON(msg)
			}
		case client := <-h.unregister:
			if _, ok := h.clients[client]; ok {
				delete(h.clients, client)
				client.conn.Close()
			}
		case message := <-h.broadcast:
			// Save message to database
			id, err := saveMessage(h.db, message)
			if err != nil {
				log.Printf("Error saving message: %v", err)
			} else {
				message.ID = id
			}

			// Broadcast to all clients
			for client := range h.clients {
				err := client.conn.WriteJSON(message)
				if err != nil {
					log.Printf("Error broadcasting: %v", err)
					client.conn.Close()
					delete(h.clients, client)
				}
			}
		}
	}
}

func (c *Client) readPump() {
	defer func() {
		c.hub.unregister <- c
	}()

	for {
		var message Message
		err := c.conn.ReadJSON(&message)
		if err != nil {
			if websocket.IsUnexpectedCloseError(err, websocket.CloseGoingAway, websocket.CloseAbnormalClosure) {
				log.Printf("Error: %v", err)
			}
			break
		}

		message.Username = c.username
		message.Timestamp = time.Now()

		c.hub.broadcast <- message
	}
}

// Generate JWT token
func generateToken(username string) (string, error) {
	expirationTime := time.Now().Add(24 * time.Hour)
	claims := &JWTClaim{
		Username: username,
		StandardClaims: jwt.StandardClaims{
			ExpiresAt: expirationTime.Unix(),
		},
	}

	token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
	return token.SignedString(jwtKey)
}

// Validate JWT token and extract username
func validateToken(tokenString string) (string, error) {
	token, err := jwt.ParseWithClaims(
		tokenString,
		&JWTClaim{},
		func(token *jwt.Token) (interface{}, error) {
			return jwtKey, nil
		},
	)

	if err != nil {
		return "", err
	}

	if claims, ok := token.Claims.(*JWTClaim); ok && token.Valid {
		return claims.Username, nil
	}

	return "", err
}

// Handle WebSocket connections with token authentication
func handleWebSocket(hub *Hub, w http.ResponseWriter, r *http.Request) {
	tokenString := r.URL.Query().Get("token")
	if tokenString == "" {
		http.Error(w, "Authentication required", http.StatusUnauthorized)
		return
	}

	username, err := validateToken(tokenString)
	if err != nil {
		http.Error(w, "Invalid token", http.StatusUnauthorized)
		return
	}

	conn, err := upgrader.Upgrade(w, r, nil)
	if err != nil {
		log.Println(err)
		return
	}

	client := &Client{
		conn:     conn,
		username: username,
		hub:      hub,
	}

	hub.register <- client

	go client.readPump()
}

// Handle user registration
func handleRegister(db *sql.DB) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodPost {
			http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
			return
		}

		var user User
		if err := json.NewDecoder(r.Body).Decode(&user); err != nil {
			http.Error(w, "Invalid request", http.StatusBadRequest)
			return
		}

		// Validate input
		if user.Username == "" || user.Password == "" {
			http.Error(w, "Username and password are required", http.StatusBadRequest)
			return
		}

		// Check if username already exists
		var exists bool
		err := db.QueryRow("SELECT EXISTS(SELECT 1 FROM users WHERE username = ?)", user.Username).Scan(&exists)
		if err != nil {
			log.Printf("Database error: %v", err)
			http.Error(w, "Internal server error", http.StatusInternalServerError)
			return
		}

		if exists {
			http.Error(w, "Username already exists", http.StatusConflict)
			return
		}

		// Hash the password
		hashedPassword, err := bcrypt.GenerateFromPassword([]byte(user.Password), bcrypt.DefaultCost)
		if err != nil {
			log.Printf("Error hashing password: %v", err)
			http.Error(w, "Internal server error", http.StatusInternalServerError)
			return
		}

		// Insert the new user
		stmt, err := db.Prepare("INSERT INTO users(username, password, email, created_at) VALUES(?, ?, ?, ?)")
		if err != nil {
			log.Printf("Database error: %v", err)
			http.Error(w, "Internal server error", http.StatusInternalServerError)
			return
		}
		defer stmt.Close()

		now := time.Now()
		result, err := stmt.Exec(user.Username, string(hashedPassword), user.Email, now)
		if err != nil {
			log.Printf("Database error: %v", err)
			http.Error(w, "Internal server error", http.StatusInternalServerError)
			return
		}

		id, _ := result.LastInsertId()
		user.ID = id
		user.CreatedAt = now
		user.Password = "" // Don't return the password

		// Generate token
		token, err := generateToken(user.Username)
		if err != nil {
			log.Printf("Token generation error: %v", err)
			http.Error(w, "Internal server error", http.StatusInternalServerError)
			return
		}

		// Return token and user data
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(AuthResponse{
			Token: token,
			User:  user,
		})
	}
}

// Handle user login
func handleLogin(db *sql.DB) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodPost {
			http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
			return
		}

		var creds Credentials
		if err := json.NewDecoder(r.Body).Decode(&creds); err != nil {
			http.Error(w, "Invalid request", http.StatusBadRequest)
			return
		}

		// Get user from database
		var user User
		var hashedPassword string
		err := db.QueryRow(
			"SELECT id, username, password, email, created_at FROM users WHERE username = ?",
			creds.Username,
		).Scan(&user.ID, &user.Username, &hashedPassword, &user.Email, &user.CreatedAt)

		if err != nil {
			if err == sql.ErrNoRows {
				http.Error(w, "Invalid credentials", http.StatusUnauthorized)
			} else {
				log.Printf("Database error: %v", err)
				http.Error(w, "Internal server error", http.StatusInternalServerError)
			}
			return
		}

		// Verify password
		if err := bcrypt.CompareHashAndPassword([]byte(hashedPassword), []byte(creds.Password)); err != nil {
			http.Error(w, "Invalid credentials", http.StatusUnauthorized)
			return
		}

		// Generate token
		token, err := generateToken(user.Username)
		if err != nil {
			log.Printf("Token generation error: %v", err)
			http.Error(w, "Internal server error", http.StatusInternalServerError)
			return
		}

		// Return token and user data
		user.Password = "" // Don't return the password
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(AuthResponse{
			Token: token,
			User:  user,
		})
	}
}

// Database functions
func initDB() (*sql.DB, error) {
	db, err := sql.Open("sqlite3", "./chat.db")
	if err != nil {
		return nil, err
	}

	// Create messages table if it doesn't exist
	_, err = db.Exec(`
		CREATE TABLE IF NOT EXISTS messages (
			id INTEGER PRIMARY KEY AUTOINCREMENT,
			username TEXT NOT NULL,
			content TEXT NOT NULL,
			timestamp DATETIME NOT NULL
		)
	`)
	if err != nil {
		return nil, err
	}

	// Create users table if it doesn't exist
	_, err = db.Exec(`
		CREATE TABLE IF NOT EXISTS users (
			id INTEGER PRIMARY KEY AUTOINCREMENT,
			username TEXT NOT NULL UNIQUE,
			password TEXT NOT NULL,
			email TEXT,
			created_at DATETIME NOT NULL
		)
	`)
	if err != nil {
		return nil, err
	}

	return db, nil
}

func saveMessage(db *sql.DB, msg Message) (int64, error) {
	stmt, err := db.Prepare("INSERT INTO messages(username, content, timestamp) VALUES(?, ?, ?)")
	if err != nil {
		return 0, err
	}
	defer stmt.Close()

	res, err := stmt.Exec(msg.Username, msg.Content, msg.Timestamp)
	if err != nil {
		return 0, err
	}

	return res.LastInsertId()
}

func getLastMessages(db *sql.DB, limit int) ([]Message, error) {
	rows, err := db.Query("SELECT id, username, content, timestamp FROM messages ORDER BY timestamp DESC LIMIT ?", limit)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var messages []Message
	for rows.Next() {
		var msg Message
		var timeStr string
		err := rows.Scan(&msg.ID, &msg.Username, &msg.Content, &timeStr)
		if err != nil {
			return nil, err
		}
		msg.Timestamp, _ = time.Parse("2006-01-02 15:04:05.999999999-07:00", timeStr)
		messages = append(messages, msg)
	}

	// Reverse the order to have oldest messages first
	for i, j := 0, len(messages)-1; i < j; i, j = i+1, j-1 {
		messages[i], messages[j] = messages[j], messages[i]
	}

	return messages, nil
}

func main() {
	db, err := initDB()
	if err != nil {
		log.Fatalf("Failed to initialize database: %v", err)
	}
	defer db.Close()

	hub := newHub(db)
	go hub.run()

	// Serve static files
	fs := http.FileServer(http.Dir("./static"))
	http.Handle("/", fs)

	// Authentication endpoints
	http.HandleFunc("/api/register", handleRegister(db))
	http.HandleFunc("/api/login", handleLogin(db))

	// WebSocket endpoint (now requires authentication)
	http.HandleFunc("/ws", func(w http.ResponseWriter, r *http.Request) {
		handleWebSocket(hub, w, r)
	})

	log.Println("Server starting on :8080")
	err = http.ListenAndServe(":8080", nil)
	if err != nil {
		log.Fatal("ListenAndServe: ", err)
	}
}
