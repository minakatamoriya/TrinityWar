import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { BusinessError, ErrorCode } from '../common/errors/index.js';

interface HeaderRequest {
  method?: string;
  headers: Record<string, string | string[] | undefined>;
}

@Injectable()
export class AdminReadonlyGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const expectedKey = process.env.ADMIN_DEBUG_KEY?.trim();
    const expectedWriteKey = process.env.ADMIN_WRITE_DEBUG_KEY?.trim();
    const request = context.switchToHttp().getRequest<HeaderRequest>();
    const actualKey = request.headers['x-admin-debug-key'];
    const actualWriteKey = request.headers['x-admin-write-debug-key'];
    const isProduction = process.env.NODE_ENV === 'production';
    const isWriteRequest = request.method !== undefined && request.method.toUpperCase() !== 'GET';

    if (!expectedKey) {
      if (isProduction) {
        throw new BusinessError({
          code: ErrorCode.Unauthorized,
          message: 'Admin debug key is required.',
          statusCode: 401,
        });
      }
      return this.canWrite(isWriteRequest, expectedWriteKey, actualWriteKey, isProduction);
    }

    if (actualKey === expectedKey && this.canWrite(isWriteRequest, expectedWriteKey, actualWriteKey, isProduction)) {
      return true;
    }

    throw new BusinessError({
      code: ErrorCode.Unauthorized,
      message: 'Admin debug key is required.',
      statusCode: 401,
    });
  }

  private canWrite(
    isWriteRequest: boolean,
    expectedWriteKey: string | undefined,
    actualWriteKey: string | string[] | undefined,
    isProduction: boolean,
  ): boolean {
    if (!isWriteRequest) {
      return true;
    }

    if (!expectedWriteKey) {
      if (!isProduction) {
        return true;
      }
      throw new BusinessError({
        code: ErrorCode.Unauthorized,
        message: 'Admin write debug key is required.',
        statusCode: 401,
      });
    }

    if (actualWriteKey === expectedWriteKey) {
      return true;
    }

    throw new BusinessError({
      code: ErrorCode.Unauthorized,
      message: 'Admin write debug key is required.',
      statusCode: 401,
    });
  }
}
