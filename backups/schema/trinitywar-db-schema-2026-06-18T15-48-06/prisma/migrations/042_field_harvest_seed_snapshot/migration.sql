ALTER TABLE "field_harvest_log"
ADD COLUMN "seed_id" TEXT;

CREATE INDEX "field_harvest_log_player_id_seed_id_idx"
ON "field_harvest_log"("player_id", "seed_id");
