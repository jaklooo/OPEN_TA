'use client';

import { useState } from 'react';
import { apiUrl } from '@/lib/api';

interface DocumentUploadProps {
  projectId: string;
  onDocumentCreated?: () => void;
}

export function DocumentUpload({ projectId, onDocumentCreated }: DocumentUploadProps) {
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [txtFile, setTxtFile] = useState<File | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !content.trim()) return;

    setIsLoading(true);
    setError('');

    try {
      const token = localStorage.getItem('accessToken');
      const res = await fetch(apiUrl(`/projects/${projectId}/documents`), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          title,
          plainText: content,
          sourceType: 'PASTE'
        })
      });

      if (!res.ok) throw new Error('Failed to create document');

      setTitle('');
      setContent('');
      onDocumentCreated?.();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleTxtUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !txtFile) return;

    setIsLoading(true);
    setError('');

    try {
      const token = localStorage.getItem('accessToken');
      const formData = new FormData();
      formData.append('title', title);
      formData.append('file', txtFile);

      const res = await fetch(apiUrl(`/projects/${projectId}/documents/upload/txt`), {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`
        },
        body: formData
      });

      if (!res.ok) throw new Error('Failed to upload .txt document');

      setTitle('');
      setTxtFile(null);
      onDocumentCreated?.();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="card">
      <h3 style={{ marginTop: 0 }}>Add Document</h3>
      {error && <p style={{ color: 'var(--accent-2)' }}>{error}</p>}
      <form onSubmit={handleSubmit} style={{ display: 'grid', gap: '0.7rem' }}>
        <label>
          Document Title
          <input
            type="text"
            placeholder="e.g., Interview Transcript"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            style={{ width: '100%' }}
          />
        </label>
        <label>
          Paste Text Content
          <textarea
            placeholder="Paste your document text here..."
            value={content}
            onChange={(e) => setContent(e.target.value)}
            style={{ width: '100%', minHeight: 200 }}
          />
        </label>
        <button type="submit" disabled={isLoading}>
          {isLoading ? 'Adding...' : 'Add Document'}
        </button>
      </form>

      <hr style={{ margin: '1rem 0' }} />

      <form onSubmit={handleTxtUpload} style={{ display: 'grid', gap: '0.7rem' }}>
        <label>
          Upload .txt File
          <input
            type="file"
            accept=".txt,text/plain"
            onChange={(e) => setTxtFile(e.target.files?.[0] ?? null)}
            style={{ width: '100%' }}
          />
        </label>
        <button type="submit" disabled={isLoading || !txtFile}>
          {isLoading ? 'Uploading...' : 'Upload TXT'}
        </button>
      </form>
    </div>
  );
}
