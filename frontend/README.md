# Go Chat - Modern React Chat Application

A sleek, responsive chat application built with React, ChakraUI, and WebSockets that allows users to chat publicly or privately and manage friends.

![Go Chat UI](https://via.placeholder.com/800x450.png?text=Go+Chat+UI)

## Features

- **Authentication** - Secure login and registration
- **Real-time Messaging** - Chat with all users in group chat
- **Private Messaging** - Direct messages with specific users
- **Friend Management**
  - Send friend requests
  - Accept/decline incoming requests
  - View and manage your friend list 
- **Online Status** - See who's currently online
- **Responsive Design** - Works on desktop and mobile devices
- **Dark Mode Support** - Beautiful interface in both light and dark modes

## Tech Stack

- **Frontend**
  - React (with Hooks)
  - ChakraUI for design
  - React Router for navigation
  - Custom hooks for state management
  - WebSocket for real-time communication

- **Backend**
  - Go (Golang) server
  - WebSocket for real-time updates
  - JWT for authentication

## Getting Started

### Prerequisites

- Node.js 16+ 
- npm or yarn
- Go 1.16+ (for the backend server)

### Installation

1. Clone the repository
```bash
git clone https://github.com/yourusername/go-chat.git
cd go-chat
```

2. Install dependencies in the React app
```bash
cd chat-app
npm install
```

3. Start the frontend development server
```bash
npm start
```

4. In a separate terminal, start the Go backend server
```bash
go run main.go
```

5. Open your browser at http://localhost:3000

## Project Structure

```
chat-app/
├── public/              # Static files
├── src/
│   ├── components/      # React components
│   │   ├── Auth/        # Login, Register components
│   │   ├── Chat/        # Chat interface components
│   │   ├── Friends/     # Friend management components
│   │   ├── Layout/      # Structural components
│   │   └── common/      # Reusable UI components
│   ├── contexts/        # Context providers
│   ├── hooks/           # Custom React hooks
│   ├── services/        # API services
│   ├── styles/          # Global styles and theme
│   ├── App.jsx          # Main app component
│   └── index.js         # Entry point
└── package.json         # Dependencies and scripts
```

## API Endpoints

The backend provides the following API endpoints:

- **Authentication**
  - `POST /api/register` - Register a new user
  - `POST /api/login` - Login and receive JWT token

- **Friends**
  - `GET /api/friends` - Get friends list
  - `GET /api/friends/pending` - Get pending friend requests
  - `POST /api/friends/request` - Send a friend request
  - `POST /api/friends/accept` - Accept a friend request
  - `POST /api/friends/decline` - Decline a friend request
  - `POST /api/friends/remove` - Remove a friend

- **WebSocket**
  - `/ws` - WebSocket endpoint for real-time chat

## Future Enhancements

- Message delivery status indicators
- Read receipts
- Typing indicators
- File and image sharing
- Voice and video calls
- Message reactions and threads
- User profiles with avatars

## License

This project is licensed under the MIT License - see the LICENSE file for details.

## Acknowledgements

- [React](https://reactjs.org/)
- [Chakra UI](https://chakra-ui.com/)
- [Go](https://golang.org/)
