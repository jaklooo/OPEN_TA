import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';

@Injectable()
export class ThemesService {
  constructor(private readonly prisma: PrismaService) {}

  private readonly themePalette = [
    '#115e59',
    '#7c2d12',
    '#1d4ed8',
    '#9333ea',
    '#be123c',
    '#047857',
    '#a16207',
    '#4338ca',
    '#0f766e',
    '#b45309'
  ];

  private readonly includeThemeRelations = {
    codeLinks: {
      include: {
        code: true
      }
    },
    codingLinks: {
      include: {
        coding: {
          include: {
            code: true,
            document: true
          }
        }
      }
    },
    parentThemeLinks: {
      include: {
        parentTheme: true
      }
    }
  };

  async findByProject(
    userId: string,
    projectId: string,
    filters: { layer?: number; documentId?: string } = {}
  ) {
    await this.assertProjectOwnership(userId, projectId);

    return this.prisma.theme.findMany({
      where: {
        projectId,
        ...(filters.layer ? { layer: filters.layer } : {}),
        ...(filters.documentId !== undefined ? { documentId: filters.documentId } : {})
      },
      include: this.includeThemeRelations,
      orderBy: [{ layer: 'asc' }, { createdAt: 'desc' }]
    });
  }

  async create(userId: string, projectId: string, name: string, layer = 1, documentId?: string) {
    await this.assertProjectOwnership(userId, projectId);
    if (documentId) {
      await this.assertDocumentOwnership(userId, projectId, documentId);
    }

    return this.prisma.theme.create({
      data: {
        projectId,
        documentId,
        name,
        color: this.getThemeColor(),
        layer
      },
      include: this.includeThemeRelations
    });
  }

  async update(userId: string, projectId: string, themeId: string, data: { name?: string }) {
    await this.assertThemeOwnership(userId, projectId, themeId);

    return this.prisma.theme.update({
      where: { id: themeId },
      data,
      include: this.includeThemeRelations
    });
  }

  async delete(userId: string, projectId: string, themeId: string) {
    await this.assertThemeOwnership(userId, projectId, themeId);

    return this.prisma.theme.delete({
      where: { id: themeId }
    });
  }

  async setThemeCodes(userId: string, projectId: string, themeId: string, codeIds: string[]) {
    const theme = await this.assertThemeOwnership(userId, projectId, themeId);
    if (theme.layer !== 1) {
      throw new BadRequestException('Only layer 1 themes can be linked to codes');
    }

    const availableCodes = await this.prisma.code.findMany({
      where: {
        projectId,
        id: { in: codeIds }
      },
      select: { id: true }
    });

    if (availableCodes.length !== codeIds.length) {
      throw new NotFoundException('One or more codes were not found');
    }

    await this.prisma.themeCode.deleteMany({
      where: { themeId }
    });

    if (codeIds.length > 0) {
      await this.prisma.themeCode.createMany({
        data: codeIds.map((codeId) => ({ themeId, codeId }))
      });
    }

    return this.findOne(themeId);
  }

  async setThemeCodings(userId: string, projectId: string, themeId: string, codingIds: string[]) {
    const theme = await this.assertThemeOwnership(userId, projectId, themeId);
    if (theme.layer !== 1 || !theme.documentId) {
      throw new BadRequestException('Only document layer 1 themes can be linked to coding cards');
    }

    const uniqueCodingIds = Array.from(new Set(codingIds));
    const availableCodings = await this.prisma.coding.findMany({
      where: {
        projectId,
        documentId: theme.documentId,
        id: { in: uniqueCodingIds }
      },
      select: { id: true }
    });

    if (availableCodings.length !== uniqueCodingIds.length) {
      throw new NotFoundException('One or more coding cards were not found');
    }

    await this.prisma.themeCoding.deleteMany({
      where: { themeId }
    });

    if (uniqueCodingIds.length > 0) {
      await this.prisma.themeCoding.createMany({
        data: uniqueCodingIds.map((codingId) => ({ themeId, codingId }))
      });
    }

    return this.findOne(themeId);
  }

  async setParentThemes(userId: string, projectId: string, themeId: string, parentThemeIds: string[]) {
    const theme = await this.assertThemeOwnership(userId, projectId, themeId);
    const uniqueParentThemeIds = Array.from(new Set(parentThemeIds));

    const parentThemes = await this.findAvailableParentThemes(projectId, theme, uniqueParentThemeIds);

    if (parentThemes.length !== uniqueParentThemeIds.length) {
      throw new NotFoundException('One or more parent themes were not found');
    }

    await this.prisma.themeTheme.deleteMany({
      where: { childThemeId: themeId }
    });

    if (uniqueParentThemeIds.length > 0) {
      await this.prisma.themeTheme.createMany({
        data: uniqueParentThemeIds.map((parentThemeId) => ({ childThemeId: themeId, parentThemeId }))
      });
    }

    return this.findOne(themeId);
  }

  private async findAvailableParentThemes(
    projectId: string,
    theme: { id: string; layer: number; documentId: string | null },
    parentThemeIds: string[]
  ) {
    if (theme.documentId) {
      if (theme.layer <= 1) {
        throw new BadRequestException('Layer 1 document themes cannot have parent themes');
      }

      return this.prisma.theme.findMany({
        where: {
          projectId,
          id: { in: parentThemeIds },
          documentId: theme.documentId,
          layer: theme.layer - 1
        },
        select: { id: true }
      });
    }

    if (theme.layer === 1) {
      return this.prisma.theme.findMany({
        where: {
          projectId,
          id: { in: parentThemeIds },
          documentId: { not: null }
        },
        select: { id: true }
      });
    }

    return this.prisma.theme.findMany({
      where: {
        projectId,
        id: { in: parentThemeIds },
        documentId: null,
        layer: theme.layer - 1
      },
      select: { id: true }
    });
  }

  private async findOne(themeId: string) {
    return this.prisma.theme.findUnique({
      where: { id: themeId },
      include: this.includeThemeRelations
    });
  }

  private getThemeColor() {
    return this.themePalette[Math.floor(Math.random() * this.themePalette.length)];
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

  private async assertDocumentOwnership(userId: string, projectId: string, documentId: string) {
    const document = await this.prisma.document.findFirst({
      where: {
        id: documentId,
        projectId,
        project: { ownerId: userId }
      },
      select: { id: true }
    });

    if (!document) {
      throw new NotFoundException('Document not found');
    }
  }

  private async assertThemeOwnership(userId: string, projectId: string, themeId: string) {
    const theme = await this.prisma.theme.findFirst({
      where: {
        id: themeId,
        projectId,
        project: { ownerId: userId }
      },
      select: { id: true, layer: true, documentId: true }
    });

    if (!theme) {
      throw new NotFoundException('Theme not found');
    }

    return theme;
  }
}
