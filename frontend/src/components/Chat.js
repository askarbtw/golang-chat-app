import React, { useEffect, useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import '../App.css';

function Chat() {
  const navigate = useNavigate();
  const [isAuthenticated, setIsAuthenticated] = useState(false);
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
    
    setIsAuthenticated(true);
    
    // Try to extract username from token
    try {
      const tokenParts = token.split('.');
      if (tokenParts.length === 3) {
        const payload = JSON.parse(atob(tokenParts[1]));
        if (payload && payload.username) {
          setUsername(payload.username);
        }
      }
    } catch (err) {
      console.error("Error parsing token:", err);
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
  }, [navigate]);
  
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
  
  if (!isAuthenticated) {
    return <div>Checking authentication...</div>;
  }
  
  const displayUsers = getAllUsersToDisplay();
  
  return (
    <div className="app">
      <header className="app-header">
        <h1>Chat Application</h1>
        {isConnected ? (
          <span style={{ 
            position: 'absolute', 
            left: '20px', 
            top: '20px',
            background: 'rgba(255,255,255,0.2)',
            padding: '4px 8px',
            borderRadius: '4px',
            fontSize: '0.8rem'
          }}>
            <span style={{ 
              display: 'inline-block', 
              width: '8px', 
              height: '8px', 
              borderRadius: '50%', 
              backgroundColor: '#4ade80', 
              marginRight: '6px' 
            }}></span>
            Connected
          </span>
        ) : (
          <span 
            onClick={handleRetryConnection}
            style={{ 
              position: 'absolute', 
              left: '20px', 
              top: '20px',
              background: 'rgba(255,255,255,0.2)',
              padding: '4px 8px',
              borderRadius: '4px',
              fontSize: '0.8rem',
              cursor: 'pointer'
            }}
          >
            <span style={{ 
              display: 'inline-block', 
              width: '8px', 
              height: '8px', 
              borderRadius: '50%', 
              backgroundColor: '#ef4444', 
              marginRight: '6px' 
            }}></span>
            Disconnected (click to reconnect)
          </span>
        )}
        <span style={{
          position: 'absolute',
          right: '100px',
          top: '20px',
          color: 'white',
          fontSize: '0.9rem'
        }}>
          Logged in as: {username}
        </span>
        <button 
          onClick={handleLogout}
          style={{
            position: 'absolute',
            right: '20px',
            top: '20px',
            background: 'rgba(255,255,255,0.2)',
            border: 'none',
            padding: '8px 16px',
            borderRadius: '4px',
            color: 'white',
            cursor: 'pointer'
          }}
        >
          Logout
        </button>
      </header>
      
      {connectionError && (
        <div style={{
          background: '#fee2e2',
          color: '#b91c1c',
          padding: '0.75rem',
          textAlign: 'center',
          fontSize: '0.875rem',
          fontWeight: 500,
          borderBottom: '1px solid #fecaca'
        }}>
          {connectionError}
          {!isConnected && (
            <button 
              onClick={handleRetryConnection}
              style={{
                marginLeft: '1rem',
                background: '#b91c1c',
                color: 'white',
                border: 'none',
                padding: '0.25rem 0.75rem',
                borderRadius: '0.25rem',
                fontSize: '0.75rem',
                cursor: 'pointer'
              }}
            >
              Retry Connection
            </button>
          )}
        </div>
      )}
      
      <main className="app-main" style={{ justifyContent: 'flex-start', alignItems: 'stretch' }}>
        <div style={{ 
          display: 'flex', 
          width: '100%', 
          maxWidth: '1200px', 
          margin: '0 auto',
          height: connectionError ? '70vh' : '75vh',
          boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)',
          borderRadius: '8px',
          overflow: 'hidden'
        }}>
          {/* Sidebar */}
          <div style={{ 
            width: '250px', 
            background: 'white',
            borderRight: '1px solid #e2e8f0',
            display: 'flex',
            flexDirection: 'column'
          }}>
            <div style={{
              padding: '1rem',
              borderBottom: '1px solid #e2e8f0',
              background: '#f8fafc'
            }}>
              <h3 style={{ margin: 0 }}>Conversations</h3>
            </div>
            
            <div style={{ 
              overflow: 'auto',
              flex: 1,
              padding: '0.5rem'
            }}>
              <div 
                onClick={() => setSelectedUser(null)}
                style={{
                  padding: '0.75rem',
                  borderRadius: '0.375rem',
                  marginBottom: '0.25rem',
                  background: !selectedUser ? '#e5efff' : 'transparent',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center'
                }}
              >
                <div style={{
                  width: '32px',
                  height: '32px',
                  borderRadius: '50%',
                  backgroundColor: '#0080ff',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: 'white',
                  marginRight: '0.75rem',
                  fontSize: '0.875rem'
                }}>
                  All
                </div>
                <div>
                  <div style={{ fontWeight: 500 }}>Global Chat</div>
                  <div style={{ fontSize: '0.75rem', color: '#6b7280' }}>Everyone</div>
                </div>
              </div>
              
              {displayUsers.map((user, index) => (
                <div 
                  key={index}
                  onClick={() => handleSelectUser(user)}
                  style={{
                    padding: '0.75rem',
                    borderRadius: '0.375rem',
                    marginBottom: '0.25rem',
                    background: selectedUser === user ? '#e5efff' : 'transparent',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center'
                  }}
                >
                  <div style={{
                    width: '32px',
                    height: '32px',
                    borderRadius: '50%',
                    backgroundColor: '#64748b',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: 'white',
                    marginRight: '0.75rem',
                    fontSize: '0.875rem',
                    textTransform: 'uppercase',
                    position: 'relative'
                  }}>
                    {user.charAt(0)}
                    
                    {/* Online/offline status indicator */}
                    <span style={{ 
                      position: 'absolute',
                      width: '10px',
                      height: '10px',
                      borderRadius: '50%',
                      backgroundColor: isUserOnline(user) ? '#4ade80' : '#9ca3af',
                      border: '2px solid white',
                      bottom: '-2px',
                      right: '-2px'
                    }}></span>
                  </div>
                  <div>
                    <div style={{ fontWeight: 500 }}>{user}</div>
                    <div style={{ fontSize: '0.75rem', color: '#6b7280' }}>
                      {isUserOnline(user) ? 'Online' : 'Offline'}
                    </div>
                  </div>
                </div>
              ))}
              
              {displayUsers.length === 0 && (
                <div style={{ 
                  padding: '1rem', 
                  color: '#6b7280', 
                  textAlign: 'center',
                  fontSize: '0.875rem' 
                }}>
                  No conversations yet
                </div>
              )}
            </div>
          </div>
          
          {/* Main chat area */}
          <div style={{ 
            flex: '1',
            display: 'flex',
            flexDirection: 'column',
            background: 'white'
          }}>
            <div style={{ 
              padding: '1rem', 
              borderBottom: '1px solid #e2e8f0',
              background: '#f8fafc',
              display: 'flex',
              alignItems: 'center'
            }}>
              <h3 style={{ margin: 0 }}>
                {selectedUser ? `Chat with ${selectedUser}` : 'Global Chat'}
              </h3>
              {selectedUser && (
                <span style={{ 
                  marginLeft: '10px',
                  fontSize: '0.75rem',
                  background: isUserOnline(selectedUser) ? '#ecfdf5' : '#f3f4f6',
                  color: isUserOnline(selectedUser) ? '#065f46' : '#6b7280',
                  padding: '2px 8px',
                  borderRadius: '10px'
                }}>
                  {isUserOnline(selectedUser) ? 'Online' : 'Offline'}
                </span>
              )}
            </div>
            
            <div style={{ 
              flex: '1',
              padding: '1rem',
              overflowY: 'auto',
              background: '#f9fafb'
            }}>
              {messages.filter(msg => 
                // Show all messages in global chat
                (!selectedUser && msg.recipient === 'all') || 
                // Show direct messages between the user and selected recipient
                (selectedUser && ((msg.sender === selectedUser && msg.recipient === username) || 
                                 (msg.sender === username && msg.recipient === selectedUser)))
              ).map((msg, index) => (
                <div 
                  key={msg.clientId || index}
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: msg.sender === username ? 'flex-end' : 'flex-start',
                    marginBottom: '1rem'
                  }}
                >
                  <div style={{
                    maxWidth: '70%',
                    background: msg.sender === username ? '#0080ff' : 'white',
                    color: msg.sender === username ? 'white' : '#333',
                    padding: '0.75rem 1rem',
                    borderRadius: '0.75rem',
                    boxShadow: '0 1px 2px rgba(0, 0, 0, 0.1)',
                    border: msg.sender !== username ? '1px solid #e2e8f0' : 'none'
                  }}>
                    {msg.content}
                  </div>
                  <div style={{
                    fontSize: '0.75rem',
                    color: '#6b7280',
                    marginTop: '0.25rem',
                    display: 'flex',
                    alignItems: 'center'
                  }}>
                    {msg.sender !== username && !selectedUser && (
                      <span style={{ marginRight: '0.5rem', fontWeight: 500 }}>{msg.sender}</span>
                    )}
                    <span>{formatTimestamp(msg.timestamp)}</span>
                  </div>
                </div>
              ))}
              
              {messages.filter(msg => 
                (!selectedUser && msg.recipient === 'all') || 
                (selectedUser && ((msg.sender === selectedUser && msg.recipient === username) || 
                                (msg.sender === username && msg.recipient === selectedUser)))
              ).length === 0 && (
                <div style={{ 
                  textAlign: 'center', 
                  color: '#6b7280', 
                  marginTop: '2rem',
                  fontSize: '0.875rem' 
                }}>
                  {selectedUser 
                    ? `Start a conversation with ${selectedUser}`
                    : "No messages in global chat. Be the first to say hello!"}
                </div>
              )}
              
              <div ref={messagesEndRef} />
            </div>
            
            <div style={{ 
              padding: '1rem',
              borderTop: '1px solid #e2e8f0',
              background: 'white'
            }}>
              <form onSubmit={handleSendMessage} style={{ display: 'flex' }}>
                <input 
                  type="text" 
                  value={messageInput}
                  onChange={(e) => setMessageInput(e.target.value)}
                  placeholder={`Message ${selectedUser || 'everyone'}...`}
                  disabled={!isConnected}
                  style={{
                    flex: '1',
                    padding: '0.75rem',
                    border: '1px solid #e2e8f0',
                    borderRadius: '4px',
                    marginRight: '0.5rem',
                    fontSize: '0.875rem'
                  }}
                />
                <button
                  type="submit"
                  disabled={!messageInput.trim() || !isConnected}
                  style={{
                    padding: '0.75rem 1.5rem',
                    background: '#0080ff',
                    color: 'white',
                    border: 'none',
                    borderRadius: '4px',
                    cursor: messageInput.trim() && isConnected ? 'pointer' : 'not-allowed',
                    opacity: messageInput.trim() && isConnected ? 1 : 0.7,
                    fontSize: '0.875rem',
                    fontWeight: 500
                  }}
                >
                  Send
                </button>
              </form>
              
              {selectedUser && !isUserOnline(selectedUser) && (
                <div style={{ 
                  marginTop: '0.5rem', 
                  fontSize: '0.75rem', 
                  color: '#6b7280',
                  textAlign: 'center'
                }}>
                  Note: This user is currently offline. Messages will be delivered when they come online.
                </div>
              )}
            </div>
          </div>
        </div>
      </main>
      <footer className="app-footer">
        <p>© 2023 Chat Application. All rights reserved.</p>
      </footer>
    </div>
  );
}

export default Chat; 