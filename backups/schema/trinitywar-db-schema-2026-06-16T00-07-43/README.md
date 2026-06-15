# TrinityWar Database Schema Backup

Created from the local PostgreSQL database on 2026-06-16.

This backup contains database structure only:

- `prisma/schema.prisma`
- `prisma/migrations/**`
- `postgres-schema.sql`
- `manifest.json`

It does not contain table data or test data.

Validation notes:

- Prisma schema validation passed.
- The PostgreSQL schema dump was checked for data import statements; no `COPY` or `INSERT INTO` rows were found.
- The local migrations directory contains 62 migrations.
- The latest applied database migration is `061_social_revive_field_types`.
- `public._prisma_migrations` currently contains 70 rows, including 5 rolled-back historical rows.
- The public schema currently has 66 base tables.

Migration status notes:

- The last common migration between local files and the database is `061_social_revive_field_types`.
- Local migration `062_backfill_spirit_shard_unlock_requirements` has not yet been applied to this database.
- The database contains repair migrations not present in the local `prisma/migrations` directory:
  `057_repair_robot_sim_required_indexes`
  `058_repair_robot_sim_one_to_one_indexes`
  `059_repair_faction_stipend_indexes`
  `060_repair_season_activity_indexes`

Restore outline:

1. Prefer `postgres-schema.sql` when you need to recreate the exact current office structure from this machine.
2. If you only need Prisma files for comparison or handoff, copy `prisma/schema.prisma` and `prisma/migrations` into `services/game-server/prisma`.
3. Configure `DATABASE_URL` for the target PostgreSQL database.
4. If restoring from Prisma migrations, review the migration status mismatch above before running deploy commands.

`postgres-schema.sql` is a schema-only dump generated with `pg_dump --schema-only --no-owner --no-privileges --schema=public`.
