import { Module } from '@nestjs/common';
import { PlayerInitializationService } from '../seed/player-initialization.service.js';
import { AuthController } from './auth.controller.js';
import { AuthPlaceholderGuard } from './auth-placeholder.guard.js';
import { AuthService } from './auth.service.js';
import { AuthTokenService } from './auth-token.service.js';

@Module({
  controllers: [AuthController],
  providers: [AuthPlaceholderGuard, AuthService, AuthTokenService, PlayerInitializationService],
  exports: [AuthPlaceholderGuard, AuthService, AuthTokenService],
})
export class AuthModule {}
