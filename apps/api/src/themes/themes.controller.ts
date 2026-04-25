import { Body, Controller, Delete, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { IsArray, IsInt, IsOptional, IsString, Min, MinLength } from 'class-validator';
import { AuthGuard } from '../auth/auth.guard.js';
import { CurrentUser } from '../auth/current-user.decorator.js';
import type { JwtPayload } from '../auth/auth.service.js';
import { ThemesService } from './themes.service.js';

class CreateThemeDto {
  @IsString()
  @MinLength(1)
  name!: string;

  @IsInt()
  @Min(1)
  @IsOptional()
  layer?: number;

  @IsString()
  @IsOptional()
  documentId?: string;
}

class UpdateThemeDto {
  @IsString()
  @MinLength(1)
  @IsOptional()
  name?: string;
}

class SetThemeCodesDto {
  @IsArray()
  codeIds!: string[];
}

class SetParentThemesDto {
  @IsArray()
  parentThemeIds!: string[];
}

@Controller('projects/:projectId/themes')
@UseGuards(AuthGuard)
export class ThemesController {
  constructor(private readonly themesService: ThemesService) {}

  @Get()
  async listThemes(
    @CurrentUser() user: JwtPayload,
    @Param('projectId') projectId: string,
    @Query('layer') layer?: string,
    @Query('documentId') documentId?: string
  ) {
    return this.themesService.findByProject(user.sub, projectId, {
      layer: layer ? Number(layer) : undefined,
      documentId: documentId || undefined
    });
  }

  @Post()
  async createTheme(
    @CurrentUser() user: JwtPayload,
    @Param('projectId') projectId: string,
    @Body() body: CreateThemeDto
  ) {
    return this.themesService.create(user.sub, projectId, body.name, body.layer ?? 1, body.documentId);
  }

  @Patch(':themeId')
  async updateTheme(
    @CurrentUser() user: JwtPayload,
    @Param('projectId') projectId: string,
    @Param('themeId') themeId: string,
    @Body() body: UpdateThemeDto
  ) {
    return this.themesService.update(user.sub, projectId, themeId, body);
  }

  @Delete(':themeId')
  async deleteTheme(
    @CurrentUser() user: JwtPayload,
    @Param('projectId') projectId: string,
    @Param('themeId') themeId: string
  ) {
    return this.themesService.delete(user.sub, projectId, themeId);
  }

  @Post(':themeId/codes')
  async setThemeCodes(
    @CurrentUser() user: JwtPayload,
    @Param('projectId') projectId: string,
    @Param('themeId') themeId: string,
    @Body() body: SetThemeCodesDto
  ) {
    return this.themesService.setThemeCodes(user.sub, projectId, themeId, body.codeIds ?? []);
  }

  @Post(':themeId/parent-themes')
  async setParentThemes(
    @CurrentUser() user: JwtPayload,
    @Param('projectId') projectId: string,
    @Param('themeId') themeId: string,
    @Body() body: SetParentThemesDto
  ) {
    return this.themesService.setParentThemes(user.sub, projectId, themeId, body.parentThemeIds ?? []);
  }
}
