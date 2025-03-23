import React, { createContext, useState, useContext, useEffect, useCallback } from 'react';
import axios from 'axios';

const AuthContext = createContext();

export const useAuth = () => useContext(AuthContext);

export const AuthProvider = ({ children }) => {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [token, setToken] = useState(localStorage.getItem('token') || '');
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const login = useCallback(async (username, password) => {
    try {
      const response = await axios.post('/api/login', { username, password });
      const { token, user } = response.data;
      
      localStorage.setItem('token', token);
      setToken(token);
      setUser(user);
      setIsAuthenticated(true);
      setError('');
      return true;
    } catch (err) {
      console.error('Login error:', err);
      setError(err.response?.data || 'Invalid credentials');
      return false;
    }
  }, []);

  const register = useCallback(async (username, password, email) => {
    try {
      const response = await axios.post('/api/register', { username, password, email });
      const { token, user } = response.data;
      
      localStorage.setItem('token', token);
      setToken(token);
      setUser(user);
      setIsAuthenticated(true);
      setError('');
      return true;
    } catch (err) {
      console.error('Registration error:', err);
      setError(err.response?.data || 'Registration failed');
      return false;
    }
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem('token');
    setToken('');
    setUser(null);
    setIsAuthenticated(false);
  }, []);

  const validateToken = useCallback(async () => {
    if (!token) {
      setLoading(false);
      return;
    }

    try {
      // Extract username from JWT token instead of making an API call
      const tokenParts = token.split('.');
      if (tokenParts.length === 3) {
        // Decode the payload part (second part) of the JWT
        const base64Url = tokenParts[1];
        const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
        const payload = JSON.parse(atob(base64));
        
        if (payload && payload.username) {
          // Set authentication state based on token data
          setIsAuthenticated(true);
          setUser({ username: payload.username });
        } else {
          // Invalid token payload
          localStorage.removeItem('token');
          setToken('');
          setIsAuthenticated(false);
          setUser(null);
        }
      } else {
        // Invalid token format
        localStorage.removeItem('token');
        setToken('');
        setIsAuthenticated(false);
        setUser(null);
      }
    } catch (err) {
      console.error('Token validation error:', err);
      localStorage.removeItem('token');
      setToken('');
      setIsAuthenticated(false);
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, [token]);

  // Validate token on mount and when token changes
  useEffect(() => {
    validateToken();
  }, [validateToken]);

  // Set authorization header for all axios requests
  useEffect(() => {
    if (token) {
      axios.defaults.headers.common['Authorization'] = token;
    } else {
      delete axios.defaults.headers.common['Authorization'];
    }
  }, [token]);

  const clearError = () => setError('');

  const value = {
    isAuthenticated,
    token,
    user,
    loading,
    error,
    login,
    register,
    logout,
    setError,
    clearError
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};

export default AuthContext; 