import { HttpStatus } from '@nestjs/common';
import { BusinessError } from './business-error.js';
import { ErrorCode } from './error-code.js';

export const createConfigurationError = (message: string, details?: unknown): BusinessError => {
  return new BusinessError({
    code: ErrorCode.ConfigurationError,
    message,
    statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
    details,
  });
};

export const createUnauthorizedError = (message = 'Unauthorized'): BusinessError => {
  return new BusinessError({
    code: ErrorCode.Unauthorized,
    message,
    statusCode: HttpStatus.UNAUTHORIZED,
  });
};
