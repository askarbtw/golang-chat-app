package handlers

import (
	"chat-app/backend/database"
	"chat-app/backend/middleware"
	"chat-app/backend/models"
	"encoding/json"
	"net/http"
	"strconv"
)

// RoomRequest represents a request to create a chat room
type RoomRequest struct {
	Name string `json:"name"`
}

// RoomMessageRequest represents a request to send a message to a room
type RoomMessageRequest struct {
	Content string `json:"content"`
}

// CreateRoom creates a new chat room
func CreateRoom(w http.ResponseWriter, r *http.Request) {
	// Get current user ID from context
	userID := middleware.GetUserIDFromContext(r.Context())
	if userID == 0 {
		http.Error(w, "Unauthorized", http.StatusUnauthorized)
		return
	}

	// Parse request body
	var req RoomRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "Invalid request body", http.StatusBadRequest)
		return
	}

	// Validate input
	if req.Name == "" {
		http.Error(w, "Room name is required", http.StatusBadRequest)
		return
	}

	// Create room
	room, err := models.CreateChatRoom(req.Name, userID)
	if err != nil {
		http.Error(w, "Failed to create room: "+err.Error(), http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(room)
}

// GetRooms retrieves all rooms the current user is a member of
func GetRooms(w http.ResponseWriter, r *http.Request) {
	// Get current user ID from context
	userID := middleware.GetUserIDFromContext(r.Context())
	if userID == 0 {
		http.Error(w, "Unauthorized", http.StatusUnauthorized)
		return
	}

	// Get rooms
	rooms, err := models.GetRoomsByUserID(userID)
	if err != nil {
		http.Error(w, "Failed to get rooms: "+err.Error(), http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(rooms)
}

// GetRoomMessages retrieves messages from a chat room
func GetRoomMessages(w http.ResponseWriter, r *http.Request) {
	// Get current user ID from context
	userID := middleware.GetUserIDFromContext(r.Context())
	if userID == 0 {
		http.Error(w, "Unauthorized", http.StatusUnauthorized)
		return
	}

	// Get room ID from query parameters
	roomIDStr := r.URL.Query().Get("room_id")
	if roomIDStr == "" {
		http.Error(w, "Room ID is required", http.StatusBadRequest)
		return
	}

	roomID, err := strconv.Atoi(roomIDStr)
	if err != nil {
		http.Error(w, "Invalid room ID", http.StatusBadRequest)
		return
	}

	// Get pagination parameters
	limitStr := r.URL.Query().Get("limit")
	offsetStr := r.URL.Query().Get("offset")

	limit := 50 // Default limit
	if limitStr != "" {
		if parsedLimit, err := strconv.Atoi(limitStr); err == nil && parsedLimit > 0 {
			limit = parsedLimit
		}
	}

	offset := 0 // Default offset
	if offsetStr != "" {
		if parsedOffset, err := strconv.Atoi(offsetStr); err == nil && parsedOffset >= 0 {
			offset = parsedOffset
		}
	}

	// Get messages
	messages, err := models.GetRoomMessages(roomID, limit, offset)
	if err != nil {
		http.Error(w, "Failed to get messages: "+err.Error(), http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(messages)
}

// SendRoomMessage sends a message to a chat room
func SendRoomMessage(w http.ResponseWriter, r *http.Request) {
	// Get current user ID from context
	userID := middleware.GetUserIDFromContext(r.Context())
	if userID == 0 {
		http.Error(w, "Unauthorized", http.StatusUnauthorized)
		return
	}

	// Get room ID from URL parameters
	roomIDStr := r.URL.Query().Get("room_id")
	if roomIDStr == "" {
		http.Error(w, "Room ID is required", http.StatusBadRequest)
		return
	}

	roomID, err := strconv.Atoi(roomIDStr)
	if err != nil {
		http.Error(w, "Invalid room ID", http.StatusBadRequest)
		return
	}

	// Parse request body
	var req RoomMessageRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "Invalid request body", http.StatusBadRequest)
		return
	}

	// Validate input
	if req.Content == "" {
		http.Error(w, "Message content is required", http.StatusBadRequest)
		return
	}

	// Create message
	message, err := models.CreateRoomMessage(roomID, userID, req.Content)
	if err != nil {
		http.Error(w, "Failed to create message: "+err.Error(), http.StatusInternalServerError)
		return
	}

	// Publish message to Redis for real-time delivery
	messageJSON, _ := json.Marshal(message)
	channelName := "room:" + strconv.Itoa(roomID) + ":messages"
	database.PublishMessage(channelName, string(messageJSON))

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(message)
}

// AddUserToRoom adds a user to a chat room
func AddUserToRoom(w http.ResponseWriter, r *http.Request) {
	// Get current user ID from context
	userID := middleware.GetUserIDFromContext(r.Context())
	if userID == 0 {
		http.Error(w, "Unauthorized", http.StatusUnauthorized)
		return
	}

	// Parse request body
	var req struct {
		RoomID int `json:"room_id"`
		UserID int `json:"user_id"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "Invalid request body", http.StatusBadRequest)
		return
	}

	// Validate input
	if req.RoomID == 0 || req.UserID == 0 {
		http.Error(w, "Room ID and user ID are required", http.StatusBadRequest)
		return
	}

	// Add user to room
	if err := models.AddUserToRoom(req.RoomID, req.UserID); err != nil {
		http.Error(w, "Failed to add user to room: "+err.Error(), http.StatusInternalServerError)
		return
	}

	w.WriteHeader(http.StatusOK)
	w.Write([]byte(`{"message": "User added to room successfully"}`))
}

// GetRoomMembers retrieves all members of a chat room
func GetRoomMembers(w http.ResponseWriter, r *http.Request) {
	// Get current user ID from context
	userID := middleware.GetUserIDFromContext(r.Context())
	if userID == 0 {
		http.Error(w, "Unauthorized", http.StatusUnauthorized)
		return
	}

	// Get room ID from query parameters
	roomIDStr := r.URL.Query().Get("room_id")
	if roomIDStr == "" {
		http.Error(w, "Room ID is required", http.StatusBadRequest)
		return
	}

	roomID, err := strconv.Atoi(roomIDStr)
	if err != nil {
		http.Error(w, "Invalid room ID", http.StatusBadRequest)
		return
	}

	// Get room members
	members, err := models.GetRoomMembers(roomID)
	if err != nil {
		http.Error(w, "Failed to get room members: "+err.Error(), http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(members)
}
