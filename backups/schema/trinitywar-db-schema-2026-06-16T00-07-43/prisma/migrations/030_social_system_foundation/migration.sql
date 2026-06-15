-- CreateEnum
CREATE TYPE "SocialRelationType" AS ENUM ('FRIEND', 'FOLLOWING', 'ENEMY', 'BLOCKED');

-- CreateEnum
CREATE TYPE "SocialRelationStatus" AS ENUM ('ACTIVE', 'PENDING', 'MUTED');

-- CreateEnum
CREATE TYPE "SocialFeedType" AS ENUM ('FRIEND_WATERED_FIELD', 'FRIEND_GUARDED_FIELD', 'TEAM_CHALLENGE_INVITED', 'TEAM_CHALLENGE_ACCEPTED', 'ENEMY_RAIDED', 'REVENGE_AVAILABLE', 'FACTION_HELP_REQUESTED');

-- CreateEnum
CREATE TYPE "SocialAssistType" AS ENUM ('WATER_FIELD', 'GUARD_FIELD', 'RECOVER_SPIRIT', 'FACTION_TASK_HELP');

-- CreateEnum
CREATE TYPE "TeamChallengeStatus" AS ENUM ('PENDING', 'ACCEPTED', 'REJECTED', 'EXPIRED', 'SETTLED');

-- CreateTable
CREATE TABLE "player_social_relation" (
    "id" TEXT NOT NULL,
    "player_id" TEXT NOT NULL,
    "target_player_id" TEXT NOT NULL,
    "relation_type" "SocialRelationType" NOT NULL,
    "status" "SocialRelationStatus" NOT NULL DEFAULT 'ACTIVE',
    "source_type" TEXT NOT NULL DEFAULT 'manual',
    "intimacy" INTEGER NOT NULL DEFAULT 0,
    "last_interacted_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "player_social_relation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "player_social_feed" (
    "id" TEXT NOT NULL,
    "player_id" TEXT NOT NULL,
    "actor_player_id" TEXT,
    "feed_type" "SocialFeedType" NOT NULL,
    "related_entity_type" TEXT,
    "related_entity_id" TEXT,
    "summary" TEXT NOT NULL,
    "metadata_json" JSONB,
    "is_read" BOOLEAN NOT NULL DEFAULT false,
    "expires_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "player_social_feed_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "player_assist_record" (
    "id" TEXT NOT NULL,
    "helper_player_id" TEXT NOT NULL,
    "target_player_id" TEXT NOT NULL,
    "assist_type" "SocialAssistType" NOT NULL,
    "target_entity_type" TEXT,
    "target_entity_id" TEXT,
    "effect_value" INTEGER NOT NULL DEFAULT 0,
    "date_key" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "player_assist_record_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "team_challenge" (
    "id" TEXT NOT NULL,
    "initiator_player_id" TEXT NOT NULL,
    "ally_player_id" TEXT NOT NULL,
    "target_player_id" TEXT NOT NULL,
    "status" "TeamChallengeStatus" NOT NULL DEFAULT 'PENDING',
    "initiator_power_snapshot" INTEGER NOT NULL DEFAULT 0,
    "ally_power_snapshot" INTEGER NOT NULL DEFAULT 0,
    "target_power_snapshot" INTEGER NOT NULL DEFAULT 0,
    "assist_efficiency_bps" INTEGER NOT NULL DEFAULT 6000,
    "result" TEXT,
    "reward_json" JSONB,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "settled_at" TIMESTAMP(3),

    CONSTRAINT "team_challenge_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "player_social_relation_player_id_target_player_id_relation_type_key" ON "player_social_relation"("player_id", "target_player_id", "relation_type");

-- CreateIndex
CREATE INDEX "player_social_relation_player_id_relation_type_status_idx" ON "player_social_relation"("player_id", "relation_type", "status");

-- CreateIndex
CREATE INDEX "player_social_relation_target_player_id_relation_type_status_idx" ON "player_social_relation"("target_player_id", "relation_type", "status");

-- CreateIndex
CREATE INDEX "player_social_relation_last_interacted_at_idx" ON "player_social_relation"("last_interacted_at");

-- CreateIndex
CREATE INDEX "player_social_feed_player_id_is_read_created_at_idx" ON "player_social_feed"("player_id", "is_read", "created_at");

-- CreateIndex
CREATE INDEX "player_social_feed_player_id_feed_type_created_at_idx" ON "player_social_feed"("player_id", "feed_type", "created_at");

-- CreateIndex
CREATE INDEX "player_social_feed_actor_player_id_created_at_idx" ON "player_social_feed"("actor_player_id", "created_at");

-- CreateIndex
CREATE INDEX "player_social_feed_expires_at_idx" ON "player_social_feed"("expires_at");

-- CreateIndex
CREATE INDEX "player_assist_record_helper_player_id_date_key_assist_type_idx" ON "player_assist_record"("helper_player_id", "date_key", "assist_type");

-- CreateIndex
CREATE INDEX "player_assist_record_target_player_id_date_key_assist_type_idx" ON "player_assist_record"("target_player_id", "date_key", "assist_type");

-- CreateIndex
CREATE INDEX "player_assist_record_target_entity_type_target_entity_id_idx" ON "player_assist_record"("target_entity_type", "target_entity_id");

-- CreateIndex
CREATE INDEX "team_challenge_initiator_player_id_status_created_at_idx" ON "team_challenge"("initiator_player_id", "status", "created_at");

-- CreateIndex
CREATE INDEX "team_challenge_ally_player_id_status_created_at_idx" ON "team_challenge"("ally_player_id", "status", "created_at");

-- CreateIndex
CREATE INDEX "team_challenge_target_player_id_created_at_idx" ON "team_challenge"("target_player_id", "created_at");

-- CreateIndex
CREATE INDEX "team_challenge_expires_at_status_idx" ON "team_challenge"("expires_at", "status");

-- AddForeignKey
ALTER TABLE "player_social_relation" ADD CONSTRAINT "player_social_relation_player_id_fkey" FOREIGN KEY ("player_id") REFERENCES "player"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "player_social_relation" ADD CONSTRAINT "player_social_relation_target_player_id_fkey" FOREIGN KEY ("target_player_id") REFERENCES "player"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "player_social_feed" ADD CONSTRAINT "player_social_feed_player_id_fkey" FOREIGN KEY ("player_id") REFERENCES "player"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "player_social_feed" ADD CONSTRAINT "player_social_feed_actor_player_id_fkey" FOREIGN KEY ("actor_player_id") REFERENCES "player"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "player_assist_record" ADD CONSTRAINT "player_assist_record_helper_player_id_fkey" FOREIGN KEY ("helper_player_id") REFERENCES "player"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "player_assist_record" ADD CONSTRAINT "player_assist_record_target_player_id_fkey" FOREIGN KEY ("target_player_id") REFERENCES "player"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "team_challenge" ADD CONSTRAINT "team_challenge_initiator_player_id_fkey" FOREIGN KEY ("initiator_player_id") REFERENCES "player"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "team_challenge" ADD CONSTRAINT "team_challenge_ally_player_id_fkey" FOREIGN KEY ("ally_player_id") REFERENCES "player"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "team_challenge" ADD CONSTRAINT "team_challenge_target_player_id_fkey" FOREIGN KEY ("target_player_id") REFERENCES "player"("id") ON DELETE CASCADE ON UPDATE CASCADE;
