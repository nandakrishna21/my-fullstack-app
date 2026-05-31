import { useEffect, useRef } from 'react';

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
            {!isOwn && <div className="username">{msg.username}</div>}
            <div>{msg.content}</div>
            <div className="time">
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
