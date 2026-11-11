import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service.js';

@Injectable()
export class ProjectsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(ownerId: string, name: string, description?: string, parentId?: string | null) {
    if (parentId) await this.assertParent(ownerId, parentId);
    return this.prisma.project.create({
      data: {
        name,
        description,
        ownerId,
        parentId
      }
    });
  }

  async findAll(userId: string) {
    return this.prisma.project.findMany({
      where: { ownerId: userId },
      orderBy: { createdAt: 'desc' }
    });
  }

  async findOne(ownerId: string, id: string) {
    const project = await this.prisma.project.findFirst({
      where: { id, ownerId },
      include: { documents: true, codes: true, themes: true }
    });

    if (!project) {
      throw new NotFoundException('Project not found');
    }

    return project;
  }

  async update(ownerId: string, id: string, data: { name?: string; description?: string; parentId?: string | null }) {
    return this.prisma.$transaction(async (tx) => {
      const project = await tx.project.findFirst({ where: { id, ownerId }, select: { id: true } });
      if (!project) throw new NotFoundException('Project not found');
      if (data.parentId) await this.assertParent(ownerId, data.parentId, id, tx);
      return tx.project.update({ where: { id }, data });
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
  }

  private async assertParent(ownerId: string, parentId: string, childId?: string, db: Pick<PrismaService, 'project'> = this.prisma) {
    const seen = new Set<string>();
    let current: string | null = parentId;
    while (current) {
      if (current === childId || seen.has(current)) throw new BadRequestException('Project hierarchy cannot contain a cycle');
      seen.add(current);
      const parent: { parentId: string | null } | null = await db.project.findFirst({
        where: { id: current, ownerId }, select: { parentId: true }
      });
      if (!parent) throw new NotFoundException('Parent project not found');
      current = parent.parentId;
    }
  }

  async delete(ownerId: string, id: string) {
    await this.findOne(ownerId, id);
    return this.prisma.project.delete({
      where: { id }
    });
  }
}
