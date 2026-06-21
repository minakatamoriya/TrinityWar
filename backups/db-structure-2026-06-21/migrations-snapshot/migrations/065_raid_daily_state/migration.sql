CREATE TABLE "player_raid_daily_state" (
  "id" TEXT NOT NULL,
  "player_id" TEXT NOT NULL,
  "date_key" TEXT NOT NULL,
  "normal_raid_attempts_used" INTEGER NOT NULL DEFAULT 0,
  "raid_refreshes_used" INTEGER NOT NULL DEFAULT 0,
  "successful_defense_raid_count" INTEGER NOT NULL DEFAULT 0,
  "extra_raid_attempts_purchased" INTEGER NOT NULL DEFAULT 0,
  "extra_refreshes_purchased" INTEGER NOT NULL DEFAULT 0,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "player_raid_daily_state_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "player_raid_pair_daily_state" (
  "id" TEXT NOT NULL,
  "attacker_player_id" TEXT NOT NULL,
  "defender_player_id" TEXT NOT NULL,
  "date_key" TEXT NOT NULL,
  "settled_count" INTEGER NOT NULL DEFAULT 0,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "player_raid_pair_daily_state_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "player_raid_daily_state_player_id_date_key_key"
  ON "player_raid_daily_state"("player_id", "date_key");

CREATE INDEX "player_raid_daily_state_date_key_idx"
  ON "player_raid_daily_state"("date_key");

CREATE UNIQUE INDEX "player_raid_pair_daily_state_attacker_player_id_defender_play_key"
  ON "player_raid_pair_daily_state"("attacker_player_id", "defender_player_id", "date_key");

CREATE INDEX "player_raid_pair_daily_state_attacker_player_id_date_key_idx"
  ON "player_raid_pair_daily_state"("attacker_player_id", "date_key");

CREATE INDEX "player_raid_pair_daily_state_defender_player_id_date_key_idx"
  ON "player_raid_pair_daily_state"("defender_player_id", "date_key");

ALTER TABLE "player_raid_daily_state"
  ADD CONSTRAINT "player_raid_daily_state_player_id_fkey"
  FOREIGN KEY ("player_id") REFERENCES "player"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "player_raid_pair_daily_state"
  ADD CONSTRAINT "player_raid_pair_daily_state_attacker_player_id_fkey"
  FOREIGN KEY ("attacker_player_id") REFERENCES "player"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "player_raid_pair_daily_state"
  ADD CONSTRAINT "player_raid_pair_daily_state_defender_player_id_fkey"
  FOREIGN KEY ("defender_player_id") REFERENCES "player"("id") ON DELETE CASCADE ON UPDATE CASCADE;
