'use client';
import { t } from '@/lib/i18n';


import { LanguageSwitcher } from '@/components/language-provider';
import { projectPath } from '@/lib/project-tree';
import Link from 'next/link';
import { useParams, usePathname, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { apiUrl } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';

interface Project {
  id: string;
  name: string;
  parentId?: string | null;
}

export function TopNav() {
  const params = useParams();
  const pathname = usePathname();
  const router = useRouter();
  const { user, logout } = useAuth();
  const projectId = params.projectId as string | undefined;
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isProjectMenuOpen, setIsProjectMenuOpen] = useState(false);
  const [projects, setProjects] = useState<Project[]>([]);
  const base = projectId ? `/projects/${projectId}` : '/projects';
  const items = [
    { href: '/cross-projects', label: t('Cross-project analytics') },
    { href: `${base}/documents`, label: t("Documents") },
    { href: `${base}/coding`, label: t("Coding") },
    { href: `${base}/thematic-analysis`, label: t("Thematic Analysis") },
    { href: `${base}/report-crafting`, label: t("Report crafting") },
    { href: `${base}/data-view`, label: t("Data View") },
    { href: `${base}/import-export`, label: t("Import / Export") }
  ].filter((item) => projectId || item.href === '/cross-projects');
  const isActiveItem = (href: string) => pathname === href || pathname.startsWith(`${href}/`);

  useEffect(() => {
    if (!user) {
      setProjects([]);
      return;
    }

    let isMounted = true;

    async function fetchProjects() {
      try {
        const token = localStorage.getItem('accessToken');
        const res = await fetch(apiUrl('/projects'), {
          headers: { Authorization: `Bearer ${token}` }
        });

        if (!res.ok) return;

        const data = await res.json();
        if (isMounted) setProjects(data);
      } catch {
        if (isMounted) setProjects([]);
      }
    }

    fetchProjects();

    return () => {
      isMounted = false;
    };
  }, [user]);

  const handleProjectChange = (nextProjectId: string) => {
    if (!nextProjectId) return;
    if (nextProjectId === projectId) {
      setIsProjectMenuOpen(false);
      return;
    }

    const pathParts = pathname.split('/').filter(Boolean);
    const projectsIndex = pathParts.indexOf('projects');
    const currentSection =
      projectsIndex >= 0 && pathParts[projectsIndex + 2] ? pathParts[projectsIndex + 2] : 'documents';

    setIsMenuOpen(false);
    setIsProjectMenuOpen(false);
    router.push(`/projects/${nextProjectId}/${currentSection}` as any);
  };

  const handleLogout = () => {
    logout();
    setIsMenuOpen(false);
    setIsProjectMenuOpen(false);
    router.push('/login');
  };

  return (
    <header className="container nav">
      <div className="nav-brand-group">
        <Link className="nav-brand" href="/projects">
          OPEN_TA
        </Link>
        <div className="project-switcher">
          <button
            type="button"
            className="project-switcher-trigger"
            aria-expanded={isProjectMenuOpen}
            aria-haspopup="menu"
            onClick={() => setIsProjectMenuOpen((value) => !value)}
          >{t("Change project")}</button>
          {isProjectMenuOpen && (
            <div className="project-switcher-menu" role="menu">
              {projects.length === 0 ? (
                <span>{t("No projects")}</span>
              ) : (
                projects.map((project) => (
                  <button
                    type="button"
                    className={project.id === projectId ? 'active' : undefined}
                    role="menuitem"
                    onClick={() => handleProjectChange(project.id)}
                    key={project.id}
                  >
                    {projectPath(project, projects)}
                  </button>
                ))
              )}
            </div>
          )}
        </div>
      </div>
      <button
        type="button"
        className="mobile-nav-toggle"
        aria-expanded={isMenuOpen}
        aria-controls="mobile-project-nav"
        onClick={() => setIsMenuOpen((value) => !value)}
      >
        Menu
      </button>
      <nav className="nav-links">
        {items.map((item) => {
          const isActive = isActiveItem(item.href);

          return (
            <Link
              className={`nav-link ${isActive ? 'active' : ''}`}
              href={item.href as any}
              aria-current={isActive ? 'page' : undefined}
              key={item.href}
            >
              {item.label}
            </Link>
          );
        })}
      </nav>
      <LanguageSwitcher />
      <button type="button" className="logout-button" aria-label={t("Log out")} title={t("Log out")} onClick={handleLogout}>
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
          <path d="M16 17l5-5-5-5" />
          <path d="M21 12H9" />
        </svg>
      </button>
      <nav id="mobile-project-nav" className={`mobile-nav-menu ${isMenuOpen ? 'open' : ''}`}>
        {items.map((item) => {
          const isActive = isActiveItem(item.href);

          return (
            <Link
              className={`mobile-nav-link ${isActive ? 'active' : ''}`}
              href={item.href as any}
              aria-current={isActive ? 'page' : undefined}
              key={item.href}
              onClick={() => setIsMenuOpen(false)}
            >
              {item.label}
            </Link>
          );
        })}
      </nav>
    </header>
  );
}
