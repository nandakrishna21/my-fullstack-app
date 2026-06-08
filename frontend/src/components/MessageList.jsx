import { useState, useEffect, useRef } from 'react';

const COLORS = ['#e94560', '#4ade80', '#60a5fa', '#f59e0b', '#a78bfa', '#34d399', '#fb923c', '#2dd4bf'];
const REACTIONS = ['👍', '❤️', '😂', '😮', '😢', '😡'];

function hashColor(str) {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash);
  }
  return COLORS[Math.abs(hash) % COLORS.length];
}

function formatDate(dateStr) {
  const date = new Date(dateStr);
  const now = new Date();
  const diff = now - date;
  const oneDay = 86400000;
  if (diff < oneDay && date.getDate() === now.getDate()) return 'Today';
  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);
  if (date.getDate() === yesterday.getDate() && date.getMonth() === yesterday.getMonth() && date.getFullYear() === yesterday.getFullYear()) return 'Yesterday';
  return date.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
}

function shouldShowDateSeparator(prevMsg, currentMsg) {
  if (!prevMsg) return true;
  return new Date(prevMsg.created_at).toDateString() !== new Date(currentMsg.created_at).toDateString();
}

function formatSize(bytes) {
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1048576) return (bytes / 1024).toFixed(1) + ' KB';
  return (bytes / 1048576).toFixed(1) + ' MB';
}

