import { describe, expect, it } from 'vitest';
import { buildCrossTable } from './cross-projects';
import { descendants, projectPath } from './project-tree';
describe('cross-project comparison', () => {
  it('matches normalized labels without losing absent or zero-count themes', () => {
    const rows = buildCrossTable([
      { id: '2025', name: '2025', layer: 3, themes: [{ id: 'a', name: ' Důvěra  ve školu ', totalCodeCount: 4, sourceCount: 2 }] },
      { id: '2026', name: '2026', layer: 1, themes: [{ id: 'b', name: 'důvěra ve školu', totalCodeCount: 0, sourceCount: 0 }, { id: 'c', name: 'Podpora', totalCodeCount: 2, sourceCount: 1 }] }
    ]);
    expect(rows).toHaveLength(2);
    expect(rows[0].cells).toEqual({ '2025': { codings: 4, sources: 2 }, '2026': { codings: 0, sources: 0 } });
    expect(rows[1].cells['2025']).toBeUndefined();
  });
  it('sums duplicate theme memberships explicitly', () => {
    expect(buildCrossTable([{ id: 'a', name: 'a', layer: 1, themes: [
      { id: 'x', name: 'Téma', totalCodeCount: 2, sourceCount: 1 },
      { id: 'y', name: 'TÉMA', totalCodeCount: 3, sourceCount: 1 }
    ] }])[0].cells.a).toEqual({ codings: 5, sources: 2 });
    expect(buildCrossTable([])).toEqual([]);
  });
});
describe('project hierarchy', () => {
  const projects = [{ id: 'p', name: 'Výzkum' }, { id: 'a', name: '2025', parentId: 'p' }, { id: 'b', name: '2026', parentId: 'p' }, { id: 'c', name: 'Rozhovory', parentId: 'b' }];
  it('includes all descendants and disambiguates project names', () => {
    expect(descendants('b', projects)).toEqual(['b', 'c']);
    expect(projectPath(projects[3], projects)).toBe('Výzkum / 2026 / Rozhovory');
  });
});
