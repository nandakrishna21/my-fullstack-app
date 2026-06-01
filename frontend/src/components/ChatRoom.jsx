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

function ChatRoom({ user, token, socket, onLogout, theme, onToggleTheme }) {
  const [messages, setMessages] = useState([]);
  const [onlineUsers, setOnlineUsers] = useState([]);
  const [typingUsers, setTypingUsers] = useState([]);
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [uploading, setUploading] = useState(false);

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

    socket.on('user_typing', (username) => {
      setTypingUsers((prev) => prev.includes(username) ? prev : [...prev, username]);
    });

    socket.on('user_stop_typing', (username) => {
      setTypingUsers((prev) => prev.filter((u) => u !== username));
    });

    return () => {
      socket.off('new_message');
      socket.off('system_message');
      socket.off('online_users');
      socket.off('user_typing');
      socket.off('user_stop_typing');
    };
  }, [socket, user]);

  const handleSend = (content) => {
    if (socket) {
      socket.emit('send_message', {
        userId: user.id,
        username: user.username,
        content,
      });
      socket.emit('stop_typing', user.username);
    }
  };

  const handleFileSend = async (file) => {
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append('file', file);

      const res = await fetch(`${API_URL}/api/upload`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      if (socket) {
        socket.emit('send_message', {
          userId: user.id,
          username: user.username,
          content: null,
          fileUrl: data.url,
          fileName: data.name,
          fileType: data.type,
          fileSize: data.size,
        });
      }
    } catch (err) {
      alert('Upload failed: ' + err.message);
    } finally {
      setUploading(false);
    }
  };

  const handleTyping = () => {
    if (socket) {
      socket.emit('typing', user.username);
    }
  };

  const handleStopTyping = () => {
    if (socket) {
      socket.emit('stop_typing', user.username);
    }
  };

  const userColor = hashColor(user.username);
  const onlineCount = onlineUsers.length;

  const typingText = typingUsers.length > 0
    ? typingUsers.length === 1
      ? `${typingUsers[0]} is typing...`
      : `${typingUsers.join(', ')} are typing...`
    : '';

  return (
    <div className="chat-layout">
      <div className="sidebar">
        <div className="sidebar-section">
          <div className="user-profile" onClick={() => setShowUserMenu(!showUserMenu)} style={{ cursor: 'pointer', position: 'relative' }}>
            <div className="avatar" style={{ background: userColor }}>{user.username[0].toUpperCase()}</div>
            <div>
              <div className="username">{user.username}</div>
              <div className="status">● Online</div>
            </div>
            {showUserMenu && (
              <div className="user-menu">
                <div className="user-menu-header">
                  <div className="user-menu-avatar" style={{ background: userColor }}>{user.username[0].toUpperCase()}</div>
                  <div>
                    <div className="user-menu-name">{user.username}</div>
                    <div className="user-menu-status">Connected</div>
                  </div>
                </div>
                <div className="user-menu-divider" />
                <button className="user-menu-item" onClick={onLogout}>
                  Sign Out
                </button>
              </div>
            )}
          </div>
        </div>
        <div className="sidebar-section">
          <h3>Online — {onlineCount}</h3>
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
        </div>
      </div>
      <div className="chat-main">
        <div className="chat-header">
          <div className="room-icon">#</div>
          <div className="room-info">
            <h2>General</h2>
            <p>{onlineCount} {onlineCount === 1 ? 'member' : 'members'}</p>
          </div>
          <button className="theme-toggle" onClick={onToggleTheme} title={`Switch to ${theme === 'light' ? 'dark' : 'light'} mode`}>
            {theme === 'light' ? '🌙' : '☀️'}
          </button>
        </div>
        <MessageList messages={messages} currentUser={user.username} />
        {typingText && (
          <div className="typing-indicator">
            <span className="typing-dots"><span>.</span><span>.</span><span>.</span></span>
            {typingText}
          </div>
        )}
        <MessageInput onSend={handleSend} onFileSend={handleFileSend} onTyping={handleTyping} onStopTyping={handleStopTyping} uploading={uploading} />
      </div>
    </div>
  );
}

export default ChatRoom;
