import { useState, useEffect, useRef, useCallback } from 'react';
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
  const [onlineUsers, setOnlineUsers] = useState([]);
  const [rooms, setRooms] = useState([]);
  const [activeRoom, setActiveRoom] = useState(() => {
    const saved = localStorage.getItem('activeRoom');
    return saved ? Number(saved) : 1;
  });
  const [typingUsers, setTypingUsers] = useState([]);
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [appearOffline, setAppearOffline] = useState(() => localStorage.getItem('appearOffline') === 'true');
  const [searchQuery, setSearchQuery] = useState('');
  const [showProfileModal, setShowProfileModal] = useState(false);
  const [showCreateRoom, setShowCreateRoom] = useState(false);
  const [newRoomName, setNewRoomName] = useState('');
  const [showNewChat, setShowNewChat] = useState(false);
  const [allUsers, setAllUsers] = useState([]);
  const [showJoinChannel, setShowJoinChannel] = useState(false);
  const [joinCode, setJoinCode] = useState('');
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [replyingTo, setReplyingTo] = useState(null);
  const searchInputRef = useRef(null);
  const fetchRef = useRef(0);
  const roomRef = useRef(activeRoom);

  const [messages, setMessages] = useState(() => {
    try {
      const savedRoom = localStorage.getItem('activeRoom');
      if (savedRoom) {
        const cached = localStorage.getItem(`messages_${savedRoom}`);
        if (cached) {
          const parsed = JSON.parse(cached);
          if (Array.isArray(parsed) && parsed.length > 0) return parsed;
        }
      }
    } catch {}
    return [];
  });

  const cacheMessages = useCallback((roomId, msgs) => {
    if (!Array.isArray(msgs) || msgs.length === 0) return;
    try {
      localStorage.setItem(`messages_${roomId}`, JSON.stringify(msgs));
    } catch {}
  }, []);

  const fetchMessages = useCallback((retries = 0) => {
    if (!activeRoom || !token) return;
    roomRef.current = activeRoom;
    const fetchId = ++fetchRef.current;
    setLoadingMessages(true);
    const params = new URLSearchParams({ room_id: activeRoom });
    if (searchQuery) params.set('search', searchQuery);
    fetch(`${API_URL}/api/messages?${params}`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json();
      })
      .then((data) => {
        if (fetchId !== fetchRef.current) return;
        if (Array.isArray(data)) {
          setMessages(data);
          cacheMessages(activeRoom, data);
        }
        setLoadingMessages(false);
      })
      .catch(() => {
        if (fetchId !== fetchRef.current) return;
        setTimeout(() => fetchMessages(retries + 1), Math.min(3000 + retries * 1000, 30000));
      });
  }, [activeRoom, token, searchQuery, cacheMessages]);

  useEffect(() => {
    localStorage.setItem('appearOffline', appearOffline);
    if (socket?.connected) {
      socket.emit('status_update', appearOffline ? 'offline' : 'online');
    }
  }, [appearOffline, socket]);

  useEffect(() => {
    localStorage.setItem('activeRoom', activeRoom);
  }, [activeRoom]);

  useEffect(() => {
    fetch(`${API_URL}/api/rooms`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((r) => r.json())
      .then((data) => { if (Array.isArray(data)) setRooms(data); })
      .catch(console.error);
  }, [token]);

  useEffect(() => {
    try {
      const cached = localStorage.getItem(`messages_${activeRoom}`);
      if (cached) {
        const parsed = JSON.parse(cached);
        if (Array.isArray(parsed) && parsed.length > 0) {
          setMessages(parsed);
        }
      }
    } catch {}
    fetchMessages();
  }, [fetchMessages, activeRoom]);

  useEffect(() => {
    if (!socket) return;
    socket.emit('join', {
      id: user.id, username: user.username,
      avatar_url: profile?.avatar_url || null, display_name: profile?.display_name || null,
      status: appearOffline ? 'offline' : 'online',
    });
    socket.on('connect', () => { fetchMessages(); });
    socket.on('new_message', (msg) => {
      setMessages((prev) => {
        const next = [...prev, msg];
        cacheMessages(activeRoom, next);
        return next;
      });
    });
    socket.on('edit_message', (msg) => {
      setMessages((prev) => {
        const next = prev.map((m) => m.id === msg.id ? msg : m);
        cacheMessages(activeRoom, next);
        return next;
      });
    });
    socket.on('delete_message', ({ id }) => {
      setMessages((prev) => {
        const next = prev.filter((m) => m.id !== id);
        cacheMessages(activeRoom, next);
        return next;
      });
    });
    socket.on('message_react', (msg) => setMessages((prev) => {
      const next = prev.map((m) => m.id === msg.id ? msg : m);
      cacheMessages(activeRoom, next);
      return next;
    }));
    socket.on('new_room', (room) => setRooms((prev) => [...prev, room]));
    socket.on('room_updated', (room) => setRooms((prev) => prev.map((r) => r.id === room.id ? room : r)));
    socket.on('room_deleted', ({ id }) => setRooms((prev) => prev.filter((r) => r.id !== id)));
    socket.on('room_cleared', ({ id }) => {
      if (id === activeRoom) {
        setMessages([]);
        cacheMessages(id, []);
      }
    });
    socket.on('system_message', (msg) => setMessages((prev) => [...prev, { ...msg, id: Date.now() + Math.random(), type: 'system' }]));
    socket.on('online_users', (users) => setOnlineUsers(users));
    socket.on('user_typing', (username) => setTypingUsers((prev) => prev.includes(username) ? prev : [...prev, username]));
    socket.on('user_stop_typing', (username) => setTypingUsers((prev) => prev.filter((u) => u !== username)));
    return () => {
      socket.off('connect'); socket.off('new_message'); socket.off('edit_message'); socket.off('delete_message');
      socket.off('message_react'); socket.off('new_room'); socket.off('room_updated'); socket.off('room_deleted'); socket.off('room_cleared'); socket.off('system_message');
      socket.off('online_users'); socket.off('user_typing'); socket.off('user_stop_typing');
    };
  }, [socket, user, fetchMessages]);

  const switchRoom = (roomId) => {
    setActiveRoom(roomId);
    setSearchQuery('');
    setReplyingTo(null);
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
      if (res.ok) { setActiveRoom(data.id); setNewRoomName(''); setShowCreateRoom(false); }
    } catch (err) { alert('Failed to create room'); }
  };

  const handleStartConversation = async (targetUserId) => {
    try {
      const res = await fetch(`${API_URL}/api/conversations`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ userId: targetUserId }),
      });
      const data = await res.json();
      if (res.ok) { setActiveRoom(data.id); setShowNewChat(false); }
    } catch (err) { alert('Failed to start conversation'); }
  };

  const [editingRoomId, setEditingRoomId] = useState(null);
  const [editingRoomName, setEditingRoomName] = useState('');

  const handleRenameRoom = async (roomId) => {
    if (!editingRoomName.trim()) return;
    try {
      const res = await fetch(`${API_URL}/api/rooms/${roomId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ name: editingRoomName.trim() }),
      });
      if (res.ok) setEditingRoomId(null);
    } catch { alert('Failed to rename'); }
  };

  const handleDeleteRoom = async (roomId) => {
    if (!confirm('Delete this room and all its messages?')) return;
    try {
      const res = await fetch(`${API_URL}/api/rooms/${roomId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        localStorage.removeItem(`messages_${roomId}`);
        if (activeRoom === roomId) setActiveRoom(1);
      }
    } catch { alert('Failed to delete'); }
  };

  const handleClearChat = async (roomId) => {
    if (!confirm('Clear all messages in this chat?')) return;
    try {
      await fetch(`${API_URL}/api/rooms/${roomId}/messages`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      localStorage.removeItem(`messages_${roomId}`);
    } catch { alert('Failed to clear chat'); }
  };

  const handleCopyInvite = async (roomId) => {
    try {
      const res = await fetch(`${API_URL}/api/rooms/${roomId}/invite`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (data.inviteCode) {
        const link = `${window.location.origin}${import.meta.env.VITE_BASE_URL || '/'}?join=${data.inviteCode}`;
        await navigator.clipboard.writeText(link);
        alert('Invite link copied!');
      }
    } catch { alert('Failed to get invite link'); }
  };

  const handleJoinChannel = async () => {
    if (!joinCode.trim()) return;
    try {
      const res = await fetch(`${API_URL}/api/rooms/join/${joinCode.trim()}`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (res.ok) { setActiveRoom(data.id); setJoinCode(''); setShowJoinChannel(false); }
      else alert(data.error || 'Invalid code');
    } catch { alert('Failed to join'); }
  };

  const handlePromote = async (userId) => {
    try {
      const res = await fetch(`${API_URL}/api/users/promote`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ userId }),
      });
      const data = await res.json();
      if (res.ok) alert('User promoted to admin');
      else alert(data.error || 'Failed to promote');
    } catch { alert('Failed to promote'); }
  };

  const handleSend = async (content) => {
    if (!socket) return;
    try {
      const res = await fetch(`${API_URL}/api/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ room_id: activeRoom, content, reply_to: replyingTo?.id || null }),
      });
      if (!res.ok) return;
    } catch {}
    setReplyingTo(null);
    socket.emit('stop_typing', user.username);
  };

  const handleFileSend = async (file) => {
    if (!file) return alert('No file selected');
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      const res = await fetch(`${API_URL}/api/upload`, {
        method: 'POST', headers: { Authorization: `Bearer ${token}` }, body: formData,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Upload rejected');
      if (!data.url) throw new Error('No file URL returned');
      const msgRes = await fetch(`${API_URL}/api/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          room_id: activeRoom, content: null,
          file_url: data.url, file_name: data.name, file_type: data.type, file_size: data.size,
          reply_to: replyingTo?.id || null,
        }),
      });
      if (!msgRes.ok) throw new Error('Failed to create message');
    } catch (err) { alert('Upload failed: ' + err.message); }
    finally { setUploading(false); }
  };

  const handleEdit = async (msgId, newContent) => {
    const res = await fetch(`${API_URL}/api/messages/${msgId}`, {
      method: 'PUT', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ content: newContent }),
    });
    if (!res.ok) alert('Failed to edit message');
  };

  const handleDelete = async (msgId) => {
    if (!confirm('Delete this message?')) return;
    const res = await fetch(`${API_URL}/api/messages/${msgId}`, {
      method: 'DELETE', headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) alert('Failed to delete message');
  };

  const handleReact = async (msgId, emoji) => {
    try {
      const res = await fetch(`${API_URL}/api/messages/${msgId}/react`, {
        method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ emoji }),
      });
      if (res.ok) {
        const updated = await res.json();
        setMessages((prev) => prev.map((m) => m.id === updated.id ? updated : m));
      }
    } catch {}
  };

  const handleTyping = () => { if (socket) socket.emit('typing', user.username); };
  const handleStopTyping = () => { if (socket) socket.emit('stop_typing', user.username); };

  const handleSearch = (e) => {
    e.preventDefault();
    fetchMessages();
  };

  const handleClearSearch = () => {
    setSearchQuery('');
  };

  const openNewChat = () => {
    fetch(`${API_URL}/api/users`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((r) => r.json())
      .then((data) => { if (Array.isArray(data)) setAllUsers(data); })
      .catch(console.error);
    setShowNewChat(true);
  };

  const displayName = profile?.display_name || user.username;
  const [avatarBroken, setAvatarBroken] = useState(false);
  const displayAvatar = profile?.avatar_url && !avatarBroken ? `${API_URL}${profile.avatar_url}` : null;
  const userColor = hashColor(user.username);
  const isAdmin = profile?.is_admin || user?.is_admin;
  const onlineCount = onlineUsers.length;
  const currentRoom = rooms.find((r) => r.id === activeRoom);
  const channels = rooms.filter((r) => r.type === 'channel');
  const dms = rooms.filter((r) => r.type === 'dm');
  const typingText = typingUsers.length > 0
    ? typingUsers.length === 1 ? `${typingUsers[0]} is typing...` : `${typingUsers.join(', ')} are typing...`
    : '';
  const onlineUsernames = new Set(onlineUsers.map((u) => u.username));

  return (
    <div className="chat-layout">
      <div className="sidebar">
        <div className="sidebar-section">
          <div className="user-profile" onClick={() => setShowUserMenu(!showUserMenu)} style={{ cursor: 'pointer', position: 'relative' }}>
            <div className="avatar" style={{ background: userColor }}>
              {displayAvatar ? (
                <img src={displayAvatar} alt="" className="avatar-img" onError={() => setAvatarBroken(true)} />
              ) : displayName[0].toUpperCase()}
            </div>
            <div>
              <div className="username">{displayName} {isAdmin && <span className="admin-badge">Admin</span>}
                <button className="profile-edit-inline" onClick={(e) => { e.stopPropagation(); setShowProfileModal(true); }} title="Edit profile">✎</button>
              </div>
              <div className="status" style={{ color: appearOffline ? 'rgba(255,255,255,0.3)' : undefined }}>
                {appearOffline ? '● Offline' : '● Online'}
              </div>
            </div>
            {showUserMenu && (
              <div className="user-menu">
                <div className="user-menu-header">
                  <div className="user-menu-avatar" style={{ background: userColor }}>
                    {displayAvatar ? (
                      <img src={displayAvatar} alt="" className="avatar-img" />
                    ) : displayName[0].toUpperCase()}
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
            {isAdmin && <button className="room-add-btn" onClick={() => setShowCreateRoom(true)} title="Create channel">＋</button>}
          </div>
          <ul className="room-list">
            {channels.map((room) => (
              <RoomListItem
                key={room.id}
                room={room}
                active={room.id === activeRoom}
                editing={editingRoomId === room.id}
                editName={editingRoomName}
                onSelect={() => switchRoom(room.id)}
                onStartEdit={() => { setEditingRoomId(room.id); setEditingRoomName(room.name); }}
                onEditChange={setEditingRoomName}
                onSave={() => handleRenameRoom(room.id)}
                onCancelEdit={() => setEditingRoomId(null)}
                onDelete={() => handleDeleteRoom(room.id)}
                onClearChat={() => handleClearChat(room.id)}
                onInvite={() => handleCopyInvite(room.id)}
                prefix="#"
                noMenu={room.id === 1}
                isAdmin={isAdmin}
              />
            ))}
          </ul>
          {showCreateRoom && (
            <div className="create-room-form">
              <input value={newRoomName} onChange={(e) => setNewRoomName(e.target.value)} placeholder="Channel name"
                onKeyDown={(e) => { if (e.key === 'Enter') handleCreateRoom(); if (e.key === 'Escape') setShowCreateRoom(false); }} autoFocus />
              <div className="create-room-actions">
                <button onClick={() => setShowCreateRoom(false)}>Cancel</button>
                <button onClick={handleCreateRoom} disabled={!newRoomName.trim()}>Create</button>
              </div>
            </div>
          )}
          <button className="join-channel-btn" onClick={() => setShowJoinChannel(true)}>➕ Join Channel</button>
          {showJoinChannel && (
            <div className="join-channel-form">
              <input value={joinCode} onChange={(e) => setJoinCode(e.target.value)} placeholder="Paste invite code"
                onKeyDown={(e) => { if (e.key === 'Enter') handleJoinChannel(); if (e.key === 'Escape') setShowJoinChannel(false); }} autoFocus />
              <div className="join-channel-actions">
                <button onClick={() => { setShowJoinChannel(false); setJoinCode(''); }}>Cancel</button>
                <button onClick={handleJoinChannel} disabled={!joinCode.trim()}>Join</button>
              </div>
            </div>
          )}
        </div>

        <div className="sidebar-section rooms-section">
          <div className="rooms-header">
            <h3>Direct Messages</h3>
            <button className="room-add-btn" onClick={openNewChat} title="New conversation">✉</button>
          </div>
          <ul className="room-list">
            {dms.map((room) => (
              <RoomListItem
                key={room.id}
                room={room}
                active={room.id === activeRoom}
                onSelect={() => switchRoom(room.id)}
                onDelete={() => handleDeleteRoom(room.id)}
                onClearChat={() => handleClearChat(room.id)}
                dm
                online={onlineUsernames.has(room.name)}
                hashColor={hashColor}
              />
            ))}
            {dms.length === 0 && <li className="room-empty">No conversations yet</li>}
          </ul>
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
                {isAdmin && u.id !== user.id && <button className="promote-btn" onClick={() => handlePromote(u.id)} title="Promote to Admin">👑</button>}
              </li>
            ))}
          </ul>
        </div>
      </div>

      <div className="chat-main">
        <div className="chat-header">
          <div className="room-icon">{currentRoom?.type === 'dm' ? '@' : '#'}</div>
          <div className="room-info">
            <h2>{currentRoom?.name || 'General'}</h2>
            <p>{currentRoom?.type === 'dm' ? 'Direct message' : `${onlineCount} ${onlineCount === 1 ? 'member' : 'members'}`}</p>
          </div>
          {currentRoom?.id !== 1 && currentRoom?.type === 'channel' && (
            <button className="header-delete-btn" onClick={() => handleDeleteRoom(currentRoom.id)} title="Delete Channel">🗑️</button>
          )}
          <form className="search-bar" onSubmit={handleSearch}>
            <input ref={searchInputRef} type="text" placeholder="Search messages..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} />
            {searchQuery && <button type="button" className="search-clear" onClick={handleClearSearch}>✕</button>}
            <button type="submit" className="search-btn">🔍</button>
          </form>
          <button className="theme-toggle" onClick={onToggleTheme} title={`Switch to ${theme === 'light' ? 'dark' : 'light'} mode`}>
            {theme === 'light' ? '🌙' : '☀️'}
          </button>
        </div>
        {loadingMessages ? (
          <div className="messages-loading">
            <div className="spinner" />
            <p>Loading messages...</p>
          </div>
        ) : (
          <MessageList messages={messages} currentUser={user.username} onEdit={handleEdit} onDelete={handleDelete} onReact={handleReact} searchQuery={searchQuery} onReply={setReplyingTo} />
        )}
        {typingText && (
          <div className="typing-indicator">
            <span className="typing-dots"><span>.</span><span>.</span><span>.</span></span>
            {typingText}
          </div>
        )}
        <MessageInput onSend={handleSend} onFileSend={handleFileSend} onTyping={handleTyping} onStopTyping={handleStopTyping} uploading={uploading} replyingTo={replyingTo} onCancelReply={() => setReplyingTo(null)} />
      </div>

      {showProfileModal && (
        <ProfileModal user={user} token={token} profile={profile} onUpdate={onProfileUpdate} onClose={() => setShowProfileModal(false)} />
      )}

      {showNewChat && (
        <div className="modal-overlay" onClick={() => setShowNewChat(false)}>
          <div className="modal-card" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>New Conversation</h2>
              <button className="modal-close" onClick={() => setShowNewChat(false)}>✕</button>
            </div>
            <div className="modal-body">
              <div className="newchat-list">
                {allUsers.map((u) => (
                  <div key={u.id} className="newchat-user" onClick={() => handleStartConversation(u.id)}>
                    <div className="newchat-avatar" style={{ background: u.avatar_url ? `url(${API_URL}${u.avatar_url}) center/cover` : hashColor(u.username) }}>
                      {!u.avatar_url && (u.display_name?.[0]?.toUpperCase() || u.username[0].toUpperCase())}
                    </div>
                    <div>
                      <div className="newchat-name">{u.display_name || u.username}</div>
                      <div className="newchat-username">@{u.username}</div>
                    </div>
                    {onlineUsernames.has(u.username) && <span className="online-dot newchat-online" />}
                    {isAdmin && u.id !== user.id && <button className="promote-btn" onClick={(e) => { e.stopPropagation(); handlePromote(u.id); }} title="Promote to Admin">👑</button>}
                  </div>
                ))}
                {allUsers.length === 0 && <p className="newchat-empty">No other users found</p>}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function RoomListItem({ room, active, editing, editName, onSelect, onStartEdit, onEditChange, onSave, onCancelEdit, onDelete, onClearChat, onInvite, prefix, dm, online, hashColor, noMenu, isAdmin }) {
  const [showMenu, setShowMenu] = useState(false);

  if (editing) {
    return (
      <li className="room-item editing">
        <input value={editName} onChange={(e) => onEditChange(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') onSave(); if (e.key === 'Escape') onCancelEdit(); }}
          autoFocus onClick={(e) => e.stopPropagation()} />
        <div className="room-edit-actions">
          <button onClick={(e) => { e.stopPropagation(); onSave(); }}>✓</button>
          <button onClick={(e) => { e.stopPropagation(); onCancelEdit(); }}>✕</button>
        </div>
      </li>
    );
  }

  return (
    <li className={`room-item ${dm ? 'dm-item' : ''} ${active ? 'active' : ''}`}
      onClick={onSelect}
      onContextMenu={(e) => { e.preventDefault(); setShowMenu(true); }}
    >
      {dm ? (
        <div className="dm-avatar-sm" style={{ background: hashColor(room.name) }}>
          {room.name[0].toUpperCase()}
          {online && <span className="dm-online-dot" />}
        </div>
      ) : (
        <span className="room-hash">{prefix || '#'}</span>
      )}
      <span className="room-name">{room.name}</span>
      <button className="room-item-menu" onClick={(e) => { e.stopPropagation(); setShowMenu(!showMenu); }}>⋯</button>
      {showMenu && (
        <div className="room-context-menu" onMouseLeave={() => setShowMenu(false)} onClick={(e) => e.stopPropagation()}>
          {!dm && !noMenu && isAdmin && <button onClick={() => { setShowMenu(false); onStartEdit(); }}>✏️ Rename</button>}
          {!noMenu && isAdmin && <button onClick={() => { setShowMenu(false); onDelete(); }}>🗑️ Delete</button>}
          {!dm && <button onClick={() => { setShowMenu(false); onInvite(); }}>🔗 Copy Invite Link</button>}
          <button onClick={() => { setShowMenu(false); onClearChat(); }}>🧹 Clear Chat</button>
        </div>
      )}
    </li>
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
        method: 'PUT', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
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
        method: 'POST', headers: { Authorization: `Bearer ${token}` }, body: formData,
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
