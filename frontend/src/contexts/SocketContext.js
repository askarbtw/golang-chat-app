import React, { createContext, useState, useEffect, useContext } from 'react';
import { useAuth } from './AuthContext';

const SocketContext = createContext();

export const useSocket = () => useContext(SocketContext);

const SocketProvider = ({ children }) => {
  const { token, isAuthenticated } = useAuth();
  const [socket, setSocket] = useState(null);
  const [isConnected, setIsConnected] = useState(false);
  const [connectionError, setConnectionError] = useState(null);

  useEffect(() => {
    let ws = null;

    const connectWebSocket = () => {
      if (!token || !isAuthenticated) {
        return;
      }

      // Close existing connection if any
      if (socket) {
        socket.close();
      }

      try {
        // Create WebSocket connection
        ws = new WebSocket(`ws://${window.location.host}/ws?token=${token}`);

        ws.onopen = () => {
          console.log('WebSocket connected');
          setIsConnected(true);
          setConnectionError(null);
        };

        ws.onclose = (event) => {
          console.log('WebSocket disconnected', event.code, event.reason);
          setIsConnected(false);
          
          // Attempt to reconnect unless the closure was intentional
          if (event.code !== 1000) {
            setTimeout(() => {
              console.log('Attempting to reconnect...');
              connectWebSocket();
            }, 3000);
          }
        };

        ws.onerror = (error) => {
          console.error('WebSocket error:', error);
          setConnectionError('Failed to connect to chat server');
        };

        setSocket(ws);
      } catch (error) {
        console.error('Error creating WebSocket connection:', error);
        setConnectionError('Failed to establish connection');
      }
    };

    connectWebSocket();

    // Cleanup function
    return () => {
      if (ws) {
        // Use code 1000 to indicate normal closure
        ws.close(1000, 'Component unmounted');
      }
    };
  }, [token, isAuthenticated]);

  // Add event listener method
  const addEventListener = (eventName, callback) => {
    if (!socket) return () => {};

    socket.addEventListener(eventName, callback);
    return () => socket.removeEventListener(eventName, callback);
  };

  // Send message method
  const sendMessage = (message) => {
    if (socket && isConnected) {
      socket.send(JSON.stringify(message));
      return true;
    }
    return false;
  };

  const value = {
    socket,
    isConnected,
    connectionError,
    addEventListener,
    sendMessage,
  };

  return (
    <SocketContext.Provider value={value}>
      {children}
    </SocketContext.Provider>
  );
};

export default SocketProvider; 