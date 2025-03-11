// API base URL
const API_BASE_URL = '/api';

// API endpoints
const API = {
    register: `${API_BASE_URL}/register`,
    login: `${API_BASE_URL}/login`,
    users: `${API_BASE_URL}/users`,
    messages: `${API_BASE_URL}/messages`,
    rooms: `${API_BASE_URL}/rooms`,
    roomMessages: `${API_BASE_URL}/room-messages`,
    roomMembers: `${API_BASE_URL}/room-members`,
    addUserToRoom: `${API_BASE_URL}/add-user-to-room`,
};

// WebSocket URL
const WS_URL = `${window.location.protocol === 'https:' ? 'wss:' : 'ws:'}//${window.location.host}/ws`;

// Helper function to make API requests
async function apiRequest(url, method = 'GET', data = null, token = null) {
    const headers = {
        'Content-Type': 'application/json',
    };

    if (token) {
        headers['Authorization'] = `Bearer ${token}`;
    }

    const options = {
        method,
        headers,
    };

    if (data) {
        options.body = JSON.stringify(data);
    }

    try {
        const response = await fetch(url, options);

        // If response is not ok, throw an error
        if (!response.ok) {
            const errorData = await response.json().catch(() => ({
                message: response.statusText,
            }));
            throw new Error(errorData.message || 'Something went wrong');
        }

        // If response is 204 No Content, return null
        if (response.status === 204) {
            return null;
        }

        // Otherwise, parse JSON response
        return await response.json();
    } catch (error) {
        console.error('API request error:', error);
        throw error;
    }
}

// Auth API functions
const AuthAPI = {
    register: (username, email, password) => {
        return apiRequest(API.register, 'POST', { username, email, password });
    },

    login: (username, password) => {
        return apiRequest(API.login, 'POST', { username, password });
    },
};

// User API functions
const UserAPI = {
    getUsers: (token) => {
        return apiRequest(API.users, 'GET', null, token);
    },
};

// Message API functions
const MessageAPI = {
    getMessages: (token, userId, limit = 50, offset = 0) => {
        return apiRequest(`${API.messages}?user_id=${userId}&limit=${limit}&offset=${offset}`, 'GET', null, token);
    },

    sendMessage: (token, recipientId, content) => {
        return apiRequest(API.messages, 'POST', { recipient_id: recipientId, content }, token);
    },
};

// Room API functions
const RoomAPI = {
    getRooms: (token) => {
        return apiRequest(API.rooms, 'GET', null, token);
    },

    createRoom: (token, name) => {
        return apiRequest(API.rooms, 'POST', { name }, token);
    },

    getRoomMessages: (token, roomId, limit = 50, offset = 0) => {
        return apiRequest(`${API.roomMessages}?room_id=${roomId}&limit=${limit}&offset=${offset}`, 'GET', null, token);
    },

    sendRoomMessage: (token, roomId, content) => {
        return apiRequest(`${API.roomMessages}?room_id=${roomId}`, 'POST', { content }, token);
    },

    getRoomMembers: (token, roomId) => {
        return apiRequest(`${API.roomMembers}?room_id=${roomId}`, 'GET', null, token);
    },

    addUserToRoom: (token, roomId, userId) => {
        return apiRequest(API.addUserToRoom, 'POST', { room_id: roomId, user_id: userId }, token);
    },
};
