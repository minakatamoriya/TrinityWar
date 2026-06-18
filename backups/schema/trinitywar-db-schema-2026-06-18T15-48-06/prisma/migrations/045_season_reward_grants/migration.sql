CREATE TABLE "player_season_reward_grant" (
  "id" TEXT NOT NULL,
  "player_id" TEXT NOT NULL,
  "season_number" INTEGER NOT NULL,
  "reward_type" TEXT NOT NULL,
  "reward_tier" TEXT,
  "status" TEXT NOT NULL DEFAULT 'generated',
  "contribution_snapshot" INTEGER NOT NULL DEFAULT 0,
  "sign_in_days" INTEGER NOT NULL DEFAULT 0,
  "login_days" INTEGER NOT NULL DEFAULT 0,
  "harvest_count" INTEGER NOT NULL DEFAULT 0,
  "raid_count" INTEGER NOT NULL DEFAULT 0,
  "reward_json" JSONB NOT NULL,
  "claimed_at" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "player_season_reward_grant_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "player_season_reward_grant_player_id_season_number_reward_type_key"
  ON "player_season_reward_grant"("player_id", "season_number", "reward_type");
CREATE INDEX "player_season_reward_grant_player_id_status_idx"
  ON "player_season_reward_grant"("player_id", "status");
CREATE INDEX "player_season_reward_grant_season_number_reward_type_idx"
  ON "player_season_reward_grant"("season_number", "reward_type");

ALTER TABLE "player_season_reward_grant"
  ADD CONSTRAINT "player_season_reward_grant_player_id_fkey"
  FOREIGN KEY ("player_id") REFERENCES "player"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "player_season_reward_grant"
  ADD CONSTRAINT "player_season_reward_grant_season_number_fkey"
  FOREIGN KEY ("season_number") REFERENCES "game_season"("season_number") ON DELETE CASCADE ON UPDATE CASCADE;
