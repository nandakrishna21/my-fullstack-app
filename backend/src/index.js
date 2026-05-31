import express from 'express';
import http from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import 'dotenv/config';
import pool, { initDB } from './db.js';
import authRoutes from './routes/auth.js';
import { authenticateToken } from './middleware/auth.js';

const app = express();
const server = http.createServer(app);
const isProd = process.env.NODE_ENV === 'production';
const allowedOrigins = isProd
  ? true
  : ['http://localhost:5173', 'http://localhost:4173'];

const io = new Server(server, {
  cors: { origin: allowedOrigins, methods: ['GET', 'POST'] },
});

app.use(cors({ origin: allowedOrigins }));
app.use(express.json());

app.use('/api/auth', authRoutes);

app.get('/api/messages', authenticateToken, async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT id, user_id, username, content, created_at FROM messages ORDER BY created_at ASC LIMIT 100'
    );
    res.json(result.rows);
  } catch (err) {
    console.error('Fetch messages error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

const onlineUsers = new Map();

io.on('connection', (socket) => {
  console.log('User connected:', socket.id);

  socket.on('join', (userData) => {
    socket.userData = userData;
    onlineUsers.set(socket.id, userData);
    io.emit('online_users', Array.from(onlineUsers.values()));
    io.emit('system_message', { content: `${userData.username} joined the chat` });
  });

  socket.on('send_message', async (data) => {
    try {
      const result = await pool.query(
        'INSERT INTO messages (user_id, username, content) VALUES ($1, $2, $3) RETURNING id, user_id, username, content, created_at',
        [data.userId, data.username, data.content]
      );
      io.emit('new_message', result.rows[0]);
    } catch (err) {
      console.error('Save message error:', err);
    }
  });

  socket.on('disconnect', () => {
    const user = onlineUsers.get(socket.id);
    if (user) {
      onlineUsers.delete(socket.id);
      io.emit('online_users', Array.from(onlineUsers.values()));
      io.emit('system_message', { content: `${user.username} left the chat` });
    }
    console.log('User disconnected:', socket.id);
  });
});

app.use(express.static('public'));

app.get('*', (_req, res) => {
  res.sendFile('index.html', { root: 'public' });
});

const PORT = process.env.PORT || 3001;

async function start() {
  try {
    await initDB();
    server.listen(PORT, () => {
      console.log(`Server running on http://localhost:${PORT}`);
    });
  } catch (err) {
    console.error('Failed to start server:', err);
    process.exit(1);
  }
}

start();
