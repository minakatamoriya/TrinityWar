import '../config/load-env.js';
import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { AppModule } from '../modules/app/app.module.js';
import { AuthService } from '../auth/auth.service.js';

async function main(): Promise<void> {
  const app = await NestFactory.createApplicationContext(AppModule, { logger: false });

  try {
    const authService = app.get(AuthService);
    const result = await authService.devLogin({
      providerUserId: `dev-ui-${Date.now()}`,
      nickname: '新测试玩家',
      factionCode: 'human',
    });

    console.log(JSON.stringify(result, null, 2));
  } finally {
    await app.close();
  }
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
