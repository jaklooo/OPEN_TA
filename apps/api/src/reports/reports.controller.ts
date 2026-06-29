import { Body, Controller, Get, Param, Patch, UseGuards } from '@nestjs/common';
import { IsString } from 'class-validator';
import { AuthGuard } from '../auth/auth.guard.js';
import { CurrentUser } from '../auth/current-user.decorator.js';
import type { JwtPayload } from '../auth/auth.service.js';
import { ReportsService } from './reports.service.js';

class SaveThemeReportDto {
  @IsString()
  content!: string;
}

@Controller('projects/:projectId/reports')
@UseGuards(AuthGuard)
export class ReportsController {
  constructor(private readonly reportsService: ReportsService) {}

  @Get('global-themes')
  async listLatestGlobalThemes(@CurrentUser() user: JwtPayload, @Param('projectId') projectId: string) {
    return this.reportsService.findLatestGlobalLayer(user.sub, projectId);
  }

  @Patch('themes/:themeId')
  async saveThemeReport(
    @CurrentUser() user: JwtPayload,
    @Param('projectId') projectId: string,
    @Param('themeId') themeId: string,
    @Body() body: SaveThemeReportDto
  ) {
    return this.reportsService.saveThemeReport(user.sub, projectId, themeId, body.content);
  }
}
