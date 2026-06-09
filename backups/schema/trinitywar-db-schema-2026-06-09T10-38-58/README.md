# TrinityWar Database Schema Backup

Created from the local PostgreSQL database on 2026-06-09.

This backup contains database structure only:

- prisma/schema.prisma
- prisma/migrations/**
- postgres-schema.sql
- manifest.json

It does not contain table data or test data.

Validation notes:

- Prisma schema validation passed.
- Prisma migrate status reports the database schema is up to date.
- The local migrations directory contains 56 migrations.
- The latest applied migration is `056_robot_sim_snapshots`.
- `public._prisma_migrations` contains 60 rows because 4 rows are rolled-back historical attempts.
- The public schema currently has 66 base tables.

Restore outline:

1. Copy `prisma/schema.prisma` and `prisma/migrations` back to `services/game-server/prisma`.
2. Configure `DATABASE_URL` for the target PostgreSQL database.
3. Run `npm run prisma:generate --workspace @trinitywar/game-server`.
4. Run `npx prisma migrate deploy --schema services/game-server/prisma/schema.prisma`.

`postgres-schema.sql` is included for direct PostgreSQL schema inspection or manual schema restore. It is a schema-only dump generated with `pg_dump --schema-only --no-owner --no-privileges --schema=public`.
