import { Module, Global } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { HealthController } from './health.controller.js';
import { AuthModule } from './auth/auth.module.js';
import { ProjectsModule } from './projects/projects.module.js';
import { DocumentsModule } from './documents/documents.module.js';
import { CodesModule } from './codes/codes.module.js';
import { ThemesModule } from './themes/themes.module.js';
import { CodingsModule } from './codings/codings.module.js';
import { PrismaService } from './prisma/prisma.service.js';

@Global()
@Module({
  providers: [PrismaService],
  exports: [PrismaService]
})
class GlobalModule {}

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['../../.env', '.env', '../../.env.example']
    }),
    GlobalModule,
    AuthModule,
    ProjectsModule,
    DocumentsModule,
    CodesModule,
    ThemesModule,
    CodingsModule
  ],
  controllers: [HealthController]
})
export class AppModule {}
