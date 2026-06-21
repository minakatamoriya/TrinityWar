-- CreateEnum
CREATE TYPE "ArmyTrainingStatus" AS ENUM ('QUEUED', 'FINISHED', 'CLAIMED', 'CANCELLED');

-- CreateTable
CREATE TABLE "player_wallet" (
    "player_id" TEXT NOT NULL,
    "vault_gold" INTEGER NOT NULL DEFAULT 0,
    "vault_capacity" INTEGER NOT NULL DEFAULT 0,
    "wallet_gold" INTEGER NOT NULL DEFAULT 0,
    "wallet_capacity" INTEGER NOT NULL DEFAULT 0,
    "wallet_protected_ratio" INTEGER NOT NULL DEFAULT 0,
    "pending_tax_gold" INTEGER NOT NULL DEFAULT 0,
    "pending_dividend_gold" INTEGER NOT NULL DEFAULT 0,
    "pending_raid_overflow_gold" INTEGER NOT NULL DEFAULT 0,
    "pending_raid_overflow_expires_at" TIMESTAMP(3),
    "balance_version" INTEGER NOT NULL DEFAULT 1,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "player_wallet_pkey" PRIMARY KEY ("player_id")
);

-- CreateTable
CREATE TABLE "player_building" (
    "player_id" TEXT NOT NULL,
    "castle_level" INTEGER NOT NULL DEFAULT 1,
    "vault_level" INTEGER NOT NULL DEFAULT 1,
    "field_slot_level" INTEGER NOT NULL DEFAULT 1,
    "population_level" INTEGER NOT NULL DEFAULT 1,
    "watchtower_level" INTEGER NOT NULL DEFAULT 1,
    "protection_tech_level" INTEGER NOT NULL DEFAULT 0,
    "farm_yield_tech_level" INTEGER NOT NULL DEFAULT 0,
    "ripe_window_tech_level" INTEGER NOT NULL DEFAULT 0,
    "pending_claim_tech_level" INTEGER NOT NULL DEFAULT 0,
    "building_version" INTEGER NOT NULL DEFAULT 1,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "player_building_pkey" PRIMARY KEY ("player_id")
);

-- CreateTable
CREATE TABLE "player_army" (
    "player_id" TEXT NOT NULL,
    "total_count" INTEGER NOT NULL DEFAULT 0,
    "available_count" INTEGER NOT NULL DEFAULT 0,
    "frozen_count" INTEGER NOT NULL DEFAULT 0,
    "wounded_count" INTEGER NOT NULL DEFAULT 0,
    "capacity" INTEGER NOT NULL DEFAULT 0,
    "army_version" INTEGER NOT NULL DEFAULT 1,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "player_army_pkey" PRIMARY KEY ("player_id")
);

-- CreateTable
CREATE TABLE "army_training_queue" (
    "id" TEXT NOT NULL,
    "player_id" TEXT NOT NULL,
    "queued_count" INTEGER NOT NULL,
    "unit_cost_gold" INTEGER NOT NULL,
    "total_cost_gold" INTEGER NOT NULL,
    "started_at" TIMESTAMP(3) NOT NULL,
    "finish_at" TIMESTAMP(3) NOT NULL,
    "status" "ArmyTrainingStatus" NOT NULL DEFAULT 'QUEUED',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "army_training_queue_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "player_wallet_pending_raid_overflow_expires_at_idx" ON "player_wallet"("pending_raid_overflow_expires_at");

-- CreateIndex
CREATE INDEX "army_training_queue_player_id_status_idx" ON "army_training_queue"("player_id", "status");

-- CreateIndex
CREATE INDEX "army_training_queue_finish_at_idx" ON "army_training_queue"("finish_at");

-- CreateIndex
CREATE UNIQUE INDEX "army_training_queue_player_active_key" ON "army_training_queue"("player_id") WHERE "status" IN ('QUEUED', 'FINISHED');

-- AddForeignKey
ALTER TABLE "player_wallet" ADD CONSTRAINT "player_wallet_player_id_fkey" FOREIGN KEY ("player_id") REFERENCES "player"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "player_building" ADD CONSTRAINT "player_building_player_id_fkey" FOREIGN KEY ("player_id") REFERENCES "player"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "player_army" ADD CONSTRAINT "player_army_player_id_fkey" FOREIGN KEY ("player_id") REFERENCES "player"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "army_training_queue" ADD CONSTRAINT "army_training_queue_player_id_fkey" FOREIGN KEY ("player_id") REFERENCES "player"("id") ON DELETE CASCADE ON UPDATE CASCADE;
