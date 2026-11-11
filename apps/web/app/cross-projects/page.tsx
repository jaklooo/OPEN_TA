'use client';
import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { TopNav } from '@/components/top-nav';
import { useAuth } from '@/lib/auth-context';
import { apiUrl, getApiError } from '@/lib/api';
import { t } from '@/lib/i18n';
import { descendants, projectPath, type ProjectNode } from '@/lib/project-tree';
import { buildCrossTable, type AnalyticsProject } from '@/lib/cross-projects';

export default function CrossProjectsPage() {
  const { user, isLoading: authLoading } = useAuth();
  const router = useRouter();
  const [projects, setProjects] = useState<ProjectNode[]>([]);
  const [selected, setSelected] = useState<string[]>([]);
  const [data, setData] = useState<AnalyticsProject[]>([]);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState('');
  useEffect(() => {
    if (authLoading) return;
    if (!user) { router.push('/login'); return; }
    const controller = new AbortController();
    setLoading(true);
    fetch(apiUrl('/projects'), { signal: controller.signal, headers: { Authorization: `Bearer ${localStorage.getItem('accessToken')}` } })
      .then(async (res) => { if (!res.ok) throw new Error(await getApiError(res, t('Failed to fetch projects'))); return res.json(); })
      .then((items: ProjectNode[]) => { setProjects(items); setLoading(false); })
      .catch((err) => { if (!controller.signal.aborted) { setError(err.message); setLoading(false); } });
    return () => controller.abort();
  }, [user, authLoading, router]);
  useEffect(() => {
    const controller = new AbortController();
    setData([]); setError('');
    if (!selected.length) return;
    setLoading(true);
    Promise.all(selected.map(async (id) => {
      const res = await fetch(apiUrl(`/projects/${id}/reports/global-themes`), { signal: controller.signal, headers: { Authorization: `Bearer ${localStorage.getItem('accessToken')}` } });
      if (!res.ok) throw new Error(await getApiError(res, t('Failed to fetch report themes')));
      const report = await res.json();
      const project = projects.find((item) => item.id === id)!;
      return { id, name: projectPath(project, projects), ...report } as AnalyticsProject;
    })).then((results) => { setData(results); setLoading(false); }).catch((err) => {
      if (!controller.signal.aborted) { setError(err.message); setLoading(false); }
    });
    return () => controller.abort();
  }, [selected, projects]);
  const rows = useMemo(() => buildCrossTable(data), [data]);
  const cellText = (cell?: { codings: number; sources: number }) => cell ? `${cell.codings} / ${cell.sources}` : '—';
  const exportPdf = async () => {
    try {
      setExporting(true); setError('');
      const { exportTablePdf } = await import('@/lib/pdf-export');
      await exportTablePdf(t('Cross-project analytics'), [t('Theme'), ...data.map((project) => project.name)],
        rows.map((row) => [row.name, ...data.map((project) => cellText(row.cells[project.id]))]),
        'open-ta-cross-projects.pdf', t('Cells show coded excerpts / source documents. A dash means the theme is absent.'));
    } catch (err) { setError((err as Error).message); } finally { setExporting(false); }
  };
  if (authLoading || !user) return null;
  return <main><TopNav /><section className="container page-stack">
    <header className="page-heading"><div><h2>{t('Cross-project analytics')}</h2>
      <p>{t('Compare final global themes across selected projects and years.')}</p></div></header>
    <div className="card"><h3>{t('Select projects')}</h3>
      <div className="analytics-actions"><button onClick={() => setSelected(projects.map((project) => project.id))}>{t('Select all')}</button>
        <button onClick={() => { setSelected([]); setLoading(false); }}>{t('Clear selection')}</button></div>
      {projects.map((project) => <div key={project.id} className="analytics-project">
        <label><input type="checkbox" checked={selected.includes(project.id)} onChange={(e) => {
          setLoading(false);
          setSelected((previous) => e.target.checked ? [...previous, project.id] : previous.filter((id) => id !== project.id));
        }} /> {projectPath(project, projects)}</label>
        {projects.some((item) => item.parentId === project.id) && <button onClick={() => setSelected((previous) => [...new Set([...previous, ...descendants(project.id, projects)])])}>{t('Include subprojects')}</button>}
      </div>)}
      {!loading && !projects.length && <p>{t('No projects yet. Create one above!')}</p>}
    </div>
    {error && <p role="alert">{error}</p>}
    {loading ? <p role="status">{t('Loading analytics...')}</p> : !selected.length ? <p>{t('Select projects to compare.')}</p> : !error && <div className="card">
      <div className="analytics-actions"><h3>{t('Summary table')}</h3><button disabled={!rows.length || exporting} onClick={exportPdf}>{exporting ? t('Exporting...') : t('Download full table as PDF')}</button></div>
      <p>{t('Cells show coded excerpts / source documents. A dash means the theme is absent.')}</p>
      <p>{t('Matching ignores case and extra spaces. Duplicate theme names sum memberships, not unique sources. Research content is not translated.')}</p>
      <div className="analytics-scroll"><table className="analytics-table"><caption>{t('Latest global theme layer for each project')}</caption>
        <thead><tr><th scope="col">{t('Theme')}</th>{data.map((project) => <th scope="col" key={project.id}>{project.name}<small>{t('Layer')}: {project.layer ?? '—'}</small></th>)}</tr></thead>
        <tbody>{rows.map((row) => <tr key={row.name}><th scope="row">{row.name}</th>{data.map((project) => <td key={project.id}>{cellText(row.cells[project.id])}</td>)}</tr>)}</tbody>
      </table></div>
      {!rows.length && <p>{t('No global themes available yet.')}</p>}
      {data.filter((project) => !project.themes.length).map((project) => <p key={project.id}>{project.name}: {t('No global themes available yet.')}</p>)}
    </div>}
  </section></main>;
}
