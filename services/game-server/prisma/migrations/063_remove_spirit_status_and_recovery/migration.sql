ALTER TABLE "player_spirit_resource"
DROP COLUMN "daily_recovery_used",
DROP COLUMN "daily_recovery_date_key";

ALTER TABLE "player_spirit_slot"
DROP COLUMN "status";

DROP TYPE "PlayerSpiritStatus";
