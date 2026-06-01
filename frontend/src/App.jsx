import { useState, useEffect } from 'react';
import { io } from 'socket.io-client';
import LoginForm from './components/LoginForm.jsx';
import ChatRoom from './components/ChatRoom.jsx';
import FileGallery from './components/FileGallery.jsx';

const API_URL = import.meta.env.VITE_API_URL || '';

function App() {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(null);
  const [socket, setSocket] = useState(null);
  const [connecting, setConnecting] = useState(false);
  const [theme, setTheme] = useState(() => localStorage.getItem('theme') || 'light');
  const [view, setView] = useState('chat');

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

    const newSocket = io(API_URL || undefined);

    newSocket.on('connect', () => {
      setConnecting(false);
    });

    newSocket.on('disconnect', () => {
      setConnecting(true);
    });

    setSocket(newSocket);

    return () => {
      newSocket.disconnect();
    };
  }, [token]);

  const handleAuth = (userData, authToken) => {
    setUser(userData);
    setToken(authToken);
    setConnecting(true);
    localStorage.setItem('token', authToken);
    localStorage.setItem('user', JSON.stringify(userData));
  };

  const handleLogout = () => {
    if (socket) {
      socket.disconnect();
    }
    setUser(null);
    setToken(null);
    setSocket(null);
    setConnecting(false);
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
      {view === 'chat' ? (
        <ChatRoom user={user} token={token} socket={socket} onLogout={handleLogout} theme={theme} onToggleTheme={toggleTheme} onNavigate={setView} />
      ) : (
        <FileGallery user={user} token={token} onBack={() => setView('chat')} />
      )}
    </div>
  );
}

export default App;
