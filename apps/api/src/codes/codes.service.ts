import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';

@Injectable()
export class CodesService {
  constructor(private readonly prisma: PrismaService) {}

  async findByProject(userId: string, projectId: string) {
    await this.assertProjectOwnership(userId, projectId);

    return this.prisma.code.findMany({
      where: { projectId },
      orderBy: { createdAt: 'desc' }
    });
  }

  async create(userId: string, projectId: string, name: string, description?: string) {
    await this.assertProjectOwnership(userId, projectId);

    return this.prisma.code.create({
      data: {
        projectId,
        name,
        description
      }
    });
  }

  async update(
    userId: string,
    projectId: string,
    codeId: string,
    data: { name?: string; description?: string }
  ) {
    await this.assertCodeOwnership(userId, projectId, codeId);

    return this.prisma.code.update({
      where: { id: codeId },
      data
    });
  }

  async delete(userId: string, projectId: string, codeId: string) {
    await this.assertCodeOwnership(userId, projectId, codeId);

    return this.prisma.code.delete({
      where: { id: codeId }
    });
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

  private async assertCodeOwnership(userId: string, projectId: string, codeId: string) {
    const code = await this.prisma.code.findFirst({
      where: {
        id: codeId,
        projectId,
        project: { ownerId: userId }
      },
      select: { id: true }
    });

    if (!code) {
      throw new NotFoundException('Code not found');
    }
  }
}
