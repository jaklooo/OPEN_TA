'use client';

import { useEffect, useMemo, useState } from 'react';
import { useParams } from 'next/navigation';
import { TopNav } from '@/components/top-nav';
import { apiUrl } from '@/lib/api';

interface Document {
  id: string;
  title: string;
  plainText: string;
}

interface Code {
  id: string;
  name: string;
  description?: string;
}

interface Coding {
  id: string;
  codeId: string;
  snippet: string;
  startIndex: number;
  endIndex: number;
  code?: Code;
}

interface Theme {
  id: string;
  name: string;
  layer: number;
  documentId?: string | null;
  codeLinks: Array<{ codeId: string; code: Code }>;
  parentThemeLinks: Array<{ parentThemeId: string; parentTheme: Theme }>;
}

interface DocumentWithCodings extends Document {
  codings: Coding[];
}

const GLOBAL_SCOPE = 'global';

export default function DataViewPage() {
  const params = useParams();
  const projectId = params.projectId as string;
  const [documents, setDocuments] = useState<DocumentWithCodings[]>([]);
  const [codes, setCodes] = useState<Code[]>([]);
  const [themes, setThemes] = useState<Theme[]>([]);
  const [activeScope, setActiveScope] = useState(GLOBAL_SCOPE);
  const [editingCodeId, setEditingCodeId] = useState<string | null>(null);
  const [editingCodeName, setEditingCodeName] = useState('');
  const [editingCodeDescription, setEditingCodeDescription] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(true);

  const selectedDocument = documents.find((document) => document.id === activeScope) ?? null;
  const visibleDocuments = selectedDocument ? [selectedDocument] : documents;
  const activeDocumentId = activeScope === GLOBAL_SCOPE ? null : activeScope;
  const visibleThemes =
    activeScope === GLOBAL_SCOPE
      ? themes
      : themes.filter((theme) => (theme.documentId ?? null) === activeDocumentId);
  const documentById = useMemo(
    () => new Map(documents.map((document) => [document.id, document])),
    [documents]
  );

  useEffect(() => {
    fetchData();
  }, [projectId]);

  const fetchData = async () => {
    try {
      setIsLoading(true);
      setError('');
      const token = localStorage.getItem('accessToken');
      const headers = { Authorization: `Bearer ${token}` };

      const [documentsRes, codesRes, themesRes] = await Promise.all([
        fetch(apiUrl(`/projects/${projectId}/documents`), { headers }),
        fetch(apiUrl(`/projects/${projectId}/codes`), { headers }),
        fetch(apiUrl(`/projects/${projectId}/themes`), { headers })
      ]);

      if (!documentsRes.ok) throw new Error('Failed to fetch documents');
      if (!codesRes.ok) throw new Error('Failed to fetch codes');
      if (!themesRes.ok) throw new Error('Failed to fetch themes');

      const [documentsData, codesData, themesData]: [Document[], Code[], Theme[]] = await Promise.all([
        documentsRes.json(),
        codesRes.json(),
        themesRes.json()
      ]);

      const documentsWithCodings = await Promise.all(
        documentsData.map(async (document) => {
          const codingsRes = await fetch(apiUrl(`/projects/${projectId}/documents/${document.id}/codings`), {
            headers
          });
          if (!codingsRes.ok) throw new Error(`Failed to fetch codings for ${document.title}`);
          const codings = await codingsRes.json();
          return { ...document, codings };
        })
      );

      setDocuments(documentsWithCodings);
      setCodes(codesData);
      setThemes(themesData);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setIsLoading(false);
    }
  };

  const visibleCodeCounts = useMemo(() => {
    const counts = new Map<string, { code: Code; count: number }>();

    for (const code of codes) {
      counts.set(code.id, { code, count: 0 });
    }

    for (const document of visibleDocuments) {
      for (const coding of document.codings) {
        const code = coding.code ?? codes.find((item) => item.id === coding.codeId);
        if (!code) continue;
        const current = counts.get(code.id) ?? { code, count: 0 };
        counts.set(code.id, { code, count: current.count + 1 });
      }
    }

    return Array.from(counts.values())
      .filter((item) => activeScope === GLOBAL_SCOPE || item.count > 0)
      .sort((a, b) => b.count - a.count);
  }, [activeScope, codes, visibleDocuments]);

  const themesByLayer = useMemo(() => {
    const groups = new Map<number, Theme[]>();
    for (const theme of visibleThemes) {
      groups.set(theme.layer, [...(groups.get(theme.layer) ?? []), theme]);
    }
    return Array.from(groups.entries()).sort(([a], [b]) => a - b);
  }, [visibleThemes]);

  const handleEditCode = (code: Code) => {
    setEditingCodeId(code.id);
    setEditingCodeName(code.name);
    setEditingCodeDescription(code.description ?? '');
  };

  const getThemeScopeLabel = (theme: Theme) =>
    theme.documentId ? documentById.get(theme.documentId)?.title ?? 'Document theme' : 'Global theme';

  const handleUpdateCode = async (codeId: string) => {
    if (!editingCodeName.trim()) return;

    try {
      setError('');
      const token = localStorage.getItem('accessToken');
      const res = await fetch(apiUrl(`/projects/${projectId}/codes/${codeId}`), {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          name: editingCodeName.trim(),
          description: editingCodeDescription.trim()
        })
      });

      if (!res.ok) throw new Error('Failed to update code');
      const updatedCode = await res.json();
      setCodes((prev) => prev.map((code) => (code.id === codeId ? updatedCode : code)));
      setDocuments((prev) =>
        prev.map((document) => ({
          ...document,
          codings: document.codings.map((coding) =>
            coding.codeId === codeId ? { ...coding, code: updatedCode } : coding
          )
        }))
      );
      setEditingCodeId(null);
    } catch (err) {
      setError((err as Error).message);
    }
  };

  const handleDeleteCode = async (codeId: string) => {
    const shouldDelete = window.confirm('Delete this code and every coding that uses it?');
    if (!shouldDelete) return;

    try {
      setError('');
      const token = localStorage.getItem('accessToken');
      const res = await fetch(apiUrl(`/projects/${projectId}/codes/${codeId}`), {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` }
      });

      if (!res.ok) throw new Error('Failed to delete code');
      setCodes((prev) => prev.filter((code) => code.id !== codeId));
      setDocuments((prev) =>
        prev.map((document) => ({
          ...document,
          codings: document.codings.filter((coding) => coding.codeId !== codeId)
        }))
      );
    } catch (err) {
      setError((err as Error).message);
    }
  };

  return (
    <main>
      <TopNav />
      <section className="container page-stack">
        <header className="page-heading">
          <div>
            <h2>Data View</h2>
            <p>Browse codes, coded excerpts, and themes globally or per document.</p>
          </div>
        </header>

        {error && <p style={{ color: 'var(--accent-2)' }}>{error}</p>}

        <div className="toolbar-row">
          <label>
            View
            <select value={activeScope} onChange={(event) => setActiveScope(event.target.value)}>
              <option value={GLOBAL_SCOPE}>Global project view</option>
              {documents.map((document) => (
                <option value={document.id} key={document.id}>
                  {document.title}
                </option>
              ))}
            </select>
          </label>
        </div>

        {isLoading ? (
          <p>Loading data...</p>
        ) : (
          <>
            <section className="card">
              <h3 style={{ marginTop: 0 }}>{selectedDocument ? 'Document Codes' : 'Global Codes'}</h3>
              {visibleCodeCounts.length === 0 ? (
                <p style={{ color: 'var(--muted)' }}>No codes yet.</p>
              ) : (
                <div className="data-code-grid">
                  {visibleCodeCounts.map(({ code, count }) => (
                    <article key={code.id}>
                      {editingCodeId === code.id ? (
                        <div className="coding-edit">
                          <input
                            type="text"
                            value={editingCodeName}
                            onChange={(event) => setEditingCodeName(event.target.value)}
                          />
                          <textarea
                            value={editingCodeDescription}
                            onChange={(event) => setEditingCodeDescription(event.target.value)}
                            rows={3}
                          />
                          <div className="inline-actions">
                            <button type="button" onClick={() => handleUpdateCode(code.id)}>
                              Save
                            </button>
                            <button type="button" onClick={() => setEditingCodeId(null)}>
                              Cancel
                            </button>
                          </div>
                        </div>
                      ) : (
                        <>
                          <strong>{code.name}</strong>
                          {code.description && <p>{code.description}</p>}
                          <small>{count} coded excerpts</small>
                          <div className="inline-actions">
                            <button type="button" onClick={() => handleEditCode(code)}>
                              Edit
                            </button>
                            <button type="button" onClick={() => handleDeleteCode(code.id)}>
                              Delete
                            </button>
                          </div>
                        </>
                      )}
                    </article>
                  ))}
                </div>
              )}
            </section>

            <section className="card">
              <h3 style={{ marginTop: 0 }}>{selectedDocument ? 'Document Themes' : 'Global Themes'}</h3>
              {themesByLayer.length === 0 ? (
                <p style={{ color: 'var(--muted)' }}>No themes in this view yet.</p>
              ) : (
                <div className="theme-layer-list">
                  {themesByLayer.map(([layer, layerThemes]) => (
                    <div key={layer}>
                      <h4>Layer {layer}</h4>
                      <div className="data-code-grid">
                        {layerThemes.map((theme) => (
                          <article key={theme.id}>
                            <strong>{theme.name}</strong>
                            {theme.layer === 1 ? (
                              <small>{theme.codeLinks.length} codes</small>
                            ) : (
                              <small>{theme.parentThemeLinks.length} parent themes</small>
                            )}
                            {activeScope === GLOBAL_SCOPE && <small>{getThemeScopeLabel(theme)}</small>}
                            {theme.layer === 1 && theme.codeLinks.length > 0 && (
                              <p>{theme.codeLinks.map((link) => link.code.name).join(', ')}</p>
                            )}
                            {theme.layer > 1 && theme.parentThemeLinks.length > 0 && (
                              <p>{theme.parentThemeLinks.map((link) => link.parentTheme.name).join(', ')}</p>
                            )}
                          </article>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </section>

            {activeScope === GLOBAL_SCOPE && (
              <section className="document-data-list">
                {visibleDocuments.length === 0 ? (
                  <p style={{ color: 'var(--muted)' }}>No documents yet.</p>
                ) : (
                  visibleDocuments.map((document) => (
                    <article className="card" key={document.id}>
                      <div className="row-between">
                        <h3 style={{ margin: 0 }}>{document.title}</h3>
                        <small>{document.codings.length} coded excerpts</small>
                      </div>

                      {document.codings.length === 0 ? (
                        <p style={{ color: 'var(--muted)' }}>No codings in this document yet.</p>
                      ) : (
                        <div className="coding-table">
                          {document.codings.map((coding) => (
                            <div key={coding.id}>
                              <strong>{coding.code?.name ?? 'Code'}</strong>
                              <span>{coding.code?.description ?? ''}</span>
                              <p>"{coding.snippet}"</p>
                            </div>
                          ))}
                        </div>
                      )}
                    </article>
                  ))
                )}
              </section>
            )}
          </>
        )}
      </section>
    </main>
  );
}
