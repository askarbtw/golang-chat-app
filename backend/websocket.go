package backend

import (
	"database/sql"
	"github.com/gorilla/websocket"
	"log"
	"net/http"
	"time"
)

var upgrader = websocket.Upgrader{
	ReadBufferSize:  1024,
	WriteBufferSize: 1024,
	CheckOrigin: func(r *http.Request) bool {
		return true // Allow all connections (in production, restrict this)
	},
}

func NewHub(db *sql.DB) *Hub {
	return &Hub{
		clients:    make(map[*Client]bool),
		broadcast:  make(chan Message),
		register:   make(chan *Client),
		unregister: make(chan *Client),
		db:         db,
	}
}

func (h *Hub) Run() {
	for {
		select {
		case client := <-h.register:
			h.clients[client] = true
			// Also send list of online users to the new client
			var onlineUsers []string
			for c := range h.clients {
				onlineUsers = append(onlineUsers, c.username)
			}
			client.conn.WriteJSON(map[string]interface{}{
				"type":  "users",
				"users": onlineUsers,
			})

			// Broadcast new user to all clients
			for c := range h.clients {
				if c != client {
					c.conn.WriteJSON(map[string]interface{}{
						"type":     "user_joined",
						"username": client.username,
					})
				}
			}

			// Send last 50 messages to new client
			messages, err := getLastMessages(h.db, client.username, 50)
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

				// Broadcast user left to all clients
				for c := range h.clients {
					c.conn.WriteJSON(map[string]interface{}{
						"type":     "user_left",
						"username": client.username,
					})
				}
			}

		case message := <-h.broadcast:
			// Save message to database
			id, err := saveMessage(h.db, message)
			if err != nil {
				log.Printf("Error saving message: %v", err)
			} else {
				message.ID = id
			}

			if message.IsPrivate {
				// Send private message only to sender and recipient
				for client := range h.clients {
					if client.username == message.Username || client.username == message.Recipient {
						err := client.conn.WriteJSON(message)
						if err != nil {
							log.Printf("Error sending private message: %v", err)
							client.conn.Close()
							delete(h.clients, client)
						}
					}
				}
			} else {
				// Broadcast to all clients (group chat)
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

		// Check if it's a private message
		message.IsPrivate = message.Recipient != ""

		c.hub.broadcast <- message
	}
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
