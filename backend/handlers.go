package backend

import (
	"database/sql"
	"encoding/json"
	"net/http"
	"path/filepath"
)

func SetupRoutes(hub *Hub, db *sql.DB) {
	// Serve static files from the React build
	fs := http.FileServer(http.Dir("./frontend/build"))

	// Handle all routes for the React SPA
	http.HandleFunc("/", func(w http.ResponseWriter, r *http.Request) {
		// For API and WebSocket requests, don't try to serve the index.html file
		if r.URL.Path == "/" || r.URL.Path == "/index.html" ||
			!filepath.HasPrefix(r.URL.Path, "/api") &&
				!filepath.HasPrefix(r.URL.Path, "/ws") &&
				!filepath.HasPrefix(r.URL.Path, "/static") {
			// Serve index.html for any route the client requests
			// This enables React Router to handle client-side routing
			http.ServeFile(w, r, "./frontend/build/index.html")
			return
		}

		// For other requests, use the file server
		fs.ServeHTTP(w, r)
	})

	// Authentication endpoints
	http.HandleFunc("/api/register", handleRegister(db))
	http.HandleFunc("/api/login", handleLogin(db))

	// WebSocket endpoint (now requires authentication)
	http.HandleFunc("/ws", func(w http.ResponseWriter, r *http.Request) {
		handleWebSocket(hub, w, r)
	})

	// Friend management endpoints
	http.HandleFunc("/api/friends", withAuth(handleFriends(db)))
	http.HandleFunc("/api/friends/request", withAuth(handleFriendRequest(db)))
	http.HandleFunc("/api/friends/accept", withAuth(handleFriendAccept(db)))
	http.HandleFunc("/api/friends/decline", withAuth(handleFriendDecline(db)))
	http.HandleFunc("/api/friends/remove", withAuth(handleFriendRemove(db)))
	http.HandleFunc("/api/friends/pending", withAuth(handlePendingFriendRequests(db)))
}

// Middleware to check authentication
func withAuth(next http.HandlerFunc) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		token := r.Header.Get("Authorization")
		if token == "" {
			http.Error(w, "Authentication required", http.StatusUnauthorized)
			return
		}

		username, err := validateToken(token)
		if err != nil {
			http.Error(w, "Invalid token", http.StatusUnauthorized)
			return
		}

		// Add the username to the request context
		r.Header.Set("X-User", username)
		next(w, r)
	}
}

// Handler for getting the friends list
func handleFriends(db *sql.DB) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodGet {
			http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
			return
		}

		username := r.Header.Get("X-User")
		friends, err := getFriends(db, username)
		if err != nil {
			http.Error(w, "Internal server error", http.StatusInternalServerError)
			return
		}

		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(friends)
	}
}

// Handler for sending a friend request
func handleFriendRequest(db *sql.DB) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodPost {
			http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
			return
		}

		var request struct {
			FriendUsername string `json:"friend_username"`
		}

		if err := json.NewDecoder(r.Body).Decode(&request); err != nil {
			http.Error(w, "Invalid request", http.StatusBadRequest)
			return
		}

		username := r.Header.Get("X-User")

		// Check if trying to add self
		if username == request.FriendUsername {
			http.Error(w, "Cannot add yourself as a friend", http.StatusBadRequest)
			return
		}

		// Check if friend exists
		var exists bool
		err := db.QueryRow("SELECT EXISTS(SELECT 1 FROM users WHERE username = $1)", request.FriendUsername).Scan(&exists)
		if err != nil {
			http.Error(w, "Internal server error", http.StatusInternalServerError)
			return
		}

		if !exists {
			http.Error(w, "User not found", http.StatusNotFound)
			return
		}

		err = addFriendRequest(db, username, request.FriendUsername)
		if err != nil {
			http.Error(w, "Internal server error", http.StatusInternalServerError)
			return
		}

		w.WriteHeader(http.StatusOK)
		json.NewEncoder(w).Encode(map[string]string{"status": "success"})
	}
}

// Handler for accepting a friend request
func handleFriendAccept(db *sql.DB) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodPost {
			http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
			return
		}

		var request struct {
			FriendUsername string `json:"friend_username"`
		}

		if err := json.NewDecoder(r.Body).Decode(&request); err != nil {
			http.Error(w, "Invalid request", http.StatusBadRequest)
			return
		}

		username := r.Header.Get("X-User")
		err := acceptFriendRequest(db, username, request.FriendUsername)
		if err != nil {
			http.Error(w, "Internal server error", http.StatusInternalServerError)
			return
		}

		w.WriteHeader(http.StatusOK)
		json.NewEncoder(w).Encode(map[string]string{"status": "success"})
	}
}

// Handler for declining a friend request
func handleFriendDecline(db *sql.DB) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodPost {
			http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
			return
		}

		var request struct {
			FriendUsername string `json:"friend_username"`
		}

		if err := json.NewDecoder(r.Body).Decode(&request); err != nil {
			http.Error(w, "Invalid request", http.StatusBadRequest)
			return
		}

		username := r.Header.Get("X-User")
		err := declineFriendRequest(db, username, request.FriendUsername)
		if err != nil {
			http.Error(w, "Internal server error", http.StatusInternalServerError)
			return
		}

		w.WriteHeader(http.StatusOK)
		json.NewEncoder(w).Encode(map[string]string{"status": "success"})
	}
}

// Handler for removing a friend
func handleFriendRemove(db *sql.DB) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodPost {
			http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
			return
		}

		var request struct {
			FriendUsername string `json:"friend_username"`
		}

		if err := json.NewDecoder(r.Body).Decode(&request); err != nil {
			http.Error(w, "Invalid request", http.StatusBadRequest)
			return
		}

		username := r.Header.Get("X-User")
		err := removeFriend(db, username, request.FriendUsername)
		if err != nil {
			http.Error(w, "Internal server error", http.StatusInternalServerError)
			return
		}

		w.WriteHeader(http.StatusOK)
		json.NewEncoder(w).Encode(map[string]string{"status": "success"})
	}
}

// Handler for getting pending friend requests
func handlePendingFriendRequests(db *sql.DB) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodGet {
			http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
			return
		}

		username := r.Header.Get("X-User")
		requests, err := getPendingFriendRequests(db, username)
		if err != nil {
			http.Error(w, "Internal server error", http.StatusInternalServerError)
			return
		}

		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(requests)
	}
}
