'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
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
  documentId?: string;
  codeId: string;
  snippet: string;
  startIndex: number;
  endIndex: number;
  code?: Code;
}

interface Theme {
  id: string;
  name: string;
  color: string;
  layer: number;
  documentId?: string | null;
  codeLinks: Array<{ codeId: string; code: Code }>;
  codingLinks: Array<{ codingId: string; coding: Coding }>;
  parentThemeLinks: Array<{ parentThemeId: string; parentTheme: Theme }>;
}

interface DocumentWithCodings extends Document {
  codings: Coding[];
}

interface ReportCode {
  id: string;
  name: string;
  description?: string | null;
  excerpts: ReportCodeExcerpt[];
}

interface ReportCodeExcerpt {
  id: string;
  snippet: string;
  documentId: string;
  documentTitle: string;
}

interface ReportSource {
  id: string;
  title: string;
}

interface ReportTheme {
  id: string;
  name: string;
  color: string;
  layer: number;
  codes: ReportCode[];
  totalCodeCount: number;
  sourceCount: number;
  sources: ReportSource[];
  reportContent: string;
  reportUpdatedAt?: string | null;
}

interface ReportThemeResponse {
  layer: number | null;
  themes: ReportTheme[];
}

const GLOBAL_SCOPE = 'global';
type DataViewMode = 'home' | 'documents' | 'analytics';
type AnalyticsView = 'home' | 'summary-table';

