# Chat App ⚡

A full-stack real-time chat application with channels, direct messages, file sharing, emoji reactions, and admin controls.

## Live Demo

- **Frontend:** https://nandakrishna21.github.io/my-fullstack-app/
- **Backend API:** https://chat-app-backend-fdhs.onrender.com

---

## Architecture

```
┌──────────────────────────────────────────────────────────────┐
│                     GITHUB PAGES (CDN)                       │
│  React SPA → Vite Build → Static HTML/JS/CSS                │
└──────────────────────────┬───────────────────────────────────┘
                           │ HTTP / WebSockets
                           ▼
┌──────────────────────────────────────────────────────────────┐
│                    RENDER (Node.js)                          │
│  Express REST API + Socket.IO Server                         │
│  Port 3001                                                   │
└──────────────────┬───────────────────────────────────────────┘
                   │ SQL
                   ▼
┌──────────────────────────────────────────────────────────────┐
│                    RENDER POSTGRESQL                         │
│  Tables: users, rooms, messages                              │
└──────────────────────────────────────────────────────────────┘
```

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| **Frontend** | React 18, Vite, Socket.IO Client |
| **Backend** | Express.js 4, Socket.IO 4, JWT (jsonwebtoken), bcrypt, Multer |
| **Database** | PostgreSQL (via `pg` driver) |
| **Auth** | JWT tokens (24h expiry), bcrypt password hashing |
| **Hosting** | GitHub Pages (frontend), Render (backend + DB) |
| **CI/CD** | GitHub Actions |

---

## Database Schema

### `users`
| Column | Type | Notes |
|--------|------|-------|
| id | SERIAL PK | |
| username | VARCHAR(50) UNIQUE | |
| password_hash | VARCHAR(255) | bcrypt hash |
| avatar_url | VARCHAR(500) | nullable |
| display_name | VARCHAR(50) | nullable |
| bio | TEXT | nullable |
| is_admin | BOOLEAN | default FALSE |
| created_at | TIMESTAMP | default NOW() |

### `rooms`
| Column | Type | Notes |
|--------|------|-------|
| id | SERIAL PK | |
| name | VARCHAR(100) | |
| type | VARCHAR(10) | 'channel' or 'dm' |
| participant_ids | INTEGER[] | for DMs only |
| invite_code | VARCHAR(20) | for channel invites |
| created_by | INTEGER FK→users | |
| created_at | TIMESTAMP | |

### `messages`
| Column | Type | Notes |
|--------|------|-------|
| id | SERIAL PK | |
| room_id | INTEGER FK→rooms | default 1 (General) |
| user_id | INTEGER FK→users | |
| username | VARCHAR(50) | denormalized for speed |
| content | TEXT | nullable if file only |
| file_url | VARCHAR(500) | nullable |
| file_name | VARCHAR(255) | nullable |
| file_type | VARCHAR(100) | nullable |
| file_size | INTEGER | nullable |
| reactions | JSONB | default '{}' |
| edited | BOOLEAN | default FALSE |
| created_at | TIMESTAMP | |

---

## Features

### 1. Authentication
- Register new account (password min 6 chars)
- Login with existing credentials
- JWT stored in localStorage, sent via `Authorization: Bearer` header
- **First user to ever register becomes admin**

### 2. Real-Time Chat (Socket.IO)
- Messages appear instantly on all connected clients
- **Message types:**
  - `send_message` → user sends a message
  - `edit_message` → user edits their message
  - `delete_message` → user deletes their message
  - `message_react` → user reacts to a message
  - `user_typing` / `user_stop_typing` → typing indicator
  - `system_message` → join/leave notifications
  - `new_room` / `room_updated` / `room_deleted` / `room_cleared` → room changes
  - `online_users` → live user list
  - `user_updated` → profile changes

### 3. Channels
- **General** channel (id: 1) exists by default, cannot be deleted
- Admins can **create**, **rename**, and **delete** channels
- Each channel has an **invite code** → shareable invite link
- Anyone can **join** a channel by entering the invite code

### 4. Direct Messages
- Click a user to start a 1-on-1 conversation
- Messages are private between the two participants

### 5. File Sharing
- Upload **images** (png, jpg, jpeg, gif, webp) and **PDFs**
- Max file size: **10MB**
- Image preview inline with click-to-expand overlay
- Paste images directly from clipboard
- Server stores files in `backend/uploads/`

### 6. Message Features
- **Edit** your own messages (shows "edited" badge)
- **Delete** your own messages
- **Emoji reactions** (👍 ❤️ 😂 😮 😢 😡)
- **Search** messages within a room
- **Date separators** between message groups
- **Message caching** in localStorage for persistence across refreshes

### 7. User System
- **Profile edit** → display name, bio, avatar upload
- **Online presence** → green dot next to online users
- **Appear Offline** mode → browse while appearing offline
- **Admin badge** → 👑 next to admin usernames
- **Admin can promote** any user to admin

### 8. UI/UX
- **Dark/Light theme** toggle (persisted in localStorage)
- **Responsive layout** with sidebar (rooms, DMs, online users)
- **Context menus** on rooms (rename, delete, invite, clear)
- **Connecting screen** while waiting for WebSocket connection

---

## API Endpoints

### Auth
```
POST /api/auth/register   → { username, password }  → { user, token }
POST /api/auth/login      → { username, password }  → { user, token }
```

