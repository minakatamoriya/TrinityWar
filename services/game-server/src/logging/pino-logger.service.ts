import { Inject, Injectable, type LoggerService } from '@nestjs/common';
import pino, { type Logger } from 'pino';
import { AppConfigService } from '../config/app-config.service.js';

@Injectable()
export class PinoLoggerService implements LoggerService {
  private readonly logger: Logger;

  constructor(@Inject(AppConfigService) config: AppConfigService) {
    this.logger = pino({
      name: 'game-server',
      level: config.logLevel,
    });
  }

  log(message: unknown, context?: string): void {
    this.logger.info({ context }, this.stringifyMessage(message));
  }

  error(message: unknown, trace?: string, context?: string): void {
    this.logger.error({ context, trace }, this.stringifyMessage(message));
  }

  warn(message: unknown, context?: string): void {
    this.logger.warn({ context }, this.stringifyMessage(message));
  }

  debug(message: unknown, context?: string): void {
    this.logger.debug({ context }, this.stringifyMessage(message));
  }

  verbose(message: unknown, context?: string): void {
    this.logger.trace({ context }, this.stringifyMessage(message));
  }

  info(bindings: Record<string, unknown>, message: string): void {
    this.logger.info(bindings, message);
  }

  private stringifyMessage(message: unknown): string {
    if (typeof message === 'string') {
      return message;
    }

    if (message instanceof Error) {
      return message.message;
    }

    return JSON.stringify(message);
  }
}
