import { useState, useEffect, useRef } from 'react';
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

function ChatRoom({ user, token, socket, profile, onProfileUpdate, onLogout, theme, onToggleTheme }) {
  const [messages, setMessages] = useState([]);
  const [onlineUsers, setOnlineUsers] = useState([]);
  const [rooms, setRooms] = useState([]);
  const [activeRoom, setActiveRoom] = useState(1);
  const [typingUsers, setTypingUsers] = useState([]);
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [appearOffline, setAppearOffline] = useState(() => localStorage.getItem('appearOffline') === 'true');
  const [searchQuery, setSearchQuery] = useState('');
  const [showProfileModal, setShowProfileModal] = useState(false);
  const [showCreateRoom, setShowCreateRoom] = useState(false);
  const [newRoomName, setNewRoomName] = useState('');
  const searchInputRef = useRef(null);

  useEffect(() => {
    localStorage.setItem('appearOffline', appearOffline);
    if (socket?.connected) {
      socket.emit('status_update', appearOffline ? 'offline' : 'online');
    }
  }, [appearOffline, socket]);

  useEffect(() => {
    fetch(`${API_URL}/api/rooms`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((r) => r.json())
      .then((data) => { if (Array.isArray(data)) setRooms(data); })
      .catch(console.error);
  }, [token]);

  useEffect(() => {
    if (!activeRoom) return;
    const params = new URLSearchParams({ room_id: activeRoom });
    if (searchQuery) params.set('search', searchQuery);
    fetch(`${API_URL}/api/messages?${params}`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((r) => r.json())
      .then((data) => { if (Array.isArray(data)) setMessages(data); })
      .catch(console.error);
  }, [token, activeRoom]);

  useEffect(() => {
    if (!socket) return;
    socket.emit('join', {
      id: user.id, username: user.username,
      avatar_url: profile?.avatar_url || null, display_name: profile?.display_name || null,
      status: appearOffline ? 'offline' : 'online',
    });
    socket.on('new_message', (msg) => setMessages((prev) => [...prev, msg]));
    socket.on('edit_message', (msg) => setMessages((prev) => prev.map((m) => m.id === msg.id ? msg : m)));
    socket.on('delete_message', ({ id }) => setMessages((prev) => prev.filter((m) => m.id !== id)));
    socket.on('message_react', (msg) => setMessages((prev) => prev.map((m) => m.id === msg.id ? msg : m)));
    socket.on('new_room', (room) => setRooms((prev) => [...prev, room]));
    socket.on('system_message', (msg) => setMessages((prev) => [...prev, { ...msg, id: Date.now() + Math.random(), type: 'system' }]));
    socket.on('online_users', (users) => setOnlineUsers(users));
    socket.on('user_typing', (username) => setTypingUsers((prev) => prev.includes(username) ? prev : [...prev, username]));
    socket.on('user_stop_typing', (username) => setTypingUsers((prev) => prev.filter((u) => u !== username)));
    return () => {
      socket.off('new_message'); socket.off('edit_message'); socket.off('delete_message');
      socket.off('message_react'); socket.off('new_room'); socket.off('system_message');
      socket.off('online_users'); socket.off('user_typing'); socket.off('user_stop_typing');
    };
  }, [socket, user]);

  const switchRoom = (roomId) => {
    setActiveRoom(roomId);
    setSearchQuery('');
  };

  const handleCreateRoom = async () => {
    if (!newRoomName.trim()) return;
    try {
      const res = await fetch(`${API_URL}/api/rooms`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ name: newRoomName.trim() }),
      });
      const data = await res.json();
      if (res.ok) {
        setActiveRoom(data.id);
        setNewRoomName('');
        setShowCreateRoom(false);
      }
    } catch (err) {
      alert('Failed to create room');
    }
  };

  const handleSend = (content) => {
    if (socket) {
      socket.emit('send_message', { roomId: activeRoom, userId: user.id, username: user.username, content });
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
          roomId: activeRoom, userId: user.id, username: user.username, content: null,
          fileUrl: data.url, fileName: data.name, fileType: data.type, fileSize: data.size,
        });
      }
    } catch (err) {
      alert('Upload failed: ' + err.message);
    } finally {
      setUploading(false);
    }
  };

  const handleEdit = async (msgId, newContent) => {
    const res = await fetch(`${API_URL}/api/messages/${msgId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ content: newContent }),
    });
    if (!res.ok) alert('Failed to edit message');
  };

  const handleDelete = async (msgId) => {
    if (!confirm('Delete this message?')) return;
    const res = await fetch(`${API_URL}/api/messages/${msgId}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) alert('Failed to delete message');
  };

  const handleReact = async (msgId, emoji) => {
    await fetch(`${API_URL}/api/messages/${msgId}/react`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ emoji }),
    });
  };

  const handleTyping = () => { if (socket) socket.emit('typing', user.username); };
  const handleStopTyping = () => { if (socket) socket.emit('stop_typing', user.username); };

  const handleSearch = (e) => {
    e.preventDefault();
    const params = new URLSearchParams({ room_id: activeRoom });
    if (searchQuery) params.set('search', searchQuery);
    fetch(`${API_URL}/api/messages?${params}`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((r) => r.json())
      .then((data) => { if (Array.isArray(data)) setMessages(data); })
      .catch(console.error);
  };

  const handleClearSearch = () => {
    setSearchQuery('');
    fetch(`${API_URL}/api/messages?room_id=${activeRoom}`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((r) => r.json())
      .then((data) => { if (Array.isArray(data)) setMessages(data); })
      .catch(console.error);
  };

  const displayName = profile?.display_name || user.username;
  const displayAvatar = profile?.avatar_url ? `${API_URL}${profile.avatar_url}` : null;
  const userColor = hashColor(user.username);
  const onlineCount = onlineUsers.length;
  const currentRoom = rooms.find((r) => r.id === activeRoom);
  const typingText = typingUsers.length > 0
    ? typingUsers.length === 1 ? `${typingUsers[0]} is typing...` : `${typingUsers.join(', ')} are typing...`
    : '';

  return (
    <div className="chat-layout">
      <div className="sidebar">
        <div className="sidebar-section">
          <div className="user-profile" onClick={() => setShowUserMenu(!showUserMenu)} style={{ cursor: 'pointer', position: 'relative' }}>
            <div className="avatar" style={{ background: displayAvatar ? `url(${displayAvatar}) center/cover` : userColor }}>
              {!displayAvatar && displayName[0].toUpperCase()}
            </div>
            <div>
              <div className="username">{displayName}</div>
              <div className="status" style={{ color: appearOffline ? 'rgba(255,255,255,0.3)' : undefined }}>
                {appearOffline ? '● Offline' : '● Online'}
              </div>
            </div>
            {showUserMenu && (
              <div className="user-menu">
                <div className="user-menu-header">
                  <div className="user-menu-avatar" style={{ background: displayAvatar ? `url(${displayAvatar}) center/cover` : userColor }}>
                    {!displayAvatar && displayName[0].toUpperCase()}
                  </div>
                  <div>
                    <div className="user-menu-name">{displayName}</div>
                    <div className="user-menu-status">{appearOffline ? 'Appearing Offline' : 'Connected'}</div>
                  </div>
                </div>
                <div className="user-menu-divider" />
                <button className="user-menu-action" onClick={() => { setShowUserMenu(false); setShowProfileModal(true); }}>Edit Profile</button>
                <div className="user-menu-divider" />
                <label className="user-menu-toggle" onClick={(e) => e.stopPropagation()}>
                  <span>Appear Offline</span>
                  <input type="checkbox" checked={appearOffline} onChange={() => setAppearOffline(!appearOffline)} />
                  <span className="toggle-slider" />
                </label>
                <div className="user-menu-divider" />
                <button className="user-menu-item" onClick={onLogout}>Sign Out</button>
              </div>
            )}
          </div>
        </div>

        <div className="sidebar-section rooms-section">
          <div className="rooms-header">
            <h3>Channels</h3>
            <button className="room-add-btn" onClick={() => setShowCreateRoom(true)} title="Create channel">＋</button>
          </div>
          <ul className="room-list">
            {rooms.map((room) => (
              <li key={room.id} className={`room-item ${room.id === activeRoom ? 'active' : ''}`} onClick={() => switchRoom(room.id)}>
                <span className="room-hash">#</span>
                <span className="room-name">{room.name}</span>
              </li>
            ))}
          </ul>
          {showCreateRoom && (
            <div className="create-room-form">
              <input
                value={newRoomName}
                onChange={(e) => setNewRoomName(e.target.value)}
                placeholder="Channel name"
                onKeyDown={(e) => { if (e.key === 'Enter') handleCreateRoom(); if (e.key === 'Escape') setShowCreateRoom(false); }}
                autoFocus
              />
              <div className="create-room-actions">
                <button onClick={() => setShowCreateRoom(false)}>Cancel</button>
                <button onClick={handleCreateRoom} disabled={!newRoomName.trim()}>Create</button>
              </div>
            </div>
          )}
        </div>

        <div className="sidebar-section">
          <h3>Online — {onlineCount}</h3>
          <ul className="online-users">
            {onlineUsers.map((u, i) => (
              <li key={i}>
                <div className="user-avatar-sm" style={{ background: u.avatar_url ? `url(${API_URL}${u.avatar_url}) center/cover` : hashColor(u.username) }}>
                  {!u.avatar_url && (u.display_name?.[0]?.toUpperCase() || u.username[0].toUpperCase())}
                </div>
                <span>{u.display_name || u.username}</span>
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
            <h2>{currentRoom?.name || 'General'}</h2>
            <p>{onlineCount} {onlineCount === 1 ? 'member' : 'members'}</p>
          </div>
          <form className="search-bar" onSubmit={handleSearch}>
            <input ref={searchInputRef} type="text" placeholder="Search messages..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} />
            {searchQuery && <button type="button" className="search-clear" onClick={handleClearSearch}>✕</button>}
            <button type="submit" className="search-btn">🔍</button>
          </form>
          <button className="theme-toggle" onClick={onToggleTheme} title={`Switch to ${theme === 'light' ? 'dark' : 'light'} mode`}>
            {theme === 'light' ? '🌙' : '☀️'}
          </button>
        </div>
        <MessageList messages={messages} currentUser={user.username} onEdit={handleEdit} onDelete={handleDelete} onReact={handleReact} searchQuery={searchQuery} />
        {typingText && (
          <div className="typing-indicator">
            <span className="typing-dots"><span>.</span><span>.</span><span>.</span></span>
            {typingText}
          </div>
        )}
        <MessageInput onSend={handleSend} onFileSend={handleFileSend} onTyping={handleTyping} onStopTyping={handleStopTyping} uploading={uploading} />
      </div>

      {showProfileModal && (
        <ProfileModal user={user} token={token} profile={profile} onUpdate={onProfileUpdate} onClose={() => setShowProfileModal(false)} />
      )}
    </div>
  );
}

function ProfileModal({ user, token, profile, onUpdate, onClose }) {
  const [displayName, setDisplayName] = useState(profile?.display_name || '');
  const [bio, setBio] = useState(profile?.bio || '');
  const [saving, setSaving] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const fileInputRef = useRef(null);

  const handleSave = async () => {
    setSaving(true);
    try {
      const res = await fetch(`${API_URL}/api/users/profile`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ display_name: displayName, bio }),
      });
      const data = await res.json();
      if (res.ok) onUpdate(data);
    } catch { alert('Failed to save profile'); }
    finally { setSaving(false); }
  };

  const handleAvatarUpload = async (file) => {
    if (!file) return;
    setUploadingAvatar(true);
    try {
      const formData = new FormData();
      formData.append('avatar', file);
      const res = await fetch(`${API_URL}/api/users/avatar`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
      });
      const data = await res.json();
      if (res.ok) onUpdate(data);
    } catch { alert('Avatar upload failed'); }
    finally { setUploadingAvatar(false); }
  };

  const avatarUrl = profile?.avatar_url ? `${API_URL}${profile.avatar_url}` : null;
  const userColor = hashColor(user.username);

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-card" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>Edit Profile</h2>
          <button className="modal-close" onClick={onClose}>✕</button>
        </div>
        <div className="modal-body">
          <div className="avatar-upload">
            <div className="avatar-preview" style={{ background: avatarUrl ? `url(${avatarUrl}) center/cover` : userColor }} onClick={() => fileInputRef.current?.click()}>
              {!avatarUrl && (displayName || user.username)[0].toUpperCase()}
              {uploadingAvatar && <div className="avatar-spinner" />}
            </div>
            <input type="file" ref={fileInputRef} accept="image/*" style={{ display: 'none' }} onChange={(e) => handleAvatarUpload(e.target.files[0])} />
            <p className="avatar-hint">Click to upload photo</p>
          </div>
          <label className="modal-label">Display Name</label>
          <input className="modal-input" value={displayName} onChange={(e) => setDisplayName(e.target.value)} placeholder={user.username} />
          <label className="modal-label">Bio</label>
          <textarea className="modal-textarea" value={bio} onChange={(e) => setBio(e.target.value)} placeholder="Tell us about yourself..." rows={3} />
        </div>
        <div className="modal-footer">
          <button className="modal-btn-secondary" onClick={onClose}>Cancel</button>
          <button className="modal-btn-primary" onClick={handleSave} disabled={saving}>{saving ? 'Saving...' : 'Save'}</button>
        </div>
      </div>
    </div>
  );
}

export default ChatRoom;
