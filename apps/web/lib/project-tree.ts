export interface ProjectNode { id: string; name: string; parentId?: string | null }
export function projectPath(project: ProjectNode, projects: ProjectNode[]): string {
  const names = [project.name];
  const seen = new Set([project.id]);
  let parentId = project.parentId;
  while (parentId && !seen.has(parentId)) {
    seen.add(parentId);
    const parent = projects.find((item) => item.id === parentId);
    if (!parent) break;
    names.unshift(parent.name); parentId = parent.parentId;
  }
  return names.join(' / ');
}
export function descendants(id: string, projects: ProjectNode[]): string[] {
  const ids = new Set([id]);
  let changed = true;
  while (changed) {
    changed = false;
    for (const project of projects) if (project.parentId && ids.has(project.parentId) && !ids.has(project.id)) {
      ids.add(project.id); changed = true;
    }
  }
  return [...ids];
}
