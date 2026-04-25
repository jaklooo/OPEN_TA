import { Module } from '@nestjs/common';
import { CodingsController } from './codings.controller.js';
import { CodingsService } from './codings.service.js';

@Module({
  controllers: [CodingsController],
  providers: [CodingsService]
})
export class CodingsModule {}
