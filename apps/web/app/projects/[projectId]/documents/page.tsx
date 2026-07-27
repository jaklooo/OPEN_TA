'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { DocumentUpload } from '@/components/document-upload';
import { TopNav } from '@/components/top-nav';
import { apiUrl, getApiError } from '@/lib/api';

interface Document {
  id: string;
  title: string;
  plainText: string;
  sourceType: string;
  createdAt: string;
}

export default function DocumentsPage() {
  const params = useParams();
  const projectId = params.projectId as string;
  const [documents, setDocuments] = useState<Document[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [editingDocumentId, setEditingDocumentId] = useState<string | null>(null);
  const [editingTitle, setEditingTitle] = useState('');
  const [savingDocumentId, setSavingDocumentId] = useState<string | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    fetchDocuments();
  }, [projectId]);

  const fetchDocuments = async () => {
    try {
      setIsLoading(true);
      setError('');
      const token = localStorage.getItem('accessToken');
      const res = await fetch(apiUrl(`/projects/${projectId}/documents`), {
        headers: { Authorization: `Bearer ${token}` }
      });

      if (!res.ok) throw new Error('Failed to fetch documents');
      const data = await res.json();
      setDocuments(data);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleDocumentCreated = (document: Document) => {
    setDocuments((prev) => [document, ...prev.filter((item) => item.id !== document.id)]);
    void fetchDocuments();
  };

  const handleDeleteDocument = async (documentId: string) => {
    const shouldDelete = window.confirm('Delete this document? Existing codings for it will be removed too.');
    if (!shouldDelete) return;

    try {
      setError('');
      const token = localStorage.getItem('accessToken');
      const res = await fetch(apiUrl(`/projects/${projectId}/documents/${documentId}`), {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` }
      });

      if (!res.ok) throw new Error('Failed to delete document');
      setDocuments((prev) => prev.filter((doc) => doc.id !== documentId));
    } catch (err) {
      setError((err as Error).message);
    }
  };

  const startEditingDocument = (document: Document) => {
    setEditingDocumentId(document.id);
    setEditingTitle(document.title);
    setError('');
  };

  const cancelEditingDocument = () => {
    setEditingDocumentId(null);
    setEditingTitle('');
  };

  const handleUpdateDocumentTitle = async (documentId: string) => {
    const title = editingTitle.trim();
    if (title.length < 2) {
      setError('Document title must be at least 2 characters.');
      return;
    }

    try {
      setSavingDocumentId(documentId);
      setError('');
      const token = localStorage.getItem('accessToken');
      const res = await fetch(apiUrl(`/projects/${projectId}/documents/${documentId}`), {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ title })
      });

      if (!res.ok) {
        throw new Error(await getApiError(res, 'Failed to update document'));
      }

      const updatedDocument = await res.json();
      setDocuments((prev) => prev.map((doc) => (doc.id === documentId ? updatedDocument : doc)));
      cancelEditingDocument();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSavingDocumentId(null);
    }
  };

  return (
    <main>
      <TopNav />
      <section className="container page-stack">
        <header className="page-heading">
          <div>
            <h2>Documents</h2>
            <p>Upload, paste, review, and remove source documents for this project.</p>
          </div>
          <Link className="nav-link" href={`/projects/${projectId}/coding`}>
            Open Coding
          </Link>
        </header>

        <DocumentUpload projectId={projectId} onDocumentCreated={handleDocumentCreated} />

        {error && <p style={{ color: 'var(--accent-2)' }}>{error}</p>}

        <section>
          <h3>Document Library</h3>
          {isLoading ? (
            <p>Loading documents...</p>
          ) : documents.length === 0 ? (
            <p style={{ color: 'var(--muted)' }}>No documents yet. Add one above.</p>
          ) : (
            <div className="document-list">
              {documents.map((doc) => (
                <article className="document-row" key={doc.id}>
                  <div>
                    {editingDocumentId === doc.id ? (
                      <div className="document-title-edit">
                        <label>
                          <span className="sr-only">Document title</span>
                          <input
                            type="text"
                            value={editingTitle}
                            onChange={(e) => setEditingTitle(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') {
                                void handleUpdateDocumentTitle(doc.id);
                              }

                              if (e.key === 'Escape') {
                                cancelEditingDocument();
                              }
                            }}
                            autoFocus
                          />
                        </label>
                        <div className="document-title-edit-actions">
                          <button
                            type="button"
                            onClick={() => handleUpdateDocumentTitle(doc.id)}
                            disabled={savingDocumentId === doc.id}
                          >
                            {savingDocumentId === doc.id ? 'Saving...' : 'Save'}
                          </button>
                          <button type="button" className="ghost-button" onClick={cancelEditingDocument}>
                            Cancel
                          </button>
                        </div>
                      </div>
                    ) : (
                      <strong>{doc.title}</strong>
                    )}
                    <p>
                      {doc.sourceType === 'IMPORTED_CODES'
                        ? 'Imported codes only'
                        : `${doc.plainText.slice(0, 180)}${doc.plainText.length > 180 ? '...' : ''}`}
                    </p>
                    <small>
                      {doc.sourceType} · {new Date(doc.createdAt).toLocaleDateString()}
                    </small>
                  </div>
                  <div className="document-row-actions">
                    {editingDocumentId !== doc.id && (
                      <button type="button" className="ghost-button" onClick={() => startEditingDocument(doc)}>
                        Edit
                      </button>
                    )}
                    {doc.sourceType === 'IMPORTED_CODES' ? (
                      <Link className="nav-link" href={`/projects/${projectId}/data-view`}>
                        View Data
                      </Link>
                    ) : (
                      <Link className="nav-link" href={`/projects/${projectId}/coding?documentId=${doc.id}`}>
                        Code
                      </Link>
                    )}
                    <button type="button" onClick={() => handleDeleteDocument(doc.id)}>
                      Delete
                    </button>
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>
      </section>
    </main>
  );
}
