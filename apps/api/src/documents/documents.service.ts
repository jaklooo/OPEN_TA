import { DocumentSourceType } from '@prisma/client';
import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { TxtParser } from '../ingestion/parsers/txt.parser.js';

@Injectable()
export class DocumentsService {
  constructor(private readonly prisma: PrismaService) {}

  private readonly txtParser = new TxtParser();

  async create(
    userId: string,
    projectId: string,
    title: string,
    plainText: string,
    sourceType: DocumentSourceType = DocumentSourceType.PASTE
  ) {
    await this.assertProjectOwnership(userId, projectId);

    return this.prisma.document.create({
      data: {
        title,
        plainText,
        sourceType,
        projectId
      }
    });
  }

  async findByProject(userId: string, projectId: string) {
    await this.assertProjectOwnership(userId, projectId);

    return this.prisma.document.findMany({
      where: { projectId },
      orderBy: { createdAt: 'desc' }
    });
  }

  async findOne(userId: string, projectId: string, id: string) {
    await this.assertProjectOwnership(userId, projectId);

    const document = await this.prisma.document.findFirst({
      where: { id, projectId },
      include: { codings: true }
    });

    if (!document) {
      throw new NotFoundException('Document not found');
    }

    return document;
  }

  async update(
    userId: string,
    projectId: string,
    id: string,
    data: { title?: string; plainText?: string }
  ) {
    await this.findOne(userId, projectId, id);

    return this.prisma.document.update({
      where: { id },
      data
    });
  }

  async delete(userId: string, projectId: string, id: string) {
    await this.findOne(userId, projectId, id);

    return this.prisma.document.delete({
      where: { id }
    });
  }

  async createFromTxtUpload(
    userId: string,
    projectId: string,
    title: string,
    fileBuffer: Buffer
  ) {
    const parsed = await this.txtParser.parse(fileBuffer);

    return this.create(
      userId,
      projectId,
      title,
      parsed.plainText,
      DocumentSourceType.TXT
    );
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
