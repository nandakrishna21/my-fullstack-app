import { useState } from 'react';

function MessageInput({ onSend }) {
  const [content, setContent] = useState('');

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!content.trim()) return;
    onSend(content.trim());
    setContent('');
  };

  return (
    <form className="message-input-area" onSubmit={handleSubmit}>
      <input
        type="text"
        placeholder="Type a message..."
        value={content}
        onChange={(e) => setContent(e.target.value)}
        autoFocus
      />
      <button type="submit" disabled={!content.trim()}>
        Send
      </button>
    </form>
  );
}

export default MessageInput;
