# TrinityWar Database Schema Backup

This backup contains database structure only:

- prisma/schema.prisma
- prisma/migrations/**
- manifest.json

It does not contain table data or test data.

Restore outline:

1. Copy `prisma/schema.prisma` and `prisma/migrations` back to `services/game-server/prisma`.
2. Configure `DATABASE_URL` for the target PostgreSQL database.
3. Run `npm run prisma:generate --workspace @trinitywar/game-server`.
4. Run `npx prisma migrate deploy --schema services/game-server/prisma/schema.prisma`.
