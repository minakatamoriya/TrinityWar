ALTER TABLE "player_spirit_resource"
  ADD COLUMN "tianji_talisman" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "daily_intel_free_used" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "daily_intel_talisman_used" INTEGER NOT NULL DEFAULT 0;

ALTER TABLE "player_spirit_resource"
  ADD CONSTRAINT "player_spirit_resource_tianji_talisman_check" CHECK ("tianji_talisman" >= 0),
  ADD CONSTRAINT "player_spirit_resource_daily_intel_free_used_check" CHECK ("daily_intel_free_used" >= 0),
  ADD CONSTRAINT "player_spirit_resource_daily_intel_talisman_used_check" CHECK ("daily_intel_talisman_used" >= 0);

ALTER TABLE "player_spirit_resource"
  ADD COLUMN "daily_recovery_date_key" TEXT,
  ADD COLUMN "daily_intel_date_key" TEXT;

ALTER TABLE "player_spirit_resource"
  ADD COLUMN "daily_tianji_claim_date_key" TEXT;