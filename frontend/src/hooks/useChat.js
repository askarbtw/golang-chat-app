import { useState, useEffect, useCallback, useRef } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useSocket } from '../contexts/SocketContext';

export const useChat = () => {
  const { user } = useAuth();
  const { socket, isConnected, sendMessage: socketSendMessage } = useSocket();
  
  const [messages, setMessages] = useState([]);
  const [selectedUser, setSelectedUser] = useState(null); // null means group chat
  const [newMessage, setNewMessage] = useState('');
  const [onlineUsers, setOnlineUsers] = useState([]);
  const messagesEndRef = useRef(null);

  // Auto-scroll to bottom when messages change
  const scrollToBottom = useCallback(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, scrollToBottom]);

  // Handle incoming WebSocket messages
  useEffect(() => {
    if (!socket) return;
    
    const messageHandler = (event) => {
      try {
        const data = JSON.parse(event.data);
        
        if (data.type === 'users') {
          // Receive list of online users
          setOnlineUsers(data.users || []);
        } else if (data.type === 'user_joined') {
          // User joined notification
          setOnlineUsers(prev => [...(prev || []), data.username]);
        } else if (data.type === 'user_left') {
          // User left notification
          setOnlineUsers(prev => (prev || []).filter(u => u !== data.username));
        } else {
          // Regular message (private or public)
          setMessages(prevMessages => [...prevMessages, data]);
        }
      } catch (error) {
        console.error('Error processing WebSocket message:', error);
      }
    };

    socket.addEventListener('message', messageHandler);
    
    return () => {
      socket.removeEventListener('message', messageHandler);
    };
  }, [socket]);

  // Filter messages based on the selected chat
  const filteredMessages = messages.filter(msg => {
    if (!selectedUser) {
      // Group chat - show only public messages
      return !msg.isPrivate;
    } else {
      // Private chat - show only messages between current user and selected user
      return msg.isPrivate &&
        ((msg.username === selectedUser && msg.recipient === user?.username) ||
         (msg.username === user?.username && msg.recipient === selectedUser));
    }
  });

  // Send a message
  const sendChatMessage = useCallback((content) => {
    if (!content.trim() || !isConnected) return false;
    
    const messageObj = {
      content: content.trim(),
      recipient: selectedUser, // null for group chat
      isPrivate: !!selectedUser
    };

    const success = socketSendMessage(messageObj);
    if (success) setNewMessage('');
    return success;
  }, [isConnected, selectedUser, socketSendMessage]);

  // Select a user for chat
  const selectUser = useCallback((username) => {
    if (username === 'Group Chat' || username === null) {
      setSelectedUser(null);
    } else if (user && username !== user.username) {
      setSelectedUser(username);
    }
  }, [user]);

  // Format timestamp for display
  const formatTime = (timestamp) => {
    const date = new Date(timestamp);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  return {
    messages,
    filteredMessages,
    newMessage,
    setNewMessage,
    selectedUser,
    onlineUsers,
    messagesEndRef,
    sendMessage: sendChatMessage,
    selectUser,
    formatTime
  };
}; 