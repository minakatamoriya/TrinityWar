import { HttpStatus } from '@nestjs/common';
import { ErrorCode } from './error-code.js';

export interface BusinessErrorOptions {
  code: ErrorCode;
  message: string;
  statusCode?: number;
  details?: unknown;
}

export class BusinessError extends Error {
  readonly code: ErrorCode;
  readonly statusCode: number;
  readonly details?: unknown;

  constructor(options: BusinessErrorOptions) {
    super(options.message);
    this.name = 'BusinessError';
    this.code = options.code;
    this.statusCode = options.statusCode ?? HttpStatus.BAD_REQUEST;
    this.details = options.details;
  }
}
