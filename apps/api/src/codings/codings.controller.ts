import { Body, Controller, Delete, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { IsInt, IsOptional, IsString, Min } from 'class-validator';
import { AuthGuard } from '../auth/auth.guard.js';
import { CurrentUser } from '../auth/current-user.decorator.js';
import type { JwtPayload } from '../auth/auth.service.js';
import { CodingsService } from './codings.service.js';

class CreateCodingDto {
  @IsString()
  codeId!: string;

  @IsString()
  snippet!: string;

  @IsInt()
  @Min(0)
  startIndex!: number;

  @IsInt()
  @Min(0)
  endIndex!: number;

  @IsString()
  @IsOptional()
  description?: string;
}

class UpdateCodingDto {
  @IsString()
  @IsOptional()
  codeId?: string;

  @IsString()
  @IsOptional()
  snippet?: string;

  @IsInt()
  @Min(0)
  @IsOptional()
  startIndex?: number;

  @IsInt()
  @Min(0)
  @IsOptional()
  endIndex?: number;

  @IsString()
  @IsOptional()
  description?: string;
}

@Controller('projects/:projectId/documents/:documentId/codings')
@UseGuards(AuthGuard)
export class CodingsController {
  constructor(private readonly codingsService: CodingsService) {}

  @Get()
  async listCodings(
    @CurrentUser() user: JwtPayload,
    @Param('projectId') projectId: string,
    @Param('documentId') documentId: string
  ) {
    return this.codingsService.findByDocument(user.sub, projectId, documentId);
  }

  @Post()
  async createCoding(
    @CurrentUser() user: JwtPayload,
    @Param('projectId') projectId: string,
    @Param('documentId') documentId: string,
    @Body() body: CreateCodingDto
  ) {
    return this.codingsService.create(user.sub, projectId, documentId, body);
  }

  @Patch(':codingId')
  async updateCoding(
    @CurrentUser() user: JwtPayload,
    @Param('projectId') projectId: string,
    @Param('documentId') documentId: string,
    @Param('codingId') codingId: string,
    @Body() body: UpdateCodingDto
  ) {
    return this.codingsService.update(user.sub, projectId, documentId, codingId, body);
  }

  @Delete(':codingId')
  async deleteCoding(
    @CurrentUser() user: JwtPayload,
    @Param('projectId') projectId: string,
    @Param('documentId') documentId: string,
    @Param('codingId') codingId: string
  ) {
    return this.codingsService.delete(user.sub, projectId, documentId, codingId);
  }
}
