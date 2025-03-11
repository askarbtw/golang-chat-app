package handlers

import (
	"chat-app/backend/database"
	"chat-app/backend/middleware"
	"chat-app/backend/models"
	"encoding/json"
	"log"
	"net/http"
	"strconv"
	"sync"
	"time"

	"github.com/gorilla/websocket"
)

// Client represents a connected WebSocket client
type Client struct {
	hub      *Hub
	conn     *websocket.Conn
	send     chan []byte
	userID   int
	username string
}

// Hub maintains the set of active clients and broadcasts messages
type Hub struct {
	clients    map[*Client]bool
	register   chan *Client
	unregister chan *Client
	broadcast  chan []byte
	userMap    map[int]*Client // Map user IDs to clients
	mutex      sync.Mutex      // Mutex to protect concurrent access to userMap
}

// WebSocketMessage represents a message sent over WebSocket
type WebSocketMessage struct {
	Type    string          `json:"type"`
	Content json.RawMessage `json:"content"`
}

var upgrader = websocket.Upgrader{
	ReadBufferSize:  1024,
	WriteBufferSize: 1024,
	CheckOrigin: func(r *http.Request) bool {
		return true // Allow all connections
	},
}

// NewHub creates a new Hub
func NewHub() *Hub {
	return &Hub{
		clients:    make(map[*Client]bool),
		register:   make(chan *Client),
		unregister: make(chan *Client),
		broadcast:  make(chan []byte),
		userMap:    make(map[int]*Client),
	}
}

// Run starts the Hub
func (h *Hub) Run() {
	for {
		select {
		case client := <-h.register:
			h.clients[client] = true
			h.mutex.Lock()
			h.userMap[client.userID] = client
			h.mutex.Unlock()

			// Set user as online in Redis
			database.SetUserOnlineStatus(strconv.Itoa(client.userID), true)

			// Broadcast user online status
			onlineMsg := struct {
				UserID   int  `json:"user_id"`
				IsOnline bool `json:"is_online"`
			}{
				UserID:   client.userID,
				IsOnline: true,
			}
			onlineMsgJSON, _ := json.Marshal(onlineMsg)
			statusMsg := WebSocketMessage{
				Type:    "status",
				Content: onlineMsgJSON,
			}
			statusMsgJSON, _ := json.Marshal(statusMsg)
			h.broadcast <- statusMsgJSON

		case client := <-h.unregister:
			if _, ok := h.clients[client]; ok {
				delete(h.clients, client)
				h.mutex.Lock()
				delete(h.userMap, client.userID)
				h.mutex.Unlock()
				close(client.send)

				// Set user as offline in Redis
				database.SetUserOnlineStatus(strconv.Itoa(client.userID), false)

				// Broadcast user offline status
				offlineMsg := struct {
					UserID   int  `json:"user_id"`
					IsOnline bool `json:"is_online"`
				}{
					UserID:   client.userID,
					IsOnline: false,
				}
				offlineMsgJSON, _ := json.Marshal(offlineMsg)
				statusMsg := WebSocketMessage{
					Type:    "status",
					Content: offlineMsgJSON,
				}
				statusMsgJSON, _ := json.Marshal(statusMsg)
				h.broadcast <- statusMsgJSON
			}

		case message := <-h.broadcast:
			for client := range h.clients {
				select {
				case client.send <- message:
				default:
					close(client.send)
					delete(h.clients, client)
					h.mutex.Lock()
					delete(h.userMap, client.userID)
					h.mutex.Unlock()
				}
			}
		}
	}
}

// SendToUser sends a message to a specific user
func (h *Hub) SendToUser(userID int, message []byte) {
	h.mutex.Lock()
	client, ok := h.userMap[userID]
	h.mutex.Unlock()

	if ok {
		select {
		case client.send <- message:
		default:
			close(client.send)
			delete(h.clients, client)
			h.mutex.Lock()
			delete(h.userMap, client.userID)
			h.mutex.Unlock()
		}
	}
}

// HandleWebSocket handles WebSocket connections
func HandleWebSocket(w http.ResponseWriter, r *http.Request) {
	// Get user ID from context
	userID := middleware.GetUserIDFromContext(r.Context())
	if userID == 0 {
		http.Error(w, "Unauthorized", http.StatusUnauthorized)
		return
	}

	// Get user from database
	user, err := models.GetUserByID(userID)
	if err != nil {
		http.Error(w, "User not found", http.StatusNotFound)
		return
	}

	// Upgrade HTTP connection to WebSocket
	conn, err := upgrader.Upgrade(w, r, nil)
	if err != nil {
		log.Println("Error upgrading to WebSocket:", err)
		return
	}

	// Create client
	client := &Client{
		hub:      hub,
		conn:     conn,
		send:     make(chan []byte, 256),
		userID:   userID,
		username: user.Username,
	}

	// Register client
	client.hub.register <- client

	// Update last seen
	models.UpdateLastSeen(userID)

	// Start goroutines for reading and writing
	go client.readPump()
	go client.writePump()

	// Subscribe to Redis channels for direct messages and room messages
	go subscribeToUserMessages(client)
}

