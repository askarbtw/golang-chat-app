package backend

import (
	"database/sql"
	"net/http"
)

func SetupRoutes(hub *Hub, db *sql.DB) {
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
}
