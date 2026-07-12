import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';

type ReportTheme = {
  id: string;
  projectId: string;
  documentId: string | null;
  name: string;
  color: string;
  layer: number;
  codeLinks: Array<{
    code: {
      id: string;
      name: string;
      codings: Array<{ id: string; documentId: string; document: { id: string; title: string } }>;
    };
  }>;
  codingLinks: Array<{
    coding: {
      id: string;
      documentId: string;
      document: { id: string; title: string };
      code: { id: string; name: string };
    };
  }>;
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
                  select: {
                    id: true,
                    documentId: true,
                    document: {
                      select: {
                        id: true,
                        title: true
                      }
                    }
                  }
                }
              }
            }
          }
        },
        codingLinks: {
          include: {
            coding: {
              include: {
                document: {
                  select: {
                    id: true,
                    title: true
                  }
                },
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
                  totalCodeCount: stats.totalCodeCount,
                  sourceCount: stats.sourceCount,
                  sources: stats.sources,
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
  ): {
    codes: Array<{ id: string; name: string }>;
    totalCodeCount: number;
    sourceCount: number;
    sources: Array<{ id: string; title: string }>;
    codingIds: Set<string>;
  } {
    if (visitedThemeIds.has(theme.id)) {
      return { codes: [], totalCodeCount: 0, sourceCount: 0, sources: [], codingIds: new Set<string>() };
    }
    visitedThemeIds.add(theme.id);

    const codeById = new Map<string, string>();
    const codingIds = new Set<string>();
    const sourceById = new Map<string, string>();
    for (const link of theme.codeLinks) {
      codeById.set(link.code.id, link.code.name);
      for (const coding of link.code.codings) {
        codingIds.add(coding.id);
        sourceById.set(coding.documentId, coding.document.title);
      }
    }
    for (const link of theme.codingLinks) {
      codingIds.add(link.coding.id);
      codeById.set(link.coding.code.id, link.coding.code.name);
      sourceById.set(link.coding.documentId, link.coding.document.title);
    }
    for (const link of theme.parentThemeLinks) {
      const parentTheme = themeById.get(link.parentThemeId);
      if (!parentTheme) continue;
      const parentStats = this.collectThemeStats(parentTheme, themeById, visitedThemeIds);
      for (const code of parentStats.codes) {
        codeById.set(code.id, code.name);
      }
      for (const codingId of parentStats.codingIds) {
        codingIds.add(codingId);
      }
      for (const source of parentStats.sources) {
        sourceById.set(source.id, source.title);
      }
    }

    const sources = Array.from(sourceById, ([id, title]) => ({ id, title })).sort((a, b) =>
      a.title.localeCompare(b.title)
    );

    return {
      codes: Array.from(codeById, ([id, name]) => ({ id, name })).sort((a, b) => a.name.localeCompare(b.name)),
      totalCodeCount: codingIds.size,
      sourceCount: sources.length,
      sources,
      codingIds
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
