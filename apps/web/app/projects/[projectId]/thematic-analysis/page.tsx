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

interface Coding {
  id: string;
  codeId: string;
  snippet: string;
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

type ThemeCardItem = {
  id: string;
  title: string;
  description?: string;
  meta: string;
  kind: 'coding' | 'theme';
  theme?: Theme;
  coding?: Coding;
};

const GLOBAL_SCOPE = 'global';
const MAX_LAYER = 3;

export default function ThematicAnalysisPage() {
  const params = useParams();
  const projectId = params.projectId as string;

  const [documents, setDocuments] = useState<Document[]>([]);
  const [themes, setThemes] = useState<Theme[]>([]);
  const [activeScope, setActiveScope] = useState(GLOBAL_SCOPE);
  const [activeLayer, setActiveLayer] = useState(1);
  const [newThemeName, setNewThemeName] = useState('');
  const [isAddingExistingTheme, setIsAddingExistingTheme] = useState(false);
  const [targetThemeId, setTargetThemeId] = useState('');
  const [selectedItemIds, setSelectedItemIds] = useState<string[]>([]);
  const [showUnthemedOnly, setShowUnthemedOnly] = useState(false);
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isCreatingTheme, setIsCreatingTheme] = useState(false);

  const activeDocumentId = activeScope === GLOBAL_SCOPE ? null : activeScope;
  const selectedDocument = documents.find((document) => document.id === activeDocumentId) ?? null;
  const documentById = useMemo(
    () => new Map(documents.map((document) => [document.id, document])),
    [documents]
  );
  const themeById = useMemo(() => new Map(themes.map((theme) => [theme.id, theme])), [themes]);
  const scopedThemes =
    activeScope === GLOBAL_SCOPE
      ? themes.filter((theme) => !theme.documentId)
      : themes.filter((theme) => theme.documentId === activeDocumentId);
  const activeLayerThemes = scopedThemes.filter((theme) => theme.layer === activeLayer);
  const layerTabs = Array.from({ length: MAX_LAYER }, (_, index) => index + 1);

  useEffect(() => {
    fetchData();
  }, [projectId]);

  useEffect(() => {
    setActiveLayer(1);
    setNewThemeName('');
    setIsAddingExistingTheme(false);
    setTargetThemeId('');
    setSelectedItemIds([]);
    setShowUnthemedOnly(false);
  }, [activeScope]);

  useEffect(() => {
    setSelectedItemIds([]);
    setIsAddingExistingTheme(false);
    setTargetThemeId('');
  }, [activeLayer]);

  useEffect(() => {
    if (!targetThemeId && activeLayerThemes.length > 0) {
      setTargetThemeId(activeLayerThemes[0].id);
      return;
    }

    if (targetThemeId && !activeLayerThemes.some((theme) => theme.id === targetThemeId)) {
      setTargetThemeId(activeLayerThemes[0]?.id ?? '');
    }
  }, [activeLayerThemes, targetThemeId]);

