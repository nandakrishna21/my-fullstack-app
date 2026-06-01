import { useState, useEffect, useRef } from 'react';

const COLORS = ['#e94560', '#4ade80', '#60a5fa', '#f59e0b', '#a78bfa', '#34d399', '#fb923c', '#2dd4bf'];

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

  if (diff < oneDay && date.getDate() === now.getDate()) {
    return 'Today';
  }

  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);
  if (date.getDate() === yesterday.getDate() &&
      date.getMonth() === yesterday.getMonth() &&
      date.getFullYear() === yesterday.getFullYear()) {
    return 'Yesterday';
  }

  return date.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
}

function shouldShowDateSeparator(prevMsg, currentMsg) {
  if (!prevMsg) return true;
  const prev = new Date(prevMsg.created_at).toDateString();
  const curr = new Date(currentMsg.created_at).toDateString();
  return prev !== curr;
}

function formatSize(bytes) {
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1048576) return (bytes / 1024).toFixed(1) + ' KB';
  return (bytes / 1048576).toFixed(1) + ' MB';
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
        <img
          src={url}
          alt={msg.file_name}
          className="file-image"
          onClick={(e) => { e.stopPropagation(); setExpanded(true); }}
        />
        {expanded && (
          <div className="file-expanded-overlay" onClick={() => setExpanded(false)}>
            <img src={url} alt={msg.file_name} className="file-expanded-img" />
          </div>
        )}
      </div>
    );
  }

  return (
    <a
      href={`${import.meta.env.VITE_API_URL || ''}${msg.file_url}`}
      target="_blank"
      rel="noopener noreferrer"
      className="file-attachment file-pdf"
      download={msg.file_name}
    >
      <span className="file-pdf-icon">📄</span>
      <div className="file-info">
        <span className="file-name">{msg.file_name}</span>
        <span className="file-size">{formatSize(msg.file_size)}</span>
      </div>
      <span className="file-download">⬇</span>
    </a>
  );
}

function MessageList({ messages, currentUser }) {
  const bottomRef = useRef(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  if (messages.length === 0) {
    return (
      <div className="messages">
        <div className="empty-state">
          <div className="empty-icon">💬</div>
          <h3>Welcome to ChatApp!</h3>
          <p>Start a conversation by sending a message or sharing an image/PDF.</p>
        </div>
        <div ref={bottomRef} />
      </div>
    );
  }

  return (
    <div className="messages">
      {messages.map((msg, idx) => {
        if (msg.type === 'system') {
          return (
            <div key={msg.id} className="message system">
              {msg.content}
            </div>
          );
        }

        const showDateSep = shouldShowDateSeparator(messages[idx - 1], msg);
        const isOwn = msg.username === currentUser;
        const hasFile = msg.file_url;

        return (
          <div key={msg.id}>
            {showDateSep && (
              <div className="date-separator">
                <span>{formatDate(msg.created_at)}</span>
              </div>
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
              {hasFile && <FilePreview msg={msg} />}
              {msg.content && <div className="msg-content">{msg.content}</div>}
              <div className="msg-time">
                {new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </div>
            </div>
          </div>
        );
      })}
      <div ref={bottomRef} />
    </div>
  );
}

export default MessageList;
