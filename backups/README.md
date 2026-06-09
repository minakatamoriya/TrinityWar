# TrinityWar Database Backups

This directory is split by backup purpose. Only schema-only backups should be committed.

## Current Local Schema Backup

Use this when you only need the current local database structure:

- `schema/trinitywar-db-schema-2026-06-09T10-38-58/`
- `schema/trinitywar-db-schema-2026-06-09T10-38-58.zip`
- `schema/trinitywar-db-schema-2026-06-09T17-04-46.zip`

The latest backup was created from the local PostgreSQL database `trinitywar` on 2026-06-09 after the robot season simulation checks. It includes Prisma schema, Prisma migrations, and a PostgreSQL schema-only dump. It does not include table data.

Validation summary:

- Prisma schema validation passed.
- Prisma migrate status reports the database schema is up to date.
- Latest migration: `056_robot_sim_snapshots`.
- Local migrations: 56.
- Public base tables: 66.
- `_prisma_migrations` rows: 60, including 4 rolled-back historical rows.

## Directory Layout

- `schema/` contains schema-only backups for structure review and migration handoff. This is commit-safe.
- `full/` and `safety/` are ignored by git if local restore scripts create them. Do not commit full database backups.

## Restore Notes

For full local database restore, place a local `.backup` file under `backups/full` and run `scripts/restore-local-db.ps1`. The script writes pre-restore safety snapshots to `backups/safety`; both directories are ignored by git.

For schema-only restore, copy the schema backup's `prisma/schema.prisma` and `prisma/migrations` into `services/game-server/prisma`, then run:

```powershell
npm run prisma:generate --workspace @trinitywar/game-server
npx prisma migrate deploy --schema services/game-server/prisma/schema.prisma
```
