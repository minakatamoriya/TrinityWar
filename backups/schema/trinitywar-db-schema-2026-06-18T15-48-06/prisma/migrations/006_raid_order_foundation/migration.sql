-- CreateEnum
CREATE TYPE "RaidOrderMode" AS ENUM ('SINGLE', 'BOUNTY');

-- CreateEnum
CREATE TYPE "RaidOrderStatus" AS ENUM ('CREATED', 'LOCKED', 'SETTLING', 'SETTLED', 'SETTLEMENT_FAILED', 'CANCELLED', 'BOUNTY_CREATED', 'BOUNTY_WAITING_PARTNER', 'BOUNTY_ACCEPTED', 'BOUNTY_EXPIRED');

-- CreateEnum
CREATE TYPE "RaidAssetLockMode" AS ENUM ('SOFT', 'HARD');

-- CreateEnum
CREATE TYPE "RaidAssetLockStatus" AS ENUM ('ACTIVE', 'RELEASED', 'CONSUMED', 'EXPIRED');

-- CreateEnum
CREATE TYPE "RaidSettlementResult" AS ENUM ('WIN', 'LOSS', 'DRAW', 'CANCELLED');

-- CreateEnum
CREATE TYPE "BattleReportType" AS ENUM ('ATTACK', 'DEFENSE', 'BOUNTY');

