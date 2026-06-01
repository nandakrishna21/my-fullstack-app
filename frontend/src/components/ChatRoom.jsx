import { useState, useEffect } from 'react';
import MessageList from './MessageList.jsx';
import MessageInput from './MessageInput.jsx';

const API_URL = import.meta.env.VITE_API_URL || '';

const COLORS = ['#e94560', '#4ade80', '#60a5fa', '#f59e0b', '#a78bfa', '#34d399', '#fb923c', '#2dd4bf'];

function hashColor(str) {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash);
  }
  return COLORS[Math.abs(hash) % COLORS.length];
}

function ChatRoom({ user, token, socket, onLogout }) {
  const [messages, setMessages] = useState([]);
  const [onlineUsers, setOnlineUsers] = useState([]);

  useEffect(() => {
    fetch(`${API_URL}/api/messages`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((res) => res.json())
      .then((data) => {
        if (Array.isArray(data)) setMessages(data);
      })
      .catch(console.error);
  }, [token]);

  useEffect(() => {
    if (!socket) return;

    socket.emit('join', { id: user.id, username: user.username });

    socket.on('new_message', (msg) => {
      setMessages((prev) => [...prev, msg]);
    });

    socket.on('system_message', (msg) => {
      setMessages((prev) => [...prev, { ...msg, id: Date.now() + Math.random(), type: 'system' }]);
    });

    socket.on('online_users', (users) => {
      setOnlineUsers(users);
    });

    return () => {
      socket.off('new_message');
      socket.off('system_message');
      socket.off('online_users');
    };
  }, [socket, user]);

  const handleSend = (content) => {
    if (socket) {
      socket.emit('send_message', {
        userId: user.id,
        username: user.username,
        content,
      });
    }
  };

  const userColor = hashColor(user.username);
  const onlineCount = onlineUsers.length;

  return (
    <div className="chat-layout">
      <div className="sidebar">
        <div className="user-profile">
          <div className="avatar" style={{ background: userColor }}>{user.username[0].toUpperCase()}</div>
          <div>
            <div className="username">{user.username}</div>
            <div className="status">● Online</div>
          </div>
        </div>
        <h3>Online ({onlineCount})</h3>
        <ul className="online-users">
          {onlineUsers.map((u, i) => (
            <li key={i}>
              <div className="user-avatar-sm" style={{ background: hashColor(u.username) }}>
                {u.username[0].toUpperCase()}
              </div>
              <span>{u.username}</span>
              <span className="online-dot" />
            </li>
          ))}
        </ul>
        <button className="logout-btn" onClick={onLogout}>
          Sign out
        </button>
      </div>
      <div className="chat-main">
        <div className="chat-header">
          <div className="room-icon">#</div>
          <div className="room-info">
            <h2>General</h2>
            <p>{onlineCount} {onlineCount === 1 ? 'member' : 'members'}</p>
          </div>
        </div>
        <MessageList messages={messages} currentUser={user.username} />
        <MessageInput onSend={handleSend} />
      </div>
    </div>
  );
}

export default ChatRoom;
