package backend

import (
	"database/sql"
	"log"
	"net/http"
	"time"

	"github.com/gorilla/websocket"
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

			// Send the online users list to all clients
			var onlineUsers []string
			for c := range h.clients {
				onlineUsers = append(onlineUsers, c.username)
			}

			// Send to all clients
			for c := range h.clients {
				c.conn.WriteJSON(map[string]interface{}{
					"type":  "users",
					"users": onlineUsers,
				})
			}

			// Send last 50 messages to new client
			messages, err := getLastMessages(h.db, client.username, 50)
			if err != nil {
				log.Printf("Error fetching messages: %v", err)
				continue
			}

			for _, msg := range messages {
				// Format to match the React client's expected structure
				messageData := map[string]interface{}{
					"type":      "message",
					"sender":    msg.Username,
					"recipient": msg.Recipient,
					"content":   msg.Content,
					"timestamp": msg.Timestamp,
				}
				client.conn.WriteJSON(messageData)
			}

		case client := <-h.unregister:
			if _, ok := h.clients[client]; ok {
				delete(h.clients, client)
				client.conn.Close()

				// Clear Redis cache for this user when they disconnect
				// This is optional - we could keep the cache, but clearing it
				// ensures that any changes made while the user was offline will be
				// visible when they reconnect (by forcing a DB fetch)
				if redisClient != nil {
					err := ClearUserCache(client.username)
					if err != nil {
						log.Printf("Error clearing Redis cache for user %s: %v", client.username, err)
					}
				}

				// Update online users list and broadcast
				var onlineUsers []string
				for c := range h.clients {
					onlineUsers = append(onlineUsers, c.username)
				}

				// Send to all remaining clients
				for c := range h.clients {
					c.conn.WriteJSON(map[string]interface{}{
						"type":  "users",
						"users": onlineUsers,
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

			// Format message for clients
			messageData := map[string]interface{}{
				"type":      "message",
				"id":        message.ID,
				"sender":    message.Username,
				"recipient": message.Recipient,
				"content":   message.Content,
				"timestamp": message.Timestamp,
				"clientId":  message.ClientId,
			}

			if message.Recipient != "all" && message.Recipient != "" {
				// Send private message only to sender and recipient
				for client := range h.clients {
					if client.username == message.Username || client.username == message.Recipient {
						err := client.conn.WriteJSON(messageData)
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
					err := client.conn.WriteJSON(messageData)
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
		// Read message as a generic map to handle different message types
		var messageData map[string]interface{}
		err := c.conn.ReadJSON(&messageData)
		if err != nil {
			if websocket.IsUnexpectedCloseError(err, websocket.CloseGoingAway, websocket.CloseAbnormalClosure) {
				log.Printf("Error: %v", err)
			}
			break
		}

		// Handle different message types
		msgType, ok := messageData["type"].(string)
		if !ok {
			log.Printf("Missing message type")
			continue
		}

		switch msgType {
		case "auth":
			// Authentication message - already handled during connection
			// But we could validate the token again if needed
			continue

		case "message":
			// Get the content and recipient
			content, contentOk := messageData["content"].(string)
			recipient, recipientOk := messageData["recipient"].(string)
			clientId, _ := messageData["clientId"].(string)

			if !contentOk {
				log.Printf("Missing message content")
				continue
			}

			// Check if client sent a timestamp
			var timestamp time.Time
			if ts, ok := messageData["timestamp"].(string); ok {
				// Try to parse the client timestamp
				parsedTime, err := time.Parse(time.RFC3339, ts)
				if err == nil {
					timestamp = parsedTime
				} else {
					// If parsing fails, use current time
					timestamp = time.Now()
					log.Printf("Error parsing client timestamp: %v, using server time", err)
				}
			} else {
				// No timestamp provided, use current time
				timestamp = time.Now()
			}

			// Create a new message
			message := Message{
				Username:  c.username,
				Content:   content,
				Timestamp: timestamp,
				IsPrivate: recipientOk && recipient != "all" && recipient != "",
				ClientId:  clientId,
			}

			if recipientOk {
				message.Recipient = recipient
			} else {
				message.Recipient = "all" // Default to all
			}

			c.hub.broadcast <- message

		default:
			log.Printf("Unknown message type: %s", msgType)
		}
	}
}

// Handle WebSocket connections with token authentication
func handleWebSocket(hub *Hub, w http.ResponseWriter, r *http.Request) {
	// Check for token in query parameters first
	tokenString := r.URL.Query().Get("token")
	if tokenString != "" {
		// Validate token and establish connection
		username, err := validateToken(tokenString)
		if err != nil {
			log.Println("Invalid token in URL parameter:", err)
			// Use HTTP error before upgrading
			http.Error(w, "Invalid token", http.StatusUnauthorized)
			return
		}

		// Token is valid, upgrade the connection
		conn, err := upgrader.Upgrade(w, r, nil)
		if err != nil {
			log.Println("Upgrade error:", err)
			return
		}

		// Create client and register
		client := &Client{
			conn:     conn,
			username: username,
			hub:      hub,
		}

		hub.register <- client
		go client.readPump()
		return
	}

	// If no token in URL, try Authorization header
	tokenString = r.Header.Get("Authorization")
	if tokenString != "" {
		// Validate token and establish connection
		username, err := validateToken(tokenString)
		if err != nil {
			log.Println("Invalid token in header:", err)
			http.Error(w, "Invalid token", http.StatusUnauthorized)
			return
		}

		// Token is valid, upgrade the connection
		conn, err := upgrader.Upgrade(w, r, nil)
		if err != nil {
			log.Println("Upgrade error:", err)
			return
		}

		// Create client and register
		client := &Client{
			conn:     conn,
			username: username,
			hub:      hub,
		}

		hub.register <- client
		go client.readPump()
		return
	}

	// Last resort: Upgrade connection first, then expect an auth message
	// This approach is more error-prone and we now prefer the methods above
	conn, err := upgrader.Upgrade(w, r, nil)
	if err != nil {
		log.Println("Upgrade error:", err)
		return
	}

	// Set a read deadline for the auth message
	conn.SetReadDeadline(time.Now().Add(10 * time.Second))

	// Read the first message, expecting an auth message
	var authMsg map[string]interface{}
	err = conn.ReadJSON(&authMsg)

	// Reset the read deadline
	conn.SetReadDeadline(time.Time{})

	if err != nil {
		log.Println("Failed to read auth message:", err)
		conn.WriteJSON(map[string]string{
			"type":    "error",
			"message": "Authentication timeout or error",
		})
		conn.Close()
		return
	}

	// Check if it's an auth message and has a token
	if msgType, ok := authMsg["type"].(string); ok && msgType == "auth" {
		if token, ok := authMsg["token"].(string); ok {
			tokenString = token
		}
	}

	if tokenString == "" {
		log.Println("No token provided in auth message")
		conn.WriteJSON(map[string]string{
			"type":    "error",
			"message": "Authentication required",
		})
		conn.Close()
		return
	}

	// Validate the token
	username, err := validateToken(tokenString)
	if err != nil {
		log.Println("Invalid token in message:", err)
		conn.WriteJSON(map[string]string{
			"type":    "error",
			"message": "Invalid token",
		})
		conn.Close()
		return
	}

	// Create client and register
	client := &Client{
		conn:     conn,
		username: username,
		hub:      hub,
	}

	hub.register <- client
	go client.readPump()
}
