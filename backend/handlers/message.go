package handlers

import (
	"chat-app/backend/database"
	"chat-app/backend/middleware"
	"chat-app/backend/models"
	"encoding/json"
	"net/http"
	"strconv"
)

// MessageRequest represents a request to send a message
type MessageRequest struct {
	RecipientID int    `json:"recipient_id"`
	Content     string `json:"content"`
}

// GetMessages retrieves messages between the current user and another user
func GetMessages(w http.ResponseWriter, r *http.Request) {
	// Get current user ID from context
	userID := middleware.GetUserIDFromContext(r.Context())
	if userID == 0 {
		http.Error(w, "Unauthorized", http.StatusUnauthorized)
		return
	}

	// Get other user ID from query parameters
	otherUserIDStr := r.URL.Query().Get("user_id")
	if otherUserIDStr == "" {
		http.Error(w, "User ID is required", http.StatusBadRequest)
		return
	}

	otherUserID, err := strconv.Atoi(otherUserIDStr)
	if err != nil {
		http.Error(w, "Invalid user ID", http.StatusBadRequest)
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
	messages, err := models.GetMessagesBetweenUsers(userID, otherUserID, limit, offset)
	if err != nil {
		http.Error(w, "Failed to get messages: "+err.Error(), http.StatusInternalServerError)
		return
	}

	// Mark messages as read
	for _, msg := range messages {
		if msg.RecipientID == userID && !msg.IsRead {
			models.MarkMessageAsRead(msg.ID)
		}
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(messages)
}

// SendMessage sends a message from the current user to another user
func SendMessage(w http.ResponseWriter, r *http.Request) {
	// Get current user ID from context
	userID := middleware.GetUserIDFromContext(r.Context())
	if userID == 0 {
		http.Error(w, "Unauthorized", http.StatusUnauthorized)
		return
	}

	// Parse request body
	var req MessageRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "Invalid request body", http.StatusBadRequest)
		return
	}

	// Validate input
	if req.RecipientID == 0 || req.Content == "" {
		http.Error(w, "Recipient ID and content are required", http.StatusBadRequest)
		return
	}

	// Create message
	message, err := models.CreateMessage(userID, req.RecipientID, req.Content)
	if err != nil {
		http.Error(w, "Failed to create message: "+err.Error(), http.StatusInternalServerError)
		return
	}

	// Publish message to Redis for real-time delivery
	messageJSON, _ := json.Marshal(message)
	channelName := "user:" + strconv.Itoa(req.RecipientID) + ":messages"
	database.PublishMessage(channelName, string(messageJSON))

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(message)
}
