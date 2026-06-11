Database structure backup created on 2026-06-12.

Contents:
- schema.prisma: current Prisma data model.
- create_schema_from_empty.sql: Prisma-generated SQL to create the current structure from an empty database.
- migrate-status.txt: local Prisma migration status at backup time.
- migration-list.txt: migration folder list at backup time.
- today-migrations/: migrations added for today's plant research repair.

Today database-structure change:
- 059_repair_plant_research_records creates/fixes the unique index on player_plant_research(player_id, seed_definition_id) and backfills research rows.
- 060_remove_quantity_only_plant_research_repair is data cleanup only; it removes quantity-only repair rows created by 059.

Preferred restore path in another environment:
1. Pull/copy this repo with migrations through 060.
2. Run: npx prisma migrate deploy --schema services/game-server/prisma/schema.prisma
3. If rebuilding an empty database manually, use create_schema_from_empty.sql as the structure reference.
