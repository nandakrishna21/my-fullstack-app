import express from 'express';
import http from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import 'dotenv/config';
import pool, { initDB } from './db.js';
import authRoutes from './routes/auth.js';
import { authenticateToken } from './middleware/auth.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const uploadsDir = path.join(__dirname, '..', 'uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, uploadsDir),
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, `${Date.now()}-${Math.random().toString(36).slice(2)}${ext}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const allowed = /\.(png|jpg|jpeg|gif|webp|pdf)$/i;
    if (allowed.test(path.extname(file.originalname))) {
      cb(null, true);
    } else {
      cb(new Error('Only images and PDF files are allowed'));
    }
  },
});

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

app.use('/uploads', express.static(uploadsDir));

app.post('/api/upload', authenticateToken, (req, res) => {
  upload.single('file')(req, res, (err) => {
    if (err) {
      if (err instanceof multer.MulterError) {
        return res.status(400).json({ error: 'File too large (max 10MB)' });
      }
      return res.status(400).json({ error: err.message });
    }
    if (!req.file) {
      return res.status(400).json({ error: 'No file provided' });
    }
    res.json({
      url: `/uploads/${req.file.filename}`,
      name: req.file.originalname,
      type: req.file.mimetype,
      size: req.file.size,
    });
  });
});

app.get('/api/messages', authenticateToken, async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT id, user_id, username, content, file_url, file_name, file_type, file_size, created_at FROM messages ORDER BY created_at ASC LIMIT 100'
    );
    res.json(result.rows);
  } catch (err) {
    console.error('Fetch messages error:', err.message);
    res.json([]);
  }
});

app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

const onlineUsers = new Map();

io.on('connection', (socket) => {
  console.log('User connected:', socket.id);

  socket.on('join', (userData) => {
    const entry = { id: userData.id, username: userData.username, status: userData.status || 'online' };
    socket.userData = entry;
    onlineUsers.set(socket.id, entry);
    io.emit('online_users', Array.from(onlineUsers.values()).filter(u => u.status === 'online'));
    io.emit('system_message', { content: `${userData.username} joined the chat` });
  });

  socket.on('status_update', (status) => {
    const entry = onlineUsers.get(socket.id);
    if (entry) {
      entry.status = status;
      onlineUsers.set(socket.id, entry);
      io.emit('online_users', Array.from(onlineUsers.values()).filter(u => u.status === 'online'));
    }
  });

  socket.on('send_message', async (data) => {
    try {
      const result = await pool.query(
        `INSERT INTO messages (user_id, username, content, file_url, file_name, file_type, file_size)
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         RETURNING id, user_id, username, content, file_url, file_name, file_type, file_size, created_at`,
        [data.userId, data.username, data.content || null, data.fileUrl || null, data.fileName || null, data.fileType || null, data.fileSize || null]
      );
      io.emit('new_message', result.rows[0]);
    } catch (err) {
      console.error('Save message error:', err.message);
      io.emit('new_message', {
        id: Date.now(),
        user_id: data.userId,
        username: data.username,
        content: data.content || null,
        file_url: data.fileUrl || null,
        file_name: data.fileName || null,
        file_type: data.fileType || null,
        file_size: data.fileSize || null,
        created_at: new Date().toISOString(),
      });
    }
  });

  socket.on('typing', () => {
    socket.broadcast.emit('user_typing', socket.userData?.username);
  });

  socket.on('stop_typing', () => {
    socket.broadcast.emit('user_stop_typing', socket.userData?.username);
  });

  socket.on('disconnect', () => {
    const user = onlineUsers.get(socket.id);
    if (user) {
      onlineUsers.delete(socket.id);
      io.emit('online_users', Array.from(onlineUsers.values()).filter(u => u.status === 'online'));
      if (user.status === 'online') {
        io.emit('system_message', { content: `${user.username} left the chat` });
      }
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
