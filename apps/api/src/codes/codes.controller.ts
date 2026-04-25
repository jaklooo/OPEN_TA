import { Body, Controller, Delete, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { IsOptional, IsString, MinLength } from 'class-validator';
import { AuthGuard } from '../auth/auth.guard.js';
import { CurrentUser } from '../auth/current-user.decorator.js';
import type { JwtPayload } from '../auth/auth.service.js';
import { CodesService } from './codes.service.js';

class CreateCodeDto {
  @IsString()
  @MinLength(1)
  name!: string;

  @IsString()
  @IsOptional()
  description?: string;
}

class UpdateCodeDto {
  @IsString()
  @MinLength(1)
  @IsOptional()
  name?: string;

  @IsString()
  @IsOptional()
  description?: string;
}

@Controller('projects/:projectId/codes')
@UseGuards(AuthGuard)
export class CodesController {
  constructor(private readonly codesService: CodesService) {}

  @Get()
  async listCodes(@CurrentUser() user: JwtPayload, @Param('projectId') projectId: string) {
    return this.codesService.findByProject(user.sub, projectId);
  }

  @Post()
  async createCode(
    @CurrentUser() user: JwtPayload,
    @Param('projectId') projectId: string,
    @Body() body: CreateCodeDto
  ) {
    return this.codesService.create(user.sub, projectId, body.name, body.description);
  }

  @Patch(':codeId')
  async updateCode(
    @CurrentUser() user: JwtPayload,
    @Param('projectId') projectId: string,
    @Param('codeId') codeId: string,
    @Body() body: UpdateCodeDto
  ) {
    return this.codesService.update(user.sub, projectId, codeId, body);
  }

  @Delete(':codeId')
  async deleteCode(
    @CurrentUser() user: JwtPayload,
    @Param('projectId') projectId: string,
    @Param('codeId') codeId: string
  ) {
    return this.codesService.delete(user.sub, projectId, codeId);
  }
}
