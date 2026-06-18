-- CreateTable
CREATE TABLE "wallet_change_log" (
    "id" TEXT NOT NULL,
    "player_id" TEXT NOT NULL,
    "wallet_bucket" TEXT NOT NULL,
    "change_type" TEXT NOT NULL,
    "delta_gold" INTEGER NOT NULL,
    "before_gold" INTEGER NOT NULL,
    "after_gold" INTEGER NOT NULL,
    "related_entity_type" TEXT,
    "related_entity_id" TEXT,
    "request_idempotency_key" TEXT,
    "note" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "wallet_change_log_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "building_upgrade_log" (
    "id" TEXT NOT NULL,
    "player_id" TEXT NOT NULL,
    "building_key" TEXT NOT NULL,
    "old_level" INTEGER NOT NULL,
    "new_level" INTEGER NOT NULL,
    "cost_gold" INTEGER NOT NULL,
    "request_idempotency_key" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "building_upgrade_log_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "field_harvest_log" (
    "id" TEXT NOT NULL,
    "player_id" TEXT NOT NULL,
    "field_slot_id" TEXT NOT NULL,
    "collect_mode" TEXT NOT NULL,
    "collected_gold" INTEGER NOT NULL,
    "overflow_gold" INTEGER NOT NULL,
    "reward_items_json" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "field_harvest_log_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "faction_contribution_log" (
    "id" TEXT NOT NULL,
    "faction_id" TEXT NOT NULL,
    "player_id" TEXT NOT NULL,
    "donated_gold" INTEGER NOT NULL,
    "contribution_delta" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "faction_contribution_log_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "task_reward_log" (
    "id" TEXT NOT NULL,
    "player_id" TEXT NOT NULL,
    "task_state_id" TEXT,
    "task_id" TEXT NOT NULL,
    "reward_gold" INTEGER NOT NULL,
    "request_idempotency_key" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "task_reward_log_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "idempotency_record" (
    "id" TEXT NOT NULL,
    "player_id" TEXT NOT NULL,
    "endpoint_key" TEXT NOT NULL,
    "idempotency_key" TEXT NOT NULL,
    "request_hash" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "response_snapshot_json" JSONB,
    "business_entity_type" TEXT,
    "business_entity_id" TEXT,
    "expires_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "idempotency_record_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "wallet_change_log_player_id_created_at_idx" ON "wallet_change_log"("player_id", "created_at");

-- CreateIndex
CREATE INDEX "wallet_change_log_request_idempotency_key_idx" ON "wallet_change_log"("request_idempotency_key");

-- CreateIndex
CREATE INDEX "wallet_change_log_change_type_created_at_idx" ON "wallet_change_log"("change_type", "created_at");

-- CreateIndex
CREATE INDEX "building_upgrade_log_player_id_created_at_idx" ON "building_upgrade_log"("player_id", "created_at");

-- CreateIndex
CREATE INDEX "building_upgrade_log_request_idempotency_key_idx" ON "building_upgrade_log"("request_idempotency_key");

-- CreateIndex
CREATE INDEX "field_harvest_log_player_id_created_at_idx" ON "field_harvest_log"("player_id", "created_at");

-- CreateIndex
CREATE INDEX "field_harvest_log_field_slot_id_idx" ON "field_harvest_log"("field_slot_id");

-- CreateIndex
CREATE INDEX "faction_contribution_log_faction_id_created_at_idx" ON "faction_contribution_log"("faction_id", "created_at");

-- CreateIndex
CREATE INDEX "faction_contribution_log_player_id_created_at_idx" ON "faction_contribution_log"("player_id", "created_at");

-- CreateIndex
CREATE INDEX "task_reward_log_player_id_created_at_idx" ON "task_reward_log"("player_id", "created_at");

-- CreateIndex
CREATE INDEX "task_reward_log_request_idempotency_key_idx" ON "task_reward_log"("request_idempotency_key");

-- CreateIndex
CREATE UNIQUE INDEX "idempotency_record_player_id_endpoint_key_idempotency_key_key" ON "idempotency_record"("player_id", "endpoint_key", "idempotency_key");

-- CreateIndex
CREATE INDEX "idempotency_record_expires_at_idx" ON "idempotency_record"("expires_at");

-- CreateIndex
CREATE INDEX "idempotency_record_status_updated_at_idx" ON "idempotency_record"("status", "updated_at");

-- AddForeignKey
ALTER TABLE "wallet_change_log" ADD CONSTRAINT "wallet_change_log_player_id_fkey" FOREIGN KEY ("player_id") REFERENCES "player"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "building_upgrade_log" ADD CONSTRAINT "building_upgrade_log_player_id_fkey" FOREIGN KEY ("player_id") REFERENCES "player"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "field_harvest_log" ADD CONSTRAINT "field_harvest_log_player_id_fkey" FOREIGN KEY ("player_id") REFERENCES "player"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "field_harvest_log" ADD CONSTRAINT "field_harvest_log_field_slot_id_fkey" FOREIGN KEY ("field_slot_id") REFERENCES "player_field_slot"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "faction_contribution_log" ADD CONSTRAINT "faction_contribution_log_faction_id_fkey" FOREIGN KEY ("faction_id") REFERENCES "faction"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "faction_contribution_log" ADD CONSTRAINT "faction_contribution_log_player_id_fkey" FOREIGN KEY ("player_id") REFERENCES "player"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "task_reward_log" ADD CONSTRAINT "task_reward_log_player_id_fkey" FOREIGN KEY ("player_id") REFERENCES "player"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "task_reward_log" ADD CONSTRAINT "task_reward_log_task_state_id_fkey" FOREIGN KEY ("task_state_id") REFERENCES "player_daily_task_state"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "idempotency_record" ADD CONSTRAINT "idempotency_record_player_id_fkey" FOREIGN KEY ("player_id") REFERENCES "player"("id") ON DELETE CASCADE ON UPDATE CASCADE;
