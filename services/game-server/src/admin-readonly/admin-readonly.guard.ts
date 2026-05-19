import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { BusinessError, ErrorCode } from '../common/errors/index.js';

interface HeaderRequest {
  headers: Record<string, string | string[] | undefined>;
}

@Injectable()
export class AdminReadonlyGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const expectedKey = process.env.ADMIN_DEBUG_KEY?.trim();
    const request = context.switchToHttp().getRequest<HeaderRequest>();
    const actualKey = request.headers['x-admin-debug-key'];

    if (!expectedKey) {
      return process.env.NODE_ENV !== 'production';
    }

    if (actualKey === expectedKey) {
      return true;
    }

    throw new BusinessError({
      code: ErrorCode.Unauthorized,
      message: 'Admin debug key is required.',
      statusCode: 401,
    });
  }
}
