'use client';

import { useEffect, useMemo, useState } from 'react';
import { useParams } from 'next/navigation';
import { TopNav } from '@/components/top-nav';
import { apiUrl } from '@/lib/api';

interface ReportCode {
  id: string;
  name: string;
}

interface ReportTheme {
  id: string;
  name: string;
  color: string;
  layer: number;
  codes: ReportCode[];
  reportContent: string;
  reportUpdatedAt?: string | null;
}

interface ReportThemeResponse {
  layer: number | null;
  themes: ReportTheme[];
}

export default function ReportCraftingPage() {
  const params = useParams();
  const projectId = params.projectId as string;
  const [layer, setLayer] = useState<number | null>(null);
  const [themes, setThemes] = useState<ReportTheme[]>([]);
  const [selectedThemeId, setSelectedThemeId] = useState('');
  const [draft, setDraft] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const selectedTheme = useMemo(
    () => themes.find((theme) => theme.id === selectedThemeId) ?? null,
    [selectedThemeId, themes]
  );

  useEffect(() => {
    fetchThemes();
  }, [projectId]);

  useEffect(() => {
    if (selectedTheme) {
      setDraft(selectedTheme.reportContent);
      setSuccess('');
    }
  }, [selectedTheme]);

  const fetchThemes = async () => {
    try {
      setIsLoading(true);
      setError('');
      const token = localStorage.getItem('accessToken');
      const res = await fetch(apiUrl(`/projects/${projectId}/reports/global-themes`), {
        headers: { Authorization: `Bearer ${token}` }
      });

      if (!res.ok) throw new Error('Failed to fetch report themes');
      const data: ReportThemeResponse = await res.json();
      setLayer(data.layer);
      setThemes(data.themes);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setIsLoading(false);
    }
  };

  const openTheme = (theme: ReportTheme) => {
    setSelectedThemeId(theme.id);
  };

  const closeTheme = () => {
    setSelectedThemeId('');
    setDraft('');
    setSuccess('');
  };

  const saveReport = async () => {
    if (!selectedTheme) return;

    try {
      setIsSaving(true);
      setError('');
      setSuccess('');
      const token = localStorage.getItem('accessToken');
      const res = await fetch(apiUrl(`/projects/${projectId}/reports/themes/${selectedTheme.id}`), {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ content: draft })
      });

      if (!res.ok) throw new Error('Failed to save report');
      const saved: { content: string; updatedAt: string } = await res.json();
      setThemes((prev) =>
        prev.map((theme) =>
          theme.id === selectedTheme.id
            ? { ...theme, reportContent: saved.content, reportUpdatedAt: saved.updatedAt }
            : theme
        )
      );
      setSuccess('Report saved.');
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <main>
      <TopNav />
      <section className="container page-stack">
        <header className="page-heading">
          <div>
            <h2>Report crafting</h2>
            <p>Write report sections from the latest available global theme layer.</p>
          </div>
          {layer && <span className="report-layer-pill">Global layer {layer}</span>}
        </header>

        {error && <p style={{ color: 'var(--accent-2)' }}>{error}</p>}

        {isLoading ? (
          <p>Loading report themes...</p>
        ) : themes.length === 0 ? (
          <div className="card">
            <strong>No global themes available</strong>
            <p style={{ color: 'var(--muted)' }}>
              Create at least one global theme in Thematic Analysis before writing the report.
            </p>
          </div>
        ) : (
          <div className="report-card-grid">
            {themes.map((theme) => {
              const hasReport = theme.reportContent.trim().length > 0;
              return (
                <button
                  type="button"
                  className="report-theme-card"
                  key={theme.id}
                  onClick={() => openTheme(theme)}
                  style={{ borderColor: theme.color }}
                >
                  <span className="report-card-accent" style={{ backgroundColor: theme.color }} />
                  <span>
                    <strong>{theme.name}</strong>
                    <small>
                      {theme.codes.length} codes / {hasReport ? 'report saved' : 'empty report'}
                    </small>
                  </span>
                </button>
              );
            })}
          </div>
        )}
      </section>

      {selectedTheme && (
        <div className="report-modal" role="dialog" aria-modal="true" aria-labelledby="report-modal-title">
          <button type="button" className="report-modal-backdrop" aria-label="Close report editor" onClick={closeTheme} />
          <section className="report-modal-panel">
            <header className="report-modal-header">
              <div>
                <h3 id="report-modal-title">{selectedTheme.name}</h3>
                <p>{selectedTheme.codes.length} codes in this theme</p>
              </div>
              <button type="button" className="ghost-button" onClick={closeTheme}>
                Close
              </button>
            </header>

            <div className="report-code-list">
              {selectedTheme.codes.length === 0 ? (
                <span>No codes linked to this theme yet.</span>
              ) : (
                selectedTheme.codes.map((code) => <span key={code.id}>{code.name}</span>)
              )}
            </div>

            <label className="report-editor-label">
              Report text
              <textarea
                value={draft}
                onChange={(event) => setDraft(event.target.value)}
                placeholder="Write this theme's report section..."
                rows={14}
              />
            </label>

            <footer className="report-modal-actions">
              {success && <span>{success}</span>}
              <button type="button" onClick={saveReport} disabled={isSaving}>
                {isSaving ? 'Saving...' : 'Save report'}
              </button>
            </footer>
          </section>
        </div>
      )}
    </main>
  );
}
