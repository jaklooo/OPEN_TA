'use client';
import { t, localeTag } from '@/lib/i18n';


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

      if (!res.ok) throw new Error(t("Failed to fetch documents"));
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
    const shouldDelete = window.confirm(t("Delete this document? Existing codings for it will be removed too."));
    if (!shouldDelete) return;

    try {
      setError('');
      const token = localStorage.getItem('accessToken');
      const res = await fetch(apiUrl(`/projects/${projectId}/documents/${documentId}`), {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` }
      });

      if (!res.ok) throw new Error(t("Failed to delete document"));
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
      setError(t("Document title must be at least 2 characters."));
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
        throw new Error(await getApiError(res, t("Failed to update document")));
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
            <h2>{t("Documents")}</h2>
            <p>{t("Upload, paste, review, and remove source documents for this project.")}</p>
          </div>
          <Link className="nav-link" href={`/projects/${projectId}/coding`}>{t("Open Coding")}</Link>
        </header>

        <DocumentUpload projectId={projectId} onDocumentCreated={handleDocumentCreated} />

        {error && <p style={{ color: 'var(--accent-2)' }}>{error}</p>}

        <section>
          <h3>{t("Document Library")}</h3>
          {isLoading ? (
            <p>{t("Loading documents...")}</p>
          ) : documents.length === 0 ? (
            <p style={{ color: 'var(--muted)' }}>{t("No documents yet. Add one above.")}</p>
          ) : (
            <div className="document-list">
              {documents.map((doc) => (
                <article className="document-row" key={doc.id}>
                  <div>
                    {editingDocumentId === doc.id ? (
                      <div className="document-title-edit">
                        <label>
                          <span className="sr-only">{t("Document title")}</span>
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
                            {savingDocumentId === doc.id ? t("Saving...") : t("Save")}
                          </button>
                          <button type="button" className="ghost-button" onClick={cancelEditingDocument}>{t("Cancel")}</button>
                        </div>
                      </div>
                    ) : (
                      <strong>{doc.title}</strong>
                    )}
                    <p>
                      {doc.sourceType === 'IMPORTED_CODES'
                        ? t("Imported codes only")
                        : `${doc.plainText.slice(0, 180)}${doc.plainText.length > 180 ? '...' : ''}`}
                    </p>
                    <small>
                      {t(doc.sourceType)} · {new Date(doc.createdAt).toLocaleDateString(localeTag())}
                    </small>
                  </div>
                  <div className="document-row-actions">
                    {editingDocumentId !== doc.id && (
                      <button type="button" className="ghost-button" onClick={() => startEditingDocument(doc)}>{t("Edit")}</button>
                    )}
                    {doc.sourceType === 'IMPORTED_CODES' ? (
                      <Link className="nav-link" href={`/projects/${projectId}/data-view`}>{t("View Data")}</Link>
                    ) : (
                      <Link className="nav-link" href={`/projects/${projectId}/coding?documentId=${doc.id}`}>{t("Code")}</Link>
                    )}
                    <button type="button" onClick={() => handleDeleteDocument(doc.id)}>{t("Delete")}</button>
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
