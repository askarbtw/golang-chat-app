import React, { useEffect, useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import '../App.css';
import Friends from './Friends/Friends';
import { useAuth } from '../contexts/AuthContext';

function Chat() {
  const navigate = useNavigate();
  const { isAuthenticated, user, logout, loading } = useAuth();
  const [messages, setMessages] = useState([]);
  const [messageInput, setMessageInput] = useState('');
  const [socket, setSocket] = useState(null);
  const [username, setUsername] = useState('');
  const [onlineUsers, setOnlineUsers] = useState([]);
  const [conversationPartners, setConversationPartners] = useState([]);
  const [selectedUser, setSelectedUser] = useState(null);
  const messagesEndRef = useRef(null);
  const [isConnected, setIsConnected] = useState(false);
  const [sentMessageIds, setSentMessageIds] = useState(new Set());
  const [connectionError, setConnectionError] = useState(null);
  const reconnectTimeoutRef = useRef(null);
  const [activeTab, setActiveTab] = useState('chat'); // 'chat' or 'friends'
  
  // Scroll to bottom of messages
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);
  
  // Extract unique conversation partners from messages
  useEffect(() => {
    if (!username) return;
    
    // Find all users the current user has exchanged messages with
    const partners = messages.reduce((acc, msg) => {
      if (msg.sender !== username && !acc.includes(msg.sender)) {
        acc.push(msg.sender);
      }
      if (msg.recipient !== 'all' && msg.recipient !== username && !acc.includes(msg.recipient)) {
        acc.push(msg.recipient);
      }
      return acc;
    }, []);
    
    // Filter out undefined, null or empty strings
    const validPartners = partners.filter(partner => partner);
    
    setConversationPartners(validPartners);
  }, [messages, username]);
  
  // Setup WebSocket connection
  const setupWebSocket = () => {
    // Clear any existing reconnect timeout
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }
    
    const token = localStorage.getItem('token');
    if (!token) {
      navigate('/');
      return null;
    }
    
    // Create WebSocket connection with token in the URL
    const ws = new WebSocket(`ws://${window.location.host}/ws?token=${token}`);
    
    ws.onopen = () => {
      console.log('Connected to the WebSocket server');
      setIsConnected(true);
      setConnectionError(null);
    };
    
    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        
        switch (data.type) {
          case 'message':
            // Check if this is a message we sent (prevent duplicates)
            if (data.sender === username && sentMessageIds.has(data.clientId)) {
              // Skip this message as we already have it in our state
              return;
            }
            
            setMessages(prev => {
              // Also check if message already exists in our state by content and timestamp
              const isDuplicate = prev.some(msg => 
                msg.content === data.content && 
                msg.sender === data.sender &&
                (msg.timestamp === data.timestamp || 
                 // If server timestamp format differs slightly
                 Math.abs(new Date(msg.timestamp).getTime() - new Date(data.timestamp).getTime()) < 5000)
              );
              
              if (isDuplicate) {
                return prev;
              }
              
              return [...prev, data];
            });
            break;
          case 'users':
            setOnlineUsers(data.users);
            break;
          case 'error':
            console.error('WebSocket error:', data.message);
            setConnectionError(data.message);
            break;
          default:
            console.log('Received unknown message type:', data);
        }
      } catch (err) {
        console.error('Error parsing message:', err);
      }
    };
    
    ws.onclose = (event) => {
      console.log('WebSocket disconnected, code:', event.code, 'reason:', event.reason);
      setIsConnected(false);
      
      // Only try to reconnect if not a normal closure and we have a token
      if (event.code !== 1000 && localStorage.getItem('token')) {
        setConnectionError('Connection lost. Trying to reconnect...');
        // Try to reconnect after 5 seconds
        reconnectTimeoutRef.current = setTimeout(() => {
          if (localStorage.getItem('token')) {
            console.log('Attempting to reconnect...');
            setupWebSocket();
          }
        }, 5000);
      }
    };
    
    ws.onerror = (error) => {
      console.error('WebSocket error:', error);
      setConnectionError('Connection error occurred');
    };
    
    return ws;
  };
  
  // Initialize connection and auth
  useEffect(() => {
    // Check if user is authenticated
    const token = localStorage.getItem('token');
    if (!token) {
      navigate('/');
      return;
    }
    
    if (isAuthenticated) {
      setUsername(user.username);
    }
    
    // Start WebSocket connection
    const ws = setupWebSocket();
    setSocket(ws);
    
    // Clean up function
    return () => {
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
      if (ws) {
        // Use a clean close code to prevent reconnection attempts
        ws.close(1000, "Component unmounting");
      }
    };
  }, [navigate, isAuthenticated, user]);
  
  // Generate a unique ID for messages
  const generateMessageId = () => {
    return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  };
  
  // Handle sending a message
  const handleSendMessage = (e) => {
    e.preventDefault();
    
    if (!messageInput.trim() || !socket || !isConnected) return;
    
    // Create a unique client ID for this message
    const clientId = generateMessageId();
    
    const messageData = {
      type: 'message',
      content: messageInput,
      recipient: selectedUser || 'all', // 'all' for global chat
      clientId: clientId // Add client ID to track this message
    };
    
    try {
      socket.send(JSON.stringify(messageData));
      
      // Track this message ID to prevent duplication
      setSentMessageIds(prev => new Set(prev).add(clientId));
      
      // Add the message to our local state immediately for better UX
      const localMessage = {
        type: 'message',
        clientId: clientId,
        content: messageInput,
        sender: username,
        recipient: selectedUser || 'all',
        timestamp: new Date().toISOString()
      };
      setMessages(prev => [...prev, localMessage]);
      
      // Clear input
      setMessageInput('');
    } catch (err) {
      console.error('Error sending message:', err);
      setConnectionError('Failed to send message. Connection may be lost.');
      
      // Try to reconnect
      if (socket.readyState !== WebSocket.OPEN) {
        setSocket(setupWebSocket());
      }
    }
  };
  
  // Retry connection if disconnected
  const handleRetryConnection = () => {
    setConnectionError('Reconnecting...');
    setSocket(setupWebSocket());
  };
  
  // Clean up old sent message IDs (optional - prevents set from growing too large)
  useEffect(() => {
    const cleanup = () => {
      // Keep only last 100 message IDs
      if (sentMessageIds.size > 100) {
        const newSet = new Set(Array.from(sentMessageIds).slice(-100));
        setSentMessageIds(newSet);
      }
    };
    
    const interval = setInterval(cleanup, 60000); // Run every minute
    return () => clearInterval(interval);
  }, [sentMessageIds]);
  
  // Implement logout function
  const handleLogout = () => {
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
    }
    if (socket) {
      socket.close(1000, "User logout");
    }
    logout();
    localStorage.removeItem('token');
    navigate('/');
  };
  
  // Handle selecting a user to chat with
  const handleSelectUser = (user) => {
    setSelectedUser(user === selectedUser ? null : user);
  };

  // Format timestamp
  const formatTimestamp = (timestamp) => {
    if (!timestamp) return '';
    
    // Handle different timestamp formats
    let date;
    if (typeof timestamp === 'string') {
      // Parse ISO string
      date = new Date(timestamp);
    } else if (timestamp instanceof Date) {
      // Already a Date object
      date = timestamp;
    } else if (typeof timestamp === 'object' && timestamp.seconds) {
      // Handle Firestore-like timestamp format
      date = new Date(timestamp.seconds * 1000);
    } else {
      // Try to convert from any other format
      date = new Date(timestamp);
    }
    
    // Check if the date is valid
    if (isNaN(date.getTime())) {
      console.warn('Invalid timestamp:', timestamp);
      return 'Invalid time';
    }
    
    return date.toLocaleTimeString([], { 
      hour: '2-digit', 
      minute: '2-digit',
      hour12: true 
    });
  };
  
  // Get all users to display in sidebar (online users + conversation partners)
  const getAllUsersToDisplay = () => {
    const allUsers = [...onlineUsers];
    
    // Add offline conversation partners
    conversationPartners.forEach(partner => {
      if (!allUsers.includes(partner) && partner !== username) {
        allUsers.push(partner);
      }
    });
    
    // Remove current user
    return allUsers.filter(user => user !== username);
  };
  
  // Check if user is online
  const isUserOnline = (user) => {
    return onlineUsers.includes(user);
  };
  
  // Handle selecting a user from the friends list
  const handleSelectUserFromFriends = (username) => {
    setSelectedUser(username);
    setActiveTab('chat'); // Switch to chat tab when a friend is selected
  };
  
  // Check authentication on component mount
  useEffect(() => {
    if (!loading && !isAuthenticated) {
      navigate('/');
    } else if (user) {
      setUsername(user.username);
    }
  }, [isAuthenticated, user, navigate, loading]);
  
  if (loading) {
    return (
      <div className="flex h-screen w-full items-center justify-center bg-gray-100">
        <div className="text-center">
          <div className="mb-4 text-blue-600 text-4xl">
            <span className="animate-pulse">•</span>
            <span className="animate-pulse animation-delay-200">•</span>
            <span className="animate-pulse animation-delay-400">•</span>
          </div>
          <p className="text-gray-600">Checking authentication...</p>
        </div>
      </div>
    );
  }
  
  if (!isAuthenticated) {
    return null; // Will be redirected by the useEffect
  }
  
  const displayUsers = getAllUsersToDisplay();
  
  return (
    <div className="chat-container flex flex-col h-screen bg-gray-100">
      <header className="bg-blue-600 text-white p-4 shadow-md">
        <div className="container mx-auto flex justify-between items-center">
          <h1 className="text-xl font-bold">Chat App</h1>
          <button
            onClick={handleLogout}
            className="bg-blue-700 hover:bg-blue-800 text-white px-4 py-2 rounded"
          >
            Logout
          </button>
        </div>
      </header>

      <div className="flex-grow flex overflow-hidden">
        <div className="flex flex-col w-full container mx-auto p-4 h-full">
          <div className="flex-grow flex bg-white rounded-lg shadow-md overflow-hidden">
            {/* Sidebar with user list and tabs */}
            <div className="w-64 bg-gray-50 border-r border-gray-200 flex flex-col">
              {/* Tabs for Chat/Friends */}
              <div className="flex border-b">
                <button
                  className={`flex-1 py-3 font-medium ${
                    activeTab === 'chat'
                      ? 'bg-blue-500 text-white'
                      : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                  }`}
                  onClick={() => setActiveTab('chat')}
                >
                  Chat
                </button>
                <button
                  className={`flex-1 py-3 font-medium ${
                    activeTab === 'friends'
                      ? 'bg-blue-500 text-white'
                      : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                  }`}
                  onClick={() => setActiveTab('friends')}
                >
                  Friends
                </button>
              </div>

              {/* Show user list only in chat tab */}
              {activeTab === 'chat' && (
                <div className="flex-1 overflow-y-auto">
                  {/* Render existing user list code */}
                  <div className="p-4 border-b">
                    <h2 className="font-bold text-gray-700">Online Users</h2>
                  </div>
                  <ul className="divide-y divide-gray-200">
                    {getAllUsersToDisplay().map(user => (
                      <li
                        key={user}
                        className={`p-3 cursor-pointer ${
                          selectedUser === user ? 'bg-blue-100' : 'hover:bg-gray-100'
                        }`}
                        onClick={() => handleSelectUser(user)}
                      >
                        <div className="flex items-center">
                          <div className={`w-2 h-2 rounded-full mr-2 ${isUserOnline(user) ? 'bg-green-500' : 'bg-gray-400'}`}></div>
                          <span>{user}</span>
                        </div>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Show friends component in friends tab */}
              {activeTab === 'friends' && (
                <div className="flex-1 overflow-hidden">
                  <Friends onSelectUser={handleSelectUserFromFriends} />
                </div>
              )}
            </div>

            {/* Main content area */}
            <div className="flex-1 flex flex-col">
              {connectionError && (
                <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 m-4 rounded relative" role="alert">
                  <strong className="font-bold">Connection Error!</strong>
                  <span className="block sm:inline ml-2">{connectionError}</span>
                  <button
                    className="bg-red-500 hover:bg-red-700 text-white font-bold py-1 px-2 rounded mt-2"
                    onClick={handleRetryConnection}
                  >
                    Retry Connection
                  </button>
                </div>
              )}

              {/* Keep the existing chat UI */}
              <div className="flex-1 overflow-y-auto p-4" style={{ 
                height: connectionError ? '70vh' : '75vh', 
                overflowY: 'auto' 
              }}>
                {/* Render existing messages code */}
                {selectedUser && (
                  <div className="text-center mb-4 bg-gray-100 p-2 rounded">
                    <h2 className="font-bold">Chatting with: {selectedUser}</h2>
                  </div>
                )}
                {renderMessages()}
                <div ref={messagesEndRef} />
              </div>

              {/* Message input */}
              <div className="border-t p-4">
                <form onSubmit={handleSendMessage} className="flex">
                  <input
                    type="text"
                    value={messageInput}
                    onChange={(e) => setMessageInput(e.target.value)}
                    placeholder="Type a message..."
                    className="flex-1 border rounded-l px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  <button
                    type="submit"
                    className="bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded-r"
                    disabled={!isConnected}
                  >
                    Send
                  </button>
                </form>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );

  // Keep all existing functions like renderMessages(), etc.
  function renderMessages() {
    const messagesToShow = messages.filter(msg => 
      // Show all messages in global chat
      (!selectedUser && msg.recipient === 'all') || 
      // Show direct messages between the user and selected recipient
      (selectedUser && ((msg.sender === selectedUser && msg.recipient === username) || 
                        (msg.sender === username && msg.recipient === selectedUser)))
    );
    
    if (messagesToShow.length === 0) {
      return (
        <div className="text-center text-gray-500 my-8">
          {selectedUser 
            ? `Start a conversation with ${selectedUser}`
            : "No messages in global chat. Be the first to say hello!"}
        </div>
      );
    }
    
    return messagesToShow.map((msg, index) => (
      <div 
        key={msg.clientId || index}
        className={`flex flex-col mb-4 ${msg.sender === username ? 'items-end' : 'items-start'}`}
      >
        <div className={`max-w-[70%] p-3 rounded-lg shadow-sm ${
          msg.sender === username 
            ? 'bg-blue-500 text-white' 
            : 'bg-white border border-gray-200 text-gray-800'
        }`}>
          {msg.content}
        </div>
        <div className="text-xs text-gray-500 mt-1 flex items-center">
          {msg.sender !== username && !selectedUser && (
            <span className="font-medium mr-2">{msg.sender}</span>
          )}
          <span>{formatTimestamp(msg.timestamp)}</span>
        </div>
      </div>
    ));
  }
}

export default Chat; 