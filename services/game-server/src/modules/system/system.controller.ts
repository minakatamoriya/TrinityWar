import { Controller, Get } from '@nestjs/common';
import { ApiOkResponse, ApiTags } from '@nestjs/swagger';
import { APP_NAME, type HealthResponse } from '@trinitywar/shared';

@ApiTags('system')
@Controller('health')
export class SystemController {
  @Get()
  @ApiOkResponse({ description: 'Service health status.' })
  getHealth(): HealthResponse {
    return {
      app: APP_NAME,
      status: 'ok',
      now: new Date().toISOString(),
    };
  }
}
