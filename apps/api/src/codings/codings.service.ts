import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';

@Injectable()
export class CodingsService {
  constructor(private readonly prisma: PrismaService) {}

  async findByDocument(userId: string, projectId: string, documentId: string) {
    await this.assertDocumentOwnership(userId, projectId, documentId);

    return this.prisma.coding.findMany({
      where: { projectId, documentId },
      include: { code: true },
      orderBy: { createdAt: 'desc' }
    });
  }

  async create(
    userId: string,
    projectId: string,
    documentId: string,
    data: {
      codeId: string;
      snippet: string;
      startIndex: number;
      endIndex: number;
      description?: string;
    }
  ) {
    await this.assertDocumentOwnership(userId, projectId, documentId);

    const code = await this.prisma.code.findFirst({
      where: { id: data.codeId, projectId },
      select: { id: true }
    });

    if (!code) {
      throw new NotFoundException('Code not found');
    }

    return this.prisma.coding.create({
      data: {
        projectId,
        documentId,
        codeId: data.codeId,
        snippet: data.snippet,
        startIndex: data.startIndex,
        endIndex: data.endIndex,
        description: data.description
      },
      include: { code: true }
    });
  }

  async update(
    userId: string,
    projectId: string,
    documentId: string,
    codingId: string,
    data: {
      codeId?: string;
      snippet?: string;
      startIndex?: number;
      endIndex?: number;
      description?: string;
    }
  ) {
    await this.assertCodingOwnership(userId, projectId, documentId, codingId);

    if (data.codeId) {
      const code = await this.prisma.code.findFirst({
        where: { id: data.codeId, projectId },
        select: { id: true }
      });

      if (!code) {
        throw new NotFoundException('Code not found');
      }
    }

    return this.prisma.coding.update({
      where: { id: codingId },
      data,
      include: { code: true }
    });
  }

  async delete(userId: string, projectId: string, documentId: string, codingId: string) {
    await this.assertCodingOwnership(userId, projectId, documentId, codingId);

    return this.prisma.coding.delete({
      where: { id: codingId }
    });
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

  private async assertCodingOwnership(
    userId: string,
    projectId: string,
    documentId: string,
    codingId: string
  ) {
    const coding = await this.prisma.coding.findFirst({
      where: {
        id: codingId,
        projectId,
        documentId,
        project: { ownerId: userId }
      },
      select: { id: true }
    });

    if (!coding) {
      throw new NotFoundException('Coding not found');
    }
  }
}
