import React, { createContext, useState, useEffect, useContext } from 'react';
import axios from 'axios';

const AuthContext = createContext();

export const useAuth = () => useContext(AuthContext);

const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(localStorage.getItem('token') || '');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Set authorization header for all axios requests
  useEffect(() => {
    if (token) {
      axios.defaults.headers.common['Authorization'] = token;
    } else {
      delete axios.defaults.headers.common['Authorization'];
    }
  }, [token]);

  // Validate token and set user on mount
  useEffect(() => {
    const validateToken = async () => {
      if (!token) {
        setLoading(false);
        return;
      }

      try {
        // Decode JWT token
        const base64Url = token.split('.')[1];
        const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
        const payload = JSON.parse(window.atob(base64));
        
        setUser({ username: payload.username });
      } catch (error) {
        console.error('Invalid token:', error);
        localStorage.removeItem('token');
        setToken('');
      } finally {
        setLoading(false);
      }
    };

    validateToken();
  }, [token]);

  const login = async (credentials) => {
    setError('');
    try {
      const response = await axios.post('/api/login', credentials);
      const { token, user } = response.data;
      
      localStorage.setItem('token', token);
      setToken(token);
      setUser(user);
      return true;
    } catch (error) {
      const errorMessage = error.response?.data || 'Login failed';
      setError(errorMessage);
      return false;
    }
  };

  const register = async (userData) => {
    setError('');
    try {
      const response = await axios.post('/api/register', userData);
      const { token, user } = response.data;
      
      localStorage.setItem('token', token);
      setToken(token);
      setUser(user);
      return true;
    } catch (error) {
      const errorMessage = error.response?.data || 'Registration failed';
      setError(errorMessage);
      return false;
    }
  };

  const logout = () => {
    localStorage.removeItem('token');
    setToken('');
    setUser(null);
  };

  const value = {
    user,
    token,
    loading,
    error,
    login,
    register,
    logout,
    isAuthenticated: !!user,
    setError
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export default AuthProvider; 