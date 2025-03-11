package config

import (
	"os"
)

// Config holds application configuration
type Config struct {
	Port        string
	PostgresURL string
	RedisURL    string
	JWTSecret   string
}

// Load loads configuration from environment variables
func Load() (*Config, error) {
	port := os.Getenv("PORT")
	if port == "" {
		port = "8080"
	}

	postgresURL := os.Getenv("POSTGRES_URL")
	if postgresURL == "" {
		postgresURL = "postgres://postgres:askarbtw@localhost:5432/chatapp?sslmode=disable"
	}

	redisURL := os.Getenv("REDIS_URL")
	if redisURL == "" {
		redisURL = "redis://localhost:6379/0"
	}

	jwtSecret := os.Getenv("JWT_SECRET")
	if jwtSecret == "" {
		jwtSecret = "your-secret-key"
	}

	return &Config{
		Port:        port,
		PostgresURL: postgresURL,
		RedisURL:    redisURL,
		JWTSecret:   jwtSecret,
	}, nil
}
