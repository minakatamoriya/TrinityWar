CREATE TABLE "player_land_deed_progress" (
    "id" TEXT NOT NULL,
    "player_id" TEXT NOT NULL,
    "deed_key" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'in_progress',
    "progress_json" JSONB NOT NULL,
    "claimed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "player_land_deed_progress_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "player_land_deed_progress_status_check" CHECK ("status" IN ('locked', 'in_progress', 'completed', 'claimed'))
);

CREATE TABLE "player_faction_stipend_state" (
    "id" TEXT NOT NULL,
    "player_id" TEXT NOT NULL,
    "date_key" TEXT NOT NULL,
    "contribution_snapshot" INTEGER NOT NULL,
    "tier_key" TEXT NOT NULL,
    "reward_json" JSONB NOT NULL,
    "claimed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "player_faction_stipend_state_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "player_land_deed_progress_player_id_deed_key_key" ON "player_land_deed_progress"("player_id", "deed_key");
CREATE INDEX "player_land_deed_progress_player_id_status_idx" ON "player_land_deed_progress"("player_id", "status");

CREATE UNIQUE INDEX "player_faction_stipend_state_player_id_date_key_key" ON "player_faction_stipend_state"("player_id", "date_key");
CREATE INDEX "player_faction_stipend_state_date_key_claimed_at_idx" ON "player_faction_stipend_state"("date_key", "claimed_at");
CREATE INDEX "player_faction_stipend_state_player_id_claimed_at_idx" ON "player_faction_stipend_state"("player_id", "claimed_at");

ALTER TABLE "player_land_deed_progress" ADD CONSTRAINT "player_land_deed_progress_player_id_fkey" FOREIGN KEY ("player_id") REFERENCES "player"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "player_faction_stipend_state" ADD CONSTRAINT "player_faction_stipend_state_player_id_fkey" FOREIGN KEY ("player_id") REFERENCES "player"("id") ON DELETE CASCADE ON UPDATE CASCADE;
