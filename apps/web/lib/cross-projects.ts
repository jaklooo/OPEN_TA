export interface AnalyticsTheme {
  id: string; name: string; totalCodeCount: number; sourceCount: number;
}
export interface AnalyticsProject {
  id: string; name: string; layer: number | null; themes: AnalyticsTheme[];
}
export function buildCrossTable(projects: AnalyticsProject[]) {
  const rows = new Map<string, { name: string; cells: Record<string, { codings: number; sources: number }> }>();
  for (const project of projects) {
    for (const theme of project.themes) {
      const key = theme.name.normalize('NFC').trim().replace(/\s+/g, ' ').toLocaleLowerCase('cs-CZ');
      const row = rows.get(key) ?? { name: theme.name, cells: {} };
      // Duplicate labels within a project are shown as a combined count of theme memberships.
      const previous = row.cells[project.id] ?? { codings: 0, sources: 0 };
      row.cells[project.id] = { codings: previous.codings + theme.totalCodeCount, sources: previous.sources + theme.sourceCount };
      rows.set(key, row);
    }
  }
  return [...rows.values()].sort((a, b) => a.name.localeCompare(b.name, 'cs-CZ'));
}
