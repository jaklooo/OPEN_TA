'use client';

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
}

export default function ProjectsPage() {
  const { user, isLoading: isAuthLoading } = useAuth();
  const router = useRouter();
  const [projects, setProjects] = useState<Project[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
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

      if (!res.ok) throw new Error('Failed to fetch projects');
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
    if (!newProjectName.trim()) return;

    try {
      const token = localStorage.getItem('accessToken');
      const res = await fetch(apiUrl('/projects'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ name: newProjectName })
      });

      if (!res.ok) throw new Error('Failed to create project');
      const newProject = await res.json();
      setProjects([newProject, ...projects]);
      setNewProjectName('');
    } catch (err) {
      setError((err as Error).message);
    }
  };

  const handleDeleteProject = async (projectId: string) => {
    try {
      const token = localStorage.getItem('accessToken');
      const res = await fetch(apiUrl(`/projects/${projectId}`), {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${token}`
        }
      });

      if (!res.ok) throw new Error('Failed to delete project');
      setProjects((prev) => prev.filter((project) => project.id !== projectId));
    } catch (err) {
      setError((err as Error).message);
    }
  };

  if (isAuthLoading || !user) return null;

  return (
    <main className="container" style={{ padding: '2rem 0' }}>
      <h2>My Projects</h2>
      {error && <p style={{ color: 'var(--accent-2)' }}>{error}</p>}

      <div className="card" style={{ marginBottom: '1.5rem' }}>
        <h3 style={{ marginTop: 0 }}>Create New Project</h3>
        <form onSubmit={handleCreateProject} style={{ display: 'flex', gap: '0.5rem' }}>
          <input
            type="text"
            placeholder="Project name..."
            value={newProjectName}
            onChange={(e) => setNewProjectName(e.target.value)}
            style={{ flex: 1 }}
          />
          <button type="submit">Create</button>
        </form>
      </div>

      {isLoading ? (
        <p>Loading projects...</p>
      ) : projects.length === 0 ? (
        <p style={{ color: 'var(--muted)' }}>No projects yet. Create one above!</p>
      ) : (
        <div style={{ display: 'grid', gap: '0.8rem' }}>
          {projects.map((project) => (
            <div className="card" key={project.id}>
              <strong>{project.name}</strong>
              {project.description && <p style={{ color: 'var(--muted)' }}>{project.description}</p>}
              <div style={{ marginTop: '0.6rem', display: 'flex', gap: '0.5rem' }}>
                <Link className="nav-link" href={`/projects/${project.id}/documents`}>
                  Open
                </Link>
                <button type="button" onClick={() => handleDeleteProject(project.id)}>
                  Delete
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </main>
  );
}
