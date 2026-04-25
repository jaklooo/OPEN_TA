import { Module } from '@nestjs/common';
import { CodesController } from './codes.controller.js';
import { CodesService } from './codes.service.js';

@Module({
  controllers: [CodesController],
  providers: [CodesService]
})
export class CodesModule {}
