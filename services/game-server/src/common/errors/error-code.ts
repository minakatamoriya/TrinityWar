export enum ErrorCode {
  BadRequest = 'BAD_REQUEST',
  Unauthorized = 'UNAUTHORIZED',
  Forbidden = 'FORBIDDEN',
  NotFound = 'NOT_FOUND',
  Conflict = 'CONFLICT',
  InsufficientVaultGold = 'INSUFFICIENT_VAULT_GOLD',
  StateVersionConflict = 'STATE_VERSION_CONFLICT',
  ConfigurationError = 'CONFIGURATION_ERROR',
  PrismaClientUnavailable = 'PRISMA_CLIENT_UNAVAILABLE',
  InternalServerError = 'INTERNAL_SERVER_ERROR',
}
