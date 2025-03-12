package main

import (
	"chat-app/backend"
	_ "github.com/lib/pq"
	"log"
	"net/http"
)

func main() {
	db, err := backend.InitDB()
	if err != nil {
		log.Fatalf("Failed to initialize database: %v", err)
	}
	defer db.Close()

	hub := backend.NewHub(db)
	go hub.Run()

	backend.SetupRoutes(hub, db)

	log.Println("Server starting on :8080")
	err = http.ListenAndServe(":8080", nil)
	if err != nil {
		log.Fatal("ListenAndServe: ", err)
	}
}
