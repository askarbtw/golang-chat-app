// Chat module for handling chat functionality
const Chat = (function() {
    // DOM elements
    const usersTab = document.querySelector('[data-tab="users"]');
    const roomsTab = document.querySelector('[data-tab="rooms"]');
    const usersListContainer = document.getElementById('users-list');
    const roomsListContainer = document.getElementById('rooms-list');
    const usersList = document.getElementById('users');
    const roomsList = document.getElementById('rooms');
    const messagesContainer = document.getElementById('messages');
    const messageInput = document.getElementById('message');
    const sendButton = document.getElementById('send');
    const chatTitle = document.getElementById('chat-title');
    const chatInfo = document.getElementById('chat-info');
    const createRoomButton = document.getElementById('create-room');
    const createRoomModal = document.getElementById('create-room-modal');
    const createRoomForm = document.getElementById('create-room-form');
    const closeModalButton = document.querySelector('.close');

    // WebSocket connection
    let socket = null;

    // Current chat state
    let currentChat = {
        type: null, // 'user' or 'room'
        id: null,
        name: null
    };

    // Typing indicator timeout
    let typingTimeout = null;

    // Users and rooms cache
    let usersCache = [];
    let roomsCache = [];

    // Initialize chat
    function init() {
        // Add event listeners
        usersTab.addEventListener('click', () => switchTab('users'));
        roomsTab.addEventListener('click', () => switchTab('rooms'));
        messageInput.addEventListener('input', handleTyping);
        messageInput.addEventListener('keypress', handleKeyPress);
        sendButton.addEventListener('click', sendMessage);
        createRoomButton.addEventListener('click', showCreateRoomModal);
        closeModalButton.addEventListener('click', hideCreateRoomModal);
        createRoomForm.addEventListener('submit', handleCreateRoom);

        // Close modal when clicking outside
        window.addEventListener('click', (e) => {
            if (e.target === createRoomModal) {
                hideCreateRoomModal();
            }
        });

        // Connect to WebSocket
        connect();

        // Load users and rooms
        loadUsers();
        loadRooms();
    }

    // Connect to WebSocket
    function connect() {
        const token = Auth.getToken();
        if (!token) return;

        // Create WebSocket connection
        socket = new WebSocket(`${WS_URL}?token=${token}`);

        // WebSocket event handlers
        socket.onopen = handleSocketOpen;
        socket.onmessage = handleSocketMessage;
        socket.onclose = handleSocketClose;
        socket.onerror = handleSocketError;
    }

    // Disconnect WebSocket
    function disconnect() {
        if (socket) {
            socket.close();
            socket = null;
        }
    }

    // Handle WebSocket open
    function handleSocketOpen() {
        console.log('WebSocket connected');
    }

    // Handle WebSocket message
    function handleSocketMessage(event) {
        const data = JSON.parse(event.data);

        switch (data.type) {
            case 'message':
                handleNewMessage(data.content);
                break;
            case 'room_message':
                handleNewRoomMessage(data.content);
                break;
            case 'typing':
                handleTypingIndicator(data.content);
                break;
            case 'status':
                handleStatusUpdate(data.content);
                break;
            default:
                console.log('Unknown message type:', data.type);
        }
    }

    // Handle WebSocket close
    function handleSocketClose(event) {
        console.log('WebSocket disconnected:', event.code, event.reason);

        // Try to reconnect after 5 seconds if not intentionally closed
        if (event.code !== 1000) {
            setTimeout(connect, 5000);
        }
    }

    // Handle WebSocket error
    function handleSocketError(error) {
        console.error('WebSocket error:', error);
    }

    // Handle new direct message
    function handleNewMessage(message) {
        // If message is for current chat, add it to the UI
        if (currentChat.type === 'user' &&
            (message.sender_id === currentChat.id || message.recipient_id === currentChat.id)) {
            addMessageToUI(message);
        }

        // Update unread count in the users list
        updateUserUnreadCount(message.sender_id);
    }

    // Handle new room message
    function handleNewRoomMessage(message) {
        // If message is for current chat, add it to the UI
        if (currentChat.type === 'room' && message.room_id === currentChat.id) {
            addRoomMessageToUI(message);
        }

        // Update unread count in the rooms list
        updateRoomUnreadCount(message.room_id);
    }

    // Handle typing indicator
    function handleTypingIndicator(data) {
        if (currentChat.type !== 'user' || data.sender_id !== currentChat.id) return;

        const typingIndicator = document.getElementById('typing-indicator');

        if (data.is_typing) {
            // Create or show typing indicator
            if (!typingIndicator) {
                const indicator = document.createElement('div');
                indicator.id = 'typing-indicator';
                indicator.className = 'typing-indicator';
                indicator.textContent = `${currentChat.name} is typing...`;
                messagesContainer.appendChild(indicator);
            } else {
                typingIndicator.style.display = 'block';
            }
        } else if (typingIndicator) {
            // Hide typing indicator
            typingIndicator.style.display = 'none';
        }
    }

    // Handle status update (online/offline)
    function handleStatusUpdate(data) {
        // Update user status in the list
        const userItem = document.querySelector(`[data-user-id="${data.user_id}"]`);
        if (userItem) {
            const indicator = userItem.querySelector('.online-indicator');
            if (indicator) {
                indicator.className = `online-indicator ${data.is_online ? 'online' : 'offline'}`;
            }
        }

        // Update chat info if this is the current chat
        if (currentChat.type === 'user' && currentChat.id === data.user_id) {
            updateChatInfo();
        }
    }

    // Switch between users and rooms tabs
    function switchTab(tab) {
        // Update tab buttons
        usersTab.classList.toggle('active', tab === 'users');
        roomsTab.classList.toggle('active', tab === 'rooms');

        // Update tab content
        usersListContainer.classList.toggle('active', tab === 'users');
        roomsListContainer.classList.toggle('active', tab === 'rooms');
    }

    // Load users list
    async function loadUsers() {
        try {
            const token = Auth.getToken();
            const users = await UserAPI.getUsers(token);

            // Filter out current user
            const currentUser = Auth.getCurrentUser();
            usersCache = users.filter(user => user.id !== currentUser.id);

            // Render users list
            renderUsersList();
        } catch (error) {
            console.error('Failed to load users:', error);
        }
    }

    // Load rooms list
    async function loadRooms() {
        try {
            const token = Auth.getToken();
            roomsCache = await RoomAPI.getRooms(token);

            // Render rooms list
            renderRoomsList();
        } catch (error) {
            console.error('Failed to load rooms:', error);
        }
    }

    // Render users list
    function renderUsersList() {
        usersList.innerHTML = '';

        usersCache.forEach(user => {
            const li = document.createElement('li');
            li.dataset.userId = user.id;
            li.dataset.username = user.username;
            li.onclick = () => selectUserChat(user.id, user.username);

            // Online indicator
            const indicator = document.createElement('span');
            indicator.className = `online-indicator ${user.is_online ? 'online' : 'offline'}`;

            // Username
            const usernameSpan = document.createElement('span');
            usernameSpan.textContent = user.username;

            // Unread count
            const unreadSpan = document.createElement('span');
            unreadSpan.className = 'unread-count';
            unreadSpan.style.display = 'none';

            li.appendChild(indicator);
            li.appendChild(usernameSpan);
            li.appendChild(unreadSpan);
            usersList.appendChild(li);
        });
    }

    // Render rooms list
    function renderRoomsList() {
        roomsList.innerHTML = '';

        roomsCache.forEach(room => {
            const li = document.createElement('li');
            li.dataset.roomId = room.id;
            li.dataset.roomName = room.name;
            li.onclick = () => selectRoomChat(room.id, room.name);

            // Room name
            const nameSpan = document.createElement('span');
            nameSpan.textContent = room.name;

            // Unread count
            const unreadSpan = document.createElement('span');
            unreadSpan.className = 'unread-count';
            unreadSpan.style.display = 'none';

            li.appendChild(nameSpan);
            li.appendChild(unreadSpan);
            roomsList.appendChild(li);
        });
    }

    // Select user chat
    async function selectUserChat(userId, username) {
        // Update active item in the list
        const items = usersList.querySelectorAll('li');
        items.forEach(item => item.classList.remove('active'));
        const selectedItem = usersList.querySelector(`[data-user-id="${userId}"]`);
        if (selectedItem) {
            selectedItem.classList.add('active');
        }

        // Update current chat
        currentChat = {
            type: 'user',
            id: userId,
            name: username
        };

        // Update UI
        chatTitle.textContent = username;
        updateChatInfo();
        messagesContainer.innerHTML = '';
        messageInput.disabled = false;
        sendButton.disabled = false;

        // Load messages
        try {
            const token = Auth.getToken();
            const messages = await MessageAPI.getMessages(token, userId);

            // Render messages
            messages.reverse().forEach(message => {
                addMessageToUI(message);
            });

            // Scroll to bottom
            scrollToBottom();
        } catch (error) {
            console.error('Failed to load messages:', error);
        }
    }

    // Select room chat
    async function selectRoomChat(roomId, roomName) {
        // Update active item in the list
        const items = roomsList.querySelectorAll('li');
        items.forEach(item => item.classList.remove('active'));
        const selectedItem = roomsList.querySelector(`[data-room-id="${roomId}"]`);
        if (selectedItem) {
            selectedItem.classList.add('active');
        }

        // Update current chat
        currentChat = {
            type: 'room',
            id: roomId,
            name: roomName
        };

        // Update UI
        chatTitle.textContent = roomName;
        updateChatInfo();
        messagesContainer.innerHTML = '';
        messageInput.disabled = false;
        sendButton.disabled = false;

        // Load messages
        try {
            const token = Auth.getToken();
            const messages = await RoomAPI.getRoomMessages(token, roomId);

            // Render messages
            messages.reverse().forEach(message => {
                addRoomMessageToUI(message);
            });

            // Scroll to bottom
            scrollToBottom();
        } catch (error) {
            console.error('Failed to load room messages:', error);
        }
    }

    // Update chat info
    async function updateChatInfo() {
        if (!currentChat.id) {
            chatInfo.textContent = '';
            return;
        }

        if (currentChat.type === 'user') {
            // Get user online status
            const user = usersCache.find(u => u.id === currentChat.id);
            if (user) {
                chatInfo.textContent = user.is_online ? 'Online' : 'Offline';
            }
        } else if (currentChat.type === 'room') {
            // Get room members count
            try {
                const token = Auth.getToken();
                const members = await RoomAPI.getRoomMembers(token, currentChat.id);
                chatInfo.textContent = `${members.length} members`;
            } catch (error) {
                console.error('Failed to get room members:', error);
                chatInfo.textContent = '';
            }
        }
    }

    // Add message to UI
    function addMessageToUI(message) {
        const currentUser = Auth.getCurrentUser();
        const isSent = message.sender_id === currentUser.id;

        const messageElement = document.createElement('div');
        messageElement.className = `message ${isSent ? 'sent' : 'received'}`;
        messageElement.textContent = message.content;

        // Add message info (time)
        const messageInfo = document.createElement('div');
        messageInfo.className = 'message-info';
        messageInfo.textContent = formatTime(new Date(message.created_at));
        messageElement.appendChild(messageInfo);

        messagesContainer.appendChild(messageElement);
        scrollToBottom();
    }

    // Add room message to UI
    function addRoomMessageToUI(message) {
        const currentUser = Auth.getCurrentUser();
        const isSent = message.sender_id === currentUser.id;

        const messageElement = document.createElement('div');
        messageElement.className = `message ${isSent ? 'sent' : 'received'}`;

        // If not sent by current user, add sender name
        if (!isSent) {
            const sender = usersCache.find(u => u.id === message.sender_id);
            const senderName = sender ? sender.username : 'Unknown';

            const senderElement = document.createElement('div');
            senderElement.className = 'message-sender';
            senderElement.textContent = senderName;
            messageElement.appendChild(senderElement);
        }

        // Message content
        const contentElement = document.createElement('div');
        contentElement.className = 'message-content';
        contentElement.textContent = message.content;
        messageElement.appendChild(contentElement);

        // Add message info (time)
        const messageInfo = document.createElement('div');
        messageInfo.className = 'message-info';
        messageInfo.textContent = formatTime(new Date(message.created_at));
        messageElement.appendChild(messageInfo);

        messagesContainer.appendChild(messageElement);
        scrollToBottom();
    }

    // Send message
    async function sendMessage() {
        const content = messageInput.value.trim();
        if (!content || !currentChat.id) return;

        try {
            const token = Auth.getToken();

            if (currentChat.type === 'user') {
                // Send direct message via WebSocket
                const message = {
                    type: 'message',
                    content: JSON.stringify({
                        recipient_id: currentChat.id,
                        content: content
                    })
                };
                socket.send(JSON.stringify(message));
            } else if (currentChat.type === 'room') {
                // Send room message via WebSocket
                const message = {
                    type: 'room_message',
                    content: JSON.stringify({
                        room_id: currentChat.id,
                        content: content
                    })
                };
                socket.send(JSON.stringify(message));
            }

            // Clear input
            messageInput.value = '';
        } catch (error) {
            console.error('Failed to send message:', error);
            alert('Failed to send message. Please try again.');
        }
    }

    // Handle typing event
    function handleTyping() {
        if (currentChat.type !== 'user') return;

        // Send typing indicator
        const isTyping = messageInput.value.trim().length > 0;

        // Send typing status via WebSocket
        const message = {
            type: 'typing',
            content: JSON.stringify({
                recipient_id: currentChat.id,
                is_typing: isTyping
            })
        };
        socket.send(JSON.stringify(message));

        // Clear previous timeout
        if (typingTimeout) {
            clearTimeout(typingTimeout);
        }

        // Set timeout to send "not typing" after 3 seconds of inactivity
        if (isTyping) {
            typingTimeout = setTimeout(() => {
                const stopTypingMessage = {
                    type: 'typing',
                    content: JSON.stringify({
                        recipient_id: currentChat.id,
                        is_typing: false
                    })
                };
                socket.send(JSON.stringify(stopTypingMessage));
            }, 3000);
        }
    }

    // Handle key press in message input
    function handleKeyPress(e) {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            sendMessage();
        }
    }

    // Update user unread count
    function updateUserUnreadCount(userId) {
        if (currentChat.type === 'user' && currentChat.id === userId) {
            // If this is the current chat, no need to update unread count
            return;
        }

        const userItem = document.querySelector(`[data-user-id="${userId}"]`);
        if (!userItem) return;

        const unreadCount = userItem.querySelector('.unread-count');
        if (!unreadCount) return;

        // Get current count
        let count = parseInt(unreadCount.textContent) || 0;
        count++;

        // Update count
        unreadCount.textContent = count;
        unreadCount.style.display = 'inline';
    }

    // Update room unread count
    function updateRoomUnreadCount(roomId) {
        if (currentChat.type === 'room' && currentChat.id === roomId) {
            // If this is the current chat, no need to update unread count
            return;
        }

        const roomItem = document.querySelector(`[data-room-id="${roomId}"]`);
        if (!roomItem) return;

        const unreadCount = roomItem.querySelector('.unread-count');
        if (!unreadCount) return;

        // Get current count
        let count = parseInt(unreadCount.textContent) || 0;
        count++;

        // Update count
        unreadCount.textContent = count;
        unreadCount.style.display = 'inline';
    }

    // Show create room modal
    function showCreateRoomModal() {
        createRoomModal.style.display = 'block';
    }

    // Hide create room modal
    function hideCreateRoomModal() {
        createRoomModal.style.display = 'none';
        createRoomForm.reset();
    }

    // Handle create room form submission
    async function handleCreateRoom(e) {
        e.preventDefault();

        const roomName = document.getElementById('room-name').value.trim();
        if (!roomName) return;

        try {
            const token = Auth.getToken();
            const room = await RoomAPI.createRoom(token, roomName);

            // Add room to cache
            roomsCache.push(room);

            // Render rooms list
            renderRoomsList();

            // Select the new room
            selectRoomChat(room.id, room.name);

            // Switch to rooms tab
            switchTab('rooms');

            // Hide modal
            hideCreateRoomModal();
        } catch (error) {
            console.error('Failed to create room:', error);
            alert('Failed to create room. Please try again.');
        }
    }

    // Scroll messages container to bottom
    function scrollToBottom() {
        messagesContainer.scrollTop = messagesContainer.scrollHeight;
    }

    // Format time for message display
    function formatTime(date) {
        return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    }

    // Return public API
    return {
        init,
        connect,
        disconnect
    };
})();
