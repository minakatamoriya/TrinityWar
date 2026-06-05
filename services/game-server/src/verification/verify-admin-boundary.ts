import type { ExecutionContext } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { AdminReadonlyGuard } from '../admin-readonly/admin-readonly.guard.js';
import { AdminReadonlyService } from '../admin-readonly/admin-readonly.service.js';
import { BusinessError } from '../common/errors/index.js';
import { AppModule } from '../modules/app/app.module.js';

async function main(): Promise<void> {
  const app = await NestFactory.createApplicationContext(AppModule, { logger: false });

  try {
    const adminService = app.get(AdminReadonlyService);
    const overview = await adminService.getOverview();
    const capabilities = overview.adminCapabilities;
    assert(capabilities, 'admin capabilities should be exposed');
    assertIncludes(capabilities.readonly, 'player-overview', 'readonly capability');
    assertIncludes(capabilities.configWrite, 'task-config-write', 'config write capability');
    assertIncludes(capabilities.notificationWrite, 'notification-global-write', 'notification write capability');
    assertIncludes(capabilities.dangerousWrite, 'player-delete', 'dangerous write capability');
    assertEqual(capabilities.auth.readHeader, 'x-admin-debug-key', 'read auth header');
    assertEqual(capabilities.auth.writeHeader, 'x-admin-write-debug-key', 'write auth header');
    assertEqual(capabilities.auth.writeHeaderRequiredInProduction, true, 'production write key requirement');
    assert(overview.modules.includes('player-delete'), 'legacy modules should include dangerous write module');

    verifyGuardBoundaries(app.get(AdminReadonlyGuard));

    console.log(JSON.stringify({
      ok: true,
      readonly: capabilities.readonly.length,
      configWrite: capabilities.configWrite.length,
      notificationWrite: capabilities.notificationWrite.length,
      dangerousWrite: capabilities.dangerousWrite.length,
      auth: capabilities.auth,
    }, null, 2));
  } finally {
    await app.close();
  }
}

function verifyGuardBoundaries(guard: AdminReadonlyGuard): void {
  const originalNodeEnv = process.env.NODE_ENV;
  const originalReadKey = process.env.ADMIN_DEBUG_KEY;
  const originalWriteKey = process.env.ADMIN_WRITE_DEBUG_KEY;

  try {
    process.env.NODE_ENV = 'production';
    process.env.ADMIN_DEBUG_KEY = 'read-key';
    process.env.ADMIN_WRITE_DEBUG_KEY = 'write-key';

    assertEqual(guard.canActivate(buildContext('GET', { 'x-admin-debug-key': 'read-key' })), true, 'production read with read key');
    assertBusinessError(
      () => guard.canActivate(buildContext('POST', { 'x-admin-debug-key': 'read-key' })),
      401,
      'production write without write key',
    );
    assertEqual(
      guard.canActivate(buildContext('POST', {
        'x-admin-debug-key': 'read-key',
        'x-admin-write-debug-key': 'write-key',
      })),
      true,
      'production write with read and write keys',
    );
    assertBusinessError(
      () => guard.canActivate(buildContext('POST', {
        'x-admin-debug-key': 'wrong-read-key',
        'x-admin-write-debug-key': 'write-key',
      })),
      401,
      'production write with wrong read key',
    );
  } finally {
    restoreEnv('NODE_ENV', originalNodeEnv);
    restoreEnv('ADMIN_DEBUG_KEY', originalReadKey);
    restoreEnv('ADMIN_WRITE_DEBUG_KEY', originalWriteKey);
  }
}

function buildContext(method: string, headers: Record<string, string>): ExecutionContext {
  return {
    switchToHttp: () => ({
      getRequest: () => ({ method, headers }),
    }),
  } as unknown as ExecutionContext;
}

function restoreEnv(key: string, value: string | undefined): void {
  if (value === undefined) {
    delete process.env[key];
    return;
  }

  process.env[key] = value;
}

function assertBusinessError(action: () => unknown, statusCode: number, label: string): void {
  try {
    action();
  } catch (error) {
    assert(error instanceof BusinessError, `${label}: should throw BusinessError`);
    assertEqual(error.statusCode, statusCode, `${label}: status code`);
    return;
  }

  throw new Error(`${label}: expected error`);
}

function assertIncludes(values: string[], expected: string, message: string): void {
  if (!values.includes(expected)) {
    throw new Error(`${message}: expected ${expected}`);
  }
}

function assert(value: unknown, message: string): asserts value {
  if (!value) {
    throw new Error(message);
  }
}

function assertEqual<T>(actual: T, expected: T, message: string): void {
  if (actual !== expected) {
    throw new Error(`${message}: expected ${String(expected)}, got ${String(actual)}`);
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