export default function DataViewPage() {
  const params = useParams();
  const projectId = params.projectId as string;
  const [activeView, setActiveView] = useState<DataViewMode>('home');
  const [documents, setDocuments] = useState<DocumentWithCodings[]>([]);
  const [codes, setCodes] = useState<Code[]>([]);
  const [themes, setThemes] = useState<Theme[]>([]);
  const [reportThemes, setReportThemes] = useState<ReportTheme[]>([]);
  const [activeAnalyticsView, setActiveAnalyticsView] = useState<AnalyticsView>('home');
  const [selectedSummaryThemeId, setSelectedSummaryThemeId] = useState('');
  const [selectedSummaryCodeId, setSelectedSummaryCodeId] = useState('');
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
  const themeById = useMemo(() => new Map(themes.map((theme) => [theme.id, theme])), [themes]);
  const selectedSummaryTheme = useMemo(
    () => reportThemes.find((theme) => theme.id === selectedSummaryThemeId) ?? null,
    [reportThemes, selectedSummaryThemeId]
  );
  const selectedSummaryCode = useMemo(
    () => selectedSummaryTheme?.codes.find((code) => code.id === selectedSummaryCodeId) ?? null,
    [selectedSummaryCodeId, selectedSummaryTheme]
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

      const [documentsRes, codesRes, themesRes, reportThemesRes] = await Promise.all([
        fetch(apiUrl(`/projects/${projectId}/documents`), { headers }),
        fetch(apiUrl(`/projects/${projectId}/codes`), { headers }),
        fetch(apiUrl(`/projects/${projectId}/themes`), { headers }),
        fetch(apiUrl(`/projects/${projectId}/reports/global-themes`), { headers })
      ]);

      if (!documentsRes.ok) throw new Error('Failed to fetch documents');
      if (!codesRes.ok) throw new Error('Failed to fetch codes');
      if (!themesRes.ok) throw new Error('Failed to fetch themes');
      if (!reportThemesRes.ok) throw new Error('Failed to fetch report themes');

      const [documentsData, codesData, themesData, reportThemesData]: [
        Document[],
        Code[],
        Theme[],
        ReportThemeResponse
      ] = await Promise.all([
        documentsRes.json(),
        codesRes.json(),
        themesRes.json(),
        reportThemesRes.json()
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
      setReportThemes(reportThemesData.themes);
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

  const getThemeCodingIds = (theme: Theme, visitedThemeIds = new Set<string>()): Set<string> => {
    if (visitedThemeIds.has(theme.id)) return new Set();
    visitedThemeIds.add(theme.id);

    const codingIds = new Set(theme.codingLinks.map((link) => link.codingId));

    for (const link of theme.parentThemeLinks) {
      const parentTheme = themeById.get(link.parentThemeId);
      if (!parentTheme) continue;
      for (const codingId of getThemeCodingIds(parentTheme, visitedThemeIds)) {
        codingIds.add(codingId);
      }
    }

    return codingIds;
  };

  const getThemeCodeCount = (theme: Theme) => getThemeCodingIds(theme).size || theme.codeLinks.length;

  const summaryRows = useMemo(() => {
    return reportThemes
      .map((theme) => ({
        themeId: theme.id,
        theme: theme.name,
        codes: theme.totalCodeCount || theme.codes.length,
        docs: theme.sourceCount,
        hasReport: theme.reportContent.trim().length > 0
      }))
      .sort((a, b) => b.codes - a.codes || b.docs - a.docs);
  }, [reportThemes]);

  const openSummaryTheme = (themeId: string) => {
    setSelectedSummaryThemeId(themeId);
    setSelectedSummaryCodeId('');
  };

  const closeSummaryTheme = () => {
    setSelectedSummaryThemeId('');
    setSelectedSummaryCodeId('');
  };

  const openSummaryCode = (codeId: string) => {
    setSelectedSummaryCodeId(codeId);
  };

  const closeSummaryCode = () => {
    setSelectedSummaryCodeId('');
  };

  const getThemeCodeNames = (theme: Theme, visitedThemeIds = new Set<string>()): string[] => {
    if (visitedThemeIds.has(theme.id)) return [];
    visitedThemeIds.add(theme.id);

    const names = [
      ...theme.codingLinks.map((link) => link.coding.code?.name ?? 'Code'),
      ...theme.codeLinks.map((link) => link.code.name)
    ];

    for (const link of theme.parentThemeLinks) {
      const parentTheme = themeById.get(link.parentThemeId);
      if (!parentTheme) continue;
      names.push(...getThemeCodeNames(parentTheme, visitedThemeIds));
    }

    return Array.from(new Set(names)).sort((a, b) => a.localeCompare(b));
  };

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
            <p>Choose a document-level view or move into project analytics.</p>
          </div>
          {activeView !== 'home' && (
            <button type="button" className="ghost-button" onClick={() => setActiveView('home')}>
              Back to Data View
            </button>
          )}
        </header>

        {error && <p style={{ color: 'var(--accent-2)' }}>{error}</p>}

        {activeView === 'home' ? (
          <section className="data-view-launch-grid">
            <button type="button" className="data-view-launch-tile" onClick={() => setActiveView('documents')}>
              <span>Document data view</span>
              <small>Browse codes, coded excerpts, and themes globally or per document.</small>
            </button>
            <button type="button" className="data-view-launch-tile" onClick={() => setActiveView('analytics')}>
              <span>Analytics</span>
              <small>Open the analytical workspace for project-level outputs.</small>
            </button>
          </section>
        ) : activeView === 'analytics' ? (
          isLoading ? (
            <p>Loading analytics...</p>
          ) : activeAnalyticsView === 'home' ? (
            <section className="data-view-launch-grid">
              <button
                type="button"
                className="data-view-launch-tile"
                onClick={() => setActiveAnalyticsView('summary-table')}
              >
                <span>Summary table</span>
                <small>Review the latest global theme layer by total codes and contributing documents.</small>
              </button>
            </section>
          ) : (
            <section className="card analytics-table-card">
              <div className="row-between">
                <div>
                  <h3>Summary table</h3>
                  <p>Latest global themes ordered by total codes.</p>
                </div>
                <button type="button" className="ghost-button" onClick={() => setActiveAnalyticsView('home')}>
                  Back to Analytics
                </button>
              </div>

              {summaryRows.length === 0 ? (
                <p style={{ color: 'var(--muted)' }}>No global themes available yet.</p>
              ) : (
                <div className="summary-table-wrap">
                  <table className="summary-table">
                    <thead>
                      <tr>
                        <th>ID</th>
                        <th>Theme</th>
                        <th>Codes</th>
                        <th>Docs</th>
                      </tr>
                    </thead>
                    <tbody>
                      {summaryRows.map((row, index) => (
                        <tr
                          key={row.themeId}
                          className="summary-table-row"
                          tabIndex={0}
                          onDoubleClick={() => openSummaryTheme(row.themeId)}
                          onKeyDown={(event) => {
                            if (event.key === 'Enter' || event.key === ' ') {
                              event.preventDefault();
                              openSummaryTheme(row.themeId);
                            }
                          }}
                          title="Double-click to open theme details"
                        >
                          <td>{index + 1}</td>
                          <td>
                            <button
                              type="button"
                              className="summary-row-button"
                              onDoubleClick={() => openSummaryTheme(row.themeId)}
                              onKeyDown={(event) => {
                                if (event.key === 'Enter' || event.key === ' ') {
                                  event.preventDefault();
                                  openSummaryTheme(row.themeId);
                                }
                              }}
                            >
                              <span>{row.theme}</span>
                              <small>{row.hasReport ? 'report saved' : 'no report text'}</small>
                            </button>
                          </td>
                          <td>{row.codes}</td>
                          <td>{row.docs}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>
          )
        ) : isLoading ? (
          <p>Loading data...</p>
        ) : (
          <>
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
                          <article key={theme.id} style={{ borderColor: theme.color }}>
                            <strong>{theme.name}</strong>
                            <small>
                              {getThemeCodeCount(theme)} codes
                              {theme.parentThemeLinks.length > 0 && ` / ${theme.parentThemeLinks.length} grouped themes`}
                            </small>
                            {activeScope === GLOBAL_SCOPE && <small>{getThemeScopeLabel(theme)}</small>}
                            {getThemeCodeNames(theme).length > 0 && (
                              <p>{getThemeCodeNames(theme).join(', ')}</p>
                            )}
                            {theme.parentThemeLinks.length > 0 && (
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

      {selectedSummaryTheme && (
        <div className="report-modal" role="dialog" aria-modal="true" aria-labelledby="summary-detail-title">
          <button
            type="button"
            className="report-modal-backdrop"
            aria-label="Close summary detail"
            onClick={closeSummaryTheme}
          />
          <section className="summary-detail-panel">
            <header className="summary-detail-header">
              <div>
                <h3 id="summary-detail-title">{selectedSummaryTheme.name}</h3>
                <p>
                  {selectedSummaryTheme.totalCodeCount} coded excerpts / {selectedSummaryTheme.sourceCount} sources
                </p>
              </div>
              <button type="button" className="ghost-button" onClick={closeSummaryTheme}>
                Close
              </button>
            </header>

            <div className="summary-detail-layout">
              <section className="summary-report-pane" aria-label="Report text">
                <h4>Report text</h4>
                <div className="summary-report-text">
                  {selectedSummaryTheme.reportContent.trim() ? (
                    selectedSummaryTheme.reportContent
                  ) : (
                    <span>No report text saved for this theme yet.</span>
                  )}
                </div>
              </section>

              <aside className="summary-side-pane">
                <section className="summary-side-section" aria-label="Codes linked to this theme">
                  <h4>Codes</h4>
                  <div className="summary-code-tiles">
                    {selectedSummaryTheme.codes.length === 0 ? (
                      <span>No codes linked to this theme yet.</span>
                    ) : (
                      selectedSummaryTheme.codes.map((code) => (
                        <button
                          key={code.id}
                          type="button"
                          onDoubleClick={() => openSummaryCode(code.id)}
                          onKeyDown={(event) => {
                            if (event.key === 'Enter' || event.key === ' ') {
                              event.preventDefault();
                              openSummaryCode(code.id);
                            }
                          }}
                          title="Double-click to open code details"
                        >
                          {code.name}
                        </button>
                      ))
                    )}
                  </div>
                </section>

                <section className="summary-side-section" aria-label="Source documents">
                  <h4>Sources</h4>
                  <div className="summary-source-links">
                    {selectedSummaryTheme.sources.length === 0 ? (
                      <span>No source documents found.</span>
                    ) : (
                      selectedSummaryTheme.sources.map((source) => (
                        <Link key={source.id} href={`/projects/${projectId}/coding?documentId=${source.id}`}>
                          {source.title}
                        </Link>
                      ))
                    )}
                  </div>
                </section>
              </aside>
            </div>
          </section>
        </div>
      )}

      {selectedSummaryTheme && selectedSummaryCode && (
        <div className="summary-code-modal" role="dialog" aria-modal="true" aria-labelledby="summary-code-title">
          <button
            type="button"
            className="summary-code-backdrop"
            aria-label="Close code detail"
            onClick={closeSummaryCode}
          />
          <section className="summary-code-detail-panel">
            <header className="summary-code-detail-header">
              <div>
                <h3 id="summary-code-title">{selectedSummaryCode.name}</h3>
                <p>{selectedSummaryCode.description?.trim() || 'No description saved for this code.'}</p>
              </div>
              <button type="button" className="ghost-button" onClick={closeSummaryCode}>
                Close
              </button>
            </header>

            <section className="summary-code-excerpts" aria-label="Coded excerpts">
              {selectedSummaryCode.excerpts.length === 0 ? (
                <p>No coded excerpts found for this code.</p>
              ) : (
                selectedSummaryCode.excerpts.map((excerpt) => (
                  <article key={excerpt.id}>
                    <blockquote>{excerpt.snippet}</blockquote>
                    <small>Source: {excerpt.documentTitle}</small>
                  </article>
                ))
              )}
            </section>
          </section>
        </div>
      )}
    </main>
  );
}
