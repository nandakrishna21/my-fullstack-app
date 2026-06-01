import { useState, useRef, useEffect } from 'react';

function MessageInput({ onSend, onTyping, onStopTyping }) {
  const [content, setContent] = useState('');
  const typingTimeout = useRef(null);

  const handleChange = (e) => {
    setContent(e.target.value);
    onTyping();

    if (typingTimeout.current) {
      clearTimeout(typingTimeout.current);
    }

    typingTimeout.current = setTimeout(() => {
      onStopTyping();
    }, 1500);
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!content.trim()) return;

    if (typingTimeout.current) {
      clearTimeout(typingTimeout.current);
    }
    onStopTyping();
    onSend(content.trim());
    setContent('');
  };

  useEffect(() => {
    return () => {
      if (typingTimeout.current) {
        clearTimeout(typingTimeout.current);
        onStopTyping();
      }
    };
  }, []);

  return (
    <form className="message-input-area" onSubmit={handleSubmit}>
      <input
        type="text"
        placeholder="Type a message..."
        value={content}
        onChange={handleChange}
        autoFocus
      />
      <button type="submit" disabled={!content.trim()}>
        Send
      </button>
    </form>
  );
}

export default MessageInput;