### Rooms
```
GET    /api/rooms              → list all rooms
POST   /api/rooms              → { name } → create channel (admin only)
PUT    /api/rooms/:id          → { name } → rename (admin only)
DELETE /api/rooms/:id          → delete room + messages
POST   /api/rooms/join/:code   → join channel by invite code
GET    /api/rooms/:id/invite   → get invite code
DELETE /api/rooms/:id/messages → clear all messages in room
```

### Messages
```
GET    /api/messages?room_id=X&search=Y  → list messages
PUT    /api/messages/:id                 → { content } → edit
DELETE /api/messages/:id                  → delete message
POST   /api/messages/:id/react           → { emoji } → toggle reaction
```

### Users
```
GET    /api/users              → list all users (except self)
GET    /api/users/profile      → get own profile
PUT    /api/users/profile      → { display_name, bio } → update
POST   /api/users/avatar       → upload avatar image
POST   /api/users/promote      → { userId } → promote to admin
```

### Admin Setup
```
POST /api/setup/admin   → claim first admin (only if none exists)
```

### File Upload
```
POST /api/upload        → upload file (multipart/form-data)
```

### Health
```
GET  /api/health        → { status: "ok", timestamp }
```

### WebSocket Events (Socket.IO)
```
Client → Server:
  join, send_message, typing, stop_typing, status_update

Server → Client:
  new_message, edit_message, delete_message, message_react,
  user_typing, user_stop_typing, system_message,
  new_room, room_updated, room_deleted, room_cleared,
  online_users, user_updated
```

---

## App Flow

### User Registration
```
1. User opens app → sees Login/Register form
2. Enters username + password (min 6 chars)
3. POST /api/auth/register → bcrypt hash → INSERT users table
4. First user → is_admin = TRUE (auto-admin)
5. Returns JWT token + user object
6. Token saved to localStorage → Socket.IO connects
```

### Sending a Message
```
1. User types message + clicks Send (or Enter)
2. socket.emit("send_message", { roomId, userId, username, content })
3. Server INSERT INTO messages → broadcasts "new_message" to all clients
4. All connected clients append message to their list
5. Message cached in localStorage for persistence
```

### Receiving Messages (Refresh)
```
1. App mounts → check localStorage for cached messages
2. Display cached messages immediately (instant UX)
3. Fetch fresh data: GET /api/messages?room_id=X
4. Update state with server data → update cache
5. On failure → retry with exponential backoff (Render wake-up)
```

### Admin Promotion
```
1. Admin clicks 👑 button next to any user
2. POST /api/users/promote → { userId }
3. Server UPDATE users SET is_admin = TRUE
4. Broadcasts "user_updated" → client updates UI
```

---

## Local Development

### Prerequisites
- Node.js 18+
- PostgreSQL (or Docker)

### Setup

```bash
# 1. Clone
git clone https://github.com/nandakrishna21/my-fullstack-app.git
cd my-fullstack-app

# 2. Backend
cd backend
cp .env.example .env   # set DATABASE_URL and JWT_SECRET
npm install
npm run dev            # starts on http://localhost:3001

# 3. Frontend (new terminal)
cd frontend
cp .env.example .env   # set VITE_API_URL=http://localhost:3001
npm install
npm run dev            # starts on http://localhost:5173
```

### Environment Variables

**backend/.env**
```
DATABASE_URL=postgres://user:password@localhost:5432/chat_app
JWT_SECRET=your-secret-key
PORT=3001
NODE_ENV=development
```

**frontend/.env**
```
VITE_API_URL=http://localhost:3001
VITE_BASE_URL=/
```

---

## Deployment

### Render (Backend + Database)
1. Create a PostgreSQL database on Render
2. Create a Web Service connected to the GitHub repo
3. Set:
   - Build Command: `bash build.sh`
   - Start Command: `cd backend && npm start`
   - Environment Variables: `DATABASE_URL`, `JWT_SECRET` (auto-generate), `NODE_VERSION=18`, `NODE_ENV=production`

### GitHub Pages (Frontend)
The `.github/workflows/deploy.yml` workflow auto-builds and deploys to the `gh-pages` branch on every push to `main`.

---

## Admin Credentials

| Username | Password | Role |
|----------|----------|------|
| `nanda` | `nanda1` | Admin |
| `testuser99` | `test123456` | Admin |

---

## Project Structure

```
my-fullstack-app/
├── .github/workflows/deploy.yml   # CI/CD pipeline
├── backend/
│   ├── src/
│   │   ├── index.js               # Express server + Socket.IO + all routes
│   │   ├── db.js                  # PostgreSQL connection + schema init
│   │   ├── routes/auth.js         # Register/Login endpoints
│   │   └── middleware/auth.js     # JWT verification middleware
│   ├── uploads/                   # File storage directory
│   └── public/                    # Built frontend assets (from build.sh)
├── frontend/
│   ├── src/
│   │   ├── App.jsx                # Root component, auth state, socket setup
│   │   ├── main.jsx               # React entry point
│   │   ├── components/
│   │   │   ├── LoginForm.jsx      # Register/Login form
│   │   │   ├── ChatRoom.jsx       # Main chat UI (sidebar + messages + input)
│   │   │   ├── MessageList.jsx    # Message rendering, reactions, edit/delete
│   │   │   └── MessageInput.jsx   # Text input + file upload
│   │   └── styles/
│   │       └── index.css          # All styles (light + dark theme)
│   ├── index.html
│   └── vite.config.js
├── build.sh                       # Build script (frontend build → backend/public)
└── render.yaml                    # Render deployment config
```
