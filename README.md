# 💬 Real-Time Chat Application

<div align="center">

**A modern, feature-rich chat platform with real-time messaging, friend management, and Redis-powered performance.**

[![Go Version](https://img.shields.io/badge/Go-1.18+-00ADD8?style=flat-square&logo=go)](https://golang.org)
[![React Version](https://img.shields.io/badge/React-18.0+-61DAFB?style=flat-square&logo=react)](https://reactjs.org)
[![PostgreSQL Version](https://img.shields.io/badge/PostgreSQL-Latest-4169E1?style=flat-square&logo=postgresql&logoColor=white)](https://www.postgresql.org)
[![Redis Version](https://img.shields.io/badge/Redis-Latest-DC382D?style=flat-square&logo=redis&logoColor=white)](https://redis.io)
[![License](https://img.shields.io/badge/License-MIT-blue?style=flat-square)](LICENSE)

</div>

---

## ✨ Features

### Core Functionality
- **⚡ Real-Time Communication**: Lightning-fast messaging using WebSockets
- **🔒 Secure Authentication**: JWT token-based user authentication system
- **🌐 Global Chat Hub**: Connect with all online users in a shared space
- **💌 Private Messaging**: One-on-one conversations with specific users
- **👥 Friend Management System**: 
  - Send friend requests
  - Accept or decline incoming requests
  - View a list of all your connected friends
  - Remove connections when needed

### User Experience
- **🟢 Online Status Indicators**: See who's currently available to chat
- **👁️ Offline Message Support**: Send messages to offline users that they'll receive when back online
- **💅 Responsive Design**: Beautiful UI that works on desktops, tablets, and mobile devices

### Technical Features
- **⚡ Redis Caching**: High-performance message caching for improved speed
- **🗄️ PostgreSQL Database**: Reliable and scalable data persistence
- **🔄 Optimistic UI Updates**: Messages appear instantly for a fluid user experience
- **⏱️ Accurate Timestamp Display**: Messages show precise sending time

## 🧰 Tech Stack

### Backend
- **Go**: Fast, efficient server-side processing
- **Gorilla WebSocket**: Real-time WebSocket communication
- **PostgreSQL**: Relational database for data persistence
- **Redis**: In-memory data store for caching
- **JWT**: Secure user authentication

### Frontend
- **React**: Component-based UI library
- **React Router**: Client-side routing
- **WebSockets**: Real-time client-server communication
- **CSS3**: Modern styling with responsive design

## 🚀 Getting Started

### Prerequisites

To run this application, you need:

- Go 1.18 or higher
- Node.js 14 or higher
- PostgreSQL database
- Redis server (optional, but recommended for production)

### Quick Start Guide

#### 1. Clone the repository

```bash
git clone https://github.com/askarbtw/golang-chat-app.git
cd golang-chat-app
```

#### 2. Set up environment variables

Copy the example environment file and adjust the values as needed:

```bash
cp .env.example .env
```

#### 3. Database Setup

Create a PostgreSQL database:

```bash
createdb chatdb
```

The application will automatically create the necessary tables on startup.

#### 4. Build the Frontend

```bash
cd frontend
npm install
npm run build
cd ..
```

#### 5. Run the Application

```bash
go run main.go
```

🎉 The application will be available at `http://localhost:8080`

## 🔧 Configuration

All configuration is handled through environment variables in the `.env` file:

| Variable | Description | Default |
|----------|-------------|---------|
| `DB_CONNECTION` | PostgreSQL connection string | `postgres://postgres:askarbtw@localhost:5432/chatdb?sslmode=disable` |
| `REDIS_ADDRESS` | Redis server address | `localhost:6379` |
| `REDIS_PASSWORD` | Redis password (if required) | (none) |
| `REDIS_DB` | Redis database number | `0` |
| `JWT_SECRET` | Secret key for JWT tokens | (random default, change in production!) |
| `PORT` | Server port | `8080` |

## 📡 API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/register` | POST | Register a new user |
| `/api/login` | POST | User login |
| `/api/friends` | GET | Get list of friends |
| `/api/friends/request` | POST | Send a friend request |
| `/api/friends/accept` | POST | Accept a friend request |
| `/api/friends/decline` | POST | Decline a friend request |
| `/api/friends/remove` | POST | Remove a friend |
| `/api/friends/pending` | GET | Get pending friend requests |
| `/ws` | WebSocket | Real-time communication endpoint |

## 🔜 Coming Soon

- **🔐 End-to-end encryption** for enhanced privacy
- **✓ Read receipts** to confirm message delivery
- **📎 File sharing** capabilities
- **👪 Group chats** for multi-user conversations
- **🖼️ User profiles** with custom avatars
- **🔍 Message search** functionality
- **📱 Mobile app** versions for iOS and Android

## 📝 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- Thanks to all contributors who have helped shape this project
- Special thanks to the open-source community for the tools that made this possible

---

<div align="center">
  <p>Made with ❤️ by <a href="https://github.com/askarbtw">askarbtw</a></p>
</div> 
