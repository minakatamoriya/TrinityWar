-- CreateEnum
CREATE TYPE "ShareAssistCampaignType" AS ENUM ('WATER');

-- CreateEnum
CREATE TYPE "ShareAssistCampaignStatus" AS ENUM ('ACTIVE', 'FULL', 'EXPIRED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "ShareAssistRecordAudience" AS ENUM ('GUEST', 'PLAYER');

-- CreateEnum
CREATE TYPE "ShareAssistRecordStatus" AS ENUM ('CONFIRMED', 'BOUND', 'REWARDED', 'REJECTED');

-- CreateEnum
CREATE TYPE "PlayerInviteRelationStatus" AS ENUM ('PENDING_BIND', 'BOUND', 'TUTORIAL_COMPLETED', 'REWARDED', 'INVALID');

-- CreateTable
CREATE TABLE "share_assist_campaign" (
    "id" TEXT NOT NULL,
    "owner_player_id" TEXT NOT NULL,
    "campaign_type" "ShareAssistCampaignType" NOT NULL,
    "target_entity_type" TEXT,
    "target_entity_id" TEXT,
    "status" "ShareAssistCampaignStatus" NOT NULL DEFAULT 'ACTIVE',
    "max_assist_count" INTEGER NOT NULL DEFAULT 3,
    "current_assist_count" INTEGER NOT NULL DEFAULT 0,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "share_assist_campaign_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "share_assist_record" (
    "id" TEXT NOT NULL,
    "campaign_id" TEXT NOT NULL,
    "helper_player_id" TEXT,
    "helper_openid_hash" TEXT,
    "helper_device_hash" TEXT,
    "helper_audience" "ShareAssistRecordAudience" NOT NULL,
    "status" "ShareAssistRecordStatus" NOT NULL DEFAULT 'CONFIRMED',
    "assist_record_id" TEXT,
    "reward_claimed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "bound_at" TIMESTAMP(3),

    CONSTRAINT "share_assist_record_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "player_invite_relation" (
    "id" TEXT NOT NULL,
    "inviter_player_id" TEXT NOT NULL,
    "invited_player_id" TEXT,
    "invited_openid_hash" TEXT,
    "source_campaign_id" TEXT,
    "status" "PlayerInviteRelationStatus" NOT NULL DEFAULT 'PENDING_BIND',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "bound_at" TIMESTAMP(3),
    "rewarded_at" TIMESTAMP(3),

    CONSTRAINT "player_invite_relation_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "share_assist_campaign_owner_player_id_campaign_type_status_created_at_idx" ON "share_assist_campaign"("owner_player_id", "campaign_type", "status", "created_at");

-- CreateIndex
CREATE INDEX "share_assist_campaign_expires_at_status_idx" ON "share_assist_campaign"("expires_at", "status");

-- CreateIndex
CREATE UNIQUE INDEX "share_assist_record_campaign_id_helper_player_id_key" ON "share_assist_record"("campaign_id", "helper_player_id");

-- CreateIndex
CREATE UNIQUE INDEX "share_assist_record_campaign_id_helper_openid_hash_key" ON "share_assist_record"("campaign_id", "helper_openid_hash");

-- CreateIndex
CREATE UNIQUE INDEX "share_assist_record_campaign_id_helper_device_hash_key" ON "share_assist_record"("campaign_id", "helper_device_hash");

-- CreateIndex
CREATE INDEX "share_assist_record_campaign_id_status_created_at_idx" ON "share_assist_record"("campaign_id", "status", "created_at");

-- CreateIndex
CREATE INDEX "share_assist_record_helper_player_id_created_at_idx" ON "share_assist_record"("helper_player_id", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "player_invite_relation_inviter_player_id_invited_player_id_key" ON "player_invite_relation"("inviter_player_id", "invited_player_id");

-- CreateIndex
CREATE UNIQUE INDEX "player_invite_relation_inviter_player_id_invited_openid_hash_key" ON "player_invite_relation"("inviter_player_id", "invited_openid_hash");

-- CreateIndex
CREATE INDEX "player_invite_relation_inviter_player_id_status_created_at_idx" ON "player_invite_relation"("inviter_player_id", "status", "created_at");

-- CreateIndex
CREATE INDEX "player_invite_relation_invited_player_id_idx" ON "player_invite_relation"("invited_player_id");

-- CreateIndex
CREATE INDEX "player_invite_relation_source_campaign_id_idx" ON "player_invite_relation"("source_campaign_id");

-- AddForeignKey
ALTER TABLE "share_assist_campaign" ADD CONSTRAINT "share_assist_campaign_owner_player_id_fkey" FOREIGN KEY ("owner_player_id") REFERENCES "player"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "share_assist_record" ADD CONSTRAINT "share_assist_record_campaign_id_fkey" FOREIGN KEY ("campaign_id") REFERENCES "share_assist_campaign"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "share_assist_record" ADD CONSTRAINT "share_assist_record_helper_player_id_fkey" FOREIGN KEY ("helper_player_id") REFERENCES "player"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "player_invite_relation" ADD CONSTRAINT "player_invite_relation_inviter_player_id_fkey" FOREIGN KEY ("inviter_player_id") REFERENCES "player"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "player_invite_relation" ADD CONSTRAINT "player_invite_relation_invited_player_id_fkey" FOREIGN KEY ("invited_player_id") REFERENCES "player"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "player_invite_relation" ADD CONSTRAINT "player_invite_relation_source_campaign_id_fkey" FOREIGN KEY ("source_campaign_id") REFERENCES "share_assist_campaign"("id") ON DELETE SET NULL ON UPDATE CASCADE;
