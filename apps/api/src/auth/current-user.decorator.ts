import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import type { JwtPayload } from './auth.service.js';

export const CurrentUser = createParamDecorator((data: unknown, ctx: ExecutionContext): JwtPayload => {
  const request = ctx.switchToHttp().getRequest();
  return request.user;
});
