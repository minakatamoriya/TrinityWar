ALTER TABLE "player_assist_record"
ADD COLUMN "intimacy_gain" INTEGER NOT NULL DEFAULT 0;

CREATE INDEX "assist_pair_date_idx"
ON "player_assist_record"("helper_player_id", "target_player_id", "date_key");
