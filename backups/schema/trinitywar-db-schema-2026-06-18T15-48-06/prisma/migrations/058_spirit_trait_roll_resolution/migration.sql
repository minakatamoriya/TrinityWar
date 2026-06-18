ALTER TABLE "spirit_trait_roll_log"
ADD COLUMN IF NOT EXISTS "status" TEXT NOT NULL DEFAULT 'APPLIED',
ADD COLUMN IF NOT EXISTS "selected_trait_code" TEXT,
ADD COLUMN IF NOT EXISTS "resolved_at" TIMESTAMP(3);

CREATE INDEX IF NOT EXISTS "spirit_trait_roll_log_player_id_status_created_at_idx"
ON "spirit_trait_roll_log"("player_id", "status", "created_at");
