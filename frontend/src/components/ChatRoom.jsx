import { useState, useEffect } from 'react';
import MessageList from './MessageList.jsx';
import MessageInput from './MessageInput.jsx';

function ChatRoom({ user, token, socket, onLogout }) {
  const [messages, setMessages] = useState([]);
  const [onlineUsers, setOnlineUsers] = useState([]);

  useEffect(() => {
    fetch('http://localhost:3001/api/messages', {
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

  return (
    <div className="chat-layout">
      <div className="sidebar">
        <h3>Online ({onlineUsers.length})</h3>
        <ul className="online-users">
          {onlineUsers.map((u, i) => (
            <li key={i}>{u.username}</li>
          ))}
        </ul>
        <button className="logout-btn" onClick={onLogout}>
          Logout
        </button>
      </div>
      <div className="chat-main">
        <div className="chat-header"># general</div>
        <MessageList messages={messages} currentUser={user.username} />
        <MessageInput onSend={handleSend} />
      </div>
    </div>
  );
}

export default ChatRoom;