// readPump pumps messages from the WebSocket connection to the hub
func (c *Client) readPump() {
	defer func() {
		c.hub.unregister <- c
		c.conn.Close()
	}()

	c.conn.SetReadLimit(512 * 1024) // 512KB max message size
	c.conn.SetReadDeadline(time.Now().Add(60 * time.Second))
	c.conn.SetPongHandler(func(string) error {
		c.conn.SetReadDeadline(time.Now().Add(60 * time.Second))
		return nil
	})

	for {
		_, message, err := c.conn.ReadMessage()
		if err != nil {
			if websocket.IsUnexpectedCloseError(err, websocket.CloseGoingAway, websocket.CloseAbnormalClosure) {
				log.Printf("WebSocket error: %v", err)
			}
			break
		}

		// Handle the message
		var wsMessage WebSocketMessage
		if err := json.Unmarshal(message, &wsMessage); err != nil {
			log.Printf("Error unmarshaling message: %v", err)
			continue
		}

		// Process message based on type
		switch wsMessage.Type {
		case "message":
			var messageData struct {
				RecipientID int    `json:"recipient_id"`
				Content     string `json:"content"`
			}
			if err := json.Unmarshal(wsMessage.Content, &messageData); err != nil {
				log.Printf("Error unmarshaling message content: %v", err)
				continue
			}

			// Create message in database
			msg, err := models.CreateMessage(c.userID, messageData.RecipientID, messageData.Content)
			if err != nil {
				log.Printf("Error creating message: %v", err)
				continue
			}

			// Send message to recipient
			msgJSON, _ := json.Marshal(msg)
			messageWrapper := WebSocketMessage{
				Type:    "message",
				Content: msgJSON,
			}
			messageWrapperJSON, _ := json.Marshal(messageWrapper)

			// Send to recipient if online
			c.hub.mutex.Lock()
			if recipient, ok := c.hub.userMap[messageData.RecipientID]; ok {
				recipient.send <- messageWrapperJSON
			}
			c.hub.mutex.Unlock()

		case "room_message":
			var messageData struct {
				RoomID  int    `json:"room_id"`
				Content string `json:"content"`
			}
			if err := json.Unmarshal(wsMessage.Content, &messageData); err != nil {
				log.Printf("Error unmarshaling room message content: %v", err)
				continue
			}

			// Create room message in database
			msg, err := models.CreateRoomMessage(messageData.RoomID, c.userID, messageData.Content)
			if err != nil {
				log.Printf("Error creating room message: %v", err)
				continue
			}

			// Publish message to Redis for room subscribers
			msgJSON, _ := json.Marshal(msg)
			messageWrapper := WebSocketMessage{
				Type:    "room_message",
				Content: msgJSON,
			}
			messageWrapperJSON, _ := json.Marshal(messageWrapper)

			channelName := "room:" + strconv.Itoa(messageData.RoomID) + ":messages"
			database.PublishMessage(channelName, string(messageWrapperJSON))

		case "typing":
			var typingData struct {
				RecipientID int  `json:"recipient_id"`
				IsTyping    bool `json:"is_typing"`
			}
			if err := json.Unmarshal(wsMessage.Content, &typingData); err != nil {
				log.Printf("Error unmarshaling typing content: %v", err)
				continue
			}

			// Create typing notification
			typingNotification := struct {
				SenderID int  `json:"sender_id"`
				IsTyping bool `json:"is_typing"`
			}{
				SenderID: c.userID,
				IsTyping: typingData.IsTyping,
			}
			typingJSON, _ := json.Marshal(typingNotification)
			typingWrapper := WebSocketMessage{
				Type:    "typing",
				Content: typingJSON,
			}
			typingWrapperJSON, _ := json.Marshal(typingWrapper)

			// Send to recipient if online
			c.hub.mutex.Lock()
			if recipient, ok := c.hub.userMap[typingData.RecipientID]; ok {
				recipient.send <- typingWrapperJSON
			}
			c.hub.mutex.Unlock()
		}
	}
}

// writePump pumps messages from the hub to the WebSocket connection
func (c *Client) writePump() {
	ticker := time.NewTicker(54 * time.Second)
	defer func() {
		ticker.Stop()
		c.conn.Close()
	}()

	for {
		select {
		case message, ok := <-c.send:
			c.conn.SetWriteDeadline(time.Now().Add(10 * time.Second))
			if !ok {
				// The hub closed the channel
				c.conn.WriteMessage(websocket.CloseMessage, []byte{})
				return
			}

			w, err := c.conn.NextWriter(websocket.TextMessage)
			if err != nil {
				return
			}
			w.Write(message)

			// Add queued messages to the current WebSocket message
			n := len(c.send)
			for i := 0; i < n; i++ {
				w.Write([]byte{'\n'})
				w.Write(<-c.send)
			}

			if err := w.Close(); err != nil {
				return
			}

		case <-ticker.C:
			c.conn.SetWriteDeadline(time.Now().Add(10 * time.Second))
			if err := c.conn.WriteMessage(websocket.PingMessage, nil); err != nil {
				return
			}
		}
	}
}

// subscribeToUserMessages subscribes to Redis channels for user messages
func subscribeToUserMessages(client *Client) {
	// Subscribe to direct messages
	userChannel := "user:" + strconv.Itoa(client.userID) + ":messages"
	pubsub := database.SubscribeToChannel(userChannel)
	defer pubsub.Close()

	// Listen for messages
	ch := pubsub.Channel()
	for msg := range ch {
		// Send message to client
		client.send <- []byte(msg.Payload)
	}
}

// Global hub instance
var hub = NewHub()
