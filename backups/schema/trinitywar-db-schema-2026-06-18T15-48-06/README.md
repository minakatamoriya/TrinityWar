# TrinityWar DB Schema Backup

Created: 2026-06-18T15:48:06+08:00

Includes:
- postgres-schema.sql
- prisma/schema.prisma
- prisma/migrations

Notable migrations included:
- 063_remove_spirit_status_and_recovery
- 064_remove_spirit_current_hp
- 065_raid_daily_state

Restore options:
1. Preferred Prisma restore:
   - Copy prisma/schema.prisma and prisma/migrations into services/game-server/prisma on the target machine.
   - Set DATABASE_URL for the target PostgreSQL database.
   - Run: npm run prisma:generate --workspace @trinitywar/game-server
   - Run: npx prisma migrate deploy --schema services/game-server/prisma/schema.prisma
2. Direct PostgreSQL schema restore:
   - Run postgres-schema.sql against an empty target database.
   - Example: psql --dbname="postgresql://USER:PASSWORD@HOST:5432/DBNAME" -f postgres-schema.sql

This backup is schema-only and does not contain table data.
