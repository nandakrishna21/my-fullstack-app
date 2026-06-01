import { useEffect, useRef } from 'react';

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
          <p>Start a conversation by sending a message below.</p>
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

        return (
          <div key={msg.id}>
            {showDateSep && (
              <div className="date-separator">
                <span>{formatDate(msg.created_at)}</span>
              </div>
            )}
            <div className={`message ${isOwn ? 'own' : 'other'}`}>
              {!isOwn && (
                <div className="msg-sender">
                  <div className="sender-avatar" style={{ background: hashColor(msg.username) }}>
                    {msg.username[0].toUpperCase()}
                  </div>
                  <span className="sender-name">{msg.username}</span>
                </div>
              )}
              <div className="msg-content">{msg.content}</div>
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
