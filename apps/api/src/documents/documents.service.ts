import { DocumentSourceType } from '@prisma/client';
import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { TxtParser } from '../ingestion/parsers/txt.parser.js';
import { DocxParser } from '../ingestion/parsers/docx.parser.js';
import { PdfParser } from '../ingestion/parsers/pdf.parser.js';

@Injectable()
export class DocumentsService {
  constructor(private readonly prisma: PrismaService) {}

  private readonly txtParser = new TxtParser();
  private readonly docxParser = new DocxParser();
  private readonly pdfParser = new PdfParser();

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

  async createFromUpload(
    userId: string,
    projectId: string,
    title: string,
    fileName: string,
    fileBuffer: Buffer
  ) {
    const lowerFileName = fileName.toLowerCase();
    const parser = lowerFileName.endsWith('.txt')
      ? this.txtParser
      : lowerFileName.endsWith('.docx')
        ? this.docxParser
        : lowerFileName.endsWith('.pdf')
          ? this.pdfParser
          : null;

    if (!parser) {
      throw new BadRequestException('Only .txt, .docx, and .pdf uploads are supported');
    }

    try {
      const parsed = await parser.parse(fileBuffer);
      return this.create(
        userId,
        projectId,
        title,
        parsed.plainText,
        parsed.metadata.sourceType as DocumentSourceType
      );
    } catch (error) {
      throw new BadRequestException((error as Error).message);
    }
  }

  async importCodings(
    userId: string,
    projectId: string,
    title: string,
    rows: Array<{
      codeName: string;
      snippet: string;
      codeDescription?: string;
      startIndex: number;
      endIndex: number;
    }>
  ) {
    await this.assertProjectOwnership(userId, projectId);

    const normalizedTitle = title.trim();
    if (!normalizedTitle) {
      throw new BadRequestException('Document name is required');
    }

    const preparedRows = rows.map((row, index) => {
      const codeName = row.codeName?.trim();
      const snippet = row.snippet?.trim();
      const codeDescription = row.codeDescription?.trim() || undefined;

      if (!codeName || !snippet) {
        throw new BadRequestException(`Row ${index + 1} is missing a code or marked text`);
      }

      if (!Number.isInteger(row.startIndex) || !Number.isInteger(row.endIndex) || row.startIndex < 0 || row.endIndex < 0) {
        throw new BadRequestException(`Row ${index + 1} has invalid start or end values`);
      }

      return {
        codeName,
        snippet,
        codeDescription,
        startIndex: row.startIndex,
        endIndex: row.endIndex
      };
    });

    if (preparedRows.length === 0) {
      throw new BadRequestException('CSV import needs at least one row');
    }

    return this.prisma.$transaction(async (tx) => {
      const document = await tx.document.create({
        data: {
          projectId,
          title: normalizedTitle,
          sourceType: DocumentSourceType.IMPORTED_CODES,
          plainText: 'Imported codes only'
        }
      });

      const existingCodes = await tx.code.findMany({
        where: { projectId }
      });
      const codeByKey = new Map(
        existingCodes.map((code) => [this.codeKey(code.name, code.description), code])
      );
      const missingCodes = new Map<string, { name: string; description?: string }>();

      for (const row of preparedRows) {
        const key = this.codeKey(row.codeName, row.codeDescription);
        if (!codeByKey.has(key) && !missingCodes.has(key)) {
          missingCodes.set(key, {
            name: row.codeName,
            description: row.codeDescription
          });
        }
      }

      if (missingCodes.size > 0) {
        await tx.code.createMany({
          data: Array.from(missingCodes.values()).map((code) => ({
            projectId,
            name: code.name,
            description: code.description
          }))
        });

        const allCodes = await tx.code.findMany({
          where: { projectId }
        });

        codeByKey.clear();
        for (const code of allCodes) {
          codeByKey.set(this.codeKey(code.name, code.description), code);
        }
      }

      await tx.coding.createMany({
        data: preparedRows.map((row) => {
          const code = codeByKey.get(this.codeKey(row.codeName, row.codeDescription));
          if (!code) {
            throw new BadRequestException(`Code "${row.codeName}" could not be prepared for import`);
          }

          return {
            projectId,
            documentId: document.id,
            codeId: code.id,
            snippet: row.snippet,
            startIndex: row.startIndex,
            endIndex: row.endIndex
          };
        })
      });

      return tx.document.findUnique({
        where: { id: document.id },
        include: { codings: { include: { code: true } } }
      });
    }, { maxWait: 10_000, timeout: 60_000 });
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

  private codeKey(name: string, description?: string | null) {
    return `${name.trim().toLowerCase()}::${(description ?? '').trim().toLowerCase()}`;
  }
}
