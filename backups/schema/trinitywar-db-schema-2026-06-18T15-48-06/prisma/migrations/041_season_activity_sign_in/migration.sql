-- CreateTable
CREATE TABLE "player_season_sign_in" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "player_id" TEXT NOT NULL,
    "season_number" INTEGER NOT NULL,
    "day_index" INTEGER NOT NULL,
    "reward_tianji_talisman" INTEGER NOT NULL,
    "claimed_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "player_season_sign_in_player_id_fkey" FOREIGN KEY ("player_id") REFERENCES "player" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "player_season_sign_in_season_number_fkey" FOREIGN KEY ("season_number") REFERENCES "game_season" ("season_number") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "player_season_activity" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "player_id" TEXT NOT NULL,
    "season_number" INTEGER NOT NULL,
    "date_key" TEXT NOT NULL,
    "first_seen_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "last_seen_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "player_season_activity_player_id_fkey" FOREIGN KEY ("player_id") REFERENCES "player" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "player_season_activity_season_number_fkey" FOREIGN KEY ("season_number") REFERENCES "game_season" ("season_number") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "player_season_sign_in_player_id_season_number_day_index_key" ON "player_season_sign_in"("player_id", "season_number", "day_index");

-- CreateIndex
CREATE INDEX "player_season_sign_in_player_id_season_number_idx" ON "player_season_sign_in"("player_id", "season_number");

-- CreateIndex
CREATE INDEX "player_season_sign_in_season_number_day_index_idx" ON "player_season_sign_in"("season_number", "day_index");

-- CreateIndex
CREATE UNIQUE INDEX "player_season_activity_player_id_season_number_date_key_key" ON "player_season_activity"("player_id", "season_number", "date_key");

-- CreateIndex
CREATE INDEX "player_season_activity_player_id_season_number_idx" ON "player_season_activity"("player_id", "season_number");

-- CreateIndex
CREATE INDEX "player_season_activity_season_number_date_key_idx" ON "player_season_activity"("season_number", "date_key");
