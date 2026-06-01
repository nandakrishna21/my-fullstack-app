import { useEffect, useRef } from 'react';

const COLORS = ['#e94560', '#4ade80', '#60a5fa', '#f59e0b', '#a78bfa', '#34d399', '#fb923c', '#2dd4bf'];

function hashColor(str) {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash);
  }
  return COLORS[Math.abs(hash) % COLORS.length];
}

function MessageList({ messages, currentUser }) {
  const bottomRef = useRef(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  return (
    <div className="messages">
      {messages.map((msg) => {
        if (msg.type === 'system') {
          return (
            <div key={msg.id} className="message system">
              {msg.content}
            </div>
          );
        }

        const isOwn = msg.username === currentUser;
        return (
          <div key={msg.id} className={`message ${isOwn ? 'own' : 'other'}`}>
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
        );
      })}
      <div ref={bottomRef} />
    </div>
  );
}

export default MessageList;
