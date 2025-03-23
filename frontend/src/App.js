import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import './App.css';
import { useAuth } from './contexts/AuthContext';

function App() {
  const navigate = useNavigate();
  const { login, isAuthenticated, loading, error: authError, clearError } = useAuth();
  
  const [formData, setFormData] = useState({
    username: '',
    password: ''
  });
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  useEffect(() => {
    // If any auth errors exist, show them in the login form
    if (authError) {
      setError(authError);
    }
  }, [authError]);

  useEffect(() => {
    // Check if user is already authenticated
    if (!loading && isAuthenticated) {
      // Redirect to chat if already logged in
      navigate('/chat');
    }
  }, [navigate, isAuthenticated, loading]);

  // Clear errors when unmounting
  useEffect(() => {
    return () => {
      clearError();
    };
  }, [clearError]);

  // Handle input changes
  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prevData => ({
      ...prevData,
      [name]: value
    }));
    // Clear errors when user starts typing
    setError('');
  };

  // Handle form submission
  const handleSubmit = async (e) => {
    e.preventDefault(); // Prevent default form submission behavior
    
    if (!formData.username || !formData.password) {
      setError('Please enter both username and password');
      return;
    }
    
    setIsLoading(true);
    setError('');
    
    try {
      const success = await login(formData.username, formData.password);
      
      if (success) {
        // Show success message
        setMessage('Login successful! Redirecting...');
        
        // Redirect to chat interface using React Router
        setTimeout(() => {
          navigate('/chat');
        }, 1000);
      }
    } catch (err) {
      console.error('Login error:', err);
    } finally {
      setIsLoading(false);
    }
  };

  // If still checking authentication, show loading
  if (loading) {
    return (
      <div className="app">
        <header className="app-header">
          <h1>Chat Application</h1>
          <p>Loading...</p>
        </header>
      </div>
    );
  }

  return (
    <div className="app">
      <header className="app-header">
        <h1>Chat Application</h1>
        <p>Welcome to our modern chat application!</p>
      </header>
      <main className="app-main">
        <div className="login-form">
          <h2>Login</h2>
          
          {error && (
            <div className="error-message">
              {error}
            </div>
          )}
          
          {message && (
            <div className="success-message">
              {message}
            </div>
          )}
          
          <form onSubmit={handleSubmit}>
            <div className="form-group">
              <label htmlFor="username">Username</label>
              <input 
                type="text" 
                id="username" 
                name="username" 
                value={formData.username}
                onChange={handleChange}
                placeholder="Enter your username"
              />
            </div>
            <div className="form-group">
              <label htmlFor="password">Password</label>
              <input 
                type="password" 
                id="password" 
                name="password"
                value={formData.password}
                onChange={handleChange}
                placeholder="Enter your password" 
              />
            </div>
            <button 
              type="submit" 
              className="btn-primary"
              disabled={isLoading}
            >
              {isLoading ? 'Signing In...' : 'Sign In'}
            </button>
          </form>
          <p className="register-link">
            Don't have an account? <Link to="/register">Register</Link>
          </p>
        </div>
      </main>
      <footer className="app-footer">
        <p>© 2025 Chat Application.</p>
      </footer>
    </div>
  );
}

export default App;
