import { TopNav } from '@/components/top-nav';

export default function ImportExportPage() {
  return (
    <main>
      <TopNav />
      <section className="container" style={{ paddingBottom: '1.2rem' }}>
        <h2>Import / Export</h2>
        <div className="card" style={{ display: 'grid', gap: '0.6rem' }}>
          <p style={{ color: 'var(--muted)' }}>
            Export coding data to CSV/XLSX with UTF-8 support. Import remains post-MVP priority.
          </p>
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <button type="button">Export CSV</button>
            <button type="button">Export XLSX</button>
          </div>
        </div>
      </section>
    </main>
  );
}
