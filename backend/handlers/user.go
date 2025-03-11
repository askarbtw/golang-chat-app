package handlers

import (
	"chat-app/backend/database"
	"chat-app/backend/models"
	"encoding/json"
	"net/http"
	"strconv"
)

// GetUsers returns a list of all users
func GetUsers(w http.ResponseWriter, r *http.Request) {
	users, err := models.GetAllUsers()
	if err != nil {
		http.Error(w, "Failed to get users: "+err.Error(), http.StatusInternalServerError)
		return
	}

	// Add online status to each user
	type UserWithStatus struct {
		models.User
		IsOnline bool `json:"is_online"`
	}

	var usersWithStatus []UserWithStatus
	for _, user := range users {
		isOnline, _ := database.IsUserOnline(strconv.Itoa(user.ID))
		usersWithStatus = append(usersWithStatus, UserWithStatus{
			User:     user,
			IsOnline: isOnline,
		})
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(usersWithStatus)
}

// GetUserByID returns a user by ID
func GetUserByID(w http.ResponseWriter, r *http.Request) {
	// Extract user ID from URL parameters
	userID := r.URL.Query().Get("id")
	if userID == "" {
		http.Error(w, "User ID is required", http.StatusBadRequest)
		return
	}

	id, err := strconv.Atoi(userID)
	if err != nil {
		http.Error(w, "Invalid user ID", http.StatusBadRequest)
		return
	}

	user, err := models.GetUserByID(id)
	if err != nil {
		http.Error(w, "Failed to get user: "+err.Error(), http.StatusNotFound)
		return
	}

	// Get online status
	isOnline, _ := database.IsUserOnline(userID)

	// Create response with online status
	response := struct {
		models.User
		IsOnline bool `json:"is_online"`
	}{
		User:     *user,
		IsOnline: isOnline,
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(response)
}