  const fetchData = async () => {
    try {
      setIsLoading(true);
      setError('');
      const token = localStorage.getItem('accessToken');
      const headers = { Authorization: `Bearer ${token}` };

      const [themesRes, documentsRes] = await Promise.all([
        fetch(apiUrl(`/projects/${projectId}/themes`), { headers }),
        fetch(apiUrl(`/projects/${projectId}/documents`), { headers })
      ]);

      if (!themesRes.ok) throw new Error('Failed to fetch themes');
      if (!documentsRes.ok) throw new Error('Failed to fetch documents');

      const [themesData, documentsData]: [Theme[], Document[]] = await Promise.all([
        themesRes.json(),
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
      setDocuments(documentsWithCodings);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setIsLoading(false);
    }
  };

  const topDocumentThemes = useMemo(() => {
    const items: Theme[] = [];

    for (const document of documents) {
      const documentThemes = themes.filter((theme) => theme.documentId === document.id);
      if (documentThemes.length === 0) continue;
      const topLayer = Math.max(...documentThemes.map((theme) => theme.layer));
      items.push(...documentThemes.filter((theme) => theme.layer === topLayer));
    }

    return items.sort((a, b) => {
      const documentA = documentById.get(a.documentId ?? '')?.title ?? '';
      const documentB = documentById.get(b.documentId ?? '')?.title ?? '';
      return documentA.localeCompare(documentB) || a.name.localeCompare(b.name);
    });
  }, [documentById, documents, themes]);

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

  const sourceItems = useMemo<ThemeCardItem[]>(() => {
    if (activeDocumentId) {
      if (activeLayer === 1) {
        return (selectedDocument?.codings ?? []).map((coding) => ({
          id: coding.id,
          title: coding.code?.name ?? 'Code',
          description: coding.snippet,
          meta: coding.code?.description ?? 'Coded excerpt',
          kind: 'coding',
          coding
        }));
      }

      return themes
        .filter((theme) => theme.documentId === activeDocumentId && theme.layer === activeLayer - 1)
        .map((theme) => ({
          id: theme.id,
          title: theme.name,
          meta: `Layer ${theme.layer} theme / ${getThemeCodeCount(theme)} codes`,
          kind: 'theme',
          theme
        }));
    }

    if (activeLayer === 1) {
      return topDocumentThemes.map((theme) => ({
        id: theme.id,
        title: theme.name,
        meta: `${documentById.get(theme.documentId ?? '')?.title ?? 'Document'} / Layer ${theme.layer} / ${getThemeCodeCount(theme)} codes`,
        kind: 'theme',
        theme
      }));
    }

    return themes
      .filter((theme) => !theme.documentId && theme.layer === activeLayer - 1)
      .map((theme) => ({
        id: theme.id,
        title: theme.name,
        meta: `Global layer ${theme.layer} theme / ${getThemeCodeCount(theme)} codes`,
        kind: 'theme',
        theme
      }));
  }, [activeDocumentId, activeLayer, documentById, selectedDocument, themes, themeById, topDocumentThemes]);

  const getAssignedThemes = (item: ThemeCardItem) => {
    if (item.kind === 'coding') {
      return activeLayerThemes.filter((theme) =>
        theme.codingLinks.some((link) => link.codingId === item.id)
      );
    }

    return activeLayerThemes.filter((theme) =>
      theme.parentThemeLinks.some((link) => link.parentThemeId === item.id)
    );
  };

  const visibleSourceItems = sourceItems.filter((item) => {
    if (!showUnthemedOnly) return true;
    return getAssignedThemes(item).length === 0;
  });

  const handleToggleSelection = (itemId: string) => {
    setSelectedItemIds((prev) =>
      prev.includes(itemId) ? prev.filter((id) => id !== itemId) : [...prev, itemId]
    );
  };

  const updateThemeInState = (updatedTheme: Theme) => {
    setThemes((prev) => prev.map((theme) => (theme.id === updatedTheme.id ? updatedTheme : theme)));
  };

  const handleCreateTheme = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!newThemeName.trim() || selectedItemIds.length === 0) return;

    try {
      setIsCreatingTheme(true);
      setError('');
      const token = localStorage.getItem('accessToken');
      const headers = {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`
      };

      const createRes = await fetch(apiUrl(`/projects/${projectId}/themes`), {
        method: 'POST',
        headers,
        body: JSON.stringify({
          name: newThemeName.trim(),
          layer: activeLayer,
          documentId: activeDocumentId ?? undefined
        })
      });

      if (!createRes.ok) throw new Error('Failed to create theme');
      const createdTheme: Theme = await createRes.json();

      const assignPath =
        activeDocumentId && activeLayer === 1
          ? `/projects/${projectId}/themes/${createdTheme.id}/codings`
          : `/projects/${projectId}/themes/${createdTheme.id}/parent-themes`;
      const assignBody =
        activeDocumentId && activeLayer === 1
          ? { codingIds: selectedItemIds }
          : { parentThemeIds: selectedItemIds };

      const assignRes = await fetch(apiUrl(assignPath), {
        method: 'POST',
        headers,
        body: JSON.stringify(assignBody)
      });

      if (!assignRes.ok) throw new Error('Failed to assign selected cards to theme');
      const assignedTheme: Theme = await assignRes.json();

      setThemes((prev) => [assignedTheme, ...prev.filter((theme) => theme.id !== assignedTheme.id)]);
      setNewThemeName('');
      setSelectedItemIds([]);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setIsCreatingTheme(false);
    }
  };

  const handleAddToExistingTheme = async (event: React.FormEvent) => {
    event.preventDefault();
    const targetTheme = activeLayerThemes.find((theme) => theme.id === targetThemeId);
    if (!targetTheme || selectedItemIds.length === 0) return;

    try {
      setIsCreatingTheme(true);
      setError('');
      const token = localStorage.getItem('accessToken');
      const headers = {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`
      };
      const isCodingTheme = activeDocumentId && activeLayer === 1;
      const existingIds = isCodingTheme
        ? targetTheme.codingLinks.map((link) => link.codingId)
        : targetTheme.parentThemeLinks.map((link) => link.parentThemeId);
      const nextIds = Array.from(new Set([...existingIds, ...selectedItemIds]));
      const res = await fetch(
        apiUrl(
          isCodingTheme
            ? `/projects/${projectId}/themes/${targetTheme.id}/codings`
            : `/projects/${projectId}/themes/${targetTheme.id}/parent-themes`
        ),
        {
          method: 'POST',
          headers,
          body: JSON.stringify(isCodingTheme ? { codingIds: nextIds } : { parentThemeIds: nextIds })
        }
      );

      if (!res.ok) throw new Error('Failed to add cards to existing theme');
      updateThemeInState(await res.json());
      setSelectedItemIds([]);
      setIsAddingExistingTheme(false);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setIsCreatingTheme(false);
    }
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

  const handleRemoveItemFromTheme = async (theme: Theme, itemId: string) => {
    try {
      setError('');
      const token = localStorage.getItem('accessToken');
      const headers = {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`
      };
      const isCodingTheme = activeDocumentId && activeLayer === 1;
      const nextIds = isCodingTheme
        ? theme.codingLinks.map((link) => link.codingId).filter((id) => id !== itemId)
        : theme.parentThemeLinks.map((link) => link.parentThemeId).filter((id) => id !== itemId);
      const res = await fetch(
        apiUrl(
          isCodingTheme
            ? `/projects/${projectId}/themes/${theme.id}/codings`
            : `/projects/${projectId}/themes/${theme.id}/parent-themes`
        ),
        {
          method: 'POST',
          headers,
          body: JSON.stringify(isCodingTheme ? { codingIds: nextIds } : { parentThemeIds: nextIds })
        }
      );

      if (!res.ok) throw new Error('Failed to update theme assignment');
      updateThemeInState(await res.json());
    } catch (err) {
      setError((err as Error).message);
    }
  };

  const scopeLabel = activeDocumentId
    ? selectedDocument?.title ?? 'Document'
    : 'Global themes';
  const sourceLabel = activeDocumentId
    ? activeLayer === 1
      ? 'Code cards in this document'
      : `Layer ${activeLayer - 1} document themes`
    : activeLayer === 1
      ? 'Top document themes'
      : `Layer ${activeLayer - 1} global themes`;

  return (
    <main>
      <TopNav />
      <section className="container page-stack">
        <header className="page-heading">
          <div>
            <h2>Thematic Analysis</h2>
            <p>Select cards, then group them into document or global themes.</p>
          </div>
        </header>

        {error && <p style={{ color: 'var(--accent-2)' }}>{error}</p>}

        <div className="toolbar-row">
          <label>
            Scope
            <select value={activeScope} onChange={(event) => setActiveScope(event.target.value)}>
              <option value={GLOBAL_SCOPE}>Global themes</option>
              {documents.map((document) => (
                <option value={document.id} key={document.id}>
                  {document.title}
                </option>
              ))}
            </select>
          </label>

          <label className="checkbox-toggle">
            <input
              type="checkbox"
              checked={showUnthemedOnly}
              onChange={(event) => setShowUnthemedOnly(event.target.checked)}
            />
            Show only without theme
          </label>
        </div>

        <div className="layer-tabs">
          {layerTabs.map((layer) => (
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

        <form
          className="theme-create-bar"
          onSubmit={isAddingExistingTheme ? handleAddToExistingTheme : handleCreateTheme}
        >
          <div>
            <strong>{scopeLabel} / Layer {activeLayer}</strong>
            <small>{selectedItemIds.length} selected</small>
            <button
              type="button"
              className="text-action"
              onClick={() => {
                setIsAddingExistingTheme((value) => !value);
                setNewThemeName('');
              }}
            >
              {isAddingExistingTheme ? 'create new theme' : 'add existing theme'}
            </button>
          </div>
          {isAddingExistingTheme ? (
            <select
              value={targetThemeId}
              onChange={(event) => setTargetThemeId(event.target.value)}
              disabled={activeLayerThemes.length === 0}
            >
              {activeLayerThemes.length === 0 ? (
                <option value="">No themes in this layer yet</option>
              ) : (
                activeLayerThemes.map((theme) => (
                  <option value={theme.id} key={theme.id}>
                    {theme.name} ({getThemeCodeCount(theme)} codes)
                  </option>
                ))
              )}
            </select>
          ) : (
            <input
              type="text"
              placeholder="Theme name"
              value={newThemeName}
              onChange={(event) => setNewThemeName(event.target.value)}
            />
          )}
          <button
            type="submit"
            disabled={
              isCreatingTheme ||
              selectedItemIds.length === 0 ||
              (isAddingExistingTheme ? !targetThemeId : !newThemeName.trim())
            }
          >
            {isCreatingTheme ? 'Saving...' : isAddingExistingTheme ? 'Add to Theme' : '+ Theme'}
          </button>
        </form>

        {isLoading ? (
          <p>Loading themes...</p>
        ) : (
          <>
            <section className="analysis-section">
              <div className="row-between">
                <h3>{sourceLabel}</h3>
                <small>{visibleSourceItems.length} visible cards</small>
              </div>

              {visibleSourceItems.length === 0 ? (
                <p style={{ color: 'var(--muted)' }}>
                  {showUnthemedOnly ? 'No unthemed cards in this layer.' : 'No cards available for this layer yet.'}
                </p>
              ) : (
                <div className="analysis-card-grid">
                  {visibleSourceItems.map((item) => {
                    const assignedThemes = getAssignedThemes(item);
                    const selected = selectedItemIds.includes(item.id);
                    const primaryTheme = assignedThemes[0];

                    return (
                      <article
                        key={item.id}
                        className={`analysis-card ${selected ? 'selected' : ''}`}
                        style={{
                          borderColor: primaryTheme?.color,
                          backgroundColor: primaryTheme ? `${primaryTheme.color}18` : undefined
                        }}
                      >
                        <button type="button" onClick={() => handleToggleSelection(item.id)}>
                          <span className="analysis-card-check">{selected ? 'on' : ''}</span>
                          <span>
                            <strong>{item.title}</strong>
                            <small>{item.meta}</small>
                          </span>
                        </button>
                        {item.description && <p>{item.description}</p>}
                        {assignedThemes.length > 0 && (
                          <div className="theme-chip-list">
                            {assignedThemes.map((theme) => (
                              <span
                                key={theme.id}
                                className="theme-chip"
                                style={{ borderColor: theme.color, backgroundColor: `${theme.color}22` }}
                              >
                                {theme.name}
                                <button
                                  type="button"
                                  aria-label={`Remove from ${theme.name}`}
                                  onClick={() => handleRemoveItemFromTheme(theme, item.id)}
                                >
                                  x
                                </button>
                              </span>
                            ))}
                          </div>
                        )}
                      </article>
                    );
                  })}
                </div>
              )}
            </section>

            <section className="analysis-section">
              <div className="row-between">
                <h3>Created themes in this layer</h3>
                <small>{activeLayerThemes.length} themes</small>
              </div>
              {activeLayerThemes.length === 0 ? (
                <p style={{ color: 'var(--muted)' }}>No themes in this layer yet.</p>
              ) : (
                <div className="theme-summary-grid">
                  {activeLayerThemes.map((theme) => (
                    <article key={theme.id} style={{ borderColor: theme.color }}>
                      <div className="row-between">
                        <div>
                          <strong>{theme.name}</strong>
                          <small>
                            {getThemeCodeCount(theme)} codes
                            {theme.parentThemeLinks.length > 0 && ` / ${theme.parentThemeLinks.length} grouped themes`}
                          </small>
                        </div>
                        <button type="button" onClick={() => handleDeleteTheme(theme.id)}>
                          Delete
                        </button>
                      </div>
                      {!activeDocumentId && theme.layer === 1 && theme.parentThemeLinks.length > 0 && (
                        <p>
                          {theme.parentThemeLinks
                            .map((link) => {
                              const documentTitle = documentById.get(link.parentTheme.documentId ?? '')?.title;
                              return documentTitle ? `${link.parentTheme.name} (${documentTitle})` : link.parentTheme.name;
                            })
                            .join(', ')}
                        </p>
                      )}
                    </article>
                  ))}
                </div>
              )}
            </section>
          </>
        )}
      </section>
    </main>
  );
}
