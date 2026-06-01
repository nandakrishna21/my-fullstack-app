import { useState, useRef, useEffect } from 'react';

function MessageInput({ onSend, onFileSend, onTyping, onStopTyping, uploading }) {
  const [content, setContent] = useState('');
  const [selectedFile, setSelectedFile] = useState(null);
  const typingTimeout = useRef(null);
  const fileInputRef = useRef(null);
  const textInputRef = useRef(null);

  const handleChange = (e) => {
    setContent(e.target.value);
    onTyping();
    if (typingTimeout.current) clearTimeout(typingTimeout.current);
    typingTimeout.current = setTimeout(() => onStopTyping(), 1500);
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (selectedFile) {
      onFileSend(selectedFile);
      setSelectedFile(null);
      if (fileInputRef.current) fileInputRef.current.value = '';
      return;
    }
    if (!content.trim()) return;
    if (typingTimeout.current) clearTimeout(typingTimeout.current);
    onStopTyping();
    onSend(content.trim());
    setContent('');
  };

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setSelectedFile(file);
  };

  const handlePaste = (e) => {
    const items = e.clipboardData?.items;
    if (!items) return;
    for (const item of items) {
      if (item.type.startsWith('image/')) {
        e.preventDefault();
        const file = item.getAsFile();
        if (file) {
          setSelectedFile(file);
        }
        return;
      }
    }
  };

  const clearFile = () => {
    setSelectedFile(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  useEffect(() => {
    return () => {
      if (typingTimeout.current) clearTimeout(typingTimeout.current);
    };
  }, []);

  const filePreview = selectedFile ? (
    <div className="file-preview">
      {selectedFile.type.startsWith('image/') ? (
        <img src={URL.createObjectURL(selectedFile)} alt="preview" className="file-preview-img" />
      ) : (
        <div className="file-preview-pdf">
          <span className="file-preview-icon">📄</span>
          <span className="file-preview-name">{selectedFile.name}</span>
        </div>
      )}
      <button type="button" className="file-preview-remove" onClick={clearFile}>✕</button>
    </div>
  ) : null;

  return (
    <div className="input-wrapper">
      {filePreview}
      <form className="message-input-area" onSubmit={handleSubmit}>
        <button
          type="button"
          className="attach-btn"
          onClick={() => fileInputRef.current?.click()}
          disabled={uploading}
          title="Attach image or PDF"
        >
          {uploading ? <span className="spinner-sm" /> : <span>＋</span>}
        </button>
        <input
          type="file"
          ref={fileInputRef}
          onChange={handleFileChange}
          accept="image/*,.pdf"
          style={{ display: 'none' }}
        />
        <input
          ref={textInputRef}
          type="text"
          placeholder={selectedFile ? 'Add a caption (optional)...' : 'Type a message...'}
          value={content}
          onChange={handleChange}
          onPaste={handlePaste}
          autoFocus
        />
        <button type="submit" disabled={(!content.trim() && !selectedFile) || uploading}>
          {selectedFile ? 'Upload' : 'Send'}
        </button>
      </form>
    </div>
  );
}

export default MessageInput;