function highlightText(text, query) {
  if (!query || !text) return text;
  const parts = text.split(new RegExp(`(${query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi'));
  return parts.map((part, i) =>
    part.toLowerCase() === query.toLowerCase() ? <mark key={i} className="search-highlight">{part}</mark> : part
  );
}

function FilePreview({ msg }) {
  const [expanded, setExpanded] = useState(false);
  const isImage = msg.file_type?.startsWith('image/');
  useEffect(() => {
    if (!expanded) return;
    const close = () => setExpanded(false);
    document.addEventListener('click', close);
    return () => document.removeEventListener('click', close);
  }, [expanded]);

  if (isImage) {
    const url = `${import.meta.env.VITE_API_URL || ''}${msg.file_url}`;
    return (
      <div className="file-attachment">
        <img src={url} alt={msg.file_name} className="file-image" onClick={(e) => { e.stopPropagation(); setExpanded(true); }} />
        {expanded && (
          <div className="file-expanded-overlay" onClick={() => setExpanded(false)}>
            <img src={url} alt={msg.file_name} className="file-expanded-img" />
          </div>
        )}
      </div>
    );
  }
  return (
    <a href={`${import.meta.env.VITE_API_URL || ''}${msg.file_url}`} target="_blank" rel="noopener noreferrer" className="file-attachment file-pdf" download={msg.file_name}>
      <span className="file-pdf-icon">📄</span>
      <div className="file-info">
        <span className="file-name">{msg.file_name}</span>
        <span className="file-size">{formatSize(msg.file_size)}</span>
      </div>
      <span className="file-download">⬇</span>
    </a>
  );
}

function ReactionBar({ reactions, onReact }) {
  const [showPicker, setShowPicker] = useState(false);
  const activeEmojis = Object.keys(reactions || {}).filter((e) => (reactions[e] || []).length > 0);

  return (
    <div className="reaction-bar">
      {activeEmojis.map((emoji) => (
        <button key={emoji} className="reaction-badge" onClick={() => onReact(emoji)} title={reactions[emoji].join(', ')}>
          <span className="reaction-emoji">{emoji}</span>
          <span className="reaction-count">{reactions[emoji].length}</span>
        </button>
      ))}
      <div className="reaction-add-wrap">
        <button className="reaction-add" onClick={() => setShowPicker(!showPicker)}>+</button>
        {showPicker && (
          <div className="reaction-picker" onMouseLeave={() => setShowPicker(false)}>
            {REACTIONS.map((emoji) => (
              <button key={emoji} className="reaction-picker-btn" onClick={() => { onReact(emoji); setShowPicker(false); }}>
                {emoji}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function MessageActions({ isOwn, onEdit, onDelete, msg, setEditMsgId, editMsgId, onReply }) {
  const [showActions, setShowActions] = useState(false);
  return (
    <div className="msg-actions-wrap">
      <button className="msg-actions-btn" onClick={() => setShowActions(!showActions)}>⋯</button>
      {showActions && (
        <div className="msg-actions-menu" onMouseLeave={() => setShowActions(false)}>
          <button onClick={() => { onReply(msg); setShowActions(false); }}>↩️ Reply</button>
          {isOwn && (
            <>
              <button onClick={() => { setEditMsgId(msg.id); setShowActions(false); }}>✏️ Edit</button>
              <button onClick={() => { onDelete(msg.id); setShowActions(false); }}>🗑️ Delete</button>
            </>
          )}
        </div>
      )}
    </div>
  );
}

function ReplyPreview({ replyTo }) {
  if (!replyTo) return null;
  const text = replyTo.content || (replyTo.file_name ? `📎 ${replyTo.file_name}` : '');
  return (
    <div className="reply-preview">
      <div className="reply-preview-bar" />
      <div className="reply-preview-body">
        <span className="reply-preview-user">{replyTo.username}</span>
        <span className="reply-preview-text">{text?.slice(0, 80)}{text?.length > 80 ? '…' : ''}</span>
      </div>
    </div>
  );
}

function MessageList({ messages, currentUser, onEdit, onDelete, onReact, searchQuery, onReply }) {
  const bottomRef = useRef(null);
  const [editMsgId, setEditMsgId] = useState(null);
  const [editContent, setEditContent] = useState('');
  const editInputRef = useRef(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  useEffect(() => {
    if (editMsgId && editInputRef.current) {
      editInputRef.current.focus();
      editInputRef.current.setSelectionRange(editInputRef.current.value.length, editInputRef.current.value.length);
    }
  }, [editMsgId]);

  const handleEditSubmit = (msgId) => {
    if (editContent.trim()) {
      onEdit(msgId, editContent.trim());
    }
    setEditMsgId(null);
    setEditContent('');
  };

  if (messages.length === 0) {
    return (
      <div className="messages">
        <div className="empty-state">
          <div className="empty-icon">💬</div>
          <h3>{searchQuery ? 'No results found' : 'Welcome to ChatApp!'}</h3>
          <p>{searchQuery ? `No messages match "${searchQuery}"` : 'Start a conversation by sending a message or sharing an image/PDF.'}</p>
        </div>
        <div ref={bottomRef} />
      </div>
    );
  }

  return (
    <div className="messages">
      {searchQuery && (
        <div className="search-notice">
          Showing results for "<strong>{searchQuery}</strong>"
          <button onClick={() => window.location.reload()} className="search-notice-clear">✕</button>
        </div>
      )}
      {messages.map((msg, idx) => {
        if (msg.type === 'system') {
          return <div key={msg.id} className="message system">{msg.content}</div>;
        }

        const showDateSep = shouldShowDateSeparator(messages[idx - 1], msg);
        const isOwn = msg.username === currentUser;
        const hasFile = msg.file_url;
        const reactions = msg.reactions || {};

        return (
          <div key={msg.id}>
            {showDateSep && (
              <div className="date-separator"><span>{formatDate(msg.created_at)}</span></div>
            )}
            <div className={`message ${isOwn ? 'own' : 'other'} ${hasFile ? 'has-file' : ''}`}>
              {!isOwn && (
                <div className="msg-sender">
                  <div className="sender-avatar" style={{ background: hashColor(msg.username) }}>
                    {msg.username[0].toUpperCase()}
                  </div>
                  <span className="sender-name">{msg.username}</span>
                </div>
              )}
              <MessageActions isOwn={isOwn} onEdit={onEdit} onDelete={onDelete} msg={msg} setEditMsgId={setEditMsgId} editMsgId={editMsgId} onReply={onReply} />
              <ReplyPreview replyTo={msg.reply_to_message} />
              {hasFile && <FilePreview msg={msg} />}
              {editMsgId === msg.id ? (
                <div className="edit-input-wrap">
                  <input
                    ref={editInputRef}
                    className="edit-input"
                    value={editContent}
                    onChange={(e) => setEditContent(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') handleEditSubmit(msg.id);
                      if (e.key === 'Escape') { setEditMsgId(null); setEditContent(''); }
                    }}
                  />
                  <div className="edit-actions">
                    <button className="edit-cancel" onClick={() => { setEditMsgId(null); setEditContent(''); }}>Cancel</button>
                    <button className="edit-save" onClick={() => handleEditSubmit(msg.id)}>Save</button>
                  </div>
                </div>
              ) : (
                <div className="msg-content">
                  {highlightText(msg.content, searchQuery)}
                  {msg.edited && <span className="edited-badge">edited</span>}
                </div>
              )}
              <div className="msg-time">
                {new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </div>
            </div>
            <ReactionBar reactions={reactions} onReact={(emoji) => onReact(msg.id, emoji)} />
          </div>
        );
      })}
      <div ref={bottomRef} />
    </div>
  );
}

export default MessageList;
