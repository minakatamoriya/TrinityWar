-- CreateEnum
CREATE TYPE "NotificationAudience" AS ENUM ('GLOBAL', 'PLAYER');

-- CreateEnum
CREATE TYPE "NotificationCategory" AS ENUM ('SYSTEM', 'ANNOUNCEMENT', 'MAINTENANCE', 'REWARD', 'COMPENSATION');

-- CreateEnum
CREATE TYPE "PlayerNotificationClaimStatus" AS ENUM ('NONE', 'UNCLAIMED', 'CLAIMED', 'EXPIRED');

-- CreateTable
CREATE TABLE "system_notification" (
    "id" TEXT NOT NULL,
    "audience" "NotificationAudience" NOT NULL,
    "category" "NotificationCategory" NOT NULL DEFAULT 'SYSTEM',
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "created_by_admin" TEXT,
    "starts_at" TIMESTAMP(3),
    "expires_at" TIMESTAMP(3),
    "revoked_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "system_notification_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "system_notification_title_length_check" CHECK (char_length("title") BETWEEN 1 AND 80),
    CONSTRAINT "system_notification_body_length_check" CHECK (char_length("body") BETWEEN 1 AND 1000)
);

-- CreateTable
CREATE TABLE "player_notification" (
    "id" TEXT NOT NULL,
    "player_id" TEXT NOT NULL,
    "system_notification_id" TEXT,
    "category" "NotificationCategory" NOT NULL DEFAULT 'SYSTEM',
    "title_snapshot" TEXT NOT NULL,
    "body_snapshot" TEXT NOT NULL,
    "attachment_json" JSONB,
    "claim_status" "PlayerNotificationClaimStatus" NOT NULL DEFAULT 'NONE',
    "read_at" TIMESTAMP(3),
    "deleted_at" TIMESTAMP(3),
    "claimed_at" TIMESTAMP(3),
    "expires_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "player_notification_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "player_notification_title_snapshot_length_check" CHECK (char_length("title_snapshot") BETWEEN 1 AND 80),
    CONSTRAINT "player_notification_body_snapshot_length_check" CHECK (char_length("body_snapshot") BETWEEN 1 AND 1000),
    CONSTRAINT "player_notification_claim_consistency_check" CHECK (
        ("attachment_json" IS NULL AND "claim_status" = 'NONE')
        OR
        ("attachment_json" IS NOT NULL AND "claim_status" IN ('UNCLAIMED', 'CLAIMED', 'EXPIRED'))
    )
);

-- CreateIndex
CREATE INDEX "system_notification_audience_created_at_idx" ON "system_notification"("audience", "created_at");

-- CreateIndex
CREATE INDEX "system_notification_category_created_at_idx" ON "system_notification"("category", "created_at");

-- CreateIndex
CREATE INDEX "system_notification_revoked_at_idx" ON "system_notification"("revoked_at");

-- CreateIndex
CREATE INDEX "player_notification_player_id_deleted_at_created_at_idx" ON "player_notification"("player_id", "deleted_at", "created_at");

-- CreateIndex
CREATE INDEX "player_notification_player_id_read_at_idx" ON "player_notification"("player_id", "read_at");

-- CreateIndex
CREATE INDEX "player_notification_player_id_claim_status_idx" ON "player_notification"("player_id", "claim_status");

-- CreateIndex
CREATE INDEX "player_notification_system_notification_id_idx" ON "player_notification"("system_notification_id");

-- AddForeignKey
ALTER TABLE "player_notification" ADD CONSTRAINT "player_notification_player_id_fkey" FOREIGN KEY ("player_id") REFERENCES "player"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "player_notification" ADD CONSTRAINT "player_notification_system_notification_id_fkey" FOREIGN KEY ("system_notification_id") REFERENCES "system_notification"("id") ON DELETE SET NULL ON UPDATE CASCADE;
