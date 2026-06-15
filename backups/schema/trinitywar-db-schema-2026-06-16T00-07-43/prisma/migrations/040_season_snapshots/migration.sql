CREATE TABLE "player_season_snapshot" (
  "id" TEXT NOT NULL,
  "player_id" TEXT NOT NULL,
  "season_number" INTEGER NOT NULL,
  "faction_id" TEXT,
  "contribution_score" INTEGER NOT NULL DEFAULT 0,
  "sign_in_days" INTEGER NOT NULL DEFAULT 0,
  "login_days" INTEGER NOT NULL DEFAULT 0,
  "harvest_count" INTEGER NOT NULL DEFAULT 0,
  "raid_count" INTEGER NOT NULL DEFAULT 0,
  "final_rank" INTEGER,
  "reward_tier" TEXT,
  "snapshot_json" JSONB NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "player_season_snapshot_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "faction_season_snapshot" (
  "id" TEXT NOT NULL,
  "faction_id" TEXT NOT NULL,
  "season_number" INTEGER NOT NULL,
  "contribution_score" INTEGER NOT NULL DEFAULT 0,
  "member_count" INTEGER NOT NULL DEFAULT 0,
  "final_rank" INTEGER,
  "snapshot_json" JSONB NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "faction_season_snapshot_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "player_season_snapshot_player_id_season_number_key"
  ON "player_season_snapshot"("player_id", "season_number");
CREATE INDEX "player_season_snapshot_season_number_contribution_score_idx"
  ON "player_season_snapshot"("season_number", "contribution_score");
CREATE INDEX "player_season_snapshot_faction_id_season_number_idx"
  ON "player_season_snapshot"("faction_id", "season_number");

CREATE UNIQUE INDEX "faction_season_snapshot_faction_id_season_number_key"
  ON "faction_season_snapshot"("faction_id", "season_number");
CREATE INDEX "faction_season_snapshot_season_number_contribution_score_idx"
  ON "faction_season_snapshot"("season_number", "contribution_score");

ALTER TABLE "player_season_snapshot"
  ADD CONSTRAINT "player_season_snapshot_player_id_fkey"
  FOREIGN KEY ("player_id") REFERENCES "player"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "player_season_snapshot"
  ADD CONSTRAINT "player_season_snapshot_faction_id_fkey"
  FOREIGN KEY ("faction_id") REFERENCES "faction"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "player_season_snapshot"
  ADD CONSTRAINT "player_season_snapshot_season_number_fkey"
  FOREIGN KEY ("season_number") REFERENCES "game_season"("season_number") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "faction_season_snapshot"
  ADD CONSTRAINT "faction_season_snapshot_faction_id_fkey"
  FOREIGN KEY ("faction_id") REFERENCES "faction"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "faction_season_snapshot"
  ADD CONSTRAINT "faction_season_snapshot_season_number_fkey"
  FOREIGN KEY ("season_number") REFERENCES "game_season"("season_number") ON DELETE CASCADE ON UPDATE CASCADE;
