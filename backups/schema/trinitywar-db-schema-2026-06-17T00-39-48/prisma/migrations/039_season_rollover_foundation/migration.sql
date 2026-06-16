CREATE TABLE "game_season" (
  "season_number" INTEGER NOT NULL,
  "starts_at" TIMESTAMP(3) NOT NULL,
  "ends_at" TIMESTAMP(3) NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "game_season_pkey" PRIMARY KEY ("season_number")
);

CREATE TABLE "player_season_state" (
  "player_id" TEXT NOT NULL,
  "current_season_number" INTEGER NOT NULL,
  "last_reset_season_number" INTEGER NOT NULL DEFAULT 1,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "player_season_state_pkey" PRIMARY KEY ("player_id")
);

CREATE INDEX "game_season_starts_at_ends_at_idx" ON "game_season"("starts_at", "ends_at");
CREATE INDEX "player_season_state_current_season_number_idx" ON "player_season_state"("current_season_number");
CREATE INDEX "player_season_state_last_reset_season_number_idx" ON "player_season_state"("last_reset_season_number");

ALTER TABLE "player_season_state"
  ADD CONSTRAINT "player_season_state_player_id_fkey"
  FOREIGN KEY ("player_id") REFERENCES "player"("id") ON DELETE CASCADE ON UPDATE CASCADE;
