import { NestFactory } from '@nestjs/core';
import { AppModule } from './modules/app/app.module.js';
import { RobotService } from './robot/robot.service.js';

async function main(): Promise<void> {
  const app = await NestFactory.createApplicationContext(AppModule, { logger: ['error', 'warn'] });

  try {
    const robotService = app.get(RobotService);
    const result = await robotService.runSmoke();
    const exitCode = result.ok ? 0 : 1;
    process.stdout.write(`${JSON.stringify(result, null, 2)}\n`, () => process.exit(exitCode));
  } catch (error) {
    console.error(error);
    process.exit(1);
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
