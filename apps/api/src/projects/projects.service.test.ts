import 'reflect-metadata';
import { describe, expect, it, vi } from 'vitest';
import { ProjectsService } from './projects.service.js';
function fixture() {
  const records = [ { id: 'root', ownerId: 'u', parentId: null }, { id: 'child', ownerId: 'u', parentId: 'root' }, { id: 'foreign', ownerId: 'other', parentId: null } ];
  const project = {
    findFirst: vi.fn(async ({ where }: any) => records.find((p) => p.id === where.id && p.ownerId === where.ownerId) ?? null),
    create: vi.fn(async ({ data }: any) => data), update: vi.fn(async ({ data }: any) => data)
  };
  const db: any = { project, $transaction: (fn: any) => fn({ project }) };
  return { service: new ProjectsService(db), project };
}
describe('project parent validation', () => {
  it('rejects foreign parents on creation and updates', async () => {
    const { service, project } = fixture();
    await expect(service.create('u', '2026', undefined, 'foreign')).rejects.toThrow('Parent project not found');
    await expect(service.update('u', 'root', { parentId: 'foreign' })).rejects.toThrow('Parent project not found');
    expect(project.create).not.toHaveBeenCalled(); expect(project.update).not.toHaveBeenCalled();
  });
  it('rejects self-parenting and descendant cycles', async () => {
    const { service } = fixture();
    await expect(service.update('u', 'root', { parentId: 'root' })).rejects.toThrow('cycle');
    await expect(service.update('u', 'root', { parentId: 'child' })).rejects.toThrow('cycle');
  });
  it('allows detaching a child and forbids editing another account', async () => {
    const { service } = fixture();
    await expect(service.update('u', 'child', { parentId: null })).resolves.toEqual({ parentId: null });
    await expect(service.update('u', 'foreign', { parentId: 'root' })).rejects.toThrow('Project not found');
  });
});
