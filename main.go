package main

import (
	"chat-app/backend"
	"fmt"
	"log"
	"net/http"
	"os"

	_ "github.com/lib/pq"
)

func main() {
	// Initialize database
	db, err := backend.InitDB()
	if err != nil {
		log.Fatalf("Failed to initialize database: %v", err)
	}
	defer db.Close()

	// Initialize Redis
	err = backend.InitRedis()
	if err != nil {
		log.Printf("Warning: Failed to initialize Redis: %v", err)
		log.Println("Continuing without Redis caching...")
	}

	hub := backend.NewHub(db)
	go hub.Run()

	backend.SetupRoutes(hub, db)

	// Get port from environment variable or use default
	port := os.Getenv("PORT")
	if port == "" {
		port = "8080"
		log.Println("Warning: Using default port 8080. Set PORT environment variable to override.")
	}

	log.Printf("Server starting on port %s", port)
	err = http.ListenAndServe(fmt.Sprintf(":%s", port), nil)
	if err != nil {
		log.Fatal("ListenAndServe: ", err)
	}
}
