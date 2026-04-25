'use client';

import { useEffect, useMemo, useState } from 'react';
import { useParams } from 'next/navigation';
import { TopNav } from '@/components/top-nav';
import { apiUrl } from '@/lib/api';

interface Document {
  id: string;
  title: string;
  codings?: Coding[];
}

interface Code {
  id: string;
  name: string;
  description?: string;
}

interface Theme {
  id: string;
  name: string;
  layer: number;
  documentId?: string | null;
  codeLinks: Array<{ codeId: string; code: Code }>;
  parentThemeLinks: Array<{ parentThemeId: string; parentTheme: Theme }>;
}

interface Coding {
  codeId: string;
}

const GLOBAL_SCOPE = 'global';

export default function ThematicAnalysisPage() {
  const params = useParams();
  const projectId = params.projectId as string;

  const [documents, setDocuments] = useState<Document[]>([]);
  const [themes, setThemes] = useState<Theme[]>([]);
  const [codes, setCodes] = useState<Code[]>([]);
  const [activeScope, setActiveScope] = useState(GLOBAL_SCOPE);
  const [activeLayer, setActiveLayer] = useState(1);
  const [newThemeName, setNewThemeName] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(true);

  const activeDocumentId = activeScope === GLOBAL_SCOPE ? null : activeScope;
  const documentById = useMemo(
    () => new Map(documents.map((document) => [document.id, document])),
    [documents]
  );
  const scopedThemes =
    activeScope === GLOBAL_SCOPE
      ? themes
      : themes.filter((theme) => (theme.documentId ?? null) === activeDocumentId);
  const availableCodes = useMemo(() => {
    if (!activeDocumentId) return codes;

    const activeDocument = documents.find((document) => document.id === activeDocumentId);
    const documentCodeIds = new Set(activeDocument?.codings?.map((coding) => coding.codeId) ?? []);
    return codes.filter((code) => documentCodeIds.has(code.id));
  }, [activeDocumentId, codes, documents]);
  const layers = useMemo(() => {
    const existingLayers = scopedThemes.map((theme) => theme.layer);
    return Array.from(new Set([1, ...existingLayers, activeLayer])).sort((a, b) => a - b);
  }, [activeLayer, scopedThemes]);
  const activeLayerThemes = scopedThemes.filter((theme) => theme.layer === activeLayer);
  const previousLayerThemes = scopedThemes.filter((theme) => theme.layer === activeLayer - 1);

  useEffect(() => {
    fetchData();
  }, [projectId]);

  useEffect(() => {
    setActiveLayer(1);
    setNewThemeName('');
  }, [activeScope]);

  const fetchData = async () => {
    try {
      setIsLoading(true);
      setError('');
      const token = localStorage.getItem('accessToken');
      const headers = { Authorization: `Bearer ${token}` };

      const [themesRes, codesRes, documentsRes] = await Promise.all([
        fetch(apiUrl(`/projects/${projectId}/themes`), { headers }),
        fetch(apiUrl(`/projects/${projectId}/codes`), { headers }),
        fetch(apiUrl(`/projects/${projectId}/documents`), { headers })
      ]);

      if (!themesRes.ok) throw new Error('Failed to fetch themes');
      if (!codesRes.ok) throw new Error('Failed to fetch codes');
      if (!documentsRes.ok) throw new Error('Failed to fetch documents');

      const [themesData, codesData, documentsData]: [Theme[], Code[], Document[]] = await Promise.all([
        themesRes.json(),
        codesRes.json(),
        documentsRes.json()
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

      setThemes(themesData);
      setCodes(codesData);
      setDocuments(documentsWithCodings);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleCreateTheme = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newThemeName.trim()) return;

    try {
      setError('');
      const token = localStorage.getItem('accessToken');
      const res = await fetch(apiUrl(`/projects/${projectId}/themes`), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          name: newThemeName,
          layer: activeLayer,
          documentId: activeDocumentId ?? undefined
        })
      });

      if (!res.ok) throw new Error('Failed to create theme');
      const theme = await res.json();
      setThemes((prev) => [theme, ...prev]);
      setNewThemeName('');
    } catch (err) {
      setError((err as Error).message);
    }
  };

  const handleAddLayer = () => {
    setActiveLayer(Math.max(...layers) + 1);
    setNewThemeName('');
  };

  const handleDeleteTheme = async (themeId: string) => {
    try {
      setError('');
      const token = localStorage.getItem('accessToken');
      const res = await fetch(apiUrl(`/projects/${projectId}/themes/${themeId}`), {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` }
      });

      if (!res.ok) throw new Error('Failed to delete theme');
      setThemes((prev) => prev.filter((theme) => theme.id !== themeId));
    } catch (err) {
      setError((err as Error).message);
    }
  };

  const updateThemeInState = (updatedTheme: Theme) => {
    setThemes((prev) => prev.map((theme) => (theme.id === updatedTheme.id ? updatedTheme : theme)));
  };

  const getThemeScopeLabel = (theme: Theme) =>
    theme.documentId ? documentById.get(theme.documentId)?.title ?? 'Document theme' : 'Global theme';

  const updateThemeOptimistically = (themeId: string, updater: (theme: Theme) => Theme) => {
    setThemes((prev) => prev.map((theme) => (theme.id === themeId ? updater(theme) : theme)));
  };

  const handleToggleCodeInTheme = async (theme: Theme, codeId: string) => {
    const previousThemes = themes;
    try {
      setError('');
      const currentlyAssigned = new Set(theme.codeLinks.map((link) => link.codeId));
      currentlyAssigned.has(codeId) ? currentlyAssigned.delete(codeId) : currentlyAssigned.add(codeId);
      const nextCodeIds = Array.from(currentlyAssigned);
      const nextCodeLinks = nextCodeIds
        .map((assignedCodeId) => {
          const code = codes.find((item) => item.id === assignedCodeId);
          return code ? { codeId: assignedCodeId, code } : null;
        })
        .filter((link): link is { codeId: string; code: Code } => Boolean(link));

      updateThemeOptimistically(theme.id, (item) => ({ ...item, codeLinks: nextCodeLinks }));

      const token = localStorage.getItem('accessToken');
      const res = await fetch(apiUrl(`/projects/${projectId}/themes/${theme.id}/codes`), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ codeIds: nextCodeIds })
      });

      if (!res.ok) throw new Error('Failed to update theme codes');
      updateThemeInState(await res.json());
    } catch (err) {
      setThemes(previousThemes);
      setError((err as Error).message);
    }
  };

  const handleToggleParentTheme = async (theme: Theme, parentThemeId: string) => {
    const previousThemes = themes;
    try {
      setError('');
      const currentlyAssigned = new Set(theme.parentThemeLinks.map((link) => link.parentThemeId));
      currentlyAssigned.has(parentThemeId)
        ? currentlyAssigned.delete(parentThemeId)
        : currentlyAssigned.add(parentThemeId);
      const nextParentThemeIds = Array.from(currentlyAssigned);
      const nextParentThemeLinks = nextParentThemeIds
        .map((assignedThemeId) => {
          const parentTheme = themes.find((item) => item.id === assignedThemeId);
          return parentTheme ? { parentThemeId: assignedThemeId, parentTheme } : null;
        })
        .filter((link): link is { parentThemeId: string; parentTheme: Theme } => Boolean(link));

      updateThemeOptimistically(theme.id, (item) => ({
        ...item,
        parentThemeLinks: nextParentThemeLinks
      }));

      const token = localStorage.getItem('accessToken');
      const res = await fetch(apiUrl(`/projects/${projectId}/themes/${theme.id}/parent-themes`), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ parentThemeIds: nextParentThemeIds })
      });

      if (!res.ok) throw new Error('Failed to update parent themes');
      updateThemeInState(await res.json());
    } catch (err) {
      setThemes(previousThemes);
      setError((err as Error).message);
    }
  };

  return (
    <main>
      <TopNav />
      <section className="container page-stack">
        <header className="page-heading">
          <div>
            <h2>Thematic Analysis</h2>
            <p>Build document-level and global themes layer by layer.</p>
          </div>
          <button type="button" onClick={handleAddLayer}>Add Layer</button>
        </header>

        {error && <p style={{ color: 'var(--accent-2)' }}>{error}</p>}

        <div className="toolbar-row">
          <label>
            Scope
            <select value={activeScope} onChange={(event) => setActiveScope(event.target.value)}>
              <option value={GLOBAL_SCOPE}>Global project themes</option>
              {documents.map((document) => (
                <option value={document.id} key={document.id}>
                  {document.title}
                </option>
              ))}
            </select>
          </label>
        </div>

        <div className="layer-tabs">
          {layers.map((layer) => (
            <button
              type="button"
              key={layer}
              className={layer === activeLayer ? 'active' : ''}
              onClick={() => setActiveLayer(layer)}
            >
              Layer {layer}
            </button>
          ))}
        </div>

        <div className="card">
          <h3 style={{ marginTop: 0 }}>Create Theme in Layer {activeLayer}</h3>
          <form onSubmit={handleCreateTheme} style={{ display: 'flex', gap: '0.5rem' }}>
            <input
              type="text"
              placeholder="New theme name"
              value={newThemeName}
              onChange={(e) => setNewThemeName(e.target.value)}
              style={{ flex: 1 }}
            />
            <button type="submit">Create Theme</button>
          </form>
        </div>

        {isLoading ? (
          <p>Loading themes...</p>
        ) : activeLayerThemes.length === 0 ? (
          <p style={{ color: 'var(--muted)' }}>No themes in this layer yet.</p>
        ) : (
          <div className="theme-grid">
            {activeLayerThemes.map((theme) => {
              const assignedCodeIds = new Set(theme.codeLinks.map((link) => link.codeId));
              const assignedParentThemeIds = new Set(theme.parentThemeLinks.map((link) => link.parentThemeId));

              return (
                <div className="card" key={theme.id}>
                  <div className="row-between">
                    <div>
                      <strong>{theme.name}</strong>
                      <p style={{ margin: '0.25rem 0 0', color: 'var(--muted)' }}>
                        {activeLayer === 1
                          ? `${theme.codeLinks.length} assigned codes`
                          : `${theme.parentThemeLinks.length} assigned layer ${activeLayer - 1} themes`}
                      </p>
                      {activeScope === GLOBAL_SCOPE && (
                        <small style={{ color: 'var(--muted)' }}>{getThemeScopeLabel(theme)}</small>
                      )}
                    </div>
                    <button type="button" onClick={() => handleDeleteTheme(theme.id)}>
                      Delete
                    </button>
                  </div>

                  <div className="checkbox-list">
                    {activeLayer === 1 ? (
                      availableCodes.length === 0 ? (
                        <p style={{ color: 'var(--muted)' }}>
                          {activeDocumentId
                            ? 'No codes have been used in this document yet.'
                            : 'No codes available in this project yet.'}
                        </p>
                      ) : (
                        availableCodes.map((code) => (
                          <label key={code.id}>
                            <input
                              type="checkbox"
                              checked={assignedCodeIds.has(code.id)}
                              onChange={() => handleToggleCodeInTheme(theme, code.id)}
                            />
                            <span>
                              <strong>{code.name}</strong>
                              {code.description && <small>{code.description}</small>}
                            </span>
                          </label>
                        ))
                      )
                    ) : previousLayerThemes.length === 0 ? (
                      <p style={{ color: 'var(--muted)' }}>
                        Create themes in Layer {activeLayer - 1} first.
                      </p>
                    ) : (
                      previousLayerThemes.map((parentTheme) => (
                        <label key={parentTheme.id}>
                          <input
                            type="checkbox"
                            checked={assignedParentThemeIds.has(parentTheme.id)}
                            onChange={() => handleToggleParentTheme(theme, parentTheme.id)}
                          />
                          <span>
                            <strong>{parentTheme.name}</strong>
                            <small>Layer {parentTheme.layer}</small>
                            {activeScope === GLOBAL_SCOPE && (
                              <small>{getThemeScopeLabel(parentTheme)}</small>
                            )}
                          </span>
                        </label>
                      ))
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>
    </main>
  );
}