-- CreateTable
CREATE TABLE "raid_target_pool" (
    "id" TEXT NOT NULL,
    "owner_player_id" TEXT NOT NULL,
    "target_player_id" TEXT NOT NULL,
    "slot_index" INTEGER NOT NULL,
    "target_snapshot_json" JSONB NOT NULL,
    "field_snapshot_json" JSONB,
    "risk_snapshot_json" JSONB,
    "refresh_batch_no" INTEGER NOT NULL,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "raid_target_pool_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "raid_order" (
    "id" TEXT NOT NULL,
    "attacker_player_id" TEXT NOT NULL,
    "defender_player_id" TEXT NOT NULL,
    "defender_field_slot_id" TEXT,
    "source_target_pool_id" TEXT,
    "mode" "RaidOrderMode" NOT NULL,
    "status" "RaidOrderStatus" NOT NULL DEFAULT 'CREATED',
    "dispatched_unit_count" INTEGER NOT NULL,
    "frozen_unit_snapshot" JSONB NOT NULL,
    "transport_capacity_snapshot" INTEGER NOT NULL,
    "attacker_snapshot_json" JSONB NOT NULL,
    "defender_snapshot_json" JSONB NOT NULL,
    "dispatched_at" TIMESTAMP(3) NOT NULL,
    "settle_at" TIMESTAMP(3) NOT NULL,
    "settled_at" TIMESTAMP(3),
    "request_idempotency_key" TEXT NOT NULL,
    "settlement_version" INTEGER NOT NULL DEFAULT 1,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "raid_order_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "raid_asset_lock" (
    "id" TEXT NOT NULL,
    "raid_order_id" TEXT NOT NULL,
    "defender_player_id" TEXT NOT NULL,
    "asset_type" TEXT NOT NULL,
    "source_entity_id" TEXT,
    "source_field_slot_id" TEXT,
    "locked_gold" INTEGER NOT NULL DEFAULT 0,
    "locked_item_json" JSONB,
    "lock_mode" "RaidAssetLockMode" NOT NULL,
    "status" "RaidAssetLockStatus" NOT NULL DEFAULT 'ACTIVE',
    "expires_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "raid_asset_lock_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "raid_settlement" (
    "id" TEXT NOT NULL,
    "raid_order_id" TEXT NOT NULL,
    "result" "RaidSettlementResult" NOT NULL,
    "loot_gold" INTEGER NOT NULL DEFAULT 0,
    "deposited_gold" INTEGER NOT NULL DEFAULT 0,
    "overflow_gold" INTEGER NOT NULL DEFAULT 0,
    "temporary_claim_expires_at" TIMESTAMP(3),
    "attacker_loss" INTEGER NOT NULL DEFAULT 0,
    "defender_loss" INTEGER NOT NULL DEFAULT 0,
    "reward_items_json" JSONB,
    "report_summary" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "raid_settlement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "battle_report" (
    "id" TEXT NOT NULL,
    "raid_order_id" TEXT NOT NULL,
    "owner_player_id" TEXT NOT NULL,
    "opponent_player_id" TEXT NOT NULL,
    "report_type" "BattleReportType" NOT NULL,
    "result" "RaidSettlementResult" NOT NULL,
    "title" TEXT NOT NULL,
    "summary" TEXT NOT NULL,
    "revenge_available" BOOLEAN NOT NULL DEFAULT false,
    "revoked_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "battle_report_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "raid_target_pool_owner_player_id_target_player_id_slot_index_refresh_batch_no_key" ON "raid_target_pool"("owner_player_id", "target_player_id", "slot_index", "refresh_batch_no");

-- CreateIndex
CREATE INDEX "raid_target_pool_owner_player_id_expires_at_idx" ON "raid_target_pool"("owner_player_id", "expires_at");

-- CreateIndex
CREATE INDEX "raid_target_pool_owner_player_id_refresh_batch_no_idx" ON "raid_target_pool"("owner_player_id", "refresh_batch_no");

-- CreateIndex
CREATE UNIQUE INDEX "raid_order_request_idempotency_key_key" ON "raid_order"("request_idempotency_key");

-- CreateIndex
CREATE INDEX "raid_order_attacker_player_id_status_idx" ON "raid_order"("attacker_player_id", "status");

-- CreateIndex
CREATE INDEX "raid_order_defender_player_id_status_idx" ON "raid_order"("defender_player_id", "status");

-- CreateIndex
CREATE INDEX "raid_order_settle_at_status_idx" ON "raid_order"("settle_at", "status");

-- CreateIndex
CREATE INDEX "raid_asset_lock_raid_order_id_idx" ON "raid_asset_lock"("raid_order_id");

-- CreateIndex
CREATE INDEX "raid_asset_lock_defender_player_id_status_idx" ON "raid_asset_lock"("defender_player_id", "status");

-- CreateIndex
CREATE INDEX "raid_asset_lock_expires_at_status_idx" ON "raid_asset_lock"("expires_at", "status");

-- CreateIndex
CREATE UNIQUE INDEX "raid_settlement_raid_order_id_key" ON "raid_settlement"("raid_order_id");

-- CreateIndex
CREATE INDEX "battle_report_owner_player_id_created_at_idx" ON "battle_report"("owner_player_id", "created_at");

-- CreateIndex
CREATE INDEX "battle_report_raid_order_id_idx" ON "battle_report"("raid_order_id");

-- AddForeignKey
ALTER TABLE "raid_target_pool" ADD CONSTRAINT "raid_target_pool_owner_player_id_fkey" FOREIGN KEY ("owner_player_id") REFERENCES "player"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "raid_target_pool" ADD CONSTRAINT "raid_target_pool_target_player_id_fkey" FOREIGN KEY ("target_player_id") REFERENCES "player"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "raid_order" ADD CONSTRAINT "raid_order_attacker_player_id_fkey" FOREIGN KEY ("attacker_player_id") REFERENCES "player"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "raid_order" ADD CONSTRAINT "raid_order_defender_player_id_fkey" FOREIGN KEY ("defender_player_id") REFERENCES "player"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "raid_order" ADD CONSTRAINT "raid_order_defender_field_slot_id_fkey" FOREIGN KEY ("defender_field_slot_id") REFERENCES "player_field_slot"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "raid_order" ADD CONSTRAINT "raid_order_source_target_pool_id_fkey" FOREIGN KEY ("source_target_pool_id") REFERENCES "raid_target_pool"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "raid_asset_lock" ADD CONSTRAINT "raid_asset_lock_raid_order_id_fkey" FOREIGN KEY ("raid_order_id") REFERENCES "raid_order"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "raid_asset_lock" ADD CONSTRAINT "raid_asset_lock_defender_player_id_fkey" FOREIGN KEY ("defender_player_id") REFERENCES "player"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "raid_asset_lock" ADD CONSTRAINT "raid_asset_lock_source_field_slot_id_fkey" FOREIGN KEY ("source_field_slot_id") REFERENCES "player_field_slot"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "raid_settlement" ADD CONSTRAINT "raid_settlement_raid_order_id_fkey" FOREIGN KEY ("raid_order_id") REFERENCES "raid_order"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "battle_report" ADD CONSTRAINT "battle_report_raid_order_id_fkey" FOREIGN KEY ("raid_order_id") REFERENCES "raid_order"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "battle_report" ADD CONSTRAINT "battle_report_owner_player_id_fkey" FOREIGN KEY ("owner_player_id") REFERENCES "player"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "battle_report" ADD CONSTRAINT "battle_report_opponent_player_id_fkey" FOREIGN KEY ("opponent_player_id") REFERENCES "player"("id") ON DELETE CASCADE ON UPDATE CASCADE;
