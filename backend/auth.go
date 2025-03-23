package backend

import (
	"database/sql"
	"encoding/json"
	"log"
	"net/http"
	"os"
	"time"

	"github.com/dgrijalva/jwt-go"
	"golang.org/x/crypto/bcrypt"
)

// jwtKey retrieves the JWT secret key from environment variables or uses a fallback
func getJWTKey() []byte {
	// Get JWT secret from environment variable or use default
	jwtSecret := os.Getenv("JWT_SECRET")
	if jwtSecret == "" {
		// In production, this should never happen - always use environment variables
		jwtSecret = "your_secret_key"
		log.Println("Warning: Using default JWT secret key. Set JWT_SECRET environment variable in production!")
	}
	return []byte(jwtSecret)
}

// Generate JWT token
func generateToken(username string) (string, error) {
	expirationTime := time.Now().Add(30 * 24 * time.Hour)
	claims := &JWTClaim{
		Username: username,
		StandardClaims: jwt.StandardClaims{
			ExpiresAt: expirationTime.Unix(),
		},
	}

	token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
	return token.SignedString(getJWTKey())
}

// Validate JWT token and extract username
func validateToken(tokenString string) (string, error) {
	token, err := jwt.ParseWithClaims(
		tokenString,
		&JWTClaim{},
		func(token *jwt.Token) (interface{}, error) {
			return getJWTKey(), nil
		},
	)

	if err != nil {
		return "", err
	}

	if claims, ok := token.Claims.(*JWTClaim); ok && token.Valid {
		return claims.Username, nil
	}

	return "", err
}

// Handle user login
func handleLogin(db *sql.DB) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodPost {
			http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
			return
		}

		var creds Credentials
		if err := json.NewDecoder(r.Body).Decode(&creds); err != nil {
			http.Error(w, "Invalid request", http.StatusBadRequest)
			return
		}

		// Get user from database
		var user User
		var hashedPassword string
		err := db.QueryRow(
			"SELECT id, username, password, email, created_at FROM users WHERE username = $1",
			creds.Username,
		).Scan(&user.ID, &user.Username, &hashedPassword, &user.Email, &user.CreatedAt)

		if err != nil {
			if err == sql.ErrNoRows {
				http.Error(w, "Invalid credentials", http.StatusUnauthorized)
			} else {
				log.Printf("Database error: %v", err)
				http.Error(w, "Internal server error", http.StatusInternalServerError)
			}
			return
		}

		// Verify password
		if err := bcrypt.CompareHashAndPassword([]byte(hashedPassword), []byte(creds.Password)); err != nil {
			http.Error(w, "Invalid credentials", http.StatusUnauthorized)
			return
		}

		// Generate token
		token, err := generateToken(user.Username)
		if err != nil {
			log.Printf("Token generation error: %v", err)
			http.Error(w, "Internal server error", http.StatusInternalServerError)
			return
		}

		// Return token and user data
		user.Password = "" // Don't return the password
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(AuthResponse{
			Token: token,
			User:  user,
		})
	}
}

// Handle user registration
func handleRegister(db *sql.DB) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodPost {
			http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
			return
		}

		var user User
		if err := json.NewDecoder(r.Body).Decode(&user); err != nil {
			http.Error(w, "Invalid request", http.StatusBadRequest)
			return
		}

		// Validate input
		if user.Username == "" || user.Password == "" {
			http.Error(w, "Username and password are required", http.StatusBadRequest)
			return
		}

		// Check if username already exists
		var exists bool
		err := db.QueryRow("SELECT EXISTS(SELECT 1 FROM users WHERE username = $1)", user.Username).Scan(&exists)
		if err != nil {
			log.Printf("Database error: %v", err)
			http.Error(w, "Internal server error", http.StatusInternalServerError)
			return
		}

		if exists {
			http.Error(w, "Username already exists", http.StatusConflict)
			return
		}

		// Hash the password
		hashedPassword, err := bcrypt.GenerateFromPassword([]byte(user.Password), bcrypt.DefaultCost)
		if err != nil {
			log.Printf("Error hashing password: %v", err)
			http.Error(w, "Internal server error", http.StatusInternalServerError)
			return
		}

		// Insert the new user
		stmt, err := db.Prepare("INSERT INTO users(username, password, email, created_at) VALUES($1, $2, $3, $4)")
		if err != nil {
			log.Printf("Database error: %v", err)
			http.Error(w, "Internal server error", http.StatusInternalServerError)
			return
		}
		defer stmt.Close()

		now := time.Now()
		result, err := stmt.Exec(user.Username, string(hashedPassword), user.Email, now)
		if err != nil {
			log.Printf("Database error: %v", err)
			http.Error(w, "Internal server error", http.StatusInternalServerError)
			return
		}

		id, _ := result.LastInsertId()
		user.ID = id
		user.CreatedAt = now
		user.Password = "" // Don't return the password

		// Generate token
		token, err := generateToken(user.Username)
		if err != nil {
			log.Printf("Token generation error: %v", err)
			http.Error(w, "Internal server error", http.StatusInternalServerError)
			return
		}

		// Return token and user data
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(AuthResponse{
			Token: token,
			User:  user,
		})
	}
}
