package main

import (
	"chat-app/backend/config"
	"chat-app/backend/database"
	"chat-app/backend/handlers"
	"chat-app/backend/middleware"
	"log"
	"net/http"

	"github.com/gorilla/mux"
)

func main() {
	// Load configuration
	cfg, err := config.Load()
	if err != nil {
		log.Fatalf("Failed to load configuration: %v", err)
	}

	// Initialize database connection
	if err := database.InitPostgres(cfg.PostgresURL); err != nil {
		log.Fatalf("Failed to connect to PostgreSQL: %v", err)
	}
	defer database.ClosePostgres()

	// Initialize Redis connection
	if err := database.InitRedis(cfg.RedisURL); err != nil {
		log.Fatalf("Failed to connect to Redis: %v", err)
	}
	defer database.CloseRedis()

	// Create router
	r := mux.NewRouter()

	// API routes
	api := r.PathPrefix("/api").Subrouter()
	api.HandleFunc("/register", handlers.Register).Methods("POST")
	api.HandleFunc("/login", handlers.Login).Methods("POST")

	// Protected routes
	protected := r.PathPrefix("/api").Subrouter()
	protected.Use(middleware.AuthMiddleware)
	protected.HandleFunc("/users", handlers.GetUsers).Methods("GET")
	protected.HandleFunc("/messages", handlers.GetMessages).Methods("GET")
	protected.HandleFunc("/messages", handlers.SendMessage).Methods("POST")

	// WebSocket route
	r.HandleFunc("/ws", handlers.HandleWebSocket)

	// Serve static files
	fs := http.FileServer(http.Dir("./public"))
	r.PathPrefix("/").Handler(fs)

	// Start WebSocket hub
	hub := handlers.NewHub()
	go hub.Run()

	// Start server
	port := cfg.Port
	log.Printf("Server starting on port %s", port)
	if err := http.ListenAndServe(":"+port, r); err != nil {
		log.Fatalf("Failed to start server: %v", err)
	}
}
