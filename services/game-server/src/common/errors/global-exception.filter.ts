import { ArgumentsHost, Catch, ExceptionFilter, HttpException, HttpStatus, Inject } from '@nestjs/common';
import { PinoLoggerService } from '../../logging/pino-logger.service.js';
import { BusinessError } from './business-error.js';
import { ErrorCode } from './error-code.js';

interface HttpRequestLike {
  method?: string;
  url?: string;
}

interface HttpResponseLike {
  status(statusCode: number): {
    json(body: unknown): unknown;
  };
}

interface ErrorResponseBody {
  success: false;
  error: {
    code: ErrorCode | string;
    message: string;
    details?: unknown;
  };
  path?: string;
  method?: string;
  timestamp: string;
}

@Catch()
export class GlobalExceptionFilter implements ExceptionFilter {
  constructor(@Inject(PinoLoggerService) private readonly logger: PinoLoggerService) {}

  catch(exception: unknown, host: ArgumentsHost): void {
    const http = host.switchToHttp();
    const response = http.getResponse<HttpResponseLike>();
    const request = http.getRequest<HttpRequestLike>();
    const timestamp = new Date().toISOString();
    const body = this.toResponseBody(exception, request, timestamp);
    const statusCode = this.toStatusCode(exception);

    if (statusCode >= HttpStatus.INTERNAL_SERVER_ERROR) {
      this.logger.error(exception, undefined, 'GlobalExceptionFilter');
    }

    response.status(statusCode).json(body);
  }

  private toStatusCode(exception: unknown): number {
    if (exception instanceof BusinessError) {
      return exception.statusCode;
    }

    if (exception instanceof HttpException) {
      return exception.getStatus();
    }

    return HttpStatus.INTERNAL_SERVER_ERROR;
  }

  private toResponseBody(exception: unknown, request: HttpRequestLike, timestamp: string): ErrorResponseBody {
    if (exception instanceof BusinessError) {
      return {
        success: false,
        error: {
          code: exception.code,
          message: exception.message,
          details: exception.details,
        },
        path: request.url,
        method: request.method,
        timestamp,
      };
    }

    if (exception instanceof HttpException) {
      return {
        success: false,
        error: {
          code: this.toHttpErrorCode(exception.getStatus()),
          message: exception.message,
          details: exception.getResponse(),
        },
        path: request.url,
        method: request.method,
        timestamp,
      };
    }

    return {
      success: false,
      error: {
        code: ErrorCode.InternalServerError,
        message: 'Internal server error',
      },
      path: request.url,
      method: request.method,
      timestamp,
    };
  }

  private toHttpErrorCode(statusCode: number): ErrorCode {
    if (statusCode === HttpStatus.UNAUTHORIZED) {
      return ErrorCode.Unauthorized;
    }

    if (statusCode === HttpStatus.FORBIDDEN) {
      return ErrorCode.Forbidden;
    }

    if (statusCode === HttpStatus.NOT_FOUND) {
      return ErrorCode.NotFound;
    }

    if (statusCode >= HttpStatus.INTERNAL_SERVER_ERROR) {
      return ErrorCode.InternalServerError;
    }

    return ErrorCode.BadRequest;
  }
}
