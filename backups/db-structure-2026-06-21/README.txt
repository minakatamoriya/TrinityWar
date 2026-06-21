Database structure backup created on 2026-06-21.

Contents:
- schema.prisma: current Prisma data model from services/game-server/prisma/schema.prisma.
- create_schema_from_empty.sql: Prisma-generated SQL to create the current structure from an empty database.
- live-schema-summary.json: live local PostgreSQL structure summary, including tables, columns, indexes, constraints, and _prisma_migrations records.
- migrate-status.txt: local Prisma migration status at backup time. Keep this file; the migration history is currently not fully clean.
- migration-list.txt: migration folder list at backup time.
- migrations-snapshot/: full copy of services/game-server/prisma/migrations at backup time.
- today-migrations/: migrations added today for season startup flow.
- git-status-short.txt: workspace dirty-state snapshot at backup time.

Important migration note:
- Prisma reported local migration history and the database migration table are different.
- Last common migration: 066_social_friend_deleted_feed.
- Local migrations not recorded in the database migration table: 067_social_followed_feed, 068_season_startup_flow.
- Database migration records not found locally: 057_repair_robot_sim_required_indexes, 058_repair_robot_sim_one_to_one_indexes, 059_repair_faction_stipend_indexes, 060_repair_season_activity_indexes.
- pg_dump was not available on PATH, so this backup uses Prisma-generated SQL plus live schema metadata instead of a pg_dump schema-only file.

Preferred continuation path tomorrow:
1. Pull/copy this repo state and keep this backup directory as reference.
2. Before running migrations on another machine, inspect migrate-status.txt and reconcile migration history if needed.
3. For empty database structure reference, use create_schema_from_empty.sql or run Prisma migrate from a clean migration chain.
4. For exact current local DB shape, compare against live-schema-summary.json.
