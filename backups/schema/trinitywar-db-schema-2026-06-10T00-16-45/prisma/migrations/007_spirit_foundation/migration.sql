-- CreateEnum
CREATE TYPE "SpiritRarity" AS ENUM ('COMMON', 'RARE', 'LEGENDARY');

-- CreateEnum
CREATE TYPE "SpiritRole" AS ENUM ('ATTACK', 'DEFENSE', 'BALANCED', 'HEALTH');

-- CreateEnum
CREATE TYPE "SpiritElement" AS ENUM ('METAL', 'WOOD', 'WATER', 'FIRE', 'EARTH');

-- CreateEnum
CREATE TYPE "PlayerSpiritStatus" AS ENUM ('ACTIVE', 'WOUNDED', 'RESTING', 'DISSOLVED');

-- CreateTable
CREATE TABLE "spirit_definition" (
    "id" TEXT NOT NULL,
    "spirit_id" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "rarity" "SpiritRarity" NOT NULL,
    "faction_affinity" TEXT NOT NULL,
    "role" "SpiritRole" NOT NULL,
    "shard_name" TEXT NOT NULL,
    "shard_unlock_required" INTEGER NOT NULL DEFAULT 100,
    "base_attack" INTEGER NOT NULL,
    "base_defense" INTEGER NOT NULL,
    "base_hp" INTEGER NOT NULL,
    "growth_attack" INTEGER NOT NULL,
    "growth_defense" INTEGER NOT NULL,
    "growth_hp" INTEGER NOT NULL,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "lore" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "spirit_definition_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "spirit_definition_shard_unlock_required_check" CHECK ("shard_unlock_required" = 100)
);

-- CreateTable
CREATE TABLE "player_spirit_resource" (
    "player_id" TEXT NOT NULL,
    "spirit_soul" INTEGER NOT NULL DEFAULT 0,
    "daily_recovery_used" INTEGER NOT NULL DEFAULT 0,
    "resource_version" INTEGER NOT NULL DEFAULT 1,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "player_spirit_resource_pkey" PRIMARY KEY ("player_id"),
    CONSTRAINT "player_spirit_resource_spirit_soul_check" CHECK ("spirit_soul" >= 0),
    CONSTRAINT "player_spirit_resource_daily_recovery_used_check" CHECK ("daily_recovery_used" >= 0)
);

-- CreateTable
CREATE TABLE "player_spirit_slot" (
    "id" TEXT NOT NULL,
    "player_id" TEXT NOT NULL,
    "slot_index" INTEGER NOT NULL,
    "spirit_definition_id" TEXT,
    "is_main" BOOLEAN NOT NULL DEFAULT false,
    "level" INTEGER NOT NULL DEFAULT 1,
    "exp" INTEGER NOT NULL DEFAULT 0,
    "element" "SpiritElement",
    "current_hp" INTEGER NOT NULL DEFAULT 0,
    "max_hp" INTEGER NOT NULL DEFAULT 0,
    "status" "PlayerSpiritStatus" NOT NULL DEFAULT 'ACTIVE',
    "acquired_at" TIMESTAMP(3),
    "dissolved_at" TIMESTAMP(3),
    "slot_version" INTEGER NOT NULL DEFAULT 1,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "player_spirit_slot_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "player_spirit_slot_slot_index_check" CHECK ("slot_index" BETWEEN 1 AND 5),
    CONSTRAINT "player_spirit_slot_level_check" CHECK ("level" BETWEEN 1 AND 50),
    CONSTRAINT "player_spirit_slot_exp_check" CHECK ("exp" >= 0),
    CONSTRAINT "player_spirit_slot_hp_check" CHECK ("current_hp" >= 0 AND "max_hp" >= 0 AND "current_hp" <= "max_hp"),
    CONSTRAINT "player_spirit_slot_filled_state_check" CHECK (
        ("spirit_definition_id" IS NULL AND "element" IS NULL AND "is_main" = false AND "current_hp" = 0 AND "max_hp" = 0)
        OR
        ("spirit_definition_id" IS NOT NULL AND "element" IS NOT NULL AND "max_hp" > 0)
    )
);

-- CreateTable
CREATE TABLE "player_spirit_codex" (
    "id" TEXT NOT NULL,
    "player_id" TEXT NOT NULL,
    "spirit_definition_id" TEXT NOT NULL,
    "has_seen" BOOLEAN NOT NULL DEFAULT false,
    "shard_count" INTEGER NOT NULL DEFAULT 0,
    "ready_to_compose" BOOLEAN NOT NULL DEFAULT false,
    "owned_current" BOOLEAN NOT NULL DEFAULT false,
    "owned_ever" BOOLEAN NOT NULL DEFAULT false,
    "first_seen_at" TIMESTAMP(3),
    "ready_at" TIMESTAMP(3),
    "last_owned_at" TIMESTAMP(3),
    "codex_version" INTEGER NOT NULL DEFAULT 1,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "player_spirit_codex_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "player_spirit_codex_shard_count_check" CHECK ("shard_count" BETWEEN 0 AND 100),
    CONSTRAINT "player_spirit_codex_ready_check" CHECK ("ready_to_compose" = false OR "shard_count" = 100)
);

-- CreateIndex
CREATE UNIQUE INDEX "spirit_definition_spirit_id_key" ON "spirit_definition"("spirit_id");

-- CreateIndex
CREATE INDEX "spirit_definition_rarity_sort_order_idx" ON "spirit_definition"("rarity", "sort_order");

-- CreateIndex
CREATE UNIQUE INDEX "player_spirit_slot_player_id_slot_index_key" ON "player_spirit_slot"("player_id", "slot_index");

-- CreateIndex
CREATE INDEX "player_spirit_slot_player_id_is_main_idx" ON "player_spirit_slot"("player_id", "is_main");

-- CreateIndex
CREATE INDEX "player_spirit_slot_spirit_definition_id_idx" ON "player_spirit_slot"("spirit_definition_id");

-- CreateIndex
CREATE UNIQUE INDEX "player_spirit_slot_one_main_per_player_idx" ON "player_spirit_slot"("player_id") WHERE "is_main" = true;

-- CreateIndex
CREATE UNIQUE INDEX "player_spirit_codex_player_id_spirit_definition_id_key" ON "player_spirit_codex"("player_id", "spirit_definition_id");

-- CreateIndex
CREATE INDEX "player_spirit_codex_player_id_ready_to_compose_idx" ON "player_spirit_codex"("player_id", "ready_to_compose");

-- CreateIndex
CREATE INDEX "player_spirit_codex_spirit_definition_id_idx" ON "player_spirit_codex"("spirit_definition_id");

-- AddForeignKey
ALTER TABLE "player_spirit_resource" ADD CONSTRAINT "player_spirit_resource_player_id_fkey" FOREIGN KEY ("player_id") REFERENCES "player"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "player_spirit_slot" ADD CONSTRAINT "player_spirit_slot_player_id_fkey" FOREIGN KEY ("player_id") REFERENCES "player"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "player_spirit_slot" ADD CONSTRAINT "player_spirit_slot_spirit_definition_id_fkey" FOREIGN KEY ("spirit_definition_id") REFERENCES "spirit_definition"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "player_spirit_codex" ADD CONSTRAINT "player_spirit_codex_player_id_fkey" FOREIGN KEY ("player_id") REFERENCES "player"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "player_spirit_codex" ADD CONSTRAINT "player_spirit_codex_spirit_definition_id_fkey" FOREIGN KEY ("spirit_definition_id") REFERENCES "spirit_definition"("id") ON DELETE CASCADE ON UPDATE CASCADE;
