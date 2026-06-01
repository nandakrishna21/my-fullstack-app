import { useState, useEffect } from 'react';
import { io } from 'socket.io-client';
import LoginForm from './components/LoginForm.jsx';
import ChatRoom from './components/ChatRoom.jsx';

const API_URL = import.meta.env.VITE_API_URL || '';

function App() {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(null);
  const [socket, setSocket] = useState(null);
  const [connecting, setConnecting] = useState(false);
  const [theme, setTheme] = useState(() => localStorage.getItem('theme') || 'light');
  const [profile, setProfile] = useState(null);

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('theme', theme);
  }, [theme]);

  const toggleTheme = () => {
    setTheme((prev) => (prev === 'light' ? 'dark' : 'light'));
  };

  useEffect(() => {
    const savedToken = localStorage.getItem('token');
    const savedUser = localStorage.getItem('user');
    if (savedToken && savedUser) {
      setToken(savedToken);
      setUser(JSON.parse(savedUser));
      setConnecting(true);
    }
  }, []);

  useEffect(() => {
    if (!token) return;
    fetch(`${API_URL}/api/users/profile`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((r) => r.json())
      .then((data) => {
        if (data.id) setProfile(data);
      })
      .catch(() => {});
  }, [token]);

  useEffect(() => {
    if (!token) return;
    const newSocket = io(API_URL || undefined);
    newSocket.on('connect', () => setConnecting(false));
    newSocket.on('disconnect', () => setConnecting(true));
    newSocket.on('user_updated', (data) => {
      if (data.id === user?.id) setProfile(data);
    });
    setSocket(newSocket);
    return () => { newSocket.disconnect(); };
  }, [token]);

  const handleAuth = (userData, authToken) => {
    setUser(userData);
    setToken(authToken);
    setConnecting(true);
    localStorage.setItem('token', authToken);
    localStorage.setItem('user', JSON.stringify(userData));
  };

  const handleLogout = () => {
    if (socket) socket.disconnect();
    setUser(null);
    setToken(null);
    setSocket(null);
    setConnecting(false);
    setProfile(null);
    localStorage.removeItem('token');
    localStorage.removeItem('user');
  };

  if (!user) {
    return <LoginForm onAuth={handleAuth} />;
  }

  if (connecting) {
    return (
      <div className="connecting-screen">
        <div className="connecting-card">
          <div className="connecting-logo">⚡</div>
          <h2>Welcome back, <span>{user.username}</span></h2>
          <p>Connecting to chat server...</p>
          <div className="connecting-bar"><div className="connecting-bar-fill" /></div>
        </div>
      </div>
    );
  }

  return (
    <div className="container">
      <ChatRoom user={user} token={token} socket={socket} profile={profile} onProfileUpdate={setProfile} onLogout={handleLogout} theme={theme} onToggleTheme={toggleTheme} />
    </div>
  );
}

export default App;
