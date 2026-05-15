import { Module } from '@nestjs/common';
import { AuthPlaceholderGuard } from './auth-placeholder.guard.js';

@Module({
  providers: [AuthPlaceholderGuard],
  exports: [AuthPlaceholderGuard],
})
export class AuthModule {}
