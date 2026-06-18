CREATE TYPE "DailyFactionTaskType" AS ENUM ('ESSENCE_SUBMIT_BASIC', 'ESSENCE_SUBMIT_FOCUS', 'CONFLICT_RAID');

ALTER TABLE "player_field_slot"
  ADD COLUMN "expected_essence_yield" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "stolen_essence_yield" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "harvested_essence_yield" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "last_stolen_at" TIMESTAMP(3);

ALTER TABLE "faction_contribution_log"
  ALTER COLUMN "donated_gold" SET DEFAULT 0,
  ADD COLUMN "source_type" TEXT NOT NULL DEFAULT 'gold-donation',
  ADD COLUMN "source_id" TEXT,
  ADD COLUMN "metadata_json" JSONB;

CREATE TABLE "daily_faction_task" (
  "id" TEXT NOT NULL,
  "player_id" TEXT NOT NULL,
  "faction_id" TEXT NOT NULL,
  "task_date" TEXT NOT NULL,
  "task_type" "DailyFactionTaskType" NOT NULL,
  "required_essence_type" TEXT,
  "required_amount" INTEGER NOT NULL,
  "progress_amount" INTEGER NOT NULL DEFAULT 0,
  "reward_contribution" INTEGER NOT NULL,
  "status" "TaskStatus" NOT NULL DEFAULT 'IN_PROGRESS',
  "generated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "completed_at" TIMESTAMP(3),
  "refreshed_from_task_id" TEXT,

  CONSTRAINT "daily_faction_task_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "daily_faction_task_player_id_task_date_task_type_key"
  ON "daily_faction_task"("player_id", "task_date", "task_type");
CREATE INDEX "daily_faction_task_player_id_task_date_status_idx"
  ON "daily_faction_task"("player_id", "task_date", "status");
CREATE INDEX "daily_faction_task_faction_id_task_date_idx"
  ON "daily_faction_task"("faction_id", "task_date");

ALTER TABLE "daily_faction_task"
  ADD CONSTRAINT "daily_faction_task_player_id_fkey"
  FOREIGN KEY ("player_id") REFERENCES "player"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "daily_faction_task"
  ADD CONSTRAINT "daily_faction_task_faction_id_fkey"
  FOREIGN KEY ("faction_id") REFERENCES "faction"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "essence_transaction_log" (
  "id" TEXT NOT NULL,
  "player_id" TEXT NOT NULL,
  "essence_type" TEXT NOT NULL,
  "delta" INTEGER NOT NULL,
  "reason" TEXT NOT NULL,
  "source_id" TEXT,
  "balance_after" INTEGER NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "essence_transaction_log_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "essence_transaction_log_player_id_created_at_idx"
  ON "essence_transaction_log"("player_id", "created_at");
CREATE INDEX "essence_transaction_log_essence_type_created_at_idx"
  ON "essence_transaction_log"("essence_type", "created_at");

ALTER TABLE "essence_transaction_log"
  ADD CONSTRAINT "essence_transaction_log_player_id_fkey"
  FOREIGN KEY ("player_id") REFERENCES "player"("id") ON DELETE CASCADE ON UPDATE CASCADE;
