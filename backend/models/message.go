package models

import (
	"chat-app/backend/database"
	"time"
)

// Message represents a direct message between users
type Message struct {
	ID          int       `json:"id"`
	SenderID    int       `json:"sender_id"`
	RecipientID int       `json:"recipient_id"`
	Content     string    `json:"content"`
	CreatedAt   time.Time `json:"created_at"`
	IsRead      bool      `json:"is_read"`
}

// CreateMessage creates a new message in the database
func CreateMessage(senderID, recipientID int, content string) (*Message, error) {
	db := database.GetDB()
	var message Message

	err := db.QueryRow(
		"INSERT INTO messages (sender_id, recipient_id, content) VALUES ($1, $2, $3) RETURNING id, sender_id, recipient_id, content, created_at, is_read",
		senderID, recipientID, content,
	).Scan(&message.ID, &message.SenderID, &message.RecipientID, &message.Content, &message.CreatedAt, &message.IsRead)

	if err != nil {
		return nil, err
	}

	return &message, nil
}

// GetMessagesBetweenUsers retrieves messages between two users
func GetMessagesBetweenUsers(userID1, userID2 int, limit, offset int) ([]Message, error) {
	db := database.GetDB()

	query := `
		SELECT id, sender_id, recipient_id, content, created_at, is_read
		FROM messages
		WHERE (sender_id = $1 AND recipient_id = $2) OR (sender_id = $2 AND recipient_id = $1)
		ORDER BY created_at DESC
		LIMIT $3 OFFSET $4
	`

	rows, err := db.Query(query, userID1, userID2, limit, offset)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var messages []Message
	for rows.Next() {
		var msg Message
		if err := rows.Scan(&msg.ID, &msg.SenderID, &msg.RecipientID, &msg.Content, &msg.CreatedAt, &msg.IsRead); err != nil {
			return nil, err
		}
		messages = append(messages, msg)
	}

	return messages, nil
}

// MarkMessageAsRead marks a message as read
func MarkMessageAsRead(messageID int) error {
	db := database.GetDB()
	_, err := db.Exec("UPDATE messages SET is_read = TRUE WHERE id = $1", messageID)
	return err
}

// GetUnreadMessageCount gets the count of unread messages for a user
func GetUnreadMessageCount(userID int) (int, error) {
	db := database.GetDB()
	var count int

	err := db.QueryRow(
		"SELECT COUNT(*) FROM messages WHERE recipient_id = $1 AND is_read = FALSE",
		userID,
	).Scan(&count)

	if err != nil {
		return 0, err
	}

	return count, nil
}
