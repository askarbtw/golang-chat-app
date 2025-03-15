import { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { useAuth } from '../contexts/AuthContext';

export const useFriends = () => {
  const { token, isAuthenticated, setError } = useAuth();
  const [friends, setFriends] = useState([]);
  const [pendingRequests, setPendingRequests] = useState([]);
  const [loading, setLoading] = useState(false);

  // Fetch friends list
  const fetchFriends = useCallback(async () => {
    if (!isAuthenticated || !token) return;
    
    setLoading(true);
    try {
      const response = await axios.get('/api/friends', {
        headers: { Authorization: token }
      });
      setFriends(response.data || []);
    } catch (error) {
      console.error('Error fetching friends:', error);
      setError(error.response?.data || 'Failed to fetch friends');
    } finally {
      setLoading(false);
    }
  }, [isAuthenticated, token, setError]);

  // Fetch pending friend requests
  const fetchPendingRequests = useCallback(async () => {
    if (!isAuthenticated || !token) return;
    
    setLoading(true);
    try {
      const response = await axios.get('/api/friends/pending', {
        headers: { Authorization: token }
      });
      setPendingRequests(response.data || []);
    } catch (error) {
      console.error('Error fetching pending requests:', error);
      setError(error.response?.data || 'Failed to fetch friend requests');
    } finally {
      setLoading(false);
    }
  }, [isAuthenticated, token, setError]);

  // Initialize data on mount or auth change
  useEffect(() => {
    if (isAuthenticated) {
      fetchFriends();
      fetchPendingRequests();
    }
  }, [isAuthenticated, fetchFriends, fetchPendingRequests]);

  // Send friend request
  const sendFriendRequest = useCallback(async (username) => {
    if (!isAuthenticated || !token || !username.trim()) return false;
    
    setLoading(true);
    try {
      await axios.post('/api/friends/request', 
        { friend_username: username.trim() },
        { headers: { Authorization: token } }
      );
      setError('Friend request sent successfully!');
      
      // Clear success message after 3 seconds
      setTimeout(() => setError(''), 3000);
      
      return true;
    } catch (error) {
      console.error('Error sending friend request:', error);
      setError(error.response?.data || 'Failed to send friend request');
      return false;
    } finally {
      setLoading(false);
    }
  }, [isAuthenticated, token, setError]);

  // Accept friend request
  const acceptFriendRequest = useCallback(async (username) => {
    if (!isAuthenticated || !token) return false;
    
    setLoading(true);
    try {
      await axios.post('/api/friends/accept',
        { friend_username: username },
        { headers: { Authorization: token } }
      );
      
      await fetchFriends();
      await fetchPendingRequests();
      return true;
    } catch (error) {
      console.error('Error accepting friend request:', error);
      setError(error.response?.data || 'Failed to accept friend request');
      return false;
    } finally {
      setLoading(false);
    }
  }, [isAuthenticated, token, setError, fetchFriends, fetchPendingRequests]);

  // Decline friend request
  const declineFriendRequest = useCallback(async (username) => {
    if (!isAuthenticated || !token) return false;
    
    setLoading(true);
    try {
      await axios.post('/api/friends/decline',
        { friend_username: username },
        { headers: { Authorization: token } }
      );
      
      await fetchPendingRequests();
      return true;
    } catch (error) {
      console.error('Error declining friend request:', error);
      setError(error.response?.data || 'Failed to decline friend request');
      return false;
    } finally {
      setLoading(false);
    }
  }, [isAuthenticated, token, setError, fetchPendingRequests]);

  // Remove friend
  const removeFriend = useCallback(async (username) => {
    if (!isAuthenticated || !token) return false;
    
    // Confirm before removing
    if (!window.confirm(`Are you sure you want to remove ${username} from your friends?`)) {
      return false;
    }
    
    setLoading(true);
    try {
      await axios.post('/api/friends/remove',
        { friend_username: username },
        { headers: { Authorization: token } }
      );
      
      await fetchFriends();
      return true;
    } catch (error) {
      console.error('Error removing friend:', error);
      setError(error.response?.data || 'Failed to remove friend');
      return false;
    } finally {
      setLoading(false);
    }
  }, [isAuthenticated, token, setError, fetchFriends]);

  return {
    friends,
    pendingRequests,
    loading,
    fetchFriends,
    fetchPendingRequests,
    sendFriendRequest,
    acceptFriendRequest,
    declineFriendRequest,
    removeFriend
  };
}; 