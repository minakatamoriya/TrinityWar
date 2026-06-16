CREATE TABLE "player_season_achievement" (
  "id" TEXT NOT NULL,
  "player_id" TEXT NOT NULL,
  "season_number" INTEGER NOT NULL,
  "domain" TEXT NOT NULL,
  "achievement_key" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "description" TEXT NOT NULL,
  "contribution_snapshot" INTEGER NOT NULL DEFAULT 0,
  "stat_snapshot_json" JSONB NOT NULL,
  "reward_grant_id" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "player_season_achievement_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "player_season_achievement_player_id_season_number_achievement_key_key"
  ON "player_season_achievement"("player_id", "season_number", "achievement_key");
CREATE INDEX "player_season_achievement_player_id_season_number_domain_idx"
  ON "player_season_achievement"("player_id", "season_number", "domain");
CREATE INDEX "player_season_achievement_reward_grant_id_idx"
  ON "player_season_achievement"("reward_grant_id");

ALTER TABLE "player_season_achievement"
  ADD CONSTRAINT "player_season_achievement_player_id_fkey"
  FOREIGN KEY ("player_id") REFERENCES "player"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "player_season_achievement"
  ADD CONSTRAINT "player_season_achievement_season_number_fkey"
  FOREIGN KEY ("season_number") REFERENCES "game_season"("season_number") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "player_season_achievement"
  ADD CONSTRAINT "player_season_achievement_reward_grant_id_fkey"
  FOREIGN KEY ("reward_grant_id") REFERENCES "player_season_reward_grant"("id") ON DELETE SET NULL ON UPDATE CASCADE;
