package models

import (
	"chat-app/backend/database"
	"time"
)

// ChatRoom represents a group chat room
type ChatRoom struct {
	ID        int       `json:"id"`
	Name      string    `json:"name"`
	CreatedBy int       `json:"created_by"`
	CreatedAt time.Time `json:"created_at"`
}

// RoomMessage represents a message in a chat room
type RoomMessage struct {
	ID        int       `json:"id"`
	RoomID    int       `json:"room_id"`
	SenderID  int       `json:"sender_id"`
	Content   string    `json:"content"`
	CreatedAt time.Time `json:"created_at"`
}

// CreateChatRoom creates a new chat room
func CreateChatRoom(name string, createdBy int) (*ChatRoom, error) {
	db := database.GetDB()
	var room ChatRoom

	err := db.QueryRow(
		"INSERT INTO chat_rooms (name, created_by) VALUES ($1, $2) RETURNING id, name, created_by, created_at",
		name, createdBy,
	).Scan(&room.ID, &room.Name, &room.CreatedBy, &room.CreatedAt)

	if err != nil {
		return nil, err
	}

	// Add the creator as a member of the room
	_, err = db.Exec(
		"INSERT INTO room_members (room_id, user_id) VALUES ($1, $2)",
		room.ID, createdBy,
	)

	if err != nil {
		return nil, err
	}

	return &room, nil
}

// GetChatRoomByID retrieves a chat room by its ID
func GetChatRoomByID(roomID int) (*ChatRoom, error) {
	db := database.GetDB()
	var room ChatRoom

	err := db.QueryRow(
		"SELECT id, name, created_by, created_at FROM chat_rooms WHERE id = $1",
		roomID,
	).Scan(&room.ID, &room.Name, &room.CreatedBy, &room.CreatedAt)

	if err != nil {
		return nil, err
	}

	return &room, nil
}

// GetRoomsByUserID retrieves all chat rooms a user is a member of
func GetRoomsByUserID(userID int) ([]ChatRoom, error) {
	db := database.GetDB()

	query := `
		SELECT r.id, r.name, r.created_by, r.created_at
		FROM chat_rooms r
		JOIN room_members m ON r.id = m.room_id
		WHERE m.user_id = $1
	`

	rows, err := db.Query(query, userID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var rooms []ChatRoom
	for rows.Next() {
		var room ChatRoom
		if err := rows.Scan(&room.ID, &room.Name, &room.CreatedBy, &room.CreatedAt); err != nil {
			return nil, err
		}
		rooms = append(rooms, room)
	}

	return rooms, nil
}

// AddUserToRoom adds a user to a chat room
func AddUserToRoom(roomID, userID int) error {
	db := database.GetDB()
	_, err := db.Exec(
		"INSERT INTO room_members (room_id, user_id) VALUES ($1, $2) ON CONFLICT DO NOTHING",
		roomID, userID,
	)
	return err
}

// RemoveUserFromRoom removes a user from a chat room
func RemoveUserFromRoom(roomID, userID int) error {
	db := database.GetDB()
	_, err := db.Exec(
		"DELETE FROM room_members WHERE room_id = $1 AND user_id = $2",
		roomID, userID,
	)
	return err
}

// GetRoomMembers gets all members of a chat room
func GetRoomMembers(roomID int) ([]User, error) {
	db := database.GetDB()

	query := `
		SELECT u.id, u.username, u.email, u.created_at, u.last_seen
		FROM users u
		JOIN room_members m ON u.id = m.user_id
		WHERE m.room_id = $1
	`

	rows, err := db.Query(query, roomID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var users []User
	for rows.Next() {
		var user User
		if err := rows.Scan(&user.ID, &user.Username, &user.Email, &user.CreatedAt, &user.LastSeen); err != nil {
			return nil, err
		}
		users = append(users, user)
	}

	return users, nil
}

// CreateRoomMessage creates a new message in a chat room
func CreateRoomMessage(roomID, senderID int, content string) (*RoomMessage, error) {
	db := database.GetDB()
	var message RoomMessage

	err := db.QueryRow(
		"INSERT INTO room_messages (room_id, sender_id, content) VALUES ($1, $2, $3) RETURNING id, room_id, sender_id, content, created_at",
		roomID, senderID, content,
	).Scan(&message.ID, &message.RoomID, &message.SenderID, &message.Content, &message.CreatedAt)

	if err != nil {
		return nil, err
	}

	return &message, nil
}

// GetRoomMessages retrieves messages from a chat room
func GetRoomMessages(roomID int, limit, offset int) ([]RoomMessage, error) {
	db := database.GetDB()

	query := `
		SELECT id, room_id, sender_id, content, created_at
		FROM room_messages
		WHERE room_id = $1
		ORDER BY created_at DESC
		LIMIT $2 OFFSET $3
	`

	rows, err := db.Query(query, roomID, limit, offset)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var messages []RoomMessage
	for rows.Next() {
		var msg RoomMessage
		if err := rows.Scan(&msg.ID, &msg.RoomID, &msg.SenderID, &msg.Content, &msg.CreatedAt); err != nil {
			return nil, err
		}
		messages = append(messages, msg)
	}

	return messages, nil
}
