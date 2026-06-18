-- CreateEnum
CREATE TYPE "FieldStatus" AS ENUM ('LOCKED', 'EMPTY', 'SEEDED', 'GROWING', 'MATURE', 'WITHERED');

-- CreateEnum
CREATE TYPE "TaskStatus" AS ENUM ('IN_PROGRESS', 'COMPLETED', 'CLAIMED');

-- CreateTable
CREATE TABLE "seed_definition" (
    "id" TEXT NOT NULL,
    "seed_id" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "rarity" TEXT NOT NULL,
    "seed_seconds" INTEGER NOT NULL,
    "grow_seconds" INTEGER NOT NULL,
    "mature_seconds" INTEGER NOT NULL,
    "ripe_window_seconds" INTEGER NOT NULL,
    "base_yield_gold" INTEGER NOT NULL,
    "harvest_seed_return" INTEGER NOT NULL DEFAULT 0,
    "strategy_note" TEXT,
    "lore" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "seed_definition_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "player_seed_inventory" (
    "id" TEXT NOT NULL,
    "player_id" TEXT NOT NULL,
    "seed_definition_id" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL DEFAULT 0,
    "inventory_version" INTEGER NOT NULL DEFAULT 1,
    "unlocked_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "player_seed_inventory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "player_field_slot" (
    "id" TEXT NOT NULL,
    "player_id" TEXT NOT NULL,
    "slot_index" INTEGER NOT NULL,
    "is_unlocked" BOOLEAN NOT NULL DEFAULT false,
    "unlock_castle_level" INTEGER NOT NULL,
    "status" "FieldStatus" NOT NULL DEFAULT 'LOCKED',
    "seed_definition_id" TEXT,
    "invested_gold" INTEGER NOT NULL DEFAULT 0,
    "current_claimable_gold" INTEGER NOT NULL DEFAULT 0,
    "harvested_gold_total" INTEGER NOT NULL DEFAULT 0,
    "raided_gold_total" INTEGER NOT NULL DEFAULT 0,
    "seed_at" TIMESTAMP(3),
    "mature_at" TIMESTAMP(3),
    "full_mature_at" TIMESTAMP(3),
    "overripe_at" TIMESTAMP(3),
    "last_calculated_at" TIMESTAMP(3),
    "status_version" INTEGER NOT NULL DEFAULT 1,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "player_field_slot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "player_daily_task_state" (
    "id" TEXT NOT NULL,
    "player_id" TEXT NOT NULL,
    "date_key" TEXT NOT NULL,
    "task_id" TEXT NOT NULL,
    "progress" INTEGER NOT NULL DEFAULT 0,
    "target" INTEGER NOT NULL,
    "status" "TaskStatus" NOT NULL DEFAULT 'IN_PROGRESS',
    "reward_gold" INTEGER NOT NULL,
    "action_scene" TEXT NOT NULL,
    "claimed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "player_daily_task_state_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "seed_definition_seed_id_key" ON "seed_definition"("seed_id");

-- CreateIndex
CREATE INDEX "player_seed_inventory_player_id_idx" ON "player_seed_inventory"("player_id");

-- CreateIndex
CREATE UNIQUE INDEX "player_seed_inventory_player_id_seed_definition_id_key" ON "player_seed_inventory"("player_id", "seed_definition_id");

-- CreateIndex
CREATE INDEX "player_field_slot_player_id_status_idx" ON "player_field_slot"("player_id", "status");

-- CreateIndex
CREATE INDEX "player_field_slot_mature_at_idx" ON "player_field_slot"("mature_at");

-- CreateIndex
CREATE INDEX "player_field_slot_full_mature_at_idx" ON "player_field_slot"("full_mature_at");

-- CreateIndex
CREATE INDEX "player_field_slot_overripe_at_idx" ON "player_field_slot"("overripe_at");

-- CreateIndex
CREATE UNIQUE INDEX "player_field_slot_player_id_slot_index_key" ON "player_field_slot"("player_id", "slot_index");

-- CreateIndex
CREATE INDEX "player_daily_task_state_player_id_date_key_idx" ON "player_daily_task_state"("player_id", "date_key");

-- CreateIndex
CREATE INDEX "player_daily_task_state_date_key_status_idx" ON "player_daily_task_state"("date_key", "status");

-- CreateIndex
CREATE UNIQUE INDEX "player_daily_task_state_player_id_date_key_task_id_key" ON "player_daily_task_state"("player_id", "date_key", "task_id");

-- AddForeignKey
ALTER TABLE "player_seed_inventory" ADD CONSTRAINT "player_seed_inventory_player_id_fkey" FOREIGN KEY ("player_id") REFERENCES "player"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "player_seed_inventory" ADD CONSTRAINT "player_seed_inventory_seed_definition_id_fkey" FOREIGN KEY ("seed_definition_id") REFERENCES "seed_definition"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "player_field_slot" ADD CONSTRAINT "player_field_slot_player_id_fkey" FOREIGN KEY ("player_id") REFERENCES "player"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "player_field_slot" ADD CONSTRAINT "player_field_slot_seed_definition_id_fkey" FOREIGN KEY ("seed_definition_id") REFERENCES "seed_definition"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "player_daily_task_state" ADD CONSTRAINT "player_daily_task_state_player_id_fkey" FOREIGN KEY ("player_id") REFERENCES "player"("id") ON DELETE CASCADE ON UPDATE CASCADE;
