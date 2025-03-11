// Auth module for handling authentication
const Auth = (function() {
    // DOM elements
    const authContainer = document.getElementById('auth-container');
    const chatContainer = document.getElementById('chat-container');
    const loginForm = document.getElementById('login');
    const registerForm = document.getElementById('register');
    const showRegisterLink = document.getElementById('show-register');
    const showLoginLink = document.getElementById('show-login');
    const loginFormContainer = document.getElementById('login-form');
    const registerFormContainer = document.getElementById('register-form');
    const usernameElement = document.getElementById('username');
    const logoutButton = document.getElementById('logout');

    // Local storage keys
    const TOKEN_KEY = 'chat_token';
    const USER_KEY = 'chat_user';

    // Initialize auth state
    function init() {
        // Add event listeners
        loginForm.addEventListener('submit', handleLogin);
        registerForm.addEventListener('submit', handleRegister);
        showRegisterLink.addEventListener('click', showRegister);
        showLoginLink.addEventListener('click', showLogin);
        logoutButton.addEventListener('click', logout);

        // Check if user is already logged in
        const token = localStorage.getItem(TOKEN_KEY);
        const user = JSON.parse(localStorage.getItem(USER_KEY));

        if (token && user) {
            // User is logged in, show chat
            showChat(user);
        } else {
            // User is not logged in, show auth
            showAuth();
        }
    }

    // Handle login form submission
    async function handleLogin(e) {
        e.preventDefault();

        const username = document.getElementById('login-username').value;
        const password = document.getElementById('login-password').value;

        try {
            const response = await AuthAPI.login(username, password);

            // Save token and user to local storage
            localStorage.setItem(TOKEN_KEY, response.token);
            localStorage.setItem(USER_KEY, JSON.stringify(response.user));

            // Show chat
            showChat(response.user);

            // Reset form
            loginForm.reset();
        } catch (error) {
            alert(error.message || 'Login failed');
        }
    }

    // Handle register form submission
    async function handleRegister(e) {
        e.preventDefault();

        const username = document.getElementById('register-username').value;
        const email = document.getElementById('register-email').value;
        const password = document.getElementById('register-password').value;

        try {
            const response = await AuthAPI.register(username, email, password);

            // Save token and user to local storage
            localStorage.setItem(TOKEN_KEY, response.token);
            localStorage.setItem(USER_KEY, JSON.stringify(response.user));

            // Show chat
            showChat(response.user);

            // Reset form
            registerForm.reset();
        } catch (error) {
            alert(error.message || 'Registration failed');
        }
    }

    // Show register form
    function showRegister(e) {
        e.preventDefault();
        loginFormContainer.style.display = 'none';
        registerFormContainer.style.display = 'block';
    }

    // Show login form
    function showLogin(e) {
        e.preventDefault();
        registerFormContainer.style.display = 'none';
        loginFormContainer.style.display = 'block';
    }

    // Show chat interface
    function showChat(user) {
        // Update UI
        authContainer.style.display = 'none';
        chatContainer.style.display = 'flex';
        usernameElement.textContent = user.username;

        // Initialize chat module
        Chat.init();
    }

    // Show auth interface
    function showAuth() {
        // Update UI
        chatContainer.style.display = 'none';
        authContainer.style.display = 'block';
        loginFormContainer.style.display = 'block';
        registerFormContainer.style.display = 'none';
    }

    // Logout user
    function logout() {
        // Clear local storage
        localStorage.removeItem(TOKEN_KEY);
        localStorage.removeItem(USER_KEY);

        // Disconnect WebSocket
        Chat.disconnect();

        // Show auth
        showAuth();
    }

    // Get current user
    function getCurrentUser() {
        return JSON.parse(localStorage.getItem(USER_KEY));
    }

    // Get token
    function getToken() {
        return localStorage.getItem(TOKEN_KEY);
    }

    // Return public API
    return {
        init,
        getCurrentUser,
        getToken,
        showAuth,
        showChat
    };
})();

