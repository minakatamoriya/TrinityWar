ALTER TABLE "player_spirit_slot"
ADD COLUMN "spirit_instance_id" TEXT;

UPDATE "player_spirit_slot"
SET "spirit_instance_id" = "id"
WHERE "spirit_definition_id" IS NOT NULL
  AND "spirit_instance_id" IS NULL;

CREATE UNIQUE INDEX "player_spirit_slot_spirit_instance_id_key"
ON "player_spirit_slot"("spirit_instance_id");

CREATE TABLE "spirit_battle_instance_stat" (
  "id" TEXT NOT NULL,
  "season_number" INTEGER NOT NULL,
  "faction_id" TEXT NOT NULL,
  "player_id" TEXT NOT NULL,
  "spirit_instance_id" TEXT NOT NULL,
  "spirit_definition_id" TEXT NOT NULL,
  "battle_count" INTEGER NOT NULL DEFAULT 0,
  "win_count" INTEGER NOT NULL DEFAULT 0,
  "loss_count" INTEGER NOT NULL DEFAULT 0,
  "draw_count" INTEGER NOT NULL DEFAULT 0,
  "latest_slot_index" INTEGER,
  "latest_is_main" BOOLEAN,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "spirit_battle_instance_stat_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "spirit_battle_instance_stat_season_number_spirit_instance_id_key"
ON "spirit_battle_instance_stat"("season_number", "spirit_instance_id");

CREATE INDEX "spirit_battle_instance_stat_season_number_faction_id_battle_count_win_count_idx"
ON "spirit_battle_instance_stat"("season_number", "faction_id", "battle_count", "win_count");

CREATE INDEX "spirit_battle_instance_stat_player_id_season_number_idx"
ON "spirit_battle_instance_stat"("player_id", "season_number");

CREATE INDEX "spirit_battle_instance_stat_spirit_definition_id_season_number_idx"
ON "spirit_battle_instance_stat"("spirit_definition_id", "season_number");

CREATE INDEX "spirit_battle_instance_stat_spirit_instance_id_idx"
ON "spirit_battle_instance_stat"("spirit_instance_id");

ALTER TABLE "spirit_battle_instance_stat"
ADD CONSTRAINT "spirit_battle_instance_stat_season_number_fkey"
FOREIGN KEY ("season_number") REFERENCES "game_season"("season_number")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "spirit_battle_instance_stat"
ADD CONSTRAINT "spirit_battle_instance_stat_faction_id_fkey"
FOREIGN KEY ("faction_id") REFERENCES "faction"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "spirit_battle_instance_stat"
ADD CONSTRAINT "spirit_battle_instance_stat_player_id_fkey"
FOREIGN KEY ("player_id") REFERENCES "player"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "spirit_battle_instance_stat"
ADD CONSTRAINT "spirit_battle_instance_stat_spirit_definition_id_fkey"
FOREIGN KEY ("spirit_definition_id") REFERENCES "spirit_definition"("id")
ON DELETE CASCADE ON UPDATE CASCADE;
