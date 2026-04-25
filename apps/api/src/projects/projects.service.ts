import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';

@Injectable()
export class ProjectsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(ownerId: string, name: string, description?: string) {
    return this.prisma.project.create({
      data: {
        name,
        description,
        ownerId
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

  async update(ownerId: string, id: string, data: { name?: string; description?: string }) {
    await this.findOne(ownerId, id);
    return this.prisma.project.update({
      where: { id },
      data
    });
  }

  async delete(ownerId: string, id: string) {
    await this.findOne(ownerId, id);
    return this.prisma.project.delete({
      where: { id }
    });
  }
}
