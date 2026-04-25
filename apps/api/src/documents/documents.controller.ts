import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  UploadedFile,
  UseGuards,
  UseInterceptors
} from '@nestjs/common';
import { DocumentSourceType } from '@prisma/client';
import { FileInterceptor } from '@nestjs/platform-express';
import { IsIn, IsOptional, IsString, MinLength } from 'class-validator';
import { DocumentsService } from './documents.service.js';
import { AuthGuard } from '../auth/auth.guard.js';
import { CurrentUser } from '../auth/current-user.decorator.js';
import type { JwtPayload } from '../auth/auth.service.js';

class CreateDocumentDto {
  @IsString()
  @MinLength(2)
  title!: string;

  @IsString()
  plainText!: string;

  @IsString()
  @IsIn(Object.values(DocumentSourceType))
  @IsOptional()
  sourceType?: DocumentSourceType;
}

class UpdateDocumentDto {
  @IsString()
  @MinLength(2)
  @IsOptional()
  title?: string;

  @IsString()
  @IsOptional()
  plainText?: string;
}

class UploadTxtDto {
  @IsString()
  @MinLength(2)
  title!: string;
}

type UploadedTxtFile = {
  originalname: string;
  buffer: Buffer;
};

@Controller('projects/:projectId/documents')
@UseGuards(AuthGuard)
export class DocumentsController {
  constructor(private readonly documentsService: DocumentsService) {}

  @Get()
  async list(@CurrentUser() user: JwtPayload, @Param('projectId') projectId: string) {
    return this.documentsService.findByProject(user.sub, projectId);
  }

  @Post()
  async create(
    @CurrentUser() user: JwtPayload,
    @Param('projectId') projectId: string,
    @Body() body: CreateDocumentDto
  ) {
    return this.documentsService.create(
      user.sub,
      projectId,
      body.title,
      body.plainText,
      body.sourceType ?? DocumentSourceType.PASTE
    );
  }

  @Post('upload/txt')
  @UseInterceptors(FileInterceptor('file'))
  async uploadTxt(
    @CurrentUser() user: JwtPayload,
    @Param('projectId') projectId: string,
    @Body() body: UploadTxtDto,
    @UploadedFile() file?: UploadedTxtFile
  ) {
    if (!file) {
      throw new BadRequestException('Missing file');
    }

    if (!file.originalname.toLowerCase().endsWith('.txt')) {
      throw new BadRequestException('Only .txt uploads are supported right now');
    }

    return this.documentsService.createFromTxtUpload(user.sub, projectId, body.title, file.buffer);
  }

  @Get(':documentId')
  async getDocument(
    @CurrentUser() user: JwtPayload,
    @Param('projectId') projectId: string,
    @Param('documentId') documentId: string
  ) {
    return this.documentsService.findOne(user.sub, projectId, documentId);
  }

  @Patch(':documentId')
  async updateDocument(
    @CurrentUser() user: JwtPayload,
    @Param('projectId') projectId: string,
    @Param('documentId') documentId: string,
    @Body() body: UpdateDocumentDto
  ) {
    return this.documentsService.update(user.sub, projectId, documentId, body);
  }

  @Delete(':documentId')
  async deleteDocument(
    @CurrentUser() user: JwtPayload,
    @Param('projectId') projectId: string,
    @Param('documentId') documentId: string
  ) {
    return this.documentsService.delete(user.sub, projectId, documentId);
  }
}
