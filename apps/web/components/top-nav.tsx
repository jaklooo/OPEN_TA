'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';

export function TopNav() {
  const params = useParams();
  const projectId = params.projectId as string | undefined;
  const base = projectId ? `/projects/${projectId}` : '/projects';
  const items = [
    { href: `${base}/documents`, label: 'Documents' },
    { href: `${base}/coding`, label: 'Coding' },
    { href: `${base}/thematic-analysis`, label: 'Thematic Analysis' },
    { href: `${base}/data-view`, label: 'Data View' },
    { href: `${base}/import-export`, label: 'Import / Export' }
  ];

  return (
    <header className="container nav">
      <strong>OPEN_TA</strong>
      <nav className="nav-links">
        {items.map((item) => (
          <Link className="nav-link" href={item.href as any} key={item.href}>
            {item.label}
          </Link>
        ))}
      </nav>
    </header>
  );
}
