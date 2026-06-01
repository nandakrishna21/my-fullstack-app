import { useState, useEffect, useRef } from 'react';

const API_URL = import.meta.env.VITE_API_URL || '';

function formatSize(bytes) {
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1048576) return (bytes / 1024).toFixed(1) + ' KB';
  return (bytes / 1048576).toFixed(1) + ' MB';
}

function formatDate(dateStr) {
  const date = new Date(dateStr);
  const now = new Date();
  const diff = now - date;
  if (diff < 86400000 && date.getDate() === now.getDate()) {
    return 'Today ' + date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) + ' ' + date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function FileGallery({ user, token, onBack }) {
  const [files, setFiles] = useState([]);
  const [uploading, setUploading] = useState(false);
  const [description, setDescription] = useState('');
  const [selectedFile, setSelectedFile] = useState(null);
  const [expandedImg, setExpandedImg] = useState(null);
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef(null);

  useEffect(() => {
    fetch(`${API_URL}/api/files`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((res) => res.json())
      .then((data) => {
        if (Array.isArray(data)) setFiles(data);
      })
      .catch(console.error);
  }, [token]);

  const handleUpload = async (file) => {
    if (!file) return;
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('description', description);

      const res = await fetch(`${API_URL}/api/files/upload`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      setFiles((prev) => [data, ...prev]);
      setSelectedFile(null);
      setDescription('');
    } catch (err) {
      alert('Upload failed: ' + err.message);
    } finally {
      setUploading(false);
    }
  };

  const handleDelete = async (id) => {
    if (!confirm('Delete this file?')) return;
    try {
      const res = await fetch(`${API_URL}/api/files/${id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error('Delete failed');
      setFiles((prev) => prev.filter((f) => f.id !== id));
    } catch (err) {
      alert('Delete failed: ' + err.message);
    }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file) setSelectedFile(file);
  };

  const isImage = (type) => type?.startsWith('image/');

  return (
    <div className="gallery-page">
      <div className="gallery-header">
        <button className="gallery-back-btn" onClick={onBack}>← Back to Chat</button>
        <h2>File Gallery</h2>
      </div>

      <div
        className={`gallery-upload-area ${dragOver ? 'drag-over' : ''}`}
        onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={handleDrop}
      >
        <div className="gallery-upload-form">
          <input
            type="text"
            placeholder="Add a description (optional)..."
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className="gallery-desc-input"
          />
          <div className="gallery-upload-row">
            <input
              type="file"
              ref={fileInputRef}
              onChange={(e) => setSelectedFile(e.target.files[0])}
              accept="image/*,.pdf"
              style={{ display: 'none' }}
            />
            <button className="gallery-choose-btn" onClick={() => fileInputRef.current?.click()} disabled={uploading}>
              Choose File
            </button>
            {selectedFile && (
              <span className="gallery-selected-name">
                {selectedFile.name} ({(selectedFile.size / 1024).toFixed(1)} KB)
              </span>
            )}
            <button
              className="gallery-upload-btn"
              onClick={() => handleUpload(selectedFile)}
              disabled={!selectedFile || uploading}
            >
              {uploading ? 'Uploading...' : 'Upload'}
            </button>
          </div>
          <p className="gallery-hint">Drop an image or PDF here, or click Choose File</p>
        </div>
      </div>

      {files.length === 0 ? (
        <div className="gallery-empty">
          <span className="gallery-empty-icon">📁</span>
          <h3>No files yet</h3>
          <p>Upload images and PDFs to see them here</p>
        </div>
      ) : (
        <div className="gallery-grid">
          {files.map((f) => (
            <div key={f.id} className="gallery-item">
              {isImage(f.file_type) ? (
                <div className="gallery-img-wrap" onClick={() => setExpandedImg(f)}>
                  <img src={`${API_URL}${f.file_url}`} alt={f.file_name} className="gallery-img" />
                </div>
              ) : (
                <a href={`${API_URL}${f.file_url}`} target="_blank" rel="noopener noreferrer" className="gallery-pdf-card" download={f.file_name}>
                  <span className="gallery-pdf-icon">📄</span>
                  <span className="gallery-pdf-name">{f.file_name}</span>
                  <span className="gallery-pdf-size">{formatSize(f.file_size)}</span>
                  <span className="gallery-download">⬇</span>
                </a>
              )}
              <div className="gallery-item-info">
                <div className="gallery-item-name">{f.file_name}</div>
                {f.description && <div className="gallery-item-desc">{f.description}</div>}
                <div className="gallery-item-meta">
                  <span>{f.username}</span>
                  <span>{formatSize(f.file_size)}</span>
                  <span>{formatDate(f.created_at)}</span>
                </div>
              </div>
              {f.user_id === user.id && (
                <button className="gallery-delete-btn" onClick={() => handleDelete(f.id)} title="Delete">✕</button>
              )}
            </div>
          ))}
        </div>
      )}

      {expandedImg && (
        <div className="gallery-overlay" onClick={() => setExpandedImg(null)}>
          <img src={`${API_URL}${expandedImg.file_url}`} alt={expandedImg.file_name} className="gallery-overlay-img" />
        </div>
      )}
    </div>
  );
}

export default FileGallery;
