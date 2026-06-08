import express from 'express';
import http from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import 'dotenv/config';
import jwt from 'jsonwebtoken';
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

app.post('/api/messages', authenticateToken, async (req, res) => {
  try {
    const { room_id, content, reply_to, file_url, file_name, file_type, file_size } = req.body;
    const result = await pool.query(
      `INSERT INTO messages (room_id, user_id, username, content, file_url, file_name, file_type, file_size, reply_to)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING *`,
      [room_id || 1, req.user.id, req.user.username, content || null, file_url || null, file_name || null, file_type || null, file_size || null, reply_to || null]
    );
    const msg = result.rows[0];
    if (msg.reply_to) {
      const replyRes = await pool.query('SELECT id, username, content, file_url, file_name FROM messages WHERE id = $1', [msg.reply_to]);
      msg.reply_to_message = replyRes.rows[0] || null;
    }
    io.emit('new_message', msg);
    res.status(201).json(msg);
  } catch (err) {
    console.error('Create message error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

app.get('/api/messages', authenticateToken, async (req, res) => {
  try {
    const { search, room_id } = req.query;
    let query = `SELECT m.*, 
      jsonb_build_object('id', r.id, 'username', r.username, 'content', r.content, 'file_url', r.file_url, 'file_name', r.file_name) AS reply_to_message
      FROM messages m LEFT JOIN messages r ON m.reply_to = r.id`;
    let params = [];
    const conditions = [];
    if (room_id) {
      conditions.push(`m.room_id = $${params.length + 1}`);
      params.push(room_id);
    }
    if (search) {
      conditions.push(`m.content ILIKE $${params.length + 1}`);
      params.push(`%${search}%`);
    }
    if (conditions.length > 0) {
      query += ' WHERE ' + conditions.join(' AND ');
    }
    query += ' ORDER BY m.created_at ASC LIMIT 100';
    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (err) {
    console.error('Fetch messages error:', err.message);
    res.json([]);
  }
});

app.get('/api/rooms', authenticateToken, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT * FROM rooms WHERE type = 'channel' OR (type = 'dm' AND $1 = ANY(participant_ids)) ORDER BY created_at ASC`,
      [req.user.id]
    );
    for (const row of result.rows) {
      if (row.type === 'channel' && !row.invite_code) {
        const code = Math.random().toString(36).slice(2, 10);
        await pool.query('UPDATE rooms SET invite_code = $1 WHERE id = $2', [code, row.id]);
        row.invite_code = code;
      }
    }
    res.json(result.rows);
  } catch (err) {
    console.error('Fetch rooms error:', err.message);
    res.json([]);
  }
});

app.post('/api/rooms', authenticateToken, async (req, res) => {
  try {
    const { name } = req.body;
    if (!name || !name.trim()) {
      return res.status(400).json({ error: 'Room name required' });
    }
    if (!req.user.is_admin) {
      return res.status(403).json({ error: 'Only admins can create channels' });
    }
    const inviteCode = Math.random().toString(36).slice(2, 10);
    const result = await pool.query(
      'INSERT INTO rooms (name, type, created_by, invite_code) VALUES ($1, $2, $3, $4) RETURNING *',
      [name.trim(), 'channel', req.user.id, inviteCode]
    );
    const room = result.rows[0];
    io.emit('new_room', room);
    res.status(201).json(room);
  } catch (err) {
    console.error('Create room error:', err.message);
    res.status(500).json({ error: 'Server error' });
  }
});

app.put('/api/rooms/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const { name } = req.body;
    if (!name || !name.trim()) {
      return res.status(400).json({ error: 'Room name required' });
    }
    if (!req.user.is_admin) {
      return res.status(403).json({ error: 'Only admins can rename channels' });
    }
    const result = await pool.query(
      'UPDATE rooms SET name = $1 WHERE id = $2 AND type = $3 RETURNING *',
      [name.trim(), id, 'channel']
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Room not found' });
    }
    const room = result.rows[0];
    io.emit('room_updated', room);
    res.json(room);
  } catch (err) {
    console.error('Update room error:', err.message);
    res.status(500).json({ error: 'Server error' });
  }
});

app.delete('/api/rooms/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    if (Number(id) === 1) {
      return res.status(400).json({ error: 'Cannot delete General channel' });
    }
    const result = await pool.query(
      'DELETE FROM rooms WHERE id = $1 RETURNING id',
      [id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Room not found' });
    }
    io.emit('room_deleted', { id: Number(id) });
    res.json({ message: 'Deleted' });
  } catch (err) {
    console.error('Delete room error:', err.message);
    res.status(500).json({ error: 'Server error' });
  }
});

app.delete('/api/rooms/:id/messages', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    await pool.query('DELETE FROM messages WHERE room_id = $1', [id]);
    io.emit('room_cleared', { id: Number(id) });
    res.json({ message: 'Chat cleared' });
  } catch (err) {
    console.error('Clear room error:', err.message);
    res.status(500).json({ error: 'Server error' });
  }
});

app.delete('/api/rooms/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    if (Number(id) === 1) {
      return res.status(400).json({ error: 'Cannot delete General channel' });
    }
    if (!req.user.is_admin) {
      return res.status(403).json({ error: 'Only admins can delete channels' });
    }
    const result = await pool.query('DELETE FROM rooms WHERE id = $1 RETURNING id', [id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Room not found' });
    }
    io.emit('room_deleted', { id: Number(id) });
    res.json({ message: 'Deleted' });
  } catch (err) {
    console.error('Delete room error:', err.message);
    res.status(500).json({ error: 'Server error' });
  }
});

app.get('/api/rooms/:id/invite', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const result = await pool.query('SELECT invite_code FROM rooms WHERE id = $1', [id]);
    if (result.rows.length === 0) return res.status(404).json({ error: 'Room not found' });
    res.json({ inviteCode: result.rows[0].invite_code });
  } catch (err) {
    console.error('Invite error:', err.message);
    res.status(500).json({ error: 'Server error' });
  }
});

app.post('/api/rooms/join/:code', authenticateToken, async (req, res) => {
  try {
    const { code } = req.params;
    const result = await pool.query('SELECT * FROM rooms WHERE invite_code = $1', [code]);
    if (result.rows.length === 0) return res.status(404).json({ error: 'Invalid invite code' });
    res.json(result.rows[0]);
  } catch (err) {
    console.error('Join error:', err.message);
    res.status(500).json({ error: 'Server error' });
  }
});

app.post('/api/conversations', authenticateToken, async (req, res) => {
  try {
    const { userId } = req.body;
    if (!userId || userId === req.user.id) {
      return res.status(400).json({ error: 'Invalid user' });
    }
    const existing = await pool.query(
      `SELECT * FROM rooms WHERE type = 'dm' AND $1 = ANY(participant_ids) AND $2 = ANY(participant_ids)`,
      [req.user.id, userId]
    );
    if (existing.rows.length > 0) {
      return res.json(existing.rows[0]);
    }
    const userResult = await pool.query('SELECT username FROM users WHERE id = $1', [userId]);
    if (userResult.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }
    const otherUser = userResult.rows[0].username;
    const result = await pool.query(
      `INSERT INTO rooms (name, type, participant_ids, created_by) VALUES ($1, 'dm', $2, $3) RETURNING *`,
      [otherUser, [req.user.id, userId], req.user.id]
    );
    const room = result.rows[0];
    io.emit('new_room', room);
    res.status(201).json(room);
  } catch (err) {
    console.error('Create conversation error:', err.message);
    res.status(500).json({ error: 'Server error' });
  }
});

app.get('/api/users', authenticateToken, async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT id, username, avatar_url, display_name, is_admin FROM users WHERE id != $1 ORDER BY username ASC',
      [req.user.id]
    );
    res.json(result.rows);
  } catch (err) {
    console.error('Fetch users error:', err.message);
    res.json([]);
  }
});

app.put('/api/messages/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const { content } = req.body;
    const result = await pool.query(
      'UPDATE messages SET content = $1, edited = TRUE WHERE id = $2 AND user_id = $3 RETURNING *',
      [content, id, req.user.id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Message not found or not owned by you' });
    }
    io.emit('edit_message', result.rows[0]);
    res.json(result.rows[0]);
  } catch (err) {
    console.error('Edit message error:', err.message);
    res.status(500).json({ error: 'Server error' });
  }
});

app.delete('/api/messages/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const result = await pool.query(
      'DELETE FROM messages WHERE id = $1 AND user_id = $2 RETURNING id',
      [id, req.user.id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Message not found or not owned by you' });
    }
    io.emit('delete_message', { id: Number(id) });
    res.json({ message: 'Deleted' });
  } catch (err) {
    console.error('Delete message error:', err.message);
    res.status(500).json({ error: 'Server error' });
  }
});

app.post('/api/messages/:id/react', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const { emoji } = req.body;
    const msgResult = await pool.query('SELECT * FROM messages WHERE id = $1', [id]);
    if (msgResult.rows.length === 0) {
      return res.status(404).json({ error: 'Message not found' });
    }
    const msg = msgResult.rows[0];
    const reactions = typeof msg.reactions === 'string' ? JSON.parse(msg.reactions) : (msg.reactions || {});
    const username = req.user.username;
    if (reactions[emoji] && reactions[emoji].includes(username)) {
      reactions[emoji] = reactions[emoji].filter((u) => u !== username);
      if (reactions[emoji].length === 0) delete reactions[emoji];
    } else {
      if (!reactions[emoji]) reactions[emoji] = [];
      if (!reactions[emoji].includes(username)) reactions[emoji].push(username);
    }
    await pool.query('UPDATE messages SET reactions = $1 WHERE id = $2', [JSON.stringify(reactions), id]);
    const updated = await pool.query('SELECT * FROM messages WHERE id = $1', [id]);
    io.emit('message_react', updated.rows[0]);
    res.json(updated.rows[0]);
  } catch (err) {
    console.error('React error:', err.message);
    res.status(500).json({ error: 'Server error' });
  }
});

app.get('/api/users/profile', authenticateToken, async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT id, username, avatar_url, display_name, bio, is_admin, created_at FROM users WHERE id = $1',
      [req.user.id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }
    res.json(result.rows[0]);
  } catch (err) {
    console.error('Profile error:', err.message);
    res.status(500).json({ error: 'Server error' });
  }
});

app.put('/api/users/profile', authenticateToken, async (req, res) => {
  try {
    const { display_name, bio } = req.body;
    const result = await pool.query(
      'UPDATE users SET display_name = $1, bio = $2 WHERE id = $3 RETURNING id, username, avatar_url, display_name, bio, created_at',
      [display_name || null, bio || null, req.user.id]
    );
    io.emit('user_updated', result.rows[0]);
    res.json(result.rows[0]);
  } catch (err) {
    console.error('Update profile error:', err.message);
    res.status(500).json({ error: 'Server error' });
  }
});

app.post('/api/users/avatar', authenticateToken, (req, res) => {
  upload.single('avatar')(req, res, async (err) => {
    if (err) {
      return res.status(400).json({ error: err.message });
    }
    if (!req.file) {
      return res.status(400).json({ error: 'No file provided' });
    }
    try {
      const avatarUrl = `/uploads/${req.file.filename}`;
      const result = await pool.query(
        'UPDATE users SET avatar_url = $1 WHERE id = $2 RETURNING id, username, avatar_url, display_name, bio, created_at',
        [avatarUrl, req.user.id]
      );
      io.emit('user_updated', result.rows[0]);
      res.json(result.rows[0]);
    } catch (dbErr) {
      console.error('Avatar update error:', dbErr.message);
      res.status(500).json({ error: 'Server error' });
    }
  });
});

app.post('/api/users/promote', authenticateToken, async (req, res) => {
  try {
    if (!req.user.is_admin) {
      return res.status(403).json({ error: 'Only admins can promote users' });
    }
    const { userId } = req.body;
    const result = await pool.query(
      "UPDATE users SET is_admin = TRUE WHERE id = $1 RETURNING id, username, avatar_url, display_name, bio, is_admin, created_at",
      [userId]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'User not found' });
    io.emit('user_updated', result.rows[0]);
    res.json(result.rows[0]);
  } catch (err) {
    console.error('Promote error:', err.message);
    res.status(500).json({ error: 'Server error' });
  }
});

app.post('/api/setup/admin', authenticateToken, async (req, res) => {
  try {
    const adminCheck = await pool.query("SELECT COUNT(*) FROM users WHERE is_admin = TRUE");
    if (parseInt(adminCheck.rows[0].count) > 0) {
      return res.status(400).json({ error: 'An admin already exists' });
    }
    await pool.query("UPDATE users SET is_admin = TRUE WHERE id = $1", [req.user.id]);
    const updated = await pool.query("SELECT id, username, avatar_url, display_name, bio, is_admin, created_at FROM users WHERE id = $1", [req.user.id]);
    const token = jwt.sign({ id: req.user.id, username: req.user.username, is_admin: true }, process.env.JWT_SECRET, { expiresIn: '24h' });
    res.json({ user: updated.rows[0], token });
  } catch (err) {
    console.error('Setup admin error:', err.message);
    res.status(500).json({ error: 'Server error' });
  }
});

app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

const onlineUsers = new Map();

io.on('connection', (socket) => {
  console.log('User connected:', socket.id);

  socket.on('join', (userData) => {
    const entry = { id: userData.id, username: userData.username, avatar_url: userData.avatar_url || null, display_name: userData.display_name || null, status: userData.status || 'online' };
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
        `INSERT INTO messages (room_id, user_id, username, content, file_url, file_name, file_type, file_size, reply_to)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
         RETURNING *`,
        [data.roomId || 1, data.userId, data.username, data.content || null, data.fileUrl || null, data.fileName || null, data.fileType || null, data.fileSize || null, data.replyTo || null]
      );
      const msg = result.rows[0];
      if (msg.reply_to) {
        const replyRes = await pool.query('SELECT id, username, content, file_url, file_name FROM messages WHERE id = $1', [msg.reply_to]);
        msg.reply_to_message = replyRes.rows[0] || null;
      }
      io.emit('new_message', msg);
    } catch (err) {
      console.error('Save message error:', err.message);
      io.emit('new_message', {
        id: Date.now(),
        room_id: data.roomId || 1,
        user_id: data.userId,
        username: data.username,
        content: data.content || null,
        file_url: data.fileUrl || null,
        file_name: data.fileName || null,
        file_type: data.fileType || null,
        file_size: data.fileSize || null,
        reply_to: data.replyTo || null,
        reactions: {},
        edited: false,
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
