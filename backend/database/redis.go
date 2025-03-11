package database

import (
	"context"
	"fmt"
	"github.com/redis/go-redis/v9"
)

var redisClient *redis.Client
var ctx = context.Background()

// InitRedis initializes the Redis connection
func InitRedis(redisURL string) error {
	opt, err := redis.ParseURL(redisURL)
	if err != nil {
		return err
	}

	redisClient = redis.NewClient(opt)

	// Test connection
	_, err = redisClient.Ping(ctx).Result()
	if err != nil {
		return err
	}

	fmt.Println("Connected to Redis")
	return nil
}

// CloseRedis closes the Redis connection
func CloseRedis() {
	if redisClient != nil {
		redisClient.Close()
	}
}

// GetRedis returns the Redis client
func GetRedis() *redis.Client {
	return redisClient
}

// PublishMessage publishes a message to a Redis channel
func PublishMessage(channel string, message string) error {
	return redisClient.Publish(ctx, channel, message).Err()
}

// SubscribeToChannel subscribes to a Redis channel
func SubscribeToChannel(channel string) *redis.PubSub {
	return redisClient.Subscribe(ctx, channel)
}

// SetUserOnlineStatus sets a user's online status in Redis
func SetUserOnlineStatus(userID string, online bool) error {
	key := fmt.Sprintf("user:%s:online", userID)
	status := "0"
	if online {
		status = "1"
	}
	return redisClient.Set(ctx, key, status, 0).Err()
}

// IsUserOnline checks if a user is online
func IsUserOnline(userID string) (bool, error) {
	key := fmt.Sprintf("user:%s:online", userID)
	status, err := redisClient.Get(ctx, key).Result()
	if err == redis.Nil {
		return false, nil
	} else if err != nil {
		return false, err
	}
	return status == "1", nil
}
