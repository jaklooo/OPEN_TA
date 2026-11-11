'use client';
import { t, localeTag } from '@/lib/i18n';


import { TopNav } from '@/components/top-nav';
import { projectPath, descendants } from '@/lib/project-tree';
import { getApiError } from '@/lib/api';
import { useEffect, useState } from 'react';
import { useAuth } from '@/lib/auth-context';
import { apiUrl } from '@/lib/api';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

interface Project {
  id: string;
  name: string;
  description?: string;
  createdAt: string;
  parentId?: string | null;
}

export default function ProjectsPage() {
  const { user, isLoading: isAuthLoading } = useAuth();
  const router = useRouter();
  const [projects, setProjects] = useState<Project[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [parentId, setParentId] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [newProjectName, setNewProjectName] = useState('');

  useEffect(() => {
    if (isAuthLoading) return;

    if (!user) {
      router.push('/login');
      return;
    }

    fetchProjects();
  }, [isAuthLoading, user, router]);

  const fetchProjects = async () => {
    try {
      setIsLoading(true);
      const token = localStorage.getItem('accessToken');
      const res = await fetch(apiUrl('/projects'), {
        headers: { Authorization: `Bearer ${token}` }
      });

      if (!res.ok) throw new Error(t("Failed to fetch projects"));
      const data = await res.json();
      setProjects(data);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleCreateProject = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newProjectName.trim().length < 2 || isSaving) return;
    setIsSaving(true);
    setError('');

    try {
      const token = localStorage.getItem('accessToken');
      const res = await fetch(apiUrl('/projects'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ name: newProjectName.trim(), parentId: parentId || null })
      });

      if (!res.ok) throw new Error(t("Failed to create project"));
      const newProject = await res.json();
      setProjects([newProject, ...projects]);
      setNewProjectName('');
      setParentId('');
    } catch (err) {
      setError((err as Error).message);
    } finally { setIsSaving(false); }
  };

  const moveProject = async (id: string, nextParentId: string) => {
    try {
      const res = await fetch(apiUrl(`/projects/${id}`), {
        method: 'PATCH', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${localStorage.getItem('accessToken')}` },
        body: JSON.stringify({ parentId: nextParentId || null })
      });
      if (!res.ok) throw new Error(await getApiError(res, t('Failed to update project')));
      const updated = await res.json();
      setProjects((previous) => previous.map((project) => project.id === id ? updated : project));
    } catch (err) { setError((err as Error).message); }
  };

  const handleDeleteProject = async (projectId: string) => {
    if (!window.confirm(t('Delete project and its data? Subprojects will be kept as separate projects.'))) return;
    try {
      const token = localStorage.getItem('accessToken');
      const res = await fetch(apiUrl(`/projects/${projectId}`), {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${token}`
        }
      });

      if (!res.ok) throw new Error(t("Failed to delete project"));
      await fetchProjects();
    } catch (err) {
      setError((err as Error).message);
    }
  };

  if (isAuthLoading || !user) return null;

  return (
    <><TopNav /><main className="container" style={{ padding: '2rem 0' }}>
      <h2>{t("My Projects")}</h2>
      {error && <p style={{ color: 'var(--accent-2)' }}>{error}</p>}

      <div className="card" style={{ marginBottom: '1.5rem' }}>
        <h3 style={{ marginTop: 0 }}>{t("Create New Project")}</h3>
        <form onSubmit={handleCreateProject} style={{ display: 'flex', gap: '0.5rem' }}>
          <input
            type="text"
            placeholder={t("Project name...")}
            value={newProjectName}
            onChange={(e) => setNewProjectName(e.target.value)}
            style={{ flex: 1 }}
          />
          <select aria-label={t('Parent project')} value={parentId} onChange={(e) => setParentId(e.target.value)}>
            <option value="">{t('Standalone project')}</option>
            {projects.map((project) => <option key={project.id} value={project.id}>{projectPath(project, projects)}</option>)}
          </select>
          <button type="submit" disabled={isSaving || newProjectName.trim().length < 2}>{t("Create")}</button>
        </form>
      </div>

      {isLoading ? (
        <p>{t("Loading projects...")}</p>
      ) : projects.length === 0 ? (
        <p style={{ color: 'var(--muted)' }}>{t("No projects yet. Create one above!")}</p>
      ) : (
        <div style={{ display: 'grid', gap: '0.8rem' }}>
          {[...projects].sort((a, b) => projectPath(a, projects).localeCompare(projectPath(b, projects), localeTag())).map((project) => (
            <div className="card" key={project.id}>
              <strong>{projectPath(project, projects)}</strong>
              <label style={{ display: 'block', marginTop: '0.5rem' }}>{t('Parent project')}
                <select value={project.parentId || ''} onChange={(e) => moveProject(project.id, e.target.value)}>
                  <option value="">{t('Standalone project')}</option>
                  {projects.filter((item) => !descendants(project.id, projects).includes(item.id)).map((item) =>
                    <option key={item.id} value={item.id}>{projectPath(item, projects)}</option>)}
                </select>
              </label>
              {project.description && <p style={{ color: 'var(--muted)' }}>{project.description}</p>}
              <div style={{ marginTop: '0.6rem', display: 'flex', gap: '0.5rem' }}>
                <Link className="nav-link" href={`/projects/${project.id}/documents`}>{t("Open")}</Link>
                <button type="button" onClick={() => handleDeleteProject(project.id)}>{t("Delete")}</button>
              </div>
            </div>
          ))}
        </div>
      )}
    </main></>
  );
}
