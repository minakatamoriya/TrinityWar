import { Body, Controller, Inject, Post } from '@nestjs/common';
import { ApiBody, ApiOkResponse, ApiTags } from '@nestjs/swagger';
import { AuthService, type DevLoginResponse } from './auth.service.js';
import { DevLoginRequestDto } from './dto.js';

@ApiTags('client-auth')
@Controller('client/auth')
export class AuthController {
  constructor(@Inject(AuthService) private readonly authService: AuthService) {}

  @Post('dev-login')
  @ApiBody({ type: DevLoginRequestDto })
  @ApiOkResponse({ description: 'Development-only login response.' })
  async devLogin(@Body() body: DevLoginRequestDto): Promise<DevLoginResponse> {
    return this.authService.devLogin(body ?? {});
  }
}

defineRouteParamTypes(AuthController.prototype, 'devLogin', [DevLoginRequestDto]);

function defineRouteParamTypes(target: object, methodName: string, paramTypes: unknown[]): void {
  const defineMetadata = Reflect.defineMetadata as
    | ((metadataKey: string, metadataValue: unknown, target: object, propertyKey: string) => void)
    | undefined;

  defineMetadata?.('design:paramtypes', paramTypes, target, methodName);
}
