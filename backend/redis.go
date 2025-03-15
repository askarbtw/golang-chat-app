package backend

import (
	"context"
	"encoding/json"
	"fmt"
	"log"
	"os"
	"strconv"
	"time"

	redis "github.com/go-redis/redis/v8"
)

var (
	redisClient *redis.Client
	ctx         = context.Background()
)

// InitRedis initializes the Redis client
func InitRedis() error {
	// Get Redis address and password from environment variables or use defaults
	redisAddr := os.Getenv("REDIS_ADDRESS")
	if redisAddr == "" {
		redisAddr = "localhost:6379"
		log.Println("Warning: Using default Redis address. Set REDIS_ADDRESS environment variable to override.")
	}

	redisPassword := os.Getenv("REDIS_PASSWORD")
	// If password is not set, we'll use empty string (no password)

	redisDB := 0
	if dbStr := os.Getenv("REDIS_DB"); dbStr != "" {
		if db, err := strconv.Atoi(dbStr); err == nil {
			redisDB = db
		}
	}

	redisClient = redis.NewClient(&redis.Options{
		Addr:     redisAddr,
		Password: redisPassword,
		DB:       redisDB,
	})

	// Ping Redis to check the connection
	_, err := redisClient.Ping(ctx).Result()
	if err != nil {
		return fmt.Errorf("failed to connect to Redis: %v", err)
	}

	log.Println("Connected to Redis at", redisAddr)
	return nil
}

// GetRedisClient returns the Redis client
func GetRedisClient() *redis.Client {
	return redisClient
}

// MessageCacheKey generates a Redis key for caching messages
// For global messages: "messages:global"
// For private messages: "messages:private:user1:user2" (users in alphabetical order)
func MessageCacheKey(recipient, username string) string {
	if recipient == "all" {
		return "messages:global"
	}

	// For private messages, ensure consistent key regardless of who is sender/recipient
	if recipient < username {
		return fmt.Sprintf("messages:private:%s:%s", recipient, username)
	}
	return fmt.Sprintf("messages:private:%s:%s", username, recipient)
}

// CacheMessage stores a message in Redis
func CacheMessage(message Message) error {
	// Ensure timestamp is valid
	if message.Timestamp.IsZero() {
		message.Timestamp = time.Now()
	}

	// Marshal the message to JSON
	data, err := json.Marshal(message)
	if err != nil {
		return fmt.Errorf("error marshaling message: %v", err)
	}

	// Generate the key based on message type
	key := MessageCacheKey(message.Recipient, message.Username)

	// Add to the sorted set with timestamp as score for time-ordering
	score := float64(message.Timestamp.UnixNano())
	err = redisClient.ZAdd(ctx, key, &redis.Z{
		Score:  score,
		Member: string(data),
	}).Err()
	if err != nil {
		return fmt.Errorf("error adding message to Redis: %v", err)
	}

	// Trim the sorted set to keep only the most recent messages (last 100)
	err = redisClient.ZRemRangeByRank(ctx, key, 0, -101).Err()
	if err != nil {
		log.Printf("Error trimming Redis cache: %v", err)
	}

	// Set expiration for the key (e.g., 24 hours)
	err = redisClient.Expire(ctx, key, 24*time.Hour).Err()
	if err != nil {
		log.Printf("Error setting expiration for Redis key: %v", err)
	}

	return nil
}

// GetCachedMessages retrieves messages from Redis cache
func GetCachedMessages(recipient, username string, limit int) ([]Message, error) {
	key := MessageCacheKey(recipient, username)

	// Get the latest messages from the sorted set
	results, err := redisClient.ZRevRange(ctx, key, 0, int64(limit-1)).Result()
	if err != nil {
		return nil, fmt.Errorf("error retrieving messages from Redis: %v", err)
	}

	var messages []Message
	for _, result := range results {
		var message Message
		if err := json.Unmarshal([]byte(result), &message); err != nil {
			log.Printf("Error unmarshaling message from Redis: %v", err)
			continue
		}

		// Validate timestamp
		if message.Timestamp.IsZero() {
			// If timestamp is zero, set it to a reasonable default
			// This shouldn't happen but is a safeguard
			score, err := redisClient.ZScore(ctx, key, result).Result()
			if err == nil && score > 0 {
				// Use the score (timestamp) from Redis
				message.Timestamp = time.Unix(0, int64(score))
			} else {
				message.Timestamp = time.Now()
			}
			log.Printf("Warning: Message had zero timestamp, set to %v", message.Timestamp)
		}

		messages = append(messages, message)
	}

	// Reverse the order to have oldest messages first
	for i, j := 0, len(messages)-1; i < j; i, j = i+1, j-1 {
		messages[i], messages[j] = messages[j], messages[i]
	}

	return messages, nil
}

// ClearUserCache clears all cached messages for a user
func ClearUserCache(username string) error {
	// Get all keys related to this user
	pattern := fmt.Sprintf("messages:private:*%s*", username)
	keys, err := redisClient.Keys(ctx, pattern).Result()
	if err != nil {
		return fmt.Errorf("error retrieving Redis keys: %v", err)
	}

	// Add global chat key
	keys = append(keys, "messages:global")

	// Delete all keys
	if len(keys) > 0 {
		err = redisClient.Del(ctx, keys...).Err()
		if err != nil {
			return fmt.Errorf("error deleting Redis keys: %v", err)
		}
	}

	return nil
}
