import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';

type ReportTheme = {
  id: string;
  projectId: string;
  documentId: string | null;
  name: string;
  color: string;
  layer: number;
  codeLinks: Array<{ code: { id: string; name: string; codings: Array<{ documentId: string }> } }>;
  codingLinks: Array<{ coding: { documentId: string; code: { id: string; name: string } } }>;
  parentThemeLinks: Array<{ parentThemeId: string }>;
  report: { content: string; updatedAt: Date } | null;
};

@Injectable()
export class ReportsService {
  constructor(private readonly prisma: PrismaService) {}

  async findLatestGlobalLayer(userId: string, projectId: string) {
    await this.assertProjectOwnership(userId, projectId);

    const themes = await this.prisma.theme.findMany({
      where: { projectId },
      include: {
        codeLinks: {
          include: {
            code: {
              select: {
                id: true,
                name: true,
                codings: {
                  select: { documentId: true }
                }
              }
            }
          }
        },
        codingLinks: {
          include: {
            coding: {
              include: {
                code: {
                  select: { id: true, name: true }
                }
              }
            }
          }
        },
        parentThemeLinks: true,
        report: {
          select: {
            content: true,
            updatedAt: true
          }
        }
      },
      orderBy: [{ layer: 'asc' }, { createdAt: 'asc' }]
    });

    const globalThemes = themes.filter((theme) => !theme.documentId);
    const latestGlobalLayer = globalThemes.length > 0 ? Math.max(...globalThemes.map((theme) => theme.layer)) : null;
    const themeById = new Map(themes.map((theme) => [theme.id, theme as ReportTheme]));

    return {
      layer: latestGlobalLayer,
      themes:
        latestGlobalLayer === null
          ? []
          : globalThemes
              .filter((theme) => theme.layer === latestGlobalLayer)
              .sort((a, b) => a.name.localeCompare(b.name))
              .map((theme) => {
                const stats = this.collectThemeStats(theme as ReportTheme, themeById);

                return {
                  id: theme.id,
                  name: theme.name,
                  color: theme.color,
                  layer: theme.layer,
                  codes: stats.codes,
                  sourceCount: stats.sourceCount,
                  reportContent: theme.report?.content ?? '',
                  reportUpdatedAt: theme.report?.updatedAt ?? null
                };
              })
    };
  }

  async saveThemeReport(userId: string, projectId: string, themeId: string, content: string) {
    const theme = await this.prisma.theme.findFirst({
      where: {
        id: themeId,
        projectId,
        documentId: null,
        project: { ownerId: userId }
      },
      select: { id: true, projectId: true }
    });

    if (!theme) {
      throw new NotFoundException('Global theme not found');
    }

    return this.prisma.themeReport.upsert({
      where: { themeId },
      create: {
        projectId: theme.projectId,
        themeId,
        content
      },
      update: { content },
      select: {
        id: true,
        themeId: true,
        content: true,
        updatedAt: true
      }
    });
  }

  private collectThemeStats(
    theme: ReportTheme,
    themeById: Map<string, ReportTheme>,
    visitedThemeIds = new Set<string>()
  ): { codes: Array<{ id: string; name: string }>; sourceCount: number; sourceIds: string[] } {
    if (visitedThemeIds.has(theme.id)) return { codes: [], sourceCount: 0, sourceIds: [] };
    visitedThemeIds.add(theme.id);

    const codeById = new Map<string, string>();
    const sourceIds = new Set<string>();
    for (const link of theme.codeLinks) {
      codeById.set(link.code.id, link.code.name);
      for (const coding of link.code.codings) {
        sourceIds.add(coding.documentId);
      }
    }
    for (const link of theme.codingLinks) {
      codeById.set(link.coding.code.id, link.coding.code.name);
      sourceIds.add(link.coding.documentId);
    }
    for (const link of theme.parentThemeLinks) {
      const parentTheme = themeById.get(link.parentThemeId);
      if (!parentTheme) continue;
      const parentStats = this.collectThemeStats(parentTheme, themeById, visitedThemeIds);
      for (const code of parentStats.codes) {
        codeById.set(code.id, code.name);
      }
      for (const sourceId of parentStats.sourceIds) {
        sourceIds.add(sourceId);
      }
    }

    return {
      codes: Array.from(codeById, ([id, name]) => ({ id, name })).sort((a, b) => a.name.localeCompare(b.name)),
      sourceCount: sourceIds.size,
      sourceIds: Array.from(sourceIds)
    };
  }

  private async assertProjectOwnership(userId: string, projectId: string) {
    const project = await this.prisma.project.findFirst({
      where: { id: projectId, ownerId: userId },
      select: { id: true }
    });

    if (!project) {
      throw new NotFoundException('Project not found');
    }
  }
}
