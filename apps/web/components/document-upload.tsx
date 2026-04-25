'use client';

import { useState } from 'react';
import { apiUrl } from '@/lib/api';

interface DocumentUploadProps {
  projectId: string;
  onDocumentCreated?: (document: CreatedDocument) => void;
}

interface CreatedDocument {
  id: string;
  title: string;
  plainText: string;
  sourceType: string;
  createdAt: string;
}

export function DocumentUpload({ projectId, onDocumentCreated }: DocumentUploadProps) {
  const [pasteTitle, setPasteTitle] = useState('');
  const [content, setContent] = useState('');
  const [uploadTitle, setUploadTitle] = useState('');
  const [documentFile, setDocumentFile] = useState<File | null>(null);
  const [fileInputKey, setFileInputKey] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!pasteTitle.trim() || !content.trim()) return;

    setIsLoading(true);
    setError('');
    setSuccess('');

    try {
      const token = localStorage.getItem('accessToken');
      const res = await fetch(apiUrl(`/projects/${projectId}/documents`), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          title: pasteTitle,
          plainText: content,
          sourceType: 'PASTE'
        })
      });

      if (!res.ok) throw new Error('Failed to create document');
      const createdDocument = await res.json();

      setPasteTitle('');
      setContent('');
      setSuccess('Document added to library.');
      onDocumentCreated?.(createdDocument);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleFileUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!uploadTitle.trim() || !documentFile) {
      setError('Choose a file and add a document title.');
      return;
    }

    setIsLoading(true);
    setError('');
    setSuccess('');

    try {
      const token = localStorage.getItem('accessToken');
      const formData = new FormData();
      formData.append('title', uploadTitle);
      formData.append('file', documentFile);

      const res = await fetch(apiUrl(`/projects/${projectId}/documents/upload`), {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`
        },
        body: formData
      });

      if (!res.ok) {
        const body = await res.json().catch(() => null);
        throw new Error(body?.message ?? 'Failed to upload document');
      }

      const createdDocument = await res.json();

      setUploadTitle('');
      setDocumentFile(null);
      setFileInputKey((value) => value + 1);
      setSuccess('Document uploaded and added to library.');
      onDocumentCreated?.(createdDocument);
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
      {success && <p style={{ color: 'var(--accent)' }}>{success}</p>}
      <form onSubmit={handleSubmit} style={{ display: 'grid', gap: '0.7rem' }}>
        <label>
          Document Title
          <input
            type="text"
            placeholder="e.g., Interview Transcript"
            value={pasteTitle}
            onChange={(e) => setPasteTitle(e.target.value)}
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

      <form onSubmit={handleFileUpload} style={{ display: 'grid', gap: '0.7rem' }}>
        <label>
          Document Title
          <input
            type="text"
            placeholder="Auto-filled from file name"
            value={uploadTitle}
            onChange={(e) => setUploadTitle(e.target.value)}
            style={{ width: '100%' }}
          />
        </label>
        <label>
          Upload File
          <input
            key={fileInputKey}
            type="file"
            accept=".txt,.docx,.pdf,text/plain,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/pdf"
            onChange={(e) => {
              const file = e.target.files?.[0] ?? null;
              setDocumentFile(file);
              if (file && !uploadTitle.trim()) {
                setUploadTitle(file.name.replace(/\.[^.]+$/, ''));
              }
            }}
            style={{ width: '100%' }}
          />
        </label>
        <button type="submit" disabled={isLoading || !documentFile || !uploadTitle.trim()}>
          {isLoading ? 'Uploading...' : 'Upload TXT / DOCX / PDF'}
        </button>
      </form>
    </div>
  );
}
