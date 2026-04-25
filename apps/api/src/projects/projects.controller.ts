import { Body, Controller, Delete, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { IsOptional, IsString, MinLength } from 'class-validator';
import { ProjectsService } from './projects.service.js';
import { AuthGuard } from '../auth/auth.guard.js';
import { CurrentUser } from '../auth/current-user.decorator.js';
import type { JwtPayload } from '../auth/auth.service.js';

class CreateProjectDto {
  @IsString()
  @MinLength(2)
  name!: string;

  @IsString()
  @IsOptional()
  description?: string;
}

class UpdateProjectDto {
  @IsString()
  @MinLength(2)
  @IsOptional()
  name?: string;

  @IsString()
  @IsOptional()
  description?: string;
}

@Controller('projects')
@UseGuards(AuthGuard)
export class ProjectsController {
  constructor(private readonly projectsService: ProjectsService) {}

  @Get()
  async list(@CurrentUser() user: JwtPayload) {
    return this.projectsService.findAll(user.sub);
  }

  @Post()
  async create(@CurrentUser() user: JwtPayload, @Body() body: CreateProjectDto) {
    return this.projectsService.create(user.sub, body.name, body.description);
  }

  @Get(':projectId')
  async getProject(@CurrentUser() user: JwtPayload, @Param('projectId') projectId: string) {
    return this.projectsService.findOne(user.sub, projectId);
  }

  @Patch(':projectId')
  async updateProject(
    @CurrentUser() user: JwtPayload,
    @Param('projectId') projectId: string,
    @Body() body: UpdateProjectDto
  ) {
    return this.projectsService.update(user.sub, projectId, body);
  }

  @Delete(':projectId')
  async deleteProject(@CurrentUser() user: JwtPayload, @Param('projectId') projectId: string) {
    return this.projectsService.delete(user.sub, projectId);
  }
}
